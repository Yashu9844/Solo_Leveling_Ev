// The adaptive interview (platform/03 §23). A person answers questions; the answers become a DraftState (generator/types.ts); the generator
// turns that into a Blueprint. This module is the question engine only: pure, serialisable, no React, no storage, no clock.

/** A key into the answers: 'identity.displayName', 'areas', 'area.knowledge.resolution', 'rhythm.wakeTime'. */
export type DraftPath = string;

export type Tier = 'quick' | 'guided';

/** The emotional sequence of 03 §23.3, in order. */
export const STAGES = [
  'DESIGNATION', 'INTENT', 'HIERARCHY', 'RESOLUTION', 'MEASURE', 'GUARDRAILS', 'RHYTHM', 'ARC', 'TRIGGERS', 'BASELINE',
] as const;
export type StageId = (typeof STAGES)[number];

export type QuestionKind = 'multi_card' | 'rank' | 'single_card' | 'action_card' | 'number' | 'time' | 'date' | 'text_short' | 'dial';

export interface OptionDef {
  value: string;
  label: string;
  /** A plain line under the label ("Applications and the work that stands in for them"). */
  hint?: string;
}

/** A JSON predicate over the answers: serialisable, so it can be tested and shipped as data. */
export type Predicate =
  | { always: true }
  | { has: DraftPath; value?: string | number | boolean }
  | { eq: [DraftPath, unknown] }
  | { gte: [DraftPath, number] }
  | { and: Predicate[] }
  | { or: Predicate[] }
  | { not: Predicate };

/** How an unanswered question's default is computed from the answers so far. */
export type DefaultRule =
  | { const: unknown }
  | { copy: DraftPath; otherwise?: unknown }
  /** value of `from` times `factor`, rounded, at least `min` (a hard day is a third of a good day). */
  | { scale: { from: DraftPath; factor: number; min?: number; otherwise?: unknown } }
  /** the first option's value, or the first `count` option values for a multi_card */
  | { firstOption: true; count?: number }
  /** today's date, plus `days` */
  | { today: true; days?: number };

export interface QuestionDef {
  id: string;
  stage: StageId;
  tier: Tier;
  /** System voice, capitals: "WHAT ARE YOU HERE TO CHANGE?". May contain {area}. */
  heading: string;
  /** Plain language under the heading. */
  subline?: string;
  kind: QuestionKind;
  /** Static options, or options computed from the draft. */
  options?: OptionDef[] | { from: DraftPath; map: Record<string, OptionDef[]> };
  eligibility: Predicate;
  writes: DraftPath;
  default?: DefaultRule;
  bounds?: { min?: number; max?: number; step?: number; maxLength?: number };
  /** The System's one-line acknowledgement. {answer} is the answer in words, {area} the area, {n} a number answered. */
  echo?: string;
  /** Asked once per chosen area, in the order the person ranked them. {area} stands for the area id in `writes` and `eligibility` paths. */
  each?: 'area';
  /** Counts toward the per-area question budget. */
  budgeted?: boolean;
  /** Set for archetype question packs. */
  archetypeId?: string;
  /** A multi_card or rank answer must hold at least / at most this many values. */
  count?: { min?: number; max?: number };
  /** A rank question orders the values of this answer (the chosen areas). */
  rankFrom?: DraftPath;
}

/** The persisted draft: nothing but answers and the tier. Raw answers never enter the event log (03 §23.2). */
export interface InterviewDraft {
  tier: Tier;
  answers: Record<DraftPath, unknown>;
}

/** One question as it is actually asked: a definition, resolved for an area where it repeats. */
export interface QuestionInstance {
  /** `${id}` or `${id}@${area}`. */
  key: string;
  def: QuestionDef;
  area?: string;
  writes: DraftPath;
  heading: string;
}

/** Questions per area (03 §23.2): Quick one, Guided four. The engine enforces it, not the content authors. */
export const AREA_BUDGET: Record<Tier, number> = { quick: 1, guided: 4 };

/** The fewest and most areas a person can pick (V-DOM-01: 4-8 core domains, two of them guardrails). */
export const AREA_COUNT = { min: 2, max: 6 } as const;
