// Slice 3's structural fix: quest_template, quest_instance and xp_ledger
// are now CACHES, fully derivable from the event log alone — the event
// log is the only source of truth (final/07 §5, §6). This is what makes
// an export-wipe-import backup complete, and what verifyIntegrity() has
// something real to diff against. Slice 4 extends the same rebuild to
// day_rollup and player_state, using engine/streak.ts's streakFrom.
//
// generateCoreQuestTemplates and generateQuests derive stable, composite-
// key ids (not deps.newId()) specifically so a rebuild reproduces the
// exact ids that QUEST_COMPLETED/QUEST_UNDONE events already reference —
// see the doc comments on both in engine/quests.ts.
import { addDays, format, parseISO } from 'date-fns';
import type {
  EngineConfig,
  EngineDeps,
  QuestCompletedPayload,
  QuestCompletionRecord,
  QuestInstance,
  QuestTemplate,
  SystemEvent,
} from '../engine/types';
import { applyEvents } from '../engine/reduce';
import { generateCoreQuestTemplates, generateQuests } from '../engine/quests';
import { computeDayLedger } from '../engine/xp';
import { levelFor } from '../engine/level';
import { streakFrom, type DayOutcome, type DayStreakOutcome } from '../engine/streak';
import { db } from './db';
import { getAllEvents } from './events';
import { buildDomainTables } from './domainProjections';
import type { DayRollupRow, PlayerStateRow, QuestInstanceRow, QuestTemplateRow, XpLedgerRow } from './schema';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

// Every XP-bearing event type OTHER than QUEST_COMPLETED (which is
// folded via state.quests instead, so an undone completion doesn't
// contribute a stale grant — see the comment where this is used). Must
// stay in sync with engine/xp.ts's computeXp: any case added there
// beyond QUEST_COMPLETED needs an entry here too, or a rebuild silently
// drops its XP from the ledger.
const NON_COMPLETION_XP_EVENT_TYPES: ReadonlySet<SystemEvent['type']> = new Set([
  'QUEST_RECOVERED',
  'PROBLEM_REVISITED',
  'ARTIFACT_SHIPPED',
  'LEARNING_BLOCK_LOGGED',
  'SYSTEM_DESIGN_LOGGED',
  'STEPS_LOGGED',
  'MAINTENANCE_LOGGED',
  'BOSS_CLEARED',
  'WEEKLY_QUEST_COMPLETED',
]);

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

