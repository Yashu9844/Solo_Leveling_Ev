import { defineInstrument, type InstrumentIssue, type InstrumentRecord } from '../framework';

export type ThresholdRecord = Record<string, unknown> & { value: number };
export type ThresholdParams = Record<string, unknown> & { unit: string; comparator: '>=' | '<='; target: number; bonusAt?: number };

export function validateThresholdRecord(record: unknown): InstrumentIssue[] {
  if (!record || typeof record !== 'object' || !Number.isFinite((record as Partial<ThresholdRecord>).value)) return [{ code: 'I-THR-01', path: 'record.value', message: 'A finite numeric value is required.' }];
  return [];
}
export function thresholdHit(value: number, params: ThresholdParams): boolean {
  return params.comparator === '>=' ? value >= params.target : value <= params.target;
}
export function thresholdSignals(records: readonly InstrumentRecord<ThresholdRecord>[], params: ThresholdParams): Readonly<Record<string, number>> {
  const hitRecords = records.filter((record) => thresholdHit(record.record.value, params));
  return {
    hit: hitRecords.length,
    hit_days: new Set(hitRecords.map((record) => record.localDate)).size,
    mean_value: records.length === 0 ? 0 : records.reduce((sum, record) => sum + record.record.value, 0) / records.length,
    days_logged: new Set(records.map((record) => record.localDate)).size,
  };
}
export const thresholdInstrument = defineInstrument<ThresholdParams, ThresholdRecord>({
  type: 'threshold', validateRecord: validateThresholdRecord, signals: thresholdSignals,
});
