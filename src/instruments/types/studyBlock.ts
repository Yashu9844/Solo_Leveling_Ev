import { differenceInCalendarDays, parseISO } from 'date-fns';
import { FOUNDATION_MASTERY_POINTS } from '../../engine/foundations';
import type { MasteryState } from '../../engine/types';
import { defineInstrument, type InstrumentEvaluationContext, type InstrumentIssue, type InstrumentRecord } from '../framework';

export type StudyBlockRecord = Record<string, unknown> & {
  topic: string;
  minutes: number;
  mode?: string;
};

/** Mirrors the `block_count` skill policy in the Blueprint schema. */
export interface BlockCountPolicy {
  introducedAt: number;
  appliedAt: number;
  fluentAt: number;
  retainedGapDays: number;
}

/** engine/foundations.ts's thresholds: Introduced 1 · Applied 3 · Fluent 5 · Retained +21 days. */
export const LEGACY_BLOCK_COUNT_POLICY: BlockCountPolicy = { introducedAt: 1, appliedAt: 3, fluentAt: 5, retainedGapDays: 21 };

export type StudyBlockParams = Record<string, unknown> & {
  topics: readonly string[];
  mastery?: BlockCountPolicy;
};

export function validateStudyBlockRecord(record: unknown, params: StudyBlockParams): InstrumentIssue[] {
  if (!record || typeof record !== 'object') return [{ code: 'I-STU-01', path: 'record', message: 'A study block must be an object.' }];
  const candidate = record as Partial<StudyBlockRecord>;
  const issues: InstrumentIssue[] = [];
  if (!candidate.topic || typeof candidate.topic !== 'string' || !params.topics.includes(candidate.topic)) issues.push({ code: 'I-STU-02', path: 'record.topic', message: 'Choose a configured topic.' });
  if (!Number.isFinite(candidate.minutes) || (candidate.minutes ?? -1) < 0) issues.push({ code: 'I-STU-03', path: 'record.minutes', message: 'Minutes must be a non-negative number.' });
  if (candidate.mode !== undefined && typeof candidate.mode !== 'string') issues.push({ code: 'I-STU-04', path: 'record.mode', message: 'The mode must be text.' });
  return issues;
}

/** Block-count mastery for one topic. With LEGACY_BLOCK_COUNT_POLICY this is exactly `foundationMasteryFor`. */
export function studyBlockMastery(
  topic: string,
  records: readonly InstrumentRecord<StudyBlockRecord>[],
  policy: BlockCountPolicy = LEGACY_BLOCK_COUNT_POLICY
): MasteryState {
  const topicBlocks = records.filter((r) => r.record.topic === topic).sort((a, b) => a.localDate.localeCompare(b.localDate));
  if (topicBlocks.length === 0) return 'unseen';

  let state: MasteryState = 'unseen';
  let fluentReachedAt: string | null = null;
  for (let i = 0; i < topicBlocks.length; i++) {
    const count = i + 1;
    const current = topicBlocks[i]!;
    if (state === 'unseen' && count >= policy.introducedAt) state = 'introduced';
    if (state === 'introduced' && count >= policy.appliedAt) state = 'applied';
    if (state === 'applied' && count >= policy.fluentAt) {
      state = 'fluent';
      fluentReachedAt = current.localDate;
    }
    if (state === 'fluent' && fluentReachedAt && i > 0) {
      if (differenceInCalendarDays(parseISO(current.localDate), parseISO(fluentReachedAt)) >= policy.retainedGapDays) state = 'retained';
    }
  }
  return state;
}

/** Sum of mastery points across the configured topics (the legacy ENGINEERING term's input). */
export function studyBlockMasteryPoints(
  records: readonly InstrumentRecord<StudyBlockRecord>[],
  topics: readonly string[],
  policy: BlockCountPolicy = LEGACY_BLOCK_COUNT_POLICY
): number {
  return topics.reduce((sum, topic) => sum + FOUNDATION_MASTERY_POINTS[studyBlockMastery(topic, records, policy)], 0);
}

export function studyBlockSignals(
  records: readonly InstrumentRecord<StudyBlockRecord>[],
  params: StudyBlockParams,
  context?: InstrumentEvaluationContext
): Readonly<Record<string, number>> {
  const policy = params.mastery ?? LEGACY_BLOCK_COUNT_POLICY;
  const requestedMode = context?.filter?.mode;
  const modeCount = records.filter((r) => (requestedMode ? r.record.mode === requestedMode : r.record.mode !== undefined)).length;
  const fluentTopics = params.topics.filter((topic) => {
    const state = studyBlockMastery(topic, records, policy);
    return state === 'fluent' || state === 'retained';
  }).length;
  return {
    blocks: records.length,
    minutes: records.reduce((sum, r) => sum + r.record.minutes, 0),
    mode_counts: modeCount,
    topic_mastery: fluentTopics,
    mastery_points: studyBlockMasteryPoints(records, params.topics, policy),
  };
}

export const studyBlockInstrument = defineInstrument<StudyBlockParams, StudyBlockRecord>({
  type: 'study_block',
  validateRecord: validateStudyBlockRecord,
  signals: studyBlockSignals,
});
