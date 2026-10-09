// The V2 counterpart of db/projections.ts#buildProjections: the five cache
// tables (quest_template, quest_instance, xp_ledger, day_rollup,
// player_state) derived from the event log AND the Blueprint versions in force,
// instead of from engine constants. For the owner's implicit LEGACY_BLUEPRINT_V1
// the result is deep-equal to buildProjections (E1, platform/02 §22.2) - that
// equality is what lets the owner's engine be swapped without re-pricing a day.
//
// Versioned (platform/02 §19-20): every date is computed under versionFor(date).
// A quest that continues across versions keeps its id and so its instance ids
// (H3); a quest a later version drops stops generating instances from that
// version's start date; the ledger prices each day by the version in force on
// it (H2) and, once a log has explicit versions, records which one (H6). The
// progression section (level curve, streak rules, window) is pinned at genesis
// (V-TRN-04), so those are read from the first version.
import { buildDayOutcomes, consistencyOver, coreTotalOn, emptyDayRollup, type BuiltProjections } from '../../db/projectionParts';
import type { DayRollupRow, PlayerStateRow, QuestInstanceRow, QuestTemplateRow } from '../../db/schema';
import { levelFor } from '../../engine/level';
import { generateQuests } from '../../engine/quests';
import { applyEvents } from '../../engine/reduce';
import { streakFrom } from '../../engine/streak';
import type { EngineDeps, QuestInstance, QuestTemplate, SystemEvent } from '../../engine/types';
import { engineConfigFromBlueprint } from '../engineConfig';
import { recordsFromEvents } from '../evaluate/env';
import { ledgerRowsV2 } from '../evaluate/ledger';
import { resolveBlueprints, versionFor } from '../resolve';
import type { QuestTemplateDef, SystemBlueprint } from '../schema';

const NOTHING: BuiltProjections = { templates: [], instances: [], ledger: [], dayRollups: [], playerState: null };

/** Whether rows should record the Blueprint version that produced them: only for logs with explicit versions. */
export function stampsVersions(versions: readonly SystemBlueprint[]): boolean {
  return versions.length > 1 || versions[0]?.provenance.generator !== 'legacy';
}

interface QuestRun {
  quest: QuestTemplateDef;
  version: SystemBlueprint;
  from: string;
  /** Index of the last version containing the quest. */
  last: number;
}

/**
 * One template row per quest id. It spans the quest's first contiguous run of
 * versions: active from the first version that has it, until the first later
 * version that does not. The row's wording and XP are the latest version's.
 */
function questTemplates(versions: readonly SystemBlueprint[], arcId: string, intentions: Record<string, QuestTemplate['implementation_intention']>): QuestTemplateRow[] {
  const runs = new Map<string, QuestRun>();
  versions.forEach((version, index) => {
    for (const quest of version.quests.filter((candidate) => candidate.type === 'core')) {
      const run = runs.get(quest.id);
      if (!run) runs.set(quest.id, { quest, version, from: version.activeFrom, last: index });
      else if (run.last === index - 1) Object.assign(run, { quest, version, last: index });
      // A quest that returns after a gap does not reopen its old row: ids are stable, history is not rewritten.
    }
  });
  return [...runs].map(([questId, run]): QuestTemplate => {
    const nextVersion = versions[run.last + 1];
    const domain = run.version.domains.find((candidate) => candidate.id === run.quest.domainId)!;
    return {
      id: `${arcId}::${questId}`,
      arc_id: arcId,
      type: 'core',
      key: questId as QuestTemplate['key'],
      title: run.quest.designation,
      category: domain.channel.id as QuestTemplate['category'],
      xp: run.quest.xp,
      criterion: run.quest.rowCriterion ?? { kind: 'blueprint', criterion: run.quest.criterion },
      implementation_intention: intentions[questId],
      active_from: run.from,
      active_to: nextVersion ? nextVersion.activeFrom : null,
      locked_until_checkpoint: true,
    };
  });
}

export function buildProjectionsV2(events: SystemEvent[], deps: EngineDeps, versions: SystemBlueprint[] = resolveBlueprints(events).versions): BuiltProjections {
  const genesis = versions[0];
  if (!genesis) return NOTHING;
  const config = engineConfigFromBlueprint(genesis);
  const state = applyEvents(events, config);
  const arc = state.arc;
  if (!arc) return NOTHING;
  const stamp = stampsVersions(versions);

  const templates: QuestTemplateRow[] = questTemplates(versions, arc.id, state.intentions as Record<string, QuestTemplate['implementation_intention']>);

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

  const ledger = ledgerRowsV2(versions, events, state.quests, recordsFromEvents(events), stamp);

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
      ...(stamp ? { blueprint_version: (versionFor(versions, localDate) ?? genesis).version } : {}),
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
