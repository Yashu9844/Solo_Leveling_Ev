import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { MasteryState } from './types';

// final/03-learning-systems.md §3.2 — the nine SE foundation topics.
export const FOUNDATION_TOPICS = [
  'Operating Systems',
  'Networking',
  'Databases',
  'Distributed Systems',
  'Concurrency',
  'Backend Engineering',
  'System Design',
  'Performance',
  'Production Architecture',
] as const;
export type FoundationTopic = (typeof FOUNDATION_TOPICS)[number];

// final/03 §3.2 — Introduced 1 · Applied 2 · Fluent 3 · Retained 4.
export const FOUNDATION_MASTERY_POINTS: Record<MasteryState, number> = {
  unseen: 0,
  introduced: 1,
  applied: 2,
  fluent: 3,
  retained: 4,
};

export interface LearningBlockFixture {
  topic: string;
  local_date: string;
}

/**
 * Pure. Foundation-topic mastery (final/03 §1's shared 5-state model,
 * applied to SE foundations rather than DSA). The table's Applied/Fluent
 * rows are written in two vocabularies — "3 problems" for DSA, "2 blocks +
 * 1 applied artefact" / "1 written explanation + 1 applied use" for
 * foundations — and this app has no separate "applied artefact" log type
 * that applies uniformly across all nine topics (system_design_study
 * exists but is scoped to the System Design topic alone). Resolved here,
 * same as engine/dsa.ts's masteryFor's flagged Introduced ambiguity, by
 * using the one signal that exists for every topic — logged block count —
 * as a direct numeric analogue of DSA's problem count: Introduced at 1,
 * Applied at 3, Fluent at 5. Retained requires a block logged >= 21 days
 * after Fluent was reached — the closest available analogue to "a revisit
 * that still holds," since foundations have no dedicated revisit event.
 * Flagged as a resolved ambiguity in the Slice 10 report.
 */
export function foundationMasteryFor(topic: string, blocks: LearningBlockFixture[]): MasteryState {
  const topicBlocks = blocks
    .filter((b) => b.topic === topic)
    .sort((a, b) => a.local_date.localeCompare(b.local_date));
  if (topicBlocks.length === 0) return 'unseen';

  let state: MasteryState = 'unseen';
  let fluentReachedAt: string | null = null;

  for (let i = 0; i < topicBlocks.length; i++) {
    const soFar = topicBlocks.slice(0, i + 1);
    const current = topicBlocks[i]!;

    if (state === 'unseen') state = 'introduced';
    if (state === 'introduced' && soFar.length >= 3) state = 'applied';
    if (state === 'applied' && soFar.length >= 5) {
      state = 'fluent';
      fluentReachedAt = current.local_date;
    }
    if (state === 'fluent' && fluentReachedAt && i > 0) {
      if (differenceInCalendarDays(parseISO(current.local_date), parseISO(fluentReachedAt)) >= 21) {
        state = 'retained';
      }
    }
  }

  return state;
}

/** Pure. Sum of mastery points across all nine topics — final/01 §5's
 * ENGINEERING term (`foundation_mastery_points ÷ 24`, max 36). */
export function foundationMasteryPoints(blocks: LearningBlockFixture[]): number {
  return FOUNDATION_TOPICS.reduce(
    (sum, topic) => sum + FOUNDATION_MASTERY_POINTS[foundationMasteryFor(topic, blocks)],
    0
  );
}
