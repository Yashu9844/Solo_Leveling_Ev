import { learnShipRatio, learnShipRuleFires, type BuildSessionFixture } from '../../engine/build';
import { defineInstrument, type InstrumentEvaluationContext, type InstrumentIssue, type InstrumentRecord } from '../framework';

export type DurationRecord = Record<string, unknown> & {
  minutes: number;
  mode?: string;
  projectKey?: string;
};

export type DurationParams = Record<string, unknown> & { minBlockMinutes?: number };

export function validateDurationRecord(record: unknown, params: DurationParams): InstrumentIssue[] {
  if (!record || typeof record !== 'object') return [{ code: 'I-DUR-01', path: 'record', message: 'A duration record must be an object.' }];
  const candidate = record as Partial<DurationRecord>;
  if (!Number.isFinite(candidate.minutes) || (candidate.minutes ?? -1) < 0) return [{ code: 'I-DUR-02', path: 'record.minutes', message: 'Minutes must be a non-negative number.' }];
  if (params.minBlockMinutes !== undefined && candidate.minutes! < params.minBlockMinutes) return [{ code: 'I-DUR-03', path: 'record.minutes', message: 'The block is below this instrument’s minimum duration.' }];
  return [];
}

function sessions(records: readonly InstrumentRecord<DurationRecord>[]): BuildSessionFixture[] {
  return records.flatMap((record) => record.record.mode === 'LEARN' || record.record.mode === 'SHIP'
    ? [{ local_date: record.localDate, mode: record.record.mode }]
    : []);
}

/** Legacy-equivalent duration and build-mode facts. */
export function durationSignals(records: readonly InstrumentRecord<DurationRecord>[], context: InstrumentEvaluationContext): Readonly<Record<string, number>> {
  const totalMinutes = records.reduce((sum, record) => sum + record.record.minutes, 0);
  const dates = new Set(records.map((record) => record.localDate));
  const modes = sessions(records);
  const requestedMode = context.filter?.mode;
  const modeCount = requestedMode ? modes.filter((session) => session.mode === requestedMode).length : modes.length;
  return {
    minutes: totalMinutes,
    mean_daily_minutes: dates.size === 0 ? 0 : totalMinutes / dates.size,
    mean_block_len: records.length === 0 ? 0 : totalMinutes / records.length,
    longest_block: records.reduce((max, record) => Math.max(max, record.record.minutes), 0),
    mode_counts: modeCount,
    input_output_ratio: learnShipRatio(modes),
  };
}

export function durationLearnShipRuleFires(records: readonly InstrumentRecord<DurationRecord>[]): boolean {
  return learnShipRuleFires(sessions(records));
}

export const durationInstrument = defineInstrument<DurationParams, DurationRecord>({
  type: 'duration',
  validateRecord: validateDurationRecord,
  signals: (records, _params, context) => durationSignals(records, context),
});
