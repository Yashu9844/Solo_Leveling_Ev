// The tables an arc's length selects (platform/02 §9.4 rule 5, §16.1): the level coefficient and the
// checkpoint days. Both are DERIVED, then written down: the coefficient anchors come from
// simulation.ts (tests/engine/library-calibration.test.ts re-runs it and fails if a number drifts),
// and the checkpoint days are the design's table. Any length from 60 to 365 is allowed; a length
// between anchors interpolates.
import type { Rank } from '../blueprint/schema';

/** Arc lengths a person can pick directly; any length in [MIN, MAX] is valid (V-ARC-02). */
export const ARC_LENGTH_PRESETS = [60, 90, 120, 180, 365] as const;
export const MIN_ARC_LENGTH = 60;
export const MAX_ARC_LENGTH = 365;

/** The terminus level at 85% completion: 40 at 120 days, scaling with the square root of length. */
export function terminusTarget(days: number): number {
  return Math.round(40 * Math.sqrt(days / 120));
}

/** Smallest coefficient reaching terminusTarget(days) in simulation.ts, 60 seeds at 85%. 120 days -> 84 is the owner's. */
export const COEFFICIENT_ANCHORS: Readonly<Record<number, number>> = { 60: 82, 90: 80, 120: 84, 180: 85, 365: 88 };

/** Checkpoint days D, C, B, A, S by arc length (02 §16.1). Day 0 is always the baseline; D is global. */
export const CHECKPOINT_ANCHORS: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  60: [14, 25, 40, 50, 60],
  90: [14, 30, 50, 70, 90],
  120: [14, 30, 60, 90, 120],
  180: [14, 45, 90, 135, 180],
  365: [14, 90, 180, 270, 365],
};

const ANCHOR_LENGTHS = ARC_LENGTH_PRESETS as readonly number[];

/** The two anchors around `length` and how far between them it sits (0..1); clamped at the ends. */
function bracket(length: number): { low: number; high: number; t: number } {
  const clamped = Math.max(MIN_ARC_LENGTH, Math.min(MAX_ARC_LENGTH, length));
  const high = ANCHOR_LENGTHS.find((anchor) => anchor >= clamped)!;
  const low = [...ANCHOR_LENGTHS].reverse().find((anchor) => anchor <= clamped)!;
  return { low, high, t: low === high ? 0 : (clamped - low) / (high - low) };
}

/** The level coefficient for an arc of `length` days: an anchor exactly, otherwise interpolated. */
export function coefficientFor(length: number): number {
  const { low, high, t } = bracket(length);
  return Math.round(COEFFICIENT_ANCHORS[low]! + t * (COEFFICIENT_ANCHORS[high]! - COEFFICIENT_ANCHORS[low]!));
}

/** The minimum spacing between checkpoints (02 §16.1). */
export const MIN_CHECKPOINT_GAP = 10;

/**
 * The checkpoint days D, C, B, A, S for an arc of `length` days. An anchor length returns the table.
 * Between anchors, C/B/A are interpolated as fractions of the length, rounded to whole days, and
 * pushed apart if they would sit closer than ten days. D is 14 and S is the length.
 */
export function checkpointDaysFor(length: number): number[] {
  const exact = CHECKPOINT_ANCHORS[length];
  if (exact) return [...exact];
  const { low, high, t } = bracket(length);
  const days: number[] = [14];
  for (let i = 1; i <= 3; i++) {
    const fraction = CHECKPOINT_ANCHORS[low]![i]! / low + t * (CHECKPOINT_ANCHORS[high]![i]! / high - CHECKPOINT_ANCHORS[low]![i]! / low);
    days.push(Math.round(fraction * length));
  }
  days.push(length);
  for (let i = 1; i < days.length - 1; i++) days[i] = Math.max(days[i]!, days[i - 1]! + MIN_CHECKPOINT_GAP);
  for (let i = days.length - 2; i >= 1; i--) days[i] = Math.min(days[i]!, days[i + 1]! - MIN_CHECKPOINT_GAP);
  return days;
}

/** The level each feature opens at in a generated System (final/01 §3 "Level unlocks"). */
export const FEATURE_UNLOCK_LEVELS = { weekly_quests: 3, attributes: 5, skills: 10, weekly_review: 12, bosses: 15, projection: 20 } as const;

const RANKS: readonly Rank[] = ['D', 'C', 'B', 'A', 'S'];

/** The rank each checkpoint day seals (the Blueprint's `rankSchedule`). */
export function rankScheduleFor(length: number): { day: number; rank: Rank }[] {
  return checkpointDaysFor(length).map((day, index) => ({ day, rank: RANKS[index]! }));
}
