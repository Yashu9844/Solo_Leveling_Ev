// The lapse flow — final/01 §6.3: "Yesterday: 4 of 6. BUILD and
// ATTENTION incomplete." + a recovery quest, +40 XP, expiring ~48h after
// the missed day. Approximated as a 2-calendar-day window (the app
// already operates in local_date terms everywhere else; an exact
// instant-based 48h window would need a local_date -> UTC instant
// conversion this codebase doesn't have yet — see the Slice 4 report).
//
// The post-lapse diagnostic tap ("Ran out of time" / "Too tired" / ...)
// is `reason` below, recorded on the QUEST_RECOVERED event itself (the
// UI lives in ui/screens/Today.tsx's recovery card). Its only consumer,
// final/01 §6.3's "3x wrong time in 14 days -> schedule-change proposal
// at the weekly review," is engine/rules.ts's WRONG_TIME_PATTERN rule.
import { addDays, format, parseISO } from 'date-fns';
import type { EngineConfig, EngineDeps, QuestRecoveredPayload } from '../engine/types';
import { applyEvents } from '../engine/reduce';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { getAllEvents } from '../db/events';
import { rebuildProjections } from '../db/projections';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

export interface RecoverableDay {
  localDate: string;
  coreCompleted: number;
  coreTotal: number;
  missedTitles: string[];
}

/** The most recent incomplete, unpaused, not-yet-recovered day within the
 * recovery window (today-1 or today-2), or null if nothing qualifies. */
export async function getRecoverableDay(today: string, config: EngineConfig): Promise<RecoverableDay | null> {
  const arc = await db.arc.toCollection().first();
  if (!arc) return null;

  const events = await getAllEvents();
  const state = applyEvents(events, config);
  if (!state.arc) return null;

  const candidates = [shiftDate(today, -1), shiftDate(today, -2)].filter((d) => d >= arc.start_date);
  const templates = await db.quest_template.toArray();

  for (const localDate of candidates) {
    if (state.recoveries[localDate]) continue;
    if (state.arc.paused_dates.includes(localDate)) continue;

    const coreTemplates = templates.filter(
      (t) => t.type === 'core' && t.active_from <= localDate && (t.active_to === null || localDate < t.active_to)
    );
    if (coreTemplates.length === 0) continue;

    const dayInstances = await db.quest_instance.where('local_date').equals(localDate).toArray();
    // A day with zero instances was never opened, not missed — same
    // distinction db/projections.ts's buildDayOutcomes makes for streak
    // purposes (engine/quests.ts: "a day with no instances is a day that
    // was never opened"). Without this, an arc whose start_date predates
    // the day the user actually begins (or a freshly onboarded arc in a
    // test/dev environment with a start_date in the past) surfaces a
    // bogus recovery card for days nobody ever saw.
    if (dayInstances.length === 0) continue;
    const completedTemplateIds = new Set(
      dayInstances.filter((i) => i.state === 'complete').map((i) => i.template_id)
    );
    const coreCompleted = coreTemplates.filter((t) => completedTemplateIds.has(t.id)).length;
    if (coreCompleted >= coreTemplates.length) continue; // a perfect day has nothing to recover

    return {
      localDate,
      coreCompleted,
      coreTotal: coreTemplates.length,
      missedTitles: coreTemplates.filter((t) => !completedTemplateIds.has(t.id)).map((t) => t.title),
    };
  }

  return null;
}

const REBUILD_TABLES_FOR_RECOVERY = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
];

/**
 * Claims the recovery quest for `missedDate` — one flat +40 XP grant,
 * max once per day (idem_key), regardless of how many quests were
 * missed. `reason` is the optional diagnostic tap; see the file header.
 *
 * `today` is the CLAIM day (the caller's already-computed current
 * local_date, via engine/time.ts's localDate) — the event's own
 * local_date, and so which day's cap and ledger the XP lands in. It is
 * NOT re-derived from deps.now() here: that would need the arc's
 * timezone/boundary hour to compute correctly, which this store
 * function has no reason to duplicate when the caller already has it.
 */
export async function claimRecovery(
  missedDate: string,
  today: string,
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps,
  reason?: QuestRecoveredPayload['reason']
): Promise<void> {
  await db.transaction('rw', REBUILD_TABLES_FOR_RECOVERY, async () => {
    const payload: QuestRecoveredPayload = { localDate: missedDate, reason };
    await appendEvent({
      id: deps.newId(),
      type: 'QUEST_RECOVERED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `recovery:${missedDate}`,
      schema_v: 1,
    });
    await rebuildProjections(config, deps);
  });
}
