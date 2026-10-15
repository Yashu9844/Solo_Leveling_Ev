// Shared by the practice_item recorder and its legacy writer (kept apart so the two do not import each other).
import type { AttemptOutcome } from '../../../engine/srs';
import type { MasteryState } from '../../../engine/types';

export interface PracticeValues {
  title: string;
  topic: string;
  difficulty: 'E' | 'M' | 'H';
  outcome: AttemptOutcome;
  minutes: number;
  insight?: string;
}

export interface PracticeResult {
  /** Set when this log moved the topic up the mastery ladder (the MASTERY Moment fires on it). */
  masteryAdvance?: { topic: string; state: 'introduced' | 'applied' | 'fluent' | 'retained' };
}

const MASTERY_ORDER: MasteryState[] = ['unseen', 'introduced', 'applied', 'fluent', 'retained'];

export function masteryAdvanced(before: MasteryState, after: MasteryState): after is 'introduced' | 'applied' | 'fluent' | 'retained' {
  return MASTERY_ORDER.indexOf(after) > MASTERY_ORDER.indexOf(before) && after !== 'unseen';
}

export const slugOf = (title: string): string => title.trim().toLowerCase().replace(/\s+/g, '-');
