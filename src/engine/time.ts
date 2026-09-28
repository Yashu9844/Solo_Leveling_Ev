// Pure. The highest-risk correctness area in the codebase (final/07 §3).
// A midnight rollover would file a 02:00 AI session under the wrong day
// and break the streak most nights, so the day boundary is 04:00 and all
// date math shifts the instant by boundaryHour before reading the
// timezone's wall-clock date.
import { parseISO, subHours, differenceInCalendarDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { EngineConfig } from './types';

/**
 * The local calendar date this instant belongs to, under a day that rolls
 * over at `boundaryHour` (default 04:00) in `tz`. Computed once, at write
 * time — callers must never recompute it later from `occurred_at`.
 */
export function localDate(instantIso: string, tz: string, boundaryHour = 4): string {
  const shifted = subHours(parseISO(instantIso), boundaryHour);
  return formatInTimeZone(shifted, tz, 'yyyy-MM-dd');
}

/**
 * True while quests are unavailable: from `config.arc.dayCloseHour`
 * (03:00 — sleep target 02:00 + 60 min grace) until the next
 * `config.arc.dayBoundaryHour` rollover (04:00). Based on wall-clock
 * time-of-day in the arc's timezone, not on which local_date the instant
 * maps to. Takes the whole config (Slice 2) so every call site reads the
 * arc's actual close/boundary hours instead of passing loose args.
 */
export function isDayClosed(instantIso: string, config: EngineConfig): boolean {
  const { timezone: tz, dayCloseHour: closeHour, dayBoundaryHour: boundaryHour } = config.arc;
  const wallClock = formatInTimeZone(parseISO(instantIso), tz, 'HH:mm');
  const parts = wallClock.split(':');
  const hh = Number(parts[0] ?? 0);
  const mm = Number(parts[1] ?? 0);
  const minutesOfDay = hh * 60 + mm;
  const closeMin = closeHour * 60;
  const boundaryMin = boundaryHour * 60;

  if (boundaryMin > closeMin) {
    return minutesOfDay >= closeMin && minutesOfDay < boundaryMin;
  }
  // The [close, boundary) window wraps past midnight.
  return minutesOfDay >= closeMin || minutesOfDay < boundaryMin;
}

/**
 * 1-indexed day number within the arc, e.g. the start date is day 1.
 * Uses the 04:00-boundary local_date, never the raw UTC calendar date.
 */
export function arcDay(instantIso: string, startDate: string, tz: string, boundaryHour = 4): number {
  const today = localDate(instantIso, tz, boundaryHour);
  return differenceInCalendarDays(parseISO(today), parseISO(startDate)) + 1;
}
