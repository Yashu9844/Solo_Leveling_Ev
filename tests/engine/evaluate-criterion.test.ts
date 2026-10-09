// platform/05 loop 4.1 — evaluateCriterion must agree with the legacy
// maybeComplete* firing conditions on every day of every corpus. The oracle
// below restates those conditions from the legacy TABLES (the rows the old
// store functions queried), so it shares nothing with the instrument path.
import { addDays, format, parseISO } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { evaluateCriterion, explainCriterion } from '../../src/blueprint/evaluate/criterion';
import { recordsFromEvents, signalEnv } from '../../src/blueprint/evaluate/env';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import { buildDomainTables, type DomainTables } from '../../src/db/domainProjections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { withinWakeWindowMinutes } from '../../src/engine/sleep';
import type { CareerSubstituteLoggedPayload, SystemEvent } from '../../src/engine/types';
import { legacyActivityLog } from './support/legacyActivityLog';
import { randomEventLog } from './support/randomEventLog';

const bp = LEGACY_BLUEPRINT_V1;
const KEYS = ['career', 'dsa', 'build', 'training', 'sleep', 'attention'] as const;

/** maybeCompleteCareerQuest / …DsaQuest / …BuildQuest / …TrainingQuest, findCoreInstance's sleep and attention checks. */
function legacyFires(key: (typeof KEYS)[number], date: string, tables: DomainTables, events: SystemEvent[]): boolean {
  const on = <T extends { local_date: string }>(rows: T[]) => rows.filter((row) => row.local_date === date);
  switch (key) {
    case 'career': {
      const quality = on(tables.applications).filter((a) => a.quality_pass).length;
      const minutes = events
        .filter((e) => e.type === 'CAREER_SUBSTITUTE_LOGGED' && e.local_date === date)
        .reduce((sum, e) => sum + ((e.payload as unknown as CareerSubstituteLoggedPayload).minutes ?? 0), 0);
      return quality >= 3 || minutes >= 25;
    }
    case 'dsa': {
      const attempts = on(tables.dsaAttempts).filter((a) => !a.is_revisit);
      return attempts.length >= 1 || attempts.reduce((sum, a) => sum + a.minutes, 0) >= 25;
    }
    case 'build': return on(tables.buildSessions).reduce((sum, s) => sum + s.minutes, 0) >= 45;
    case 'training':
      return on(tables.trainingSessions).length >= 1 || on(tables.metricSamples).filter((m) => m.kind === 'steps').reduce((sum, m) => sum + m.value, 0) >= 8000;
    case 'sleep': return on(tables.metricSamples).some((m) => m.kind === 'wake_time' && withinWakeWindowMinutes(m.value, DEFAULT_CONFIG.wakeTargetTime, 30));
    case 'attention': return on(tables.metricSamples).some((m) => m.kind === 'screen_time_min' && m.value <= 60);
  }
}

function datesOf(events: SystemEvent[]): string[] {
  const last = events.reduce((max, e) => (e.local_date > max ? e.local_date : max), DEFAULT_CONFIG.arc.startDate);
  const dates: string[] = [];
  for (let d = DEFAULT_CONFIG.arc.startDate; d <= last; d = format(addDays(parseISO(d), 1), 'yyyy-MM-dd')) dates.push(d);
  return dates;
}

/** Returns [quest-days compared, quest-days where the quest was met]. */
function assertAgreement(events: SystemEvent[]): [number, number] {
  const tables = buildDomainTables(events, DEFAULT_CONFIG);
  const records = recordsFromEvents(events);
  let compared = 0;
  let met = 0;
  for (const date of datesOf(events)) {
    const env = signalEnv(bp, records, date);
    for (const key of KEYS) {
      const quest = bp.quests.find((q) => q.id === key)!;
      const v2 = evaluateCriterion(quest.criterion, env).met;
      const legacy = legacyFires(key, date, tables, events);
      if (v2 !== legacy) throw new Error(`${key} on ${date}: criterion=${v2}, legacy=${legacy}`);
      compared++;
      if (v2) met++;
    }
  }
  return [compared, met];
}

