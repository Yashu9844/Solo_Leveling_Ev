import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { masteryFor, weightedVolume, type DsaAttemptFixture } from '../../src/engine/dsa';
import { nextReview } from '../../src/engine/srs';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { practiceItemMastery, practiceItemNextReview, practiceItemSignals, validatePracticeItemRecord, type PracticeItemRecord } from '../../src/instruments/types/practiceItem';
import type { InstrumentRecord } from '../../src/instruments/framework';

const outcomes = ['first_attempt', 'hint', 'editorial', 'unsolved'] as const;
const difficulties = ['E', 'M', 'H'] as const;
const params = { topics: ['Arrays', 'Graphs'], difficultyScale: difficulties, outcomes } as const;

function record(attempt: DsaAttemptFixture, id: number): InstrumentRecord<PracticeItemRecord> {
  return {
    id: `record-${id}`, eventId: `event-${id}`, instrumentId: 'logic.practice', instrumentType: 'practice_item', domainId: 'logic', blueprintVersion: 1,
    localDate: attempt.local_date,
    record: { problemId: attempt.problem_id, topic: attempt.topic, difficulty: attempt.difficulty, outcome: attempt.outcome, minutes: id % 61, isRevisit: attempt.is_revisit },
  };
}

const attemptArb = fc.record({
  problem_id: fc.string({ minLength: 1, maxLength: 8 }),
  topic: fc.constantFrom('Arrays', 'Graphs'),
  difficulty: fc.constantFrom(...difficulties),
  local_date: fc.integer({ min: 1, max: 28 }).map((day) => `2026-09-${String(day).padStart(2, '0')}`),
  outcome: fc.constantFrom(...outcomes),
  is_revisit: fc.boolean(),
});

describe('practice_item instrument (loop 3.2)', () => {
  it('validates the bounded record contract', () => {
    expect(validatePracticeItemRecord({ problemId: 'x', topic: 'Arrays', difficulty: 'M', outcome: 'first_attempt', minutes: 25, isRevisit: false }, params)).toEqual([]);
    expect(validatePracticeItemRecord({ problemId: '', topic: 'Other', difficulty: 'X', outcome: 'skip', minutes: -1 }, params)).toHaveLength(6);
  });

  it('matches legacy DSA volume, mastery, and SRS across 10,000 generated histories', () => {
    fc.assert(fc.property(fc.array(attemptArb, { minLength: 1, maxLength: 35 }), (attempts) => {
      const chronological = [...attempts].sort((a, b) => a.local_date.localeCompare(b.local_date));
      const records = chronological.map(record);
      const signals = practiceItemSignals(records);
      expect(signals.weighted_volume).toBe(weightedVolume(chronological));
      for (const topic of params.topics) expect(practiceItemMastery(topic, records)).toBe(masteryFor(topic, chronological));
      const history = chronological.filter((attempt) => attempt.problem_id === chronological[0]!.problem_id);
      const recordHistory = records.filter((item) => item.record.problemId === chronological[0]!.problem_id);
      if (history.length > 0) {
        const expected = nextReview(history[history.length - 1]!.outcome, history.map(({ local_date, outcome }) => ({ local_date, outcome })), DEFAULT_CONFIG.srs);
        expect(practiceItemNextReview(recordHistory, DEFAULT_CONFIG.srs)).toBe(expected);
      }
    }), { numRuns: 10_000 });
  });
});
