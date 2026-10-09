import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { estimate1RM } from '../../src/engine/training';
import { withinWakeWindowMinutes } from '../../src/engine/sleep';
import { sessionSignals, validateSessionRecord, type SessionRecord } from '../../src/instruments/types/session';
import { thresholdHit, thresholdSignals, validateThresholdRecord } from '../../src/instruments/types/threshold';
import { timeWindowSignals, validateTimeWindowRecord } from '../../src/instruments/types/timeWindow';
import type { InstrumentRecord } from '../../src/instruments/framework';

function record<T extends Record<string, unknown>>(instrumentType: InstrumentRecord<T>['instrumentType'], localDate: string, value: T, id: number): InstrumentRecord<T> {
  return { id: `${instrumentType}-${id}`, eventId: `event-${id}`, instrumentId: `test.${instrumentType}`, instrumentType, domainId: 'test', blueprintVersion: 1, localDate, record: value };
}
function legacyStrengthGain(records: readonly InstrumentRecord<SessionRecord>[]): number {
  const byName = new Map<string, { date: string; value: number }[]>();
  for (const session of records) for (const lift of session.record.lifts ?? []) {
    const list = byName.get(lift.name) ?? [];
    list.push({ date: session.localDate, value: lift.est1Rm ?? estimate1RM(lift.weightKg, lift.reps) }); byName.set(lift.name, list);
  }
  const gains = [...byName.values()].flatMap((values) => {
    if (values.length < 2) return [];
    const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[0]!.value > 0 ? [(sorted[sorted.length - 1]!.value - sorted[0]!.value) / sorted[0]!.value] : [];
  });
  return gains.length ? gains.reduce((sum, value) => sum + value, 0) / gains.length : 0;
}
function legacyWakeSd(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

describe('session, threshold, and time_window instruments (loop 3.5)', () => {
  it('validates each bounded record contract', () => {
    expect(validateSessionRecord({ sessionType: 'strength', minutes: 45 }, { sessionTypes: ['strength'], minMinutes: 15 })).toEqual([]);
    expect(validateThresholdRecord({ value: Number.NaN })).toHaveLength(1);
    expect(validateTimeWindowRecord({ minutes: 510 }, { targetTime: '08:30', toleranceMinutes: 30 })).toEqual([]);
  });
  it('matches Epley, threshold, and wake-window behavior over 10,000 corpora', () => {
    const sessionArb = fc.record({ localDate: fc.integer({ min: 1, max: 28 }).map((day) => `2026-09-${String(day).padStart(2, '0')}`), minutes: fc.integer({ min: 1, max: 180 }), weightKg: fc.integer({ min: 1, max: 200 }), reps: fc.integer({ min: 0, max: 20 }), name: fc.constantFrom('squat', 'bench') });
    const timeArb = fc.record({ localDate: fc.integer({ min: 1, max: 28 }).map((day) => `2026-09-${String(day).padStart(2, '0')}`), minutes: fc.integer({ min: 0, max: 1439 }) });
    fc.assert(fc.property(fc.array(sessionArb, { maxLength: 30 }), fc.array(timeArb, { maxLength: 30 }), fc.array(fc.integer({ min: 0, max: 20_000 }), { maxLength: 30 }), (sessions, times, values) => {
      const sessionRecords = sessions.map((session, id) => record('session', session.localDate, { sessionType: 'strength', minutes: session.minutes, lifts: [{ name: session.name, weightKg: session.weightKg, reps: session.reps, est1Rm: estimate1RM(session.weightKg, session.reps) }] }, id));
      expect(sessionSignals(sessionRecords).strength_gain_pct).toBe(legacyStrengthGain(sessionRecords));
      const params = { unit: 'steps', comparator: '>=' as const, target: 8000 };
      const thresholds = values.map((value, id) => record('threshold', `2026-09-${String((id % 28) + 1).padStart(2, '0')}`, { value }, id));
      expect(thresholdSignals(thresholds, params).hit).toBe(values.filter((value) => thresholdHit(value, params)).length);
      const timeRecords = times.map((time, id) => record('time_window', time.localDate, { minutes: time.minutes }, id));
      const windowParams = { targetTime: '08:30', toleranceMinutes: 30 };
      expect(timeWindowSignals(timeRecords, windowParams).hit).toBe(times.filter((time) => withinWakeWindowMinutes(time.minutes, '08:30', 30)).length);
      expect(timeWindowSignals(timeRecords, windowParams).sd_minutes).toBe(legacyWakeSd(times.map((time) => time.minutes)));
    }), { numRuns: 10_000 });
  });
});
