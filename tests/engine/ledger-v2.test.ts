// platform/05 loop 4.2 — the Blueprint-driven XP ledger must equal
// computeDayLedger's rows (amount, category, reason, capped_from, ids and
// order) on every corpus. This is E1 on the ledger (platform/02 §22.2).
import { describe, expect, it } from 'vitest';
import { recordsFromEvents } from '../../src/blueprint/evaluate/env';
import { computeDayLedgerV2, grantForRecord, ledgerRowsV2 } from '../../src/blueprint/evaluate/ledger';
import { LEGACY_BLUEPRINT_V1, legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { buildProjections } from '../../src/db/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { applyEvents } from '../../src/engine/reduce';
import type { SystemEvent } from '../../src/engine/types';
import { legacyActivityLog } from './support/legacyActivityLog';
import { fuzzDeps, mulberry32, randomEventLog } from './support/randomEventLog';

const bp = LEGACY_BLUEPRINT_V1;

/** randomEventLog plus, every day, far more XP events than any cap allows. */
function capStressLog(seed: number): SystemEvent[] {
  const events = randomEventLog(seed, 12);
  const arc = events[0]!;
  const rand = mulberry32(seed * 7919);
  let n = 0;
  const push = (type: SystemEvent['type'], localDate: string, payload: object, minute: number) => events.push({
    id: `stress-${seed}-${n++}`, type, occurred_at: `${localDate}T${String(10 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00Z`,
    local_date: localDate, arc_id: arc.arc_id, payload: payload as Record<string, unknown>, source: 'user', idem_key: `stress-${seed}-${n}`, schema_v: 1,
  });
  const days = [...new Set(events.filter((e) => e.type === 'APP_OPENED').map((e) => e.local_date))];
  for (const day of days) {
    let minute = 0;
    const many = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    for (let i = 0; i < many(2, 7); i++) push('LEARNING_BLOCK_LOGGED', day, { topic: 'Networking', minutes: 15 }, minute += 3);
    for (let i = 0; i < many(4, 12); i++) push('PROBLEM_REVISITED', day, { problemId: `p-${i}`, outcome: 'first_attempt', minutes: 10 }, minute += 3);
    for (let i = 0; i < many(2, 6); i++) push('ARTIFACT_SHIPPED', day, { artifactId: `a-${n}`, kind: 'feature', title: 't', projectKey: 'k' }, minute += 3);
    for (let i = 0; i < many(1, 3); i++) push('STEPS_LOGGED', day, { localDate: day, steps: 10000 + i }, minute += 3);
    for (let i = 0; i < many(1, 3); i++) push('SYSTEM_DESIGN_LOGGED', day, { system: 'Feed', mode: 'studied', minutes: 40 }, minute += 3);
    for (let i = 0; i < many(1, 2); i++) push('MAINTENANCE_LOGGED', day, { localDate: day, bath: true, fuel: true, laundry: true, allDone: true }, minute += 3);
  }
  return events;
}

function v2Ledger(events: SystemEvent[]) {
  const state = applyEvents(events, DEFAULT_CONFIG);
  return ledgerRowsV2(bp, events, state.quests, recordsFromEvents(events));
}
function legacyLedger(events: SystemEvent[]) {
  return buildProjections(events, DEFAULT_CONFIG, fuzzDeps).ledger;
}

describe('computeDayLedgerV2 (loop 4.2)', () => {
  it('reproduces the legacy ledger row for row on the golden 120-day log', () => {
    const events = legacyActivityLog({ seed: 42, days: 120 });
    const legacy = legacyLedger(events);
    expect(v2Ledger(events)).toEqual(legacy);
    // The corpus exercises every channel (caps are stressed separately below).
    const categories = new Set(legacy.map((row) => row.category));
    for (const wanted of ['CAREER', 'MIND', 'CRAFT', 'BODY', 'SLEEP', 'ATTENTION', 'LEARN', 'MAINT', 'BONUS']) expect(categories.has(wanted as never), wanted).toBe(true);
  });

  it('matches over 100 more activity seeds', () => {
    let rows = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const events = legacyActivityLog({ seed, days: 60, skipRate: 0.15 });
      const legacy = legacyLedger(events);
      expect(v2Ledger(events), `seed ${seed}`).toEqual(legacy);
      rows += legacy.length;
    }
    expect(rows).toBeGreaterThan(5_000);
  });

  it('matches over 300 raw-event fuzz logs', () => {
    for (let seed = 1; seed <= 300; seed++) expect(v2Ledger(randomEventLog(seed)), `seed ${seed}`).toEqual(legacyLedger(randomEventLog(seed)));
  });

  it('matches when days are stuffed past every channel cap and the daily cap', () => {
    let trimmed = 0;
    let dailyTrimmed = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const events = capStressLog(seed);
      const legacy = legacyLedger(events);
      expect(v2Ledger(events), `seed ${seed}`).toEqual(legacy);
      trimmed += legacy.filter((row) => row.capped_from !== undefined).length;
      dailyTrimmed += legacy.filter((row) => row.capped_from !== undefined && row.amount > 0).length;
    }
    expect(trimmed).toBeGreaterThan(500);
    expect(dailyTrimmed).toBeGreaterThan(20); // partially trimmed, not only zeroed
  });

  it('every legacy reason is produced from the Blueprint', () => {
    const reasons = new Set<string>();
    for (const seed of [42, 7, 11, 19]) for (const row of v2Ledger(legacyActivityLog({ seed, days: 120 }))) reasons.add(row.reason);
    for (const wanted of ['core:career', 'core:dsa', 'core:build', 'core:training', 'core:sleep', 'core:attention', 'revisit', 'ship', 'learning_block', 'system_design', 'steps_bonus', 'maintenance', 'recovery']) {
      expect(reasons.has(wanted), wanted).toBe(true);
    }
  });

  it('trims by channel cap, then by the daily cap, and never pays negative XP', () => {
    const intent = (n: number, channel: string, amount: number) => ({ eventId: `e${n}`, occurredAt: `2026-09-02T0${n}:00:00Z`, localDate: '2026-09-02', channel, amount, reason: 'x' });
    // LEARN's cap is 75: the fourth 25 is trimmed to 0.
    const learn = computeDayLedgerV2(bp, [1, 2, 3, 4].map((n) => intent(n, 'LEARN', 25)));
    expect(learn.map((e) => e.amount)).toEqual([25, 25, 25, 0]);
    expect(learn[3]!.cappedFrom).toBe(25);
    // Daily cap 700: after 650 of capped XP, a 100 grant is trimmed to 50 by the daily cap.
    const day = computeDayLedgerV2(bp, [intent(1, 'MIND', 200), intent(2, 'CRAFT', 200), intent(3, 'BODY', 150), intent(4, 'CAREER', 100), intent(5, 'SLEEP', 60)]);
    expect(day.map((e) => e.amount)).toEqual([200, 200, 150, 100, 50]);
    expect(day[4]!.cappedFrom).toBe(60);
    // BONUS and BOSS bypass both caps.
    const exempt = computeDayLedgerV2(bp, [intent(1, 'MIND', 200), intent(2, 'CRAFT', 200), intent(3, 'BODY', 150), intent(4, 'CAREER', 140), intent(5, 'BOSS', 500)]);
    expect(exempt[4]).toMatchObject({ amount: 500 });
    expect(exempt[4]!.cappedFrom).toBeUndefined();
  });

  it('pays grants only where the instrument parameters say so', () => {
    const steps = bp.instruments.find((i) => i.id === 'training.steps')!;
    const make = (value: number) => ({ id: 'r', instrumentId: steps.id, instrumentType: steps.type, domainId: 'training', localDate: '2026-09-02', eventId: 'e', blueprintVersion: 1, record: { value } });
    expect(grantForRecord(steps, make(9999))).toBeNull();
    expect(grantForRecord(steps, make(10000))).toEqual({ amount: 20, reason: 'steps_bonus' });
    const dsa = bp.instruments.find((i) => i.id === 'dsa.problems')!;
    const attempt = (isRevisit: boolean) => ({ id: 'r', instrumentId: dsa.id, instrumentType: dsa.type, domainId: 'dsa', localDate: '2026-09-02', eventId: 'e', blueprintVersion: 1, record: { isRevisit } });
    expect(grantForRecord(dsa, attempt(false))).toBeNull();
    expect(grantForRecord(dsa, attempt(true))).toEqual({ amount: 20, reason: 'revisit' });
  });

  it('follows a changed Blueprint: a new cap or amount changes the ledger, a rename does not', () => {
    const events = legacyActivityLog({ seed: 42, days: 60 });
    const state = applyEvents(events, DEFAULT_CONFIG);
    const rows = (blueprint: typeof bp) => ledgerRowsV2(blueprint, events, state.quests, recordsFromEvents(events));
    const base = rows(bp);
    const renamed = legacyBlueprintFor(OWNER_ARC_DEFAULTS);
    renamed.domains[1]!.name = 'Puzzles';
    renamed.domains[1]!.designation = 'RIDDLE';
    expect(rows(renamed)).toEqual(base);
    const tighter = legacyBlueprintFor(OWNER_ARC_DEFAULTS);
    tighter.domains.find((d) => d.id === 'dsa')!.channel.cap = 100;
    expect(rows(tighter)).not.toEqual(base);
  });
});
