import { withinWakeWindowMinutes } from '../../engine/sleep';
import { defineInstrument, type InstrumentIssue, type InstrumentRecord } from '../framework';

export type TimeWindowRecord = Record<string, unknown> & { minutes: number };
export type TimeWindowParams = Record<string, unknown> & { targetTime: string; toleranceMinutes: number };

export function validateTimeWindowRecord(record: unknown, params: TimeWindowParams): InstrumentIssue[] {
  const minutes = record && typeof record === 'object' ? (record as Partial<TimeWindowRecord>).minutes : undefined;
  if (!Number.isInteger(minutes) || minutes! < 0 || minutes! >= 24 * 60) return [{ code: 'I-TIM-01', path: 'record.minutes', message: 'Time must be a minute of the day.' }];
  if (!/^\d{2}:\d{2}$/.test(params.targetTime) || !Number.isFinite(params.toleranceMinutes) || params.toleranceMinutes < 0) return [{ code: 'I-TIM-02', path: 'params', message: 'The target time and tolerance are invalid.' }];
  return [];
}
function stddev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}
export function timeWindowSignals(records: readonly InstrumentRecord<TimeWindowRecord>[], params: TimeWindowParams): Readonly<Record<string, number>> {
  const hits = records.filter((record) => withinWakeWindowMinutes(record.record.minutes, params.targetTime, params.toleranceMinutes));
  const values = records.map((record) => record.record.minutes);
  return {
    hit: hits.length,
    hit_days: new Set(hits.map((record) => record.localDate)).size,
    sd_minutes: stddev(values),
    mean_minutes: values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}
export const timeWindowInstrument = defineInstrument<TimeWindowParams, TimeWindowRecord>({
  type: 'time_window', validateRecord: validateTimeWindowRecord, signals: timeWindowSignals,
});
