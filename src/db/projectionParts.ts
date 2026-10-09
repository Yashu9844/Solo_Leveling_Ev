// The pieces of the projection build that both engines share: the day-outcome
// fold, the empty day rollup, the core-total count and the consistency window.
// They live apart from db/projections.ts so the Blueprint engine
// (blueprint/engine/projections.ts) can use them without importing the module
// that, under the ENGINE_V2 flag, imports the Blueprint engine.
import { addDays, format, parseISO } from 'date-fns';
import type { QuestCompletionRecord, QuestTemplate, SystemEvent } from '../engine/types';
import type { DayStreakOutcome, DayOutcome } from '../engine/streak';
import type { DayRollupRow, PlayerStateRow, QuestInstanceRow, QuestTemplateRow, XpLedgerRow } from './schema';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let d = start; d <= end; d = shiftDate(d, 1)) {
    dates.push(d);
  }
  return dates;
}

/**
 * Every calendar day from the arc's start through `uptoDate` (inclusive),
 * as the DayOutcome[] engine/streak.ts's streakFrom needs — gaps
 * (never-opened days) become misses, matching "a day with no instances
 * is a day that was never opened" (final/11 Step 2). Shared by the full
 * rebuild (db/projections.ts) and the live streak query (store/
 * streak.ts) so there is exactly one place that turns "opened dates +
 * completions + pauses" into day outcomes.
 *
 * `completions` must be `applyEvents(events, config).quests` — the
 * completion overlay, not a raw scan of QUEST_COMPLETED events. A raw
 * scan double-counts a quest that was completed, undone, and never
 * redone (that instance's completion event is still in the log even
 * though it no longer counts); the overlay already resolves that.
 *
 * MVD is approximated as "at least one core completion in effect that
 * day" rather than "day's capped XP >= mvdXp" — every core quest is
 * individually worth well over mvdXp (35) uncapped, and near the daily
 * cap a genuine completion's XP can be trimmed below 35 even though real
 * work happened; a presence check sidesteps that edge case rather than
 * risking a false miss on an otherwise-full day.
 */
export function buildDayOutcomes(
  events: SystemEvent[],
  completions: Record<string, QuestCompletionRecord>,
  arcStartDate: string,
  pausedDates: string[],
  uptoDate: string
): DayOutcome[] {
  if (uptoDate < arcStartDate) return [];

  const openedDates = new Set<string>();
  for (const event of events) {
    if (event.type === 'APP_OPENED') openedDates.add(event.local_date);
  }

  const datesWithACompletion = new Set(Object.values(completions).map((c) => c.local_date));

  const pausedSet = new Set(pausedDates);
  return enumerateDates(arcStartDate, uptoDate).map((localDate) => ({
    local_date: localDate,
    mvd_met: openedDates.has(localDate) && datesWithACompletion.has(localDate),
    paused: pausedSet.has(localDate),
  }));
}

export interface BuiltProjections {
  templates: QuestTemplateRow[];
  instances: QuestInstanceRow[];
  ledger: XpLedgerRow[];
  dayRollups: DayRollupRow[];
  playerState: PlayerStateRow | null;
}

export function emptyDayRollup(localDate: string, coreTotal: number): DayRollupRow {
  return {
    local_date: localDate,
    xp_earned: 0,
    xp_capped_away: 0,
    core_completed: 0,
    core_total: coreTotal,
    mvd_met: false,
    grace_applied: false,
    reduced_mode: false,
    deep_minutes: 0,
    longest_block_minutes: 0,
    problems: { E: 0, M: 0, H: 0, first_attempt: 0 },
    applications: 0,
    quality_applications: 0,
    learn_minutes: 0,
    build_mode_split: { LEARN: 0, SHIP: 0 },
    steps: 0,
    app_seconds: 0,
  };
}

export function coreTotalOn(templates: QuestTemplate[], localDate: string): number {
  return templates.filter(
    (t) => t.type === 'core' && t.active_from <= localDate && (t.active_to === null || localDate < t.active_to)
  ).length;
}

export function consistencyOver(history: DayStreakOutcome[], windowDays: number): number {
  const window = history.slice(-windowDays);
  const eligible = window.filter((d) => !d.paused);
  if (eligible.length === 0) return 0;
  const hits = eligible.filter((d) => d.mvd_met).length;
  return Math.round((hits / eligible.length) * 100);
}

