// The V2 counterpart of db/projections.ts#buildProjections: the five cache
// tables (quest_template, quest_instance, xp_ledger, day_rollup,
// player_state) derived from the event log AND a Blueprint, instead of from
// engine constants. For the owner's implicit LEGACY_BLUEPRINT_V1 the result is
// deep-equal to buildProjections (E1, platform/02 §22.2) — that equality is
// what lets the owner's engine be swapped without re-pricing a single day.
//
// Single-version for now: Phase 5 resolves `versionFor(date)` per day. The
// version list is already an argument so that change adds no new signature.
import type { BuiltProjections } from '../../db/projections';
import { buildDayOutcomes, consistencyOver, coreTotalOn, emptyDayRollup } from '../../db/projections';
import type { DayRollupRow, PlayerStateRow, QuestInstanceRow, QuestTemplateRow } from '../../db/schema';
import { DEFAULT_CONFIG } from '../../engine/config';
import { levelFor } from '../../engine/level';
import { generateQuests } from '../../engine/quests';
import { applyEvents } from '../../engine/reduce';
import { streakFrom } from '../../engine/streak';
import type { EngineDeps, QuestInstance, QuestTemplate, SystemEvent } from '../../engine/types';
import { engineConfigFromBlueprint } from '../engineConfig';
import { recordsFromEvents } from '../evaluate/env';
import { ledgerRowsV2 } from '../evaluate/ledger';
import { legacyBlueprintFor } from '../legacy/legacyV1';
import type { SystemBlueprint } from '../schema';

/**
 * The Blueprint versions in force for a log. A log with no BLUEPRINT_ACTIVATED
 * event is the owner's: implicit LEGACY_BLUEPRINT_V1 over the arc it recorded
 * (platform/02 §21.1) — no rows written, nothing to roll back.
 */
export function implicitLegacyVersions(events: SystemEvent[]): SystemBlueprint[] {
  const arc = applyEvents(events, DEFAULT_CONFIG).arc // the reducer ignores its config; a Blueprint config only exists once an arc does;
  if (!arc) return [];
  return [legacyBlueprintFor({
    id: arc.id, start_date: arc.start_date, end_date: arc.end_date, timezone: arc.timezone,
    day_boundary_hour: arc.day_boundary_hour, day_close_hour: arc.day_close_hour, main_quest_text: arc.main_quest_text, stake_text: arc.stake_text,
  })];
}

export function buildProjectionsV2(events: SystemEvent[], deps: EngineDeps, versions: SystemBlueprint[] = implicitLegacyVersions(events)): BuiltProjections {
  const blueprint = versions[0];
  if (!blueprint) return { templates: [], instances: [], ledger: [], dayRollups: [], playerState: null };
  const config = engineConfigFromBlueprint(blueprint);
  const state = applyEvents(events, config);
  const arc = state.arc;
  if (!arc) return { templates: [], instances: [], ledger: [], dayRollups: [], playerState: null };

  const channelOf = (domainId: string) => blueprint.domains.find((domain) => domain.id === domainId)!.channel.id;
  const templates: QuestTemplateRow[] = blueprint.quests.filter((quest) => quest.type === 'core').map((quest): QuestTemplate => ({
    id: `${arc.id}::${quest.id}`,
    arc_id: arc.id,
    type: 'core',
    key: quest.id as QuestTemplate['key'],
    title: quest.designation,
    category: channelOf(quest.domainId) as QuestTemplate['category'],
    xp: quest.xp,
    criterion: quest.rowCriterion ?? { kind: 'blueprint', criterion: quest.criterion },
    implementation_intention: state.intentions[quest.id as keyof typeof state.intentions],
    active_from: blueprint.activeFrom,
    active_to: null,
    locked_until_checkpoint: true,
  }));

  const appOpenedDates = new Set<string>();
  for (const event of events) {
    if (event.type === 'APP_OPENED' && event.local_date >= arc.start_date && event.local_date <= arc.end_date) appOpenedDates.add(event.local_date);
  }
  let instances: QuestInstance[] = [];
  for (const localDate of [...appOpenedDates].sort()) {
    instances = instances.concat(generateQuests(localDate, templates, [], config, deps));
  }
  const instanceRows: QuestInstanceRow[] = instances.map((instance) => {
    const record = state.quests[instance.id];
    return record ? { ...instance, state: 'complete' as const, completed_at: record.completed_at } : instance;
  });

  const ledger = ledgerRowsV2(blueprint, events, state.quests, recordsFromEvents(events));

  const openedDatesSorted = [...appOpenedDates].sort();
  const lastKnown = openedDatesSorted[openedDatesSorted.length - 1];
  if (!lastKnown) return { templates, instances: instanceRows, ledger, dayRollups: [], playerState: null };

  const streakResult = streakFrom(buildDayOutcomes(events, state.quests, arc.start_date, arc.paused_dates, lastKnown), config.streak);
  const streakByDate = new Map(streakResult.history.map((h) => [h.local_date, h]));
  const xpByDate = new Map<string, number>();
  const cappedAwayByDate = new Map<string, number>();
  for (const row of ledger) {
    xpByDate.set(row.local_date, (xpByDate.get(row.local_date) ?? 0) + row.amount);
    if (row.capped_from !== undefined) cappedAwayByDate.set(row.local_date, (cappedAwayByDate.get(row.local_date) ?? 0) + (row.capped_from - row.amount));
  }

  const dayRollups: DayRollupRow[] = openedDatesSorted.map((localDate) => {
    const streakDay = streakByDate.get(localDate);
    const review = state.reviews[localDate];
    return {
      ...emptyDayRollup(localDate, coreTotalOn(templates, localDate)),
      xp_earned: xpByDate.get(localDate) ?? 0,
      xp_capped_away: cappedAwayByDate.get(localDate) ?? 0,
      core_completed: instanceRows.filter((i) => i.local_date === localDate && i.state === 'complete').length,
      mvd_met: streakDay?.mvd_met ?? false,
      grace_applied: streakDay?.grace_applied ?? false,
      reduced_mode: streakDay?.reduced_mode ?? false,
      energy: review?.energy,
      focus: review?.focus,
      blocker: review?.blocker,
    };
  });

  const totalXp = ledger.reduce((sum, row) => sum + row.amount, 0);
  const level = levelFor(totalXp, config);
  const playerState: PlayerStateRow = {
    id: 'player',
    total_xp: totalXp,
    level: level.level,
    xp_into_level: level.xpIntoLevel,
    xp_for_next: level.xpForNext,
    rank: 'E', // rank is read from sealed checkpoints; player_state.rank has always been 'E'
    rank_since_day: 0,
    arc_streak: streakResult.arc_streak,
    consistency_7: consistencyOver(streakResult.history, 7),
    consistency_28: consistencyOver(streakResult.history, 28),
    grace_remaining: streakResult.grace_remaining,
    schema_v: 1,
  };
  return { templates, instances: instanceRows, ledger, dayRollups, playerState };
}
