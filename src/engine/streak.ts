import { addDays, format, parseISO } from 'date-fns';
import type { EngineConfig } from './types';

export interface DayOutcome {
  local_date: string;
  mvd_met: boolean;
  paused: boolean;
}

export interface DayStreakOutcome extends DayOutcome {
  grace_applied: boolean;
  reduced_mode: boolean;
  streak_after: number;
}

export interface StreakResult {
  history: DayStreakOutcome[];
  arc_streak: number;
  grace_remaining: number;
  grace_used_this_cycle: number;
  reduced_mode: boolean;
}

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

/**
 * Pure. Derives the arc streak from a day-by-day history (chronological,
 * one entry per calendar day already elapsed — never today, which isn't
 * final yet), applying up to `graceDaysPer28` grace days automatically
 * per TRAILING 28-day window, and entering/exiting Reduced Mode on
 * `reducedModeTriggerMisses` consecutive misses / `reducedModeExitDays`
 * consecutive hits. final/01 §6.2-6.4.
 *
 * A grace-covered miss PRESERVES the streak (it doesn't count as a hit,
 * doesn't advance the number, but doesn't reset it either) — "protects
 * the streak" (§6.2), not "extends" it. A paused day is fully neutral:
 * no grace consumed, no miss counted, streak and Reduced Mode untouched.
 *
 * Reduced Mode and grace are independent, parallel checks on the same
 * miss — grace protects the NUMBER; Reduced Mode responds to the
 * underlying reality that you're missing days, and a grace-covered miss
 * is still a miss for that purpose.
 */
export function streakFrom(days: DayOutcome[], config: EngineConfig['streak']): StreakResult {
  const sorted = [...days].sort((a, b) => a.local_date.localeCompare(b.local_date));

  const history: DayStreakOutcome[] = [];
  let streak = 0;
  let reducedMode = false;
  let consecutiveMisses = 0;
  let consecutiveHitsInReduced = 0;
  const graceDates: string[] = [];

  for (const day of sorted) {
    if (day.paused) {
      history.push({ ...day, grace_applied: false, reduced_mode: reducedMode, streak_after: streak });
      continue;
    }

    let graceApplied = false;

    if (day.mvd_met) {
      streak += 1;
      consecutiveMisses = 0;
      if (reducedMode) {
        consecutiveHitsInReduced += 1;
        if (consecutiveHitsInReduced >= config.reducedModeExitDays) {
          reducedMode = false;
          consecutiveHitsInReduced = 0;
        }
      }
    } else {
      const windowStart = shiftDate(day.local_date, -27); // trailing 28 days, inclusive
      const graceUsedInWindow = graceDates.filter((d) => d >= windowStart && d <= day.local_date).length;
      if (graceUsedInWindow < config.graceDaysPer28) {
        graceApplied = true;
        graceDates.push(day.local_date);
      } else {
        streak = 0;
      }
      consecutiveMisses += 1;
      consecutiveHitsInReduced = 0;
      if (consecutiveMisses >= config.reducedModeTriggerMisses) {
        reducedMode = true;
      }
    }

    history.push({ ...day, grace_applied: graceApplied, reduced_mode: reducedMode, streak_after: streak });
  }

  const last = sorted[sorted.length - 1];
  const currentWindowStart = last ? shiftDate(last.local_date, -27) : null;
  const graceUsedThisCycle = currentWindowStart
    ? graceDates.filter((d) => d >= currentWindowStart).length
    : 0;

  return {
    history,
    arc_streak: streak,
    grace_remaining: Math.max(0, config.graceDaysPer28 - graceUsedThisCycle),
    grace_used_this_cycle: graceUsedThisCycle,
    reduced_mode: reducedMode,
  };
}
