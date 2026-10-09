import { estimate1RM } from '../../engine/training';
import { defineInstrument, type InstrumentIssue, type InstrumentRecord } from '../framework';

export type SessionRecord = Record<string, unknown> & {
  sessionType: string;
  minutes: number;
  lifts?: readonly { name: string; weightKg: number; reps: number; est1Rm?: number }[];
};
export type SessionParams = Record<string, unknown> & { sessionTypes: readonly string[]; minMinutes?: number };

export function validateSessionRecord(record: unknown, params: SessionParams): InstrumentIssue[] {
  if (!record || typeof record !== 'object') return [{ code: 'I-SES-01', path: 'record', message: 'A session record must be an object.' }];
  const item = record as Partial<SessionRecord>;
  const issues: InstrumentIssue[] = [];
  if (!item.sessionType || !params.sessionTypes.includes(item.sessionType)) issues.push({ code: 'I-SES-02', path: 'record.sessionType', message: 'Choose a configured session type.' });
  if (!Number.isFinite(item.minutes) || (item.minutes ?? -1) < (params.minMinutes ?? 0)) issues.push({ code: 'I-SES-03', path: 'record.minutes', message: 'Session minutes are below the required minimum.' });
  if (item.lifts?.some((lift) => !lift.name || !Number.isFinite(lift.weightKg) || !Number.isFinite(lift.reps))) issues.push({ code: 'I-SES-04', path: 'record.lifts', message: 'Every lift needs a name, weight, and reps.' });
  return issues;
}

/** Same per-exercise earliest-to-latest aggregation as checkpoint evidence. */
export function strengthGainPct(records: readonly InstrumentRecord<SessionRecord>[]): number {
  const liftsByName = new Map<string, { localDate: string; est1Rm: number }[]>();
  for (const record of records) for (const lift of record.record.lifts ?? []) {
    const values = liftsByName.get(lift.name) ?? [];
    values.push({ localDate: record.localDate, est1Rm: lift.est1Rm ?? estimate1RM(lift.weightKg, lift.reps) });
    liftsByName.set(lift.name, values);
  }
  const gains: number[] = [];
  for (const samples of liftsByName.values()) {
    if (samples.length < 2) continue;
    const sorted = [...samples].sort((a, b) => a.localDate.localeCompare(b.localDate));
    const first = sorted[0]!.est1Rm;
    const last = sorted[sorted.length - 1]!.est1Rm;
    if (first > 0) gains.push((last - first) / first);
  }
  return gains.length === 0 ? 0 : gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
}

export function sessionSignals(records: readonly InstrumentRecord<SessionRecord>[]): Readonly<Record<string, number>> {
  return { count: records.length, minutes: records.reduce((sum, record) => sum + record.record.minutes, 0), strength_gain_pct: strengthGainPct(records) };
}

export const sessionInstrument = defineInstrument<SessionParams, SessionRecord>({
  type: 'session', validateRecord: validateSessionRecord, signals: sessionSignals,
});
