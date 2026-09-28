/**
 * The System's voice — the live half.
 *
 * design/04-SYSTEM-MESSAGE-ENGINE.md §12 and §14. Everything this module
 * reads is already derived by another engine: db.day_rollup (kept current
 * by db/projections.ts's rebuildProjections on every write), the player's
 * XP, store/streak.ts, store/recovery.ts and the raw event log. Nothing
 * here re-derives a domain fact, and nothing here writes an event —
 * which sentence the System said is device state, not evidence about the
 * arc (design/00 §10).
 *
 * The one piece of real machinery is the fingerprint cache: a message is
 * chosen for a *state*, not for a moment, so a reload, a re-render or a
 * round trip through another tab returns the same line, and only a real
 * change in the Player's condition makes the System speak again.
 */
import { formatInTimeZone } from 'date-fns-tz';
import { addDays, format, parseISO } from 'date-fns';
import type { EngineConfig, EngineDeps } from '../engine/types';
import { isDayClosed } from '../engine/time';
import { levelFor } from '../engine/level';
import {
  bandFor,
  fingerprintFor,
  phaseFor,
  selectSystemMessage,
  tierFor,
  type ShowState,
  type SystemMessage,
  type SystemMessageContext,
} from '../engine/systemVoice';
import { VOICE_PACK } from '../engine/voicePack';
import { db } from '../db/db';
import { getTotalXp } from './playerState';
import { getStreakState } from './streak';
import { getRecoverableDay } from './recovery';
import { getCurrentRank } from './checkpoint';

/** engine/rank.ts's checkpoint ladder — the schedule, not a second copy of it. */
const CHECKPOINT_DAYS = [14, 30, 60, 90, 120] as const;

export interface Transmission {
  message: SystemMessage;
  fingerprint: string;
  context: SystemMessageContext;
}

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  );
}

/** IST (or whatever the arc's timezone is) wall clock as minutes since midnight. */
function minutesOfDayIn(instantIso: string, tz: string): number {
  const [hh, mm] = formatInTimeZone(parseISO(instantIso), tz, 'HH:mm').split(':');
  return Number(hh ?? 0) * 60 + Number(mm ?? 0);
}

/**
 * Everything the selector needs, in one pass over the derived tables.
 *
 * Reads are issued together rather than in sequence — this runs inside
 * Today's existing refresh, and a serial chain here would show up as
 * latency on the app's most important paint.
 */