function emptyDayRollup(localDate: string, coreTotal: number): DayRollupRow {
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

function coreTotalOn(templates: QuestTemplate[], localDate: string): number {
  return templates.filter(
    (t) => t.type === 'core' && t.active_from <= localDate && (t.active_to === null || localDate < t.active_to)
  ).length;
}

function consistencyOver(history: DayStreakOutcome[], windowDays: number): number {
  const window = history.slice(-windowDays);
  const eligible = window.filter((d) => !d.paused);
  if (eligible.length === 0) return 0;
  const hits = eligible.filter((d) => d.mvd_met).length;
  return Math.round((hits / eligible.length) * 100);
}

/**
 * Pure assembly: event log -> the five cache tables' rows, in memory.
 * The single place both rebuildProjections (writes them) and
 * verifyIntegrity (diffs them against the live tables) do this — one
 * implementation, so they can never quietly diverge from each other.
 *
 * day_rollup and player_state are built over EVERY day the log knows
 * about, including the most recent one if it was opened — a full,
 * point-in-time snapshot suited to backup/integrity. The live TODAY
 * screen does NOT read these for its real-time streak display (a
 * still-in-progress "today" would wrongly score as a miss); it uses
 * store/streak.ts's getStreakState, which excludes today by construction.
 */
/** Pure — no db access. Exported for tests/engine/fuzz.test.ts's reducer
 * fuzz (final/08 §3.4): the single computation rebuildProjections and
 * verifyIntegrity both wrap with real IndexedDB I/O, callable directly
 * against an in-memory event log for fast, DB-free invariant checking. */
export function buildProjections(events: SystemEvent[], config: EngineConfig, deps: EngineDeps): BuiltProjections {
  const state = applyEvents(events, config);
  if (!state.arc) {
    return { templates: [], instances: [], ledger: [], dayRollups: [], playerState: null };
  }
  const arc = state.arc;

  const templates = generateCoreQuestTemplates(arc.id, state.intentions, config, deps);

  // "Was this day opened" is a recorded fact (APP_OPENED), not an
  // inference from whichever instance rows happen to exist in a cache.
  const appOpenedDates = new Set<string>();
  for (const event of events) {
    if (event.type === 'APP_OPENED' && event.local_date >= arc.start_date && event.local_date <= arc.end_date) {
      appOpenedDates.add(event.local_date);
    }
  }

  let instances: QuestInstance[] = [];
  for (const localDate of [...appOpenedDates].sort()) {
    instances = instances.concat(generateQuests(localDate, templates, [], config, deps));
  }
  instances = instances.map((instance) => {
    const record = state.quests[instance.id];
    if (!record) return instance;
    return { ...instance, state: 'complete' as const, completed_at: record.completed_at };
  });

  // Every XP-relevant event, grouped by the day it actually lands on
  // (caps are per real calendar day of activity). QUEST_COMPLETED comes
  // from state.quests (the completion overlay) rather than a raw scan of
  // the log, so an instance that was completed then undone doesn't
  // contribute a stale grant. QUEST_RECOVERED is grouped by the event's
  // own local_date (the day you tapped the button), not payload.localDate
  // (the missed day it refers to) — XP lands, and caps apply, on the day
  // it was actually granted.
  const ledgerEventsByDate = new Map<string, SystemEvent[]>();
  function addLedgerEvent(localDate: string, event: SystemEvent) {
    const list = ledgerEventsByDate.get(localDate) ?? [];
    list.push(event);
    ledgerEventsByDate.set(localDate, list);
  }

  for (const record of Object.values(state.quests)) {
    const payload: QuestCompletedPayload = {
      instanceId: record.instance_id,
      templateId: record.template_id,
      questKey: record.quest_key,
      localDate: record.local_date,
    };
    addLedgerEvent(record.local_date, {
      id: record.event_id,
      type: 'QUEST_COMPLETED',
      occurred_at: record.completed_at,
      local_date: record.local_date,
      arc_id: arc.id,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `quest-complete:${record.instance_id}`,
      schema_v: 1,
    });
  }
  for (const event of events) {
    if (NON_COMPLETION_XP_EVENT_TYPES.has(event.type)) {
      addLedgerEvent(event.local_date, event);
    }
  }

  const ledger: XpLedgerRow[] = [];
  for (const [localDate, dayEvents] of ledgerEventsByDate) {
    const entries = computeDayLedger(localDate, dayEvents, config);
    for (const entry of entries) {
      ledger.push({
        id: entry.instanceId ? `${entry.instanceId}::xp` : `${entry.eventId}::xp`,
        event_id: entry.eventId,
        instance_id: entry.instanceId,
        local_date: localDate,
        amount: entry.amount,
        category: entry.category,
        reason: entry.reason,
        capped_from: entry.cappedFrom,
      });
    }
  }

  const openedDatesSorted = [...appOpenedDates].sort();
  const lastKnown = openedDatesSorted[openedDatesSorted.length - 1];

  if (!lastKnown) {
    return { templates, instances, ledger, dayRollups: [], playerState: null };
  }

  const dayOutcomes = buildDayOutcomes(events, state.quests, arc.start_date, arc.paused_dates, lastKnown);
  const streakResult = streakFrom(dayOutcomes, config.streak);
  const streakByDate = new Map(streakResult.history.map((h) => [h.local_date, h]));

  const xpByDate = new Map<string, number>();
  const cappedAwayByDate = new Map<string, number>();
  for (const row of ledger) {
    xpByDate.set(row.local_date, (xpByDate.get(row.local_date) ?? 0) + row.amount);
    if (row.capped_from !== undefined) {
      const trimmed = row.capped_from - row.amount;
      cappedAwayByDate.set(row.local_date, (cappedAwayByDate.get(row.local_date) ?? 0) + trimmed);
    }
  }

  const dayRollups: DayRollupRow[] = openedDatesSorted.map((localDate) => {
    const coreTotal = coreTotalOn(templates, localDate);
    const coreCompleted = instances.filter((i) => i.local_date === localDate && i.state === 'complete').length;
    const streakDay = streakByDate.get(localDate);
    const base = emptyDayRollup(localDate, coreTotal);
    const review = state.reviews[localDate];
    return {
      ...base,
      xp_earned: xpByDate.get(localDate) ?? 0,
      xp_capped_away: cappedAwayByDate.get(localDate) ?? 0,
      core_completed: coreCompleted,
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
    rank: 'E', // hardcoded until rank.ts — Slice 12
    rank_since_day: 0,
    arc_streak: streakResult.arc_streak,
    consistency_7: consistencyOver(streakResult.history, 7),
    consistency_28: consistencyOver(streakResult.history, 28),
    grace_remaining: streakResult.grace_remaining,
    schema_v: 1,
  };

  return { templates, instances, ledger, dayRollups, playerState };
}

/**
 * Rebuilds every derived table from the event log alone. Wipes and
 * repopulates quest_template, quest_instance, xp_ledger, day_rollup and
 * player_state. Deterministic: same log + same config -> identical
 * tables (same rows, same ids). Returns what it wrote, so a caller that
 * just appended an event (store/quests.ts, store/streak.ts) can rebuild
 * as its ONE mechanism for staying correct and read the fresh result
 * back without a second round-trip to the db.
 */
export async function rebuildProjections(
  config: EngineConfig,
  deps: EngineDeps
): Promise<BuiltProjections> {
  const events = await getAllEvents();
  const built = buildProjections(events, config, deps);

  await db.transaction(
    'rw',
    [db.quest_template, db.quest_instance, db.xp_ledger, db.day_rollup, db.player_state],
    async () => {
      await db.quest_template.clear();
      await db.quest_instance.clear();
      await db.xp_ledger.clear();
      await db.day_rollup.clear();
      await db.player_state.clear();
      if (built.templates.length > 0) await db.quest_template.bulkAdd(built.templates);
      if (built.instances.length > 0) await db.quest_instance.bulkAdd(built.instances);
      if (built.ledger.length > 0) await db.xp_ledger.bulkAdd(built.ledger);
      if (built.dayRollups.length > 0) await db.day_rollup.bulkAdd(built.dayRollups);
      if (built.playerState) await db.player_state.add(built.playerState);
    }
  );

  return built;
}

export interface IntegrityReport {
  clean: boolean;
  discrepancies: string[];
}

/**
 * Rebuilds into memory (never touches the db) and diffs against the live
 * tables. Dev-only surface — used by projections.test.ts and the Profile
 * dev action.
 */
export async function verifyIntegrity(config: EngineConfig, deps: EngineDeps): Promise<IntegrityReport> {
  const events = await getAllEvents();
  const rebuilt = buildProjections(events, config, deps);

  const liveTemplates = await db.quest_template.toArray();
  const liveInstances = await db.quest_instance.toArray();
  const liveLedger = await db.xp_ledger.toArray();
  const liveDayRollups = await db.day_rollup.toArray();
  const livePlayerState = await db.player_state.toArray();

  const discrepancies: string[] = [];
  diffById('quest_template', liveTemplates, rebuilt.templates, discrepancies);
  diffById('quest_instance', liveInstances, rebuilt.instances, discrepancies);
  diffById('xp_ledger', liveLedger, rebuilt.ledger, discrepancies);
  diffById(
    'day_rollup',
    liveDayRollups.map((r) => ({ ...r, id: r.local_date })),
    rebuilt.dayRollups.map((r) => ({ ...r, id: r.local_date })),
    discrepancies
  );
  const rebuiltPlayerState = rebuilt.playerState ? [rebuilt.playerState] : [];
  diffById('player_state', livePlayerState, rebuiltPlayerState, discrepancies);

  // Slice 13 — the domain detail tables (applications, DSA problems,
  // training sessions, etc.) are folded separately from the five tables
  // above (db/domainProjections.ts), not as part of buildProjections —
  // see that module's header for why they stay a separate fold. Verified
  // here all the same, so "clean" means the whole database matches the
  // event log, not just the quest/XP/streak slice of it.
  const domain = buildDomainTables(events, config);
  diffById('application', await db.application.toArray(), domain.applications, discrepancies);
  diffById('career_event', await db.career_event.toArray(), domain.careerEvents, discrepancies);
  diffById('resume_version', await db.resume_version.toArray(), domain.resumeVersions, discrepancies);
  diffById('dsa_problem', await db.dsa_problem.toArray(), domain.dsaProblems, discrepancies);
  diffById('dsa_attempt', await db.dsa_attempt.toArray(), domain.dsaAttempts, discrepancies);
  diffById('learning_block', await db.learning_block.toArray(), domain.learningBlocks, discrepancies);
  diffById('system_design_study', await db.system_design_study.toArray(), domain.systemDesigns, discrepancies);
  diffById('build_session', await db.build_session.toArray(), domain.buildSessions, discrepancies);
  diffById('artifact', await db.artifact.toArray(), domain.artifacts, discrepancies);
  diffById('training_session', await db.training_session.toArray(), domain.trainingSessions, discrepancies);
  diffById('metric_sample', await db.metric_sample.toArray(), domain.metricSamples, discrepancies);
  diffById(
    'maintenance_log',
    (await db.maintenance_log.toArray()).map((r) => ({ ...r, id: r.local_date })),
    domain.maintenanceLogs.map((r) => ({ ...r, id: r.local_date })),
    discrepancies
  );

  return { clean: discrepancies.length === 0, discrepancies };
}

function diffById<T extends { id: string }>(table: string, live: T[], rebuilt: T[], out: string[]): void {
  const liveById = new Map(live.map((row) => [row.id, row]));
  const rebuiltById = new Map(rebuilt.map((row) => [row.id, row]));

  for (const [id, row] of rebuiltById) {
    const liveRow = liveById.get(id);
    if (!liveRow) {
      out.push(`${table}: missing live row for rebuilt id ${id}`);
    } else if (JSON.stringify(liveRow) !== JSON.stringify(row)) {
      out.push(`${table}: row ${id} differs from rebuild`);
    }
  }
  for (const id of liveById.keys()) {
    if (!rebuiltById.has(id)) {
      out.push(`${table}: live row ${id} has no counterpart in the rebuild`);
    }
  }
}
