// The live, real-time streak/Reduced-Mode view for TODAY. Deliberately
// does NOT read db.player_state (that's a rebuild-time snapshot that can
// include today if today happens to have been opened when
// rebuildProjections last ran) — a still-in-progress "today" would
// wrongly score as a miss (0 XP so far) if it were included in the
// day-by-day history. This always excludes today by construction,
// computing fresh from the event log the same way db/projections.ts
// does (buildDayOutcomes), just capped at yesterday.
import { addDays, format, parseISO } from 'date-fns';
import type { EngineConfig } from '../engine/types';
import { applyEvents } from '../engine/reduce';
import { streakFrom, type StreakResult } from '../engine/streak';
import { getAllEvents } from '../db/events';
import { buildDayOutcomes } from '../db/projections';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

export interface LiveStreakState {
  arc_streak: number;
  grace_remaining: number;
  reduced_mode: boolean;
  consistency_7: number;
  consistency_14: number;
  consistency_28: number;
}

const EMPTY_STREAK: LiveStreakState = {
  arc_streak: 0,
  grace_remaining: 0,
  reduced_mode: false,
  consistency_7: 0,
  consistency_14: 0,
  consistency_28: 0,
};

function consistencyOver(history: StreakResult['history'], windowDays: number): number {
  const window = history.slice(-windowDays);
  const eligible = window.filter((d) => !d.paused);
  if (eligible.length === 0) return 0;
  const hits = eligible.filter((d) => d.mvd_met).length;
  return Math.round((hits / eligible.length) * 100);
}

export async function getStreakState(today: string, config: EngineConfig): Promise<LiveStreakState> {
  const events = await getAllEvents();
  const state = applyEvents(events, config);
  if (!state.arc) return EMPTY_STREAK;

  const yesterday = shiftDate(today, -1);
  const dayOutcomes = buildDayOutcomes(events, state.quests, state.arc.start_date, state.arc.paused_dates, yesterday);
  if (dayOutcomes.length === 0) return EMPTY_STREAK;

  const result = streakFrom(dayOutcomes, config.streak);
  return {
    arc_streak: result.arc_streak,
    grace_remaining: result.grace_remaining,
    reduced_mode: result.reduced_mode,
    consistency_7: consistencyOver(result.history, 7),
    consistency_14: consistencyOver(result.history, 14),
    consistency_28: consistencyOver(result.history, 28),
  };
}