export async function buildSystemMessageContext(
  today: string,
  arcDayNumber: number,
  config: EngineConfig,
  deps: Pick<EngineDeps, 'now'>
): Promise<SystemMessageContext | null> {
  const arc = await db.arc.toCollection().first();
  if (!arc) return null;

  const now = deps.now();
  const tz = config.arc.timezone;

  const [rollup, yesterdayRollup, totalXp, streakState, recoverable, rank, todayEvents, priorOpens] =
    await Promise.all([
      db.day_rollup.get(today),
      db.day_rollup.get(shiftDate(today, -1)),
      getTotalXp(),
      getStreakState(today, config),
      getRecoverableDay(today, config),
      getCurrentRank(),
      db.event.where('local_date').equals(today).toArray(),
      db.event.where('type').equals('APP_OPENED').toArray(),
    ]);

  const xpTarget = Object.values(config.coreQuests).reduce((sum, q) => sum + q.xp, 0);
  const xpEarned = rollup?.xp_earned ?? 0;
  const coreCompleted = rollup?.core_completed ?? 0;
  const coreTotal = rollup?.core_total ?? 0;
  const progressPct =
    xpTarget > 0 ? Math.max(0, Math.min(100, Math.round((xpEarned / xpTarget) * 100))) : 0;

  const level = levelFor(totalXp, config);
  // A level boundary crossed by today's XP alone. Pure arithmetic over two
  // pure calls — there is no LEVEL_UP event in this codebase to consume.
  const levelBefore = levelFor(Math.max(0, totalXp - xpEarned), config);

  const dayClosed = isDayClosed(now, config);
  const arcState: SystemMessageContext['arcState'] =
    today < arc.start_date ? 'before' : today > arc.end_date ? 'after' : 'active';

  const nextCheckpoint = CHECKPOINT_DAYS.find((d) => d >= arcDayNumber);
  // The newest APP_OPENED strictly before today — the gap that decides
  // whether this is a return after an absence. There are at most one per
  // day for the length of the arc, so scanning them is cheaper than a
  // compound key range.
  const lastOpen = priorOpens
    .map((e) => e.local_date)
    .filter((d) => d < today)
    .sort()
    .at(-1);

  return {
    localDate: today,
    arcDay: arcDayNumber,
    minutesOfDay: minutesOfDayIn(now, tz),
    phase: phaseFor(minutesOfDayIn(now, tz), dayClosed),
    dayClosed,
    arcState,

    xpEarned,
    xpTarget,
    progressPct,
    band: bandFor(progressPct, coreCompleted, coreTotal),
    coreCompleted,
    coreTotal,
    firstActionOfDay: coreCompleted === 1,

    level: level.level,
    xpIntoLevel: level.xpIntoLevel,
    xpForNext: level.xpForNext,
    rank,
    streak: streakState.arc_streak,
    consistency7: streakState.consistency_7,

    reducedMode: streakState.reduced_mode,
    recoveryAvailable: recoverable !== null,
    mvdMet: rollup?.mvd_met ?? false,

    daysToCheckpoint: nextCheckpoint === undefined ? null : nextCheckpoint - arcDayNumber,
    eventsToday: todayEvents.map((e) => e.type),
    leveledUpToday: level.level > levelBefore.level,
    yesterdayCleared: yesterdayRollup
      ? yesterdayRollup.core_total > 0 && yesterdayRollup.core_completed >= yesterdayRollup.core_total
      : null,
    daysSinceLastOpen: lastOpen ? daysBetween(lastOpen, today) : null,
  };
}

async function loadHistory(): Promise<Map<string, ShowState>> {
  const rows = await db.system_message_state.toArray();
  return new Map(
    rows.map((row) => [row.id, { times_shown: row.times_shown, last_shown_date: row.last_shown_date }])
  );
}

/**
 * The transmission for right now.
 *
 * Cache-first on the (local_date, fingerprint) pair: an unchanged state
 * performs zero writes and returns the line the Player has already read.
 * A changed one selects, persists and records the show.
 *
 * Persistence failures are swallowed on purpose. A private-mode browser
 * or a full quota must not cost the Player the message — the worst case
 * is a line that repeats sooner than its cooldown would have allowed,
 * which is strictly better than a blank surface.
 */
export async function resolveTransmission(
  today: string,
  arcDayNumber: number,
  config: EngineConfig,
  deps: Pick<EngineDeps, 'now'>
): Promise<Transmission | null> {
  const context = await buildSystemMessageContext(today, arcDayNumber, config, deps);
  if (!context) return null;

  const fingerprint = fingerprintFor(context, tierFor(context));
  const cached = await db.system_transmission.get(today);

  if (cached && cached.fingerprint === fingerprint) {
    const message = VOICE_PACK.find((m) => m.id === cached.message_id);
    // A missing id means the library changed under a cached row — fall
    // through to a fresh selection rather than showing nothing.
    if (message) return { message, fingerprint, context };
  }

  const history = await loadHistory();
  const selection = selectSystemMessage(VOICE_PACK, context, history);

  try {
    const existing = await db.system_message_state.get(selection.message.id);
    await db.system_message_state.put({
      id: selection.message.id,
      times_shown: (existing?.times_shown ?? 0) + 1,
      last_shown_date: today,
    });
    await db.system_transmission.put({
      local_date: today,
      fingerprint: selection.fingerprint,
      message_id: selection.message.id,
      chosen_at: deps.now(),
    });
  } catch {
    // Non-fatal by design — see the doc comment above.
  }

  return { message: selection.message, fingerprint: selection.fingerprint, context };
}
