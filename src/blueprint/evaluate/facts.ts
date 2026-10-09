// The arc-wide facts behind `global`, `quest` and `metric` signals
// (platform/02 §12). Each one restates a number the legacy store layer
// computes ad hoc — streak consistency, MVD days, "did a quest ever
// complete", boss and checkpoint status — in one place, as a pure function of
// the event log, the sealed-checkpoint rows and the quest instances.
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { buildDayOutcomes, consistencyOver } from '../../db/projections';
import type { QuestInstanceRow } from '../../db/schema';
import { ifThenFiringRate } from '../../engine/ifThen';
import { applyEvents } from '../../engine/reduce';
import { streakFrom } from '../../engine/streak';
import type { EngineConfig, QuestRecoveredPayload, SystemEvent } from '../../engine/types';
import { buildSignalSnapshot } from '../../instruments/snapshot';
import type { Aggregate, GlobalSignalName, SystemBlueprint } from '../schema';
import type { SignalFacts } from './signals';

/** The part of a checkpoint row the facts need. */
export interface CheckpointFact { day: number; sealed_at?: string; rank_after?: string }

export interface FactsInput {
  blueprint: SystemBlueprint;
  config: EngineConfig;
  events: readonly SystemEvent[];
  checkpoints: readonly CheckpointFact[];
  /** quest_instance rows (V2 or legacy), for the if-then firing rate. */
  instances: readonly Pick<QuestInstanceRow, 'template_id' | 'local_date' | 'state' | 'recovered'>[];
  /** xp_ledger rows (V2 or legacy), for XP-earned totals. */
  ledger?: readonly { local_date: string; amount: number }[];
  asOf: string;
}

export interface BuiltFacts {
  facts: SignalFacts;
  /** The attribute window: up to N non-paused dates ending at `asOf`, oldest first. */
  eligibleDates: ReadonlySet<string>;
}

export interface FactsHooks {
  /** Whether a boss counts as cleared as of now: formally cleared, or its window is open and its conditions all hold. */
  bossCleared(bossId: string): boolean;
}

function shift(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

/** Walks back from `asOf` skipping paused dates, collecting up to `windowDays` dates, never before the arc start. */
export function eligibleWindowDates(asOf: string, arcStartDate: string, pausedDates: readonly string[], windowDays: number): string[] {
  const paused = new Set(pausedDates);
  const dates: string[] = [];
  for (let cursor = asOf; dates.length < windowDays && cursor >= arcStartDate; cursor = shift(cursor, -1)) {
    if (!paused.has(cursor)) dates.push(cursor);
  }
  return dates.reverse();
}

export function buildFacts(input: FactsInput, hooks: FactsHooks): BuiltFacts {
  const { blueprint, config, events, checkpoints, instances, asOf } = input;
  const ledger = input.ledger ?? [];
  const state = applyEvents([...events], config);
  const arc = state.arc;
  const arcStart = arc?.start_date ?? blueprint.arc.startDate;
  const paused = arc?.paused_dates ?? [];
  const eligible = new Set(eligibleWindowDates(asOf, arcStart, paused, blueprint.progression.attributeWindowDays));
  const completions = Object.values(state.quests);

  // Day outcomes through today (MVD days, trailing-90) and through yesterday (consistency, as the live streak does).
  const throughToday = buildDayOutcomes([...events], state.quests, arcStart, paused, asOf);
  const yesterday = shift(asOf, -1);
  const throughYesterday = buildDayOutcomes([...events], state.quests, arcStart, paused, yesterday);
  const streakYesterday = throughYesterday.length > 0 ? streakFrom(throughYesterday, config.streak) : undefined;

  const sealed = (day: number) => checkpoints.some((checkpoint) => checkpoint.day === day && checkpoint.sealed_at !== undefined);

  const inAggregateWindow = (localDate: string, aggregate: Aggregate | undefined): boolean => {
    if (localDate > asOf) return false;
    switch (aggregate) {
      case 'day': return localDate === asOf;
      case 'eligible_28': return eligible.has(localDate);
      case 'window_7': return localDate >= shift(asOf, -6);
      case 'window_14': return localDate >= shift(asOf, -13);
      case 'window_28': return localDate >= shift(asOf, -27);
      case 'window_90': return localDate >= shift(asOf, -89);
      default: return true;
    }
  };

  const firableTemplateIds = new Set(blueprint.quests.filter((quest) => quest.intentionAllowed).map((quest) => `${arc?.id ?? blueprint.arcId}::${quest.id}`));
  const ifThenStart = shift(asOf, -59);

  const facts: SignalFacts = {
    global(signal: GlobalSignalName, id, aggregate) {
      switch (signal) {
        case 'consistency_14': return streakYesterday ? consistencyOver(streakYesterday.history, 14) / 100 : 0;
        case 'consistency_28': return streakYesterday ? consistencyOver(streakYesterday.history, 28) / 100 : 0;
        case 'mvd_days': {
          const days = aggregate === 'window_90' ? throughToday.slice(-90) : throughToday;
          return days.filter((day) => day.mvd_met).length;
        }
        case 'completion_days': return new Set(completions.filter((c) => inAggregateWindow(c.local_date, aggregate)).map((c) => c.local_date)).size;
        case 'window_days': return eligible.size;
        case 'first_quest': return completions.length > 0 ? 1 : 0;
        case 'recovered_after_gap':
          return events.some((e) => e.type === 'QUEST_RECOVERED' && differenceInCalendarDays(parseISO(e.local_date), parseISO((e.payload as unknown as QuestRecoveredPayload).localDate)) >= 2) ? 1 : 0;
        case 'if_then_rate':
          return ifThenFiringRate(instances.filter((i) => firableTemplateIds.has(i.template_id) && i.local_date >= ifThenStart && i.local_date <= asOf));
        case 'boss_cleared': return id !== undefined && hooks.bossCleared(id) ? 1 : 0;
        case 'checkpoint_sealed': return id !== undefined && sealed(Number(id)) ? 1 : 0;
        case 'prior_checkpoints_sealed': return [14, 30, 60, 90].filter(sealed).length;
        case 'xp_earned': return ledger.filter((row) => inAggregateWindow(row.local_date, aggregate)).reduce((sum, row) => sum + row.amount, 0);
        case 'bosses_cleared': return events.filter((e) => e.type === 'BOSS_CLEARED' && e.local_date <= asOf).length;
        case 'checkpoints_sealed': return checkpoints.filter((checkpoint) => checkpoint.sealed_at !== undefined).length;
        case 'grace_used': return streakYesterday?.grace_used_this_cycle ?? 0;
        case 'core_completion': {
          const snapshot = buildSignalSnapshot({
            arcStartDate: arcStart, uptoDate: asOf, pausedDates: paused, events, streak: config.streak,
            coreCompletions: completions.map((c) => ({ questId: c.instance_id, localDate: c.local_date })),
            coreTotalOn: () => blueprint.quests.filter((quest) => quest.type === 'core').length,
          });
          return snapshot.value('core_completion');
        }
      }
    },
    questCompletedDays(questId, aggregate) {
      return new Set(completions.filter((c) => (questId === '*' || c.quest_key === questId) && inAggregateWindow(c.local_date, aggregate)).map((c) => c.local_date)).size;
    },
    metricValues(metricId) {
      return events
        .filter((e) => e.type === 'METRIC_RECORDED' && !e.idem_key.startsWith('baseline:') && e.local_date <= asOf && (e.payload as { kind?: string }).kind === metricId)
        .map((e) => (e.payload as { value: number }).value);
    },
  };
  return { facts, eligibleDates: eligible };
}
