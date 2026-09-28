import { addDays, format, parseISO } from 'date-fns';
import type { EngineConfig } from './types';

export type AttemptOutcome = 'first_attempt' | 'hint' | 'editorial' | 'unsolved';

export interface ReviewHistoryEntry {
  local_date: string;
  outcome: AttemptOutcome;
}

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

/**
 * Pure. Computes the next review date for a problem given its outcome
 * and prior review history (final/03 §2.2). `history` must include the
 * CURRENT attempt as its last entry — its local_date is the anchor the
 * returned date is computed from.
 *
 * FIRST_ATTEMPT advances through config.firstAttemptIntervals ([3, 10,
 * 30, 90] days) one step per CONSECUTIVE first-attempt success counting
 * back from the current entry — the first success after none, or after
 * a HINT/EDITORIAL/UNSOLVED break, lands on the first interval; each
 * further consecutive success advances one step, capped at the last
 * interval. HINT/EDITORIAL/UNSOLVED reset to their own fixed interval
 * and, by breaking the consecutive-success run, reset the ladder for
 * whatever FIRST_ATTEMPT comes next.
 */
export function nextReview(
  outcome: AttemptOutcome,
  history: ReviewHistoryEntry[],
  config: EngineConfig['srs']
): string {
  const current = history[history.length - 1];
  if (!current) {
    throw new Error('nextReview requires history to include the current attempt as its last entry');
  }
  const anchor = current.local_date;

  switch (outcome) {
    case 'hint':
      return shiftDate(anchor, config.hint);
    case 'editorial':
      return shiftDate(anchor, config.editorial);
    case 'unsolved':
      return shiftDate(anchor, config.unsolved);
    case 'first_attempt': {
      let consecutive = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i]!.outcome === 'first_attempt') {
          consecutive += 1;
        } else {
          break;
        }
      }
      const step = Math.min(consecutive - 1, config.firstAttemptIntervals.length - 1);
      const days = config.firstAttemptIntervals[Math.max(0, step)]!;
      return shiftDate(anchor, days);
    }
  }
}
