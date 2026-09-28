import { describe, it, expect } from 'vitest';
import { weightedVolume, masteryFor, type DsaAttemptFixture } from '../../src/engine/dsa';

function attempt(overrides: Partial<DsaAttemptFixture>): DsaAttemptFixture {
  return {
    problem_id: 'p1',
    topic: 'arrays',
    difficulty: 'E',
    local_date: '2026-09-01',
    outcome: 'first_attempt',
    is_revisit: false,
    ...overrides,
  };
}

describe('weightedVolume', () => {
  it('weights E/M/H at 1/2/3.5', () => {
    const attempts = [attempt({ difficulty: 'E' }), attempt({ difficulty: 'M' }), attempt({ difficulty: 'H' })];
    expect(weightedVolume(attempts)).toBe(1 + 2 + 3.5);
  });

  it('is 0 for an empty set', () => {
    expect(weightedVolume([])).toBe(0);
  });
});

describe('masteryFor', () => {
  it('unseen with no attempts', () => {
    expect(masteryFor('graphs', [])).toBe('unseen');
  });

  it('introduced after the first attempt', () => {
    const attempts = [attempt({ local_date: '2026-09-01' })];
    expect(masteryFor('arrays', attempts)).toBe('introduced');
  });

  it('applied at 3 attempts, below the fluent bar', () => {
    const attempts = [
      attempt({ local_date: '2026-09-01', outcome: 'unsolved' }),
      attempt({ local_date: '2026-09-02', outcome: 'unsolved' }),
      attempt({ local_date: '2026-09-03', outcome: 'unsolved' }),
    ];
    expect(masteryFor('arrays', attempts)).toBe('applied');
  });

  it('fluent at 5 attempts, >=60% first-attempt, >=2 medium+', () => {
    const attempts = [
      attempt({ local_date: '2026-09-01', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-02', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-03', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-04', difficulty: 'E', outcome: 'unsolved' }),
      attempt({ local_date: '2026-09-05', difficulty: 'E', outcome: 'hint' }),
    ];
    // 5 attempts, 3/5 = 60% first-attempt, 2 at medium+.
    expect(masteryFor('arrays', attempts)).toBe('fluent');
  });

  it('stays applied when the first-attempt rate is below 60% even at 5+ attempts', () => {
    const attempts = [
      attempt({ local_date: '2026-09-01', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-02', difficulty: 'M', outcome: 'unsolved' }),
      attempt({ local_date: '2026-09-03', difficulty: 'M', outcome: 'unsolved' }),
      attempt({ local_date: '2026-09-04', difficulty: 'M', outcome: 'hint' }),
      attempt({ local_date: '2026-09-05', difficulty: 'M', outcome: 'editorial' }),
    ];
    expect(masteryFor('arrays', attempts)).toBe('applied');
  });

  it('retained after an unaided revisit >= 21 days after reaching fluent', () => {
    const attempts = [
      attempt({ local_date: '2026-09-01', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-02', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-03', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-04', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-05', difficulty: 'E', outcome: 'first_attempt' }), // fluent reached here
      attempt({ local_date: '2026-09-26', outcome: 'first_attempt', is_revisit: true }), // exactly 21 days later
    ];
    expect(masteryFor('arrays', attempts)).toBe('retained');
  });

  it('a revisit before the 21-day gap does not grant retained', () => {
    const attempts = [
      attempt({ local_date: '2026-09-01', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-02', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-03', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-04', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-05', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-10', outcome: 'first_attempt', is_revisit: true }), // only 5 days later
    ];
    expect(masteryFor('arrays', attempts)).toBe('fluent');
  });

  it('a retained topic regresses to fluent on a later failed revisit', () => {
    const attempts = [
      attempt({ local_date: '2026-09-01', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-02', difficulty: 'M', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-03', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-04', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-05', difficulty: 'E', outcome: 'first_attempt' }),
      attempt({ local_date: '2026-09-26', outcome: 'first_attempt', is_revisit: true }), // reaches retained
      attempt({ local_date: '2026-10-20', outcome: 'hint', is_revisit: true }), // fails a later revisit
    ];
    expect(masteryFor('arrays', attempts)).toBe('fluent');
  });

  it('mastery is scoped per topic — other topics do not contribute', () => {
    const attempts = [
      attempt({ local_date: '2026-09-01', topic: 'arrays' }),
      attempt({ local_date: '2026-09-02', topic: 'graphs' }),
    ];
    expect(masteryFor('arrays', attempts)).toBe('introduced');
    expect(masteryFor('graphs', attempts)).toBe('introduced');
    expect(masteryFor('trees', attempts)).toBe('unseen');
  });
});
