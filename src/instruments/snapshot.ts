import { addDays, format, parseISO } from 'date-fns';
import { streakFrom, type DayOutcome, type DayStreakOutcome } from '../engine/streak';
import type { EngineConfig, SystemEvent } from '../engine/types';

export type GlobalSignal = 'mvd_days' | 'core_completion' | 'bosses_cleared' | 'checkpoints_sealed' | 'grace_used';

export interface CoreCompletion {
  /** Stable quest-instance id; duplicate log records must not inflate progress. */
  questId: string;
  localDate: string;
}

export interface SignalDay extends DayStreakOutcome {
  coreCompleted: number;
  coreTotal: number;
}

export interface SignalSnapshot {
  from: string;
  to: string;
  days: readonly SignalDay[];
  global: Readonly<Record<GlobalSignal, number>>;
  value(signal: GlobalSignal): number;
}

export interface SignalSnapshotInput {
  arcStartDate: string;
  uptoDate: string;
  pausedDates: readonly string[];
  events: readonly Pick<SystemEvent, 'type' | 'local_date'>[];
  /** Completion overlay, after undone records have been removed. */
  coreCompletions: readonly CoreCompletion[];
  /** Number of applicable core quests on a date (zero when no quests exist). */
  coreTotalOn?: (localDate: string) => number;
  streak: EngineConfig['streak'];
}

function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

/**
 * Builds the one read-model input shared by V2 criteria, attributes, gates,
 * bosses and messages. It is pure and intentionally derives MVD exactly as
 * today's projection does: an opened day with a completion in the resolved
 * completion overlay. The caller supplies that overlay, so undone records
 * cannot leak back into a score.
 */
export function buildSignalSnapshot(input: SignalSnapshotInput): SignalSnapshot {
  if (input.uptoDate < input.arcStartDate) {
    const global: Record<GlobalSignal, number> = { mvd_days: 0, core_completion: 0, bosses_cleared: 0, checkpoints_sealed: 0, grace_used: 0 };
    return { from: input.arcStartDate, to: input.uptoDate, days: [], global, value: (signal) => global[signal] };
  }

  const openedDates = new Set(input.events.filter((event) => event.type === 'APP_OPENED').map((event) => event.local_date));
  const completionIdsByDate = new Map<string, Set<string>>();
  for (const completion of input.coreCompletions) {
    const ids = completionIdsByDate.get(completion.localDate) ?? new Set<string>();
    ids.add(completion.questId);
    completionIdsByDate.set(completion.localDate, ids);
  }
  const pausedDates = new Set(input.pausedDates);
  const outcomes: DayOutcome[] = datesBetween(input.arcStartDate, input.uptoDate).map((localDate) => ({
    local_date: localDate,
    mvd_met: openedDates.has(localDate) && (completionIdsByDate.get(localDate)?.size ?? 0) > 0,
    paused: pausedDates.has(localDate),
  }));
  const streak = streakFrom(outcomes, input.streak);
  const days = streak.history.map((day) => ({
    ...day,
    coreCompleted: completionIdsByDate.get(day.local_date)?.size ?? 0,
    coreTotal: input.coreTotalOn?.(day.local_date) ?? 0,
  }));
  const eligibleDays = days.filter((day) => !day.paused);
  const coreCompleted = eligibleDays.reduce((sum, day) => sum + day.coreCompleted, 0);
  const coreTotal = eligibleDays.reduce((sum, day) => sum + day.coreTotal, 0);
  const global: Record<GlobalSignal, number> = {
    mvd_days: days.filter((day) => day.mvd_met).length,
    core_completion: coreTotal === 0 ? 0 : coreCompleted / coreTotal,
    bosses_cleared: input.events.filter((event) => event.type === 'BOSS_CLEARED' && event.local_date <= input.uptoDate).length,
    checkpoints_sealed: input.events.filter((event) => event.type === 'CHECKPOINT_SEALED' && event.local_date <= input.uptoDate).length,
    grace_used: streak.grace_used_this_cycle,
  };
  return { from: input.arcStartDate, to: input.uptoDate, days, global, value: (signal) => global[signal] };
}
