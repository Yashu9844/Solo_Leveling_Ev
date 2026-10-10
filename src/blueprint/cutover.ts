// The calendar guard of the owner's cutover (platform/02 §22.3 step 4, F14):
// the engine swap must not land within three days of a checkpoint, because a
// seal or a gate that differs on seal day is the one place a regression would
// cost the owner something real. Pure, so the same rule runs in the runbook
// script and in tests.
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const CUTOVER_BUFFER_DAYS = 3;

export interface CutoverWindow {
  /** 1-based arc day of the date asked about. */
  arcDay: number;
  /** The checkpoint nearest to it (by day number), with its distance in days (negative = already past). */
  nearest: { day: number; daysAway: number } | undefined;
  /** True when the date is NOT within ±CUTOVER_BUFFER_DAYS of any checkpoint. */
  allowed: boolean;
  /** The next date on or after the asked one that is allowed. */
  earliestAllowed: string;
  reason: string;
}

export function cutoverWindow(arcStartDate: string, onDate: string, checkpointDays: readonly number[], buffer = CUTOVER_BUFFER_DAYS): CutoverWindow {
  const arcDay = differenceInCalendarDays(parseISO(onDate), parseISO(arcStartDate)) + 1;
  const near = (day: number) => Math.abs(day - arcDay) <= buffer;
  const nearest = [...checkpointDays].sort((a, b) => Math.abs(a - arcDay) - Math.abs(b - arcDay))[0];
  const allowed = !checkpointDays.some(near);

  let candidate = arcDay;
  while (checkpointDays.some((day) => Math.abs(day - candidate) <= buffer)) candidate++;
  const earliestAllowed = format(addDays(parseISO(arcStartDate), candidate - 1), 'yyyy-MM-dd');

  const reason = nearest === undefined
    ? 'No checkpoints are scheduled.'
    : allowed
      ? `Arc day ${arcDay} is ${Math.abs(nearest - arcDay)} days from the Day ${nearest} checkpoint (needs more than ${buffer}).`
      : `Arc day ${arcDay} is within ${buffer} days of the Day ${nearest} checkpoint. Earliest safe date: ${earliestAllowed}.`;
  return { arcDay, nearest: nearest === undefined ? undefined : { day: nearest, daysAway: nearest - arcDay }, allowed, earliestAllowed, reason };
}
