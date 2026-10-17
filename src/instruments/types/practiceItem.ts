import { masteryFor, weightedVolume, type DsaAttemptFixture } from '../../engine/dsa';
import { nextReview, type AttemptOutcome, type ReviewHistoryEntry } from '../../engine/srs';
import type { EngineConfig, MasteryState } from '../../engine/types';
import { defineInstrument, type InstrumentIssue, type InstrumentRecord } from '../framework';

export type PracticeDifficulty = 'E' | 'M' | 'H';

export type PracticeItemRecord = Record<string, unknown> & {
  problemId: string;
  topic: string;
  difficulty: PracticeDifficulty;
  outcome: AttemptOutcome;
  minutes: number;
  isRevisit: boolean;
};

export type PracticeItemParams = Record<string, unknown> & {
  topics: readonly string[];
  difficultyScale: readonly PracticeDifficulty[] | Readonly<Record<PracticeDifficulty, number>>;
  outcomes: readonly AttemptOutcome[];
};

function asLegacyAttempt(record: PracticeItemRecord, localDate: string): DsaAttemptFixture {
  return {
    problem_id: record.problemId,
    topic: record.topic,
    difficulty: record.difficulty,
    local_date: localDate,
    outcome: record.outcome,
    is_revisit: record.isRevisit,
  };
}

export function validatePracticeItemRecord(record: unknown, params: PracticeItemParams): InstrumentIssue[] {
  if (!record || typeof record !== 'object') return [{ code: 'I-REC-01', path: 'record', message: 'A practice record must be an object.' }];
  const candidate = record as Partial<PracticeItemRecord>;
  const issues: InstrumentIssue[] = [];
  if (!candidate.problemId || typeof candidate.problemId !== 'string') issues.push({ code: 'I-REC-02', path: 'record.problemId', message: 'A problem id is required.' });
  if (!candidate.topic || typeof candidate.topic !== 'string' || !params.topics.includes(candidate.topic)) issues.push({ code: 'I-REC-03', path: 'record.topic', message: 'Choose a configured topic.' });
  if (!candidate.difficulty || !['E', 'M', 'H'].includes(candidate.difficulty)) issues.push({ code: 'I-REC-04', path: 'record.difficulty', message: 'Choose E, M, or H difficulty.' });
  if (!candidate.outcome || !params.outcomes.includes(candidate.outcome)) issues.push({ code: 'I-REC-05', path: 'record.outcome', message: 'Choose a configured outcome.' });
  if (!Number.isFinite(candidate.minutes) || (candidate.minutes ?? -1) < 0) issues.push({ code: 'I-REC-06', path: 'record.minutes', message: 'Minutes must be a non-negative number.' });
  if (typeof candidate.isRevisit !== 'boolean') issues.push({ code: 'I-REC-07', path: 'record.isRevisit', message: 'Revisit status is required.' });
  return issues;
}

/** Legacy-equivalent DSA statistics, expressed through the generic type. */
export function practiceItemSignals(records: readonly InstrumentRecord<PracticeItemRecord>[]): Readonly<Record<string, number>> {
  const attempts = records.map((record) => asLegacyAttempt(record.record, record.localDate));
  const firstAttempts = attempts.filter((attempt) => attempt.outcome === 'first_attempt').length;
  const revisits = attempts.filter((attempt) => attempt.is_revisit);
  const successfulRevisits = revisits.filter((attempt) => attempt.outcome === 'first_attempt').length;
  // Mastery of every topic is the expensive signal, and most reads ask for something else: it is worked out when (and only when) it is read.
  let fluentTopics: number | undefined;
  const signals = {
    count: attempts.length,
    weighted_volume: weightedVolume(attempts),
    minutes: records.reduce((sum, record) => sum + record.record.minutes, 0),
    first_attempt_rate: attempts.length === 0 ? 0 : firstAttempts / attempts.length,
    revisit_success_rate: revisits.length === 0 ? 0 : successfulRevisits / revisits.length,
    topic_mastery: 0,
    record_first_attempt_at_top_difficulty: attempts.some((attempt) => attempt.difficulty === 'H' && attempt.outcome === 'first_attempt') ? 1 : 0,
  };
  Object.defineProperty(signals, 'topic_mastery', {
    enumerable: true,
    get: () => {
      fluentTopics ??= [...new Set(attempts.map((attempt) => attempt.topic))].filter((topic) => { const state = masteryFor(topic, attempts); return state === 'fluent' || state === 'retained'; }).length;
      return fluentTopics;
    },
  });
  return signals;
}

export function practiceItemMastery(topic: string, records: readonly InstrumentRecord<PracticeItemRecord>[]): MasteryState {
  return masteryFor(topic, records.map((record) => asLegacyAttempt(record.record, record.localDate)));
}

/** Exact legacy SRS schedule for one problem's chronological history. */
export function practiceItemNextReview(
  history: readonly Pick<InstrumentRecord<PracticeItemRecord>, 'localDate' | 'record'>[],
  config: EngineConfig['srs']
): string {
  const entries: ReviewHistoryEntry[] = history.map((record) => ({ local_date: record.localDate, outcome: record.record.outcome }));
  return nextReview(entries[entries.length - 1]!.outcome, entries, config);
}

export const practiceItemInstrument = defineInstrument<PracticeItemParams, PracticeItemRecord>({
  type: 'practice_item',
  validateRecord: validatePracticeItemRecord,
  signals: (records) => practiceItemSignals(records),
});
