import { describe, it, expect } from 'vitest';
import { nextReview, type ReviewHistoryEntry } from '../../src/engine/srs';
import { DEFAULT_CONFIG } from '../../src/engine/config';

const SRS = DEFAULT_CONFIG.srs; // firstAttemptIntervals: [3, 10, 30, 90], hint: 3, editorial: 2, unsolved: 1

function history(...entries: [string, ReviewHistoryEntry['outcome']][]): ReviewHistoryEntry[] {
  return entries.map(([local_date, outcome]) => ({ local_date, outcome }));
}

describe('nextReview', () => {
  it('a first ever first_attempt schedules 3 days out', () => {
    const h = history(['2026-09-05', 'first_attempt']);
    expect(nextReview('first_attempt', h, SRS)).toBe('2026-09-08');
  });

  it('consecutive first_attempts advance through the interval ladder', () => {
    const h = history(
      ['2026-09-01', 'first_attempt'],
      ['2026-09-04', 'first_attempt'],
      ['2026-09-14', 'first_attempt'],
      ['2026-10-14', 'first_attempt']
    );
    // 4th consecutive success: anchor is the last entry's date, step = 90.
    expect(nextReview('first_attempt', h, SRS)).toBe('2027-01-12');
  });

  it('caps at the last interval beyond the 4th consecutive success', () => {
    const h = history(
      ['2026-01-01', 'first_attempt'],
      ['2026-01-04', 'first_attempt'],
      ['2026-01-14', 'first_attempt'],
      ['2026-02-13', 'first_attempt'],
      ['2026-05-14', 'first_attempt']
    );
    expect(nextReview('first_attempt', h, SRS)).toBe('2026-08-12'); // still +90
  });

  it('hint resets to 3 days regardless of prior streak', () => {
    const h = history(['2026-09-01', 'first_attempt'], ['2026-09-04', 'first_attempt'], ['2026-09-14', 'hint']);
    expect(nextReview('hint', h, SRS)).toBe('2026-09-17');
  });

  it('editorial resets to 2 days', () => {
    const h = history(['2026-09-05', 'editorial']);
    expect(nextReview('editorial', h, SRS)).toBe('2026-09-07');
  });

  it('unsolved resets to 1 day', () => {
    const h = history(['2026-09-05', 'unsolved']);
    expect(nextReview('unsolved', h, SRS)).toBe('2026-09-06');
  });

  it('a first_attempt after a break (hint/editorial/unsolved) restarts the ladder at 3 days', () => {
    const h = history(
      ['2026-09-01', 'first_attempt'],
      ['2026-09-04', 'first_attempt'],
      ['2026-09-14', 'unsolved'],
      ['2026-09-15', 'first_attempt']
    );
    expect(nextReview('first_attempt', h, SRS)).toBe('2026-09-18');
  });
});