describe('evaluateCriterion (loop 4.1)', () => {
  it('agrees with the legacy completion conditions on every day of the golden 120-day log', () => {
    const [compared, met] = assertAgreement(legacyActivityLog({ seed: 42, days: 120 }));
    expect(compared).toBeGreaterThan(700);
    expect(met).toBeGreaterThan(300); // the corpus really exercises both outcomes
    expect(compared - met).toBeGreaterThan(50);
  });

  it('agrees over 80 more seeds, including heavy lapsing', () => {
    let compared = 0;
    for (let seed = 1; seed <= 80; seed++) compared += assertAgreement(legacyActivityLog({ seed, days: 45, skipRate: 0.25 }))[0];
    expect(compared).toBeGreaterThan(20_000);
  });

  it('agrees over 200 raw-event fuzz logs', () => {
    for (let seed = 1; seed <= 200; seed++) assertAgreement(randomEventLog(seed));
  });

  describe('edge cases the legacy conditions define', () => {
    const base = { arc_id: 'a', source: 'user' as const, schema_v: 1, local_date: '2026-09-02' };
    let n = 0;
    const ev = (type: SystemEvent['type'], payload: object): SystemEvent => ({
      ...base, id: `e${String(n++).padStart(3, '0')}`, type, occurred_at: `2026-09-02T0${4 + (n % 5)}:00:00Z`, payload: payload as Record<string, unknown>, idem_key: `k${n}`,
    });
    const run = (events: SystemEvent[], key: (typeof KEYS)[number]) =>
      evaluateCriterion(bp.quests.find((q) => q.id === key)!.criterion, signalEnv(bp, recordsFromEvents(events), '2026-09-02'));

    it('steps add up across logs: 5,000 + 3,000 completes training; 5,000 + 2,999 does not', () => {
      expect(run([ev('STEPS_LOGGED', { steps: 5000 }), ev('STEPS_LOGGED', { steps: 3000 })], 'training').met).toBe(true);
      expect(run([ev('STEPS_LOGGED', { steps: 5000 }), ev('STEPS_LOGGED', { steps: 2999 })], 'training').met).toBe(false);
    });
    it('a revisit alone never completes DSA, even past 25 minutes', () => {
      expect(run([ev('PROBLEM_REVISITED', { problemId: 'p', outcome: 'first_attempt', minutes: 40 })], 'dsa').met).toBe(false);
      expect(run([ev('PROBLEM_LOGGED', { problemId: 'p', slug: 's', title: 't', topic: 'DP', difficulty: 'E', outcome: 'unsolved', minutes: 1 })], 'dsa').met).toBe(true);
    });
    it('24 + 1 substitute minutes complete CAREER; 24 do not', () => {
      expect(run([ev('CAREER_SUBSTITUTE_LOGGED', { minutes: 24, kind: 'mock' }), ev('CAREER_SUBSTITUTE_LOGGED', { minutes: 1, kind: 'mock' })], 'career').met).toBe(true);
      expect(run([ev('CAREER_SUBSTITUTE_LOGGED', { minutes: 24, kind: 'mock' })], 'career').met).toBe(false);
    });
    it('one in-window wake log counts even after an out-of-window one; screen time needs one log at or under 60', () => {
      expect(run([ev('SLEEP_LOGGED', { wakeTime: '11:00' }), ev('SLEEP_LOGGED', { wakeTime: '08:00' })], 'sleep').met).toBe(true);
      expect(run([ev('SLEEP_LOGGED', { wakeTime: '09:01' })], 'sleep').met).toBe(false);
      expect(run([ev('SCREENTIME_LOGGED', { minutes: 61 })], 'attention').met).toBe(false);
      expect(run([ev('SCREENTIME_LOGGED', { minutes: 90 }), ev('SCREENTIME_LOGGED', { minutes: 60 })], 'attention').met).toBe(true);
    });
  });

  describe('progress and explanation', () => {
    it('gives the quest row a partial meter and says what is left', () => {
      const events = legacyActivityLog({ seed: 5, days: 20 });
      const env = signalEnv(bp, recordsFromEvents(events), '2026-09-10');
      const build = bp.quests.find((q) => q.id === 'build')!;
      const result = evaluateCriterion(build.criterion, env);
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(1);
      expect(result.met).toBe(result.progress === 1);
      expect(explainCriterion(build.criterion, env)[0]).toContain('build.sessions.minutes');
    });
    it('any = best branch, all = mean of branches', () => {
      const env = signalEnv(bp, new Map(), '2026-09-02');
      const leaf = (target: number) => ({ kind: 'signal' as const, instrumentId: 'build.sessions', signal: 'minutes', comparator: '>=' as const, target });
      expect(evaluateCriterion({ kind: 'any', of: [leaf(10), leaf(20)] }, env)).toMatchObject({ met: false, progress: 0 });
      expect(evaluateCriterion({ kind: 'all', of: [] }, env)).toMatchObject({ met: true, progress: 1 });
    });
  });
});
