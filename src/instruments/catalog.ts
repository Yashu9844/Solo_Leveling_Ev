import type { InstrumentType } from '../blueprint/schema';

export type SignalKind = 'effort' | 'performance';
export interface InstrumentCatalogueEntry {
  type: InstrumentType;
  signals: Readonly<Record<string, SignalKind>>;
  requiredParams: readonly string[];
  numericBounds: Readonly<Record<string, { min: number; max: number }>>;
  minRecordsPerDay?: number;
}

/** The finite contract between Blueprint data and instrument implementations. */
export const INSTRUMENT_CATALOGUE: Readonly<Record<InstrumentType, InstrumentCatalogueEntry>> = {
  practice_item: {
    type: 'practice_item', requiredParams: ['topics', 'difficultyScale', 'outcomes'], numericBounds: { bonusXp: { min: 0, max: 60 }, maxRevisitsPerDay: { min: 1, max: 10 } },
    signals: { count: 'effort', weighted_volume: 'effort', minutes: 'effort', first_attempt_rate: 'performance', revisit_success_rate: 'performance', topic_mastery: 'performance', record_first_attempt_at_top_difficulty: 'performance' },
  },
  pipeline: {
    type: 'pipeline', requiredParams: ['stages', 'qualityGate'], numericBounds: { followupAfterDays: { min: 1, max: 30 } },
    signals: { submitted: 'effort', quality_count: 'effort', quality_rate: 'performance', followthrough_rate: 'performance', stage_counts: 'performance' },
  },
  duration: {
    type: 'duration', requiredParams: [], numericBounds: { minBlockMinutes: { min: 1, max: 480 } },
    signals: { minutes: 'effort', mean_daily_minutes: 'effort', mean_block_len: 'effort', longest_block: 'effort', mode_counts: 'effort', input_output_ratio: 'performance' },
  },
  session: {
    type: 'session', requiredParams: ['sessionTypes'], numericBounds: { minMinutes: { min: 1, max: 480 } },
    signals: { count: 'effort', minutes: 'effort', strength_gain_pct: 'performance' },
  },
  threshold: {
    type: 'threshold', requiredParams: ['unit', 'comparator', 'target'], numericBounds: { target: { min: 0, max: 1_000_000 }, bonusAt: { min: 0, max: 1_000_000 } },
    signals: { hit: 'effort', hit_days: 'effort', mean_value: 'effort', days_logged: 'effort' },
  },
  time_window: {
    type: 'time_window', requiredParams: ['targetTime', 'toleranceMinutes'], numericBounds: { toleranceMinutes: { min: 0, max: 240 } },
    signals: { hit: 'effort', hit_days: 'effort', sd_minutes: 'performance', mean_minutes: 'effort' },
  },
  artifact: {
    type: 'artifact', requiredParams: ['kinds'], numericBounds: { bonusXp: { min: 0, max: 100 } },
    signals: { count: 'effort', projects_with: 'effort', first_of_kind: 'performance' },
  },
  study_block: {
    type: 'study_block', requiredParams: ['topics'], numericBounds: { blockXp: { min: 0, max: 100 }, maxPerDay: { min: 1, max: 10 } },
    signals: { blocks: 'effort', minutes: 'effort', mode_counts: 'effort', topic_mastery: 'performance' },
  },
  checklist: {
    type: 'checklist', requiredParams: ['items'], numericBounds: {}, signals: { all_done_days: 'effort' },
  },
};

export function isKnownInstrumentSignal(type: InstrumentType, signal: string): boolean {
  return Object.hasOwn(INSTRUMENT_CATALOGUE[type].signals, signal);
}
