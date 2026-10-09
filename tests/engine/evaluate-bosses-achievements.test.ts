// platform/05 loop 4.6 — the Blueprint boss, achievement and identity
// evaluators against the live getBossStatus and getAchievementsReport (E2).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { evaluateAchievements } from '../../src/blueprint/evaluate/achievement';
import { evaluateBoss, evaluateBosses } from '../../src/blueprint/evaluate/boss';
import { readModelEnv } from '../../src/blueprint/evaluate/readModel';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import type { CheckpointRow } from '../../src/db/schema';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { BOSSES } from '../../src/engine/boss';
import type { SystemEvent } from '../../src/engine/types';
import { getAchievementsReport } from '../../src/store/achievements';
import { getBossStatus } from '../../src/store/boss';
import { dateAt, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';
import { randomEventLog } from './support/randomEventLog';

const bp = LEGACY_BLUEPRINT_V1;

function sealed(day: number): CheckpointRow {
  return {
    id: `cp-${day}`, day, export_verified: true, metrics: {}, self_efficacy: {}, automaticity: {}, enjoyment: {}, rank_before: 'E',
    gates: {}, controlled: {}, external: {}, quest_templates_snapshot: {}, sealed_at: '2026-10-01T00:00:00Z', rank_after: 'D',
  };
}

async function assertAgree(events: SystemEvent[], today: string, rows: CheckpointRow[], label: string) {
  const prefix = prefixOf(events, today);
  await loadLegacyDb(prefix, today, rows);
  const env = readModelEnv({ blueprint: bp, events: prefix, checkpoints: rows, asOf: today });
  const legacyBosses = await Promise.all(BOSSES.map((boss) => getBossStatus(boss.id, today)));
  expect(evaluateBosses(bp.bosses, env, prefix), `${label} bosses`).toEqual(legacyBosses);
  expect(evaluateAchievements(bp, env), `${label} achievements`).toEqual(await getAchievementsReport(today, DEFAULT_CONFIG));
  return { bosses: legacyBosses, report: await getAchievementsReport(today, DEFAULT_CONFIG) };
}

describe('boss, achievement and identity evaluators (loop 4.6)', () => {
  const golden = legacyActivityLog({ seed: 42, days: 120 });

  it('reproduce getBossStatus and getAchievementsReport on the golden log across the arc', async () => {
    const earned = new Set<string>();
    const cleared = new Set<string>();
    for (const offset of [0, 6, 13, 24, 29, 34, 49, 59, 74, 89, 99, 104, 119]) {
      const { bosses, report } = await assertAgree(golden, dateAt(offset), [], `day ${offset + 1}`);
      for (const boss of bosses) if (boss.cleared) cleared.add(boss.boss.id);
      for (const item of [...report.achievements, ...report.identities]) if (item.earned) earned.add(item.id);
    }
    expect(earned.size).toBeGreaterThan(4); // the log earns a real mix, so "earned" is genuinely tested
    expect(earned.size).toBeLessThan(13);
  }, 300_000);

  it('honours sealed checkpoints (Boss I needs Day 30 sealed, The Arc needs Day 120 sealed)', async () => {
    const today = dateAt(119);
    const without = await assertAgree(golden, today, [], 'no seals');
    const withSeals = await assertAgree(golden, today, [14, 30, 60, 90, 120].map(sealed), 'all sealed');
    expect(without.report.achievements.find((a) => a.id === 'the_arc')!.earned).toBe(false);
    expect(withSeals.report.achievements.find((a) => a.id === 'the_arc')!.earned).toBe(true);
  }, 120_000);

  it('treats a formally cleared boss as cleared even when its conditions are no longer met', async () => {
    const withClear: SystemEvent[] = [
      ...golden,
      { id: 'zz-boss', type: 'BOSS_CLEARED', occurred_at: `${dateAt(70)}T05:00:00Z`, local_date: dateAt(70), arc_id: 'legacy-arc', payload: { bossId: 'III' }, source: 'user', idem_key: 'boss:III', schema_v: 1 },
    ];
    const { bosses } = await assertAgree(withClear, dateAt(80), [], 'formal clear');
    expect(bosses.find((b) => b.boss.id === 'III')!.cleared).toBe(true);
  }, 120_000);

  it('agrees on raw fuzz logs, which contain BOSS_CLEARED events and almost no domain data', async () => {
    for (const seed of [1, 2, 3, 4]) {
      const events = randomEventLog(seed, 40);
      await assertAgree(events, events.reduce((max, e) => (e.local_date > max ? e.local_date : max), events[0]!.local_date), [], `fuzz ${seed}`);
    }
  }, 120_000);

  it('a boss window opens at its start day and never closes; it cannot be failed', () => {
    const env = readModelEnv({ blueprint: bp, events: prefixOf(golden, dateAt(10)), checkpoints: [], asOf: dateAt(10) });
    const first = evaluateBoss(bp.bosses[0]!, env, golden);
    expect(first.windowOpen).toBe(false); // day 11 < 25
    const late = readModelEnv({ blueprint: bp, events: prefixOf(golden, dateAt(119)), checkpoints: [], asOf: dateAt(119) });
    expect(evaluateBoss(bp.bosses[0]!, late, golden).windowOpen).toBe(true); // far past its end day 35
  });

  it('splits achievements from identities by kind and keeps the legacy order', () => {
    const env = readModelEnv({ blueprint: bp, events: golden, checkpoints: [], asOf: dateAt(119) });
    const report = evaluateAchievements(bp, env);
    expect(report.achievements.map((a) => a.id)).toEqual(['first_move', 'two_weeks', 'century', 'shipped', 'return', 'regular', 'in_public', 'the_arc']);
    expect(report.identities.map((a) => a.id)).toEqual(['problem_solver', 'builder', 'consistent', 'trains', 'keeps_promises']);
  });
});
