// Loop 9.1: personaEventLog is deterministic and drives every instrument type with records the instruments accept.
import { describe, expect, it } from 'vitest';
import { resolveBlueprints } from '../../src/blueprint/resolve';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import type { InstrumentType, SystemBlueprint } from '../../src/blueprint/schema';
import { draftFromPreset, generateBlueprint } from '../../src/generator';
import type { DraftState } from '../../src/generator/types';
import { INSTRUMENT_DEFINITIONS } from '../../src/instruments/registry';
import { personaEventLog, type PersonaProfileKind } from './support/personaEventLog';

const CONTEXT = { lineageId: 'persona-arc', today: '2026-09-01', displayName: 'ADA', primaryObjective: 'Keep promises.', timezone: 'Asia/Kolkata', rhythm: { wakeTime: '07:00', sleepTime: '23:30' } };
const deps = { now: () => '2026-12-31T00:00:00.000Z', newId: () => 'persona-id' };

const engineer = generateBlueprint(draftFromPreset('software-engineer', CONTEXT)!).blueprint;

/** One custom domain per remaining instrument type, plus reading (study_block) and the guardrails. */
const mixed: DraftState = {
  lineageId: 'persona-mixed', today: '2026-09-01', identity: { displayName: 'ADA', primaryObjective: 'Everything.' },
  domains: [
    { archetypeId: 'custom:checklist', answers: { topic: 'Shutdown', items: ['Plan tomorrow', 'Clear desk'] } },
    { archetypeId: 'custom:time_window', answers: { topic: 'Cold shower', time: '06:15' } },
    { archetypeId: 'custom:threshold', answers: { topic: 'Pushups' } },
    { archetypeId: 'reading' },
    { archetypeId: 'exam-prep' },
    { archetypeId: 'custom:pipeline', answers: { topic: 'Outreach' } },
    { archetypeId: 'sleep-regularity' },
    { archetypeId: 'attention-control' },
  ],
  arc: { startDate: '2026-09-01', lengthDays: 90, timezone: 'Asia/Kolkata' },
};
const mixedBlueprint = generateBlueprint(mixed).blueprint;

const typesOf = (events: ReturnType<typeof personaEventLog>): Set<string> => new Set(events.filter((event) => event.type === 'INSTRUMENT_RECORDED').map((event) => String(event.payload.instrumentType)));

describe('personaEventLog', () => {
  it('both Systems generate cleanly, so the logs below are driven by real generated Blueprints', () => {
    for (const blueprint of [engineer, mixedBlueprint]) expect(blueprint.domains.length).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic: the same blueprint, seed and profile give the same log; another seed does not', () => {
    const a = personaEventLog(engineer, 7, { kind: 'steady', days: 30 });
    expect(personaEventLog(engineer, 7, { kind: 'steady', days: 30 })).toEqual(a);
    expect(personaEventLog(engineer, 8, { kind: 'steady', days: 30 })).not.toEqual(a);
  });

  it('ids sort chronologically and idem keys are unique', () => {
    const events = personaEventLog(engineer, 3, { kind: 'steady', days: 40 });
    const ids = events.map((event) => event.id);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(events.map((event) => event.idem_key)).size).toBe(events.length);
    const times = events.map((event) => Date.parse(event.occurred_at));
    expect(times.every((time) => Number.isFinite(time))).toBe(true);
  });

  it('drives every one of the nine instrument types, with records each instrument accepts', () => {
    const seen = new Set<string>();
    for (const blueprint of [engineer, mixedBlueprint]) {
      const events = personaEventLog(blueprint, 11, { kind: 'steady', days: 60 });
      for (const type of typesOf(events)) seen.add(type);
      for (const event of events.filter((candidate) => candidate.type === 'INSTRUMENT_RECORDED')) {
        const instrument = blueprint.instruments.find((candidate) => candidate.id === event.payload.instrumentId)!;
        const issues = INSTRUMENT_DEFINITIONS[instrument.type].validateRecord(event.payload.record, instrument.params);
        expect(issues, `${instrument.id}: ${JSON.stringify(event.payload.record)}`).toEqual([]);
      }
    }
    const all: InstrumentType[] = ['practice_item', 'pipeline', 'duration', 'session', 'threshold', 'time_window', 'artifact', 'study_block', 'checklist'];
    expect([...seen].sort()).toEqual([...all].sort());
  });

  it('is accepted by the replay path and rebuilds into projections that move', () => {
    for (const blueprint of [engineer, mixedBlueprint]) {
      const events = personaEventLog(blueprint, 5, { kind: 'steady', days: 45 });
      const { versions, rejected } = resolveBlueprints(events);
      expect(rejected).toEqual([]);
      expect(versions).toHaveLength(1);
      const built = buildProjectionsV2(events, deps);
      expect(built.instances.length).toBeGreaterThan(0);
      expect(built.playerState!.total_xp).toBeGreaterThan(1000);
      expect(built.instances.filter((instance) => instance.state === 'complete').length).toBeGreaterThan(built.instances.length / 2);
    }
  });

  it('steady keeps most days; lapsing has empty days and Reduced Mode; burst hits a cap; adversarial does the minimum', () => {
    const run = (kind: PersonaProfileKind) => {
      const events = personaEventLog(engineer, 21, { kind, days: 60 });
      return { events, built: buildProjectionsV2(events, deps) };
    };
    const rate = (r: ReturnType<typeof run>) => r.built.instances.filter((instance) => instance.state === 'complete').length / r.built.instances.length;
    const steady = run('steady');
    const lapsing = run('lapsing');
    const burst = run('burst');
    const adversarial = run('adversarial');

    expect(rate(steady)).toBeGreaterThan(0.7);
    expect(lapsing.built.dayRollups.some((day) => day.core_completed === 0)).toBe(true);
    expect(lapsing.built.dayRollups.some((day) => day.reduced_mode)).toBe(true);
    expect(rate(lapsing)).toBeLessThan(rate(steady));
    expect(burst.built.dayRollups.some((day) => day.xp_capped_away > 0)).toBe(true);
    expect(adversarial.events.filter((event) => event.type === 'INSTRUMENT_RECORDED').length).toBeGreaterThan(0);
    expect(adversarial.built.playerState!.total_xp).toBeLessThan(steady.built.playerState!.total_xp);
  });

  it('never exceeds the daily cap plus the uncapped grants, whatever the profile (I10)', () => {
    for (const kind of ['steady', 'burst', 'adversarial'] as const) {
      const built = buildProjectionsV2(personaEventLog(engineer, 33, { kind, days: 50 }), deps);
      const capped = new Map<string, number>();
      for (const row of built.ledger) capped.set(row.local_date, (capped.get(row.local_date) ?? 0) + row.amount);
      // The cap binds the capped sources; weekly quests (2 x 200), a boss (500) and a recovery (40) are frequency-limited instead.
      for (const [date, total] of capped) expect(total, `${kind} ${date}`).toBeLessThanOrEqual(engineer.progression.dailyCap + 40 + 500 + 200 * 2);
    }
  });

  it('uses the arc length when no days are given, and never more than it', () => {
    const short: SystemBlueprint = structuredClone(engineer);
    short.arc.lengthDays = 20;
    short.arc.endDate = '2026-09-20';
    expect(personaEventLog(short, 1).filter((event) => event.type === 'APP_OPENED')).toHaveLength(20);
    expect(personaEventLog(short, 1, { kind: 'steady', days: 999 }).filter((event) => event.type === 'APP_OPENED')).toHaveLength(20);
  });
});
