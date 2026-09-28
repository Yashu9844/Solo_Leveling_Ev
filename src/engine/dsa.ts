import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { MasteryState } from './types';

// ui/dsa/LogProblemSheet.tsx's chip list, promoted here so the Skills
// screen (ui/screens/Skills.tsx) can render mastery for the same nine
// topics without a second, driftable copy of the list.
export const DSA_TOPICS = ['Arrays', 'Strings', 'Hashing', 'Two Pointers', 'Sliding Window', 'Stacks', 'Trees', 'Graphs', 'DP'] as const;
export type DsaTopic = (typeof DSA_TOPICS)[number];

export interface DsaAttemptFixture {
  problem_id: string;
  topic: string;
  difficulty: 'E' | 'M' | 'H';
  local_date: string;
  outcome: 'first_attempt' | 'hint' | 'editorial' | 'unsolved';
  is_revisit: boolean;
}

const DIFFICULTY_WEIGHT: Record<DsaAttemptFixture['difficulty'], number> = { E: 1, M: 2, H: 3.5 };

/** Pure. Weighted problem volume over a window: E x1, M x2, H x3.5
 * (final/01 §5's PROBLEM_SOLVING formula weights). */
export function weightedVolume(attempts: DsaAttemptFixture[]): number {
  return attempts.reduce((sum, a) => sum + DIFFICULTY_WEIGHT[a.difficulty], 0);
}

function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/**
 * Pure. Derives a topic's mastery state from its attempt history
 * (final/03 §1's shared 5-state model, DSA-specific transition
 * criteria). A fold over the chronological history, since Retained can
 * regress to Fluent on a later failed revisit — the only place in the
 * app regression is allowed.
 *
 * final/03 §1's table shares one column ("1 logged learning block") for
 * Introduced across both DSA and SE-foundations topics, but a DSA topic
 * has no "learning block" concept — only problem attempts. Interpreted
 * here as: the first attempt of any outcome introduces a topic, matching
 * how Applied/Fluent are already stated in DSA-specific terms (problem
 * counts). Flagged as a resolved ambiguity in the Slice 7 report.
 */
export function masteryFor(topic: string, attempts: DsaAttemptFixture[]): MasteryState {
  const topicAttempts = attempts
    .filter((a) => a.topic === topic)
    .sort((a, b) => a.local_date.localeCompare(b.local_date));
  if (topicAttempts.length === 0) return 'unseen';

  let state: MasteryState = 'unseen';
  let fluentReachedAt: string | null = null;

  for (let i = 0; i < topicAttempts.length; i++) {
    const soFar = topicAttempts.slice(0, i + 1);
    const current = topicAttempts[i]!;

    if (state === 'unseen') {
      state = 'introduced';
    }
    if (state === 'introduced' && soFar.length >= 3) {
      state = 'applied';
    }
    if (state === 'introduced' || state === 'applied') {
      const firstAttempts = soFar.filter((a) => a.outcome === 'first_attempt').length;
      const mediumPlus = soFar.filter((a) => a.difficulty !== 'E').length;
      const rate = firstAttempts / soFar.length;
      if (soFar.length >= 5 && rate >= 0.6 && mediumPlus >= 2) {
        state = 'fluent';
        fluentReachedAt = current.local_date;
      }
    }

    if (state === 'fluent' && current.is_revisit && fluentReachedAt) {
      if (daysBetween(fluentReachedAt, current.local_date) >= 21 && current.outcome === 'first_attempt') {
        state = 'retained';
      }
    } else if (state === 'retained' && current.is_revisit && current.outcome !== 'first_attempt') {
      // Regression is allowed here and nowhere else (final/03 §1): a
      // Retained topic that fails a later revisit drops to Fluent.
      state = 'fluent';
    }
  }

  return state;
}
