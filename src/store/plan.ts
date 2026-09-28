import type {
  CoreQuestKey,
  EngineConfig,
  EngineDeps,
  ImplementationIntention,
  PlanAmendedPayload,
} from '../engine/types';
import { applyEvents } from '../engine/reduce';
import { DEFAULT_CONFIG } from '../engine/config';
import { appendEvent, getAllEvents } from '../db/events';
import { rebuildProjections } from '../db/projections';
import { db } from '../db/db';

/**
 * Reading and amending the three implementation intentions.
 *
 * These are the only "settings" in the app that are genuinely evidence,
 * so they belong in the event log rather than in localStorage
 * (design/03 §2 draws that line): an implementation intention is a
 * commitment the arc is measured against, and when you changed it is
 * part of the record.
 *
 * PLAN_AMENDED already existed for exactly this — engine/reduce.ts
 * keeps the latest one per quest key, "which is the amend in its name"
 * — it simply had no caller after onboarding.
 */

/** The three core quests that carry an implementation intention
 * (store/onboarding.ts writes exactly these). */
export const INTENTION_KEYS: CoreQuestKey[] = ['career', 'dsa', 'training'];

const REBUILD_TABLES = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
];

export async function getIntentions(): Promise<
  Partial<Record<CoreQuestKey, ImplementationIntention>>
> {
  const events = await getAllEvents();
  // The config only shapes XP and streak derivation here; intentions
  // come straight off PLAN_AMENDED, so the default is fine to read with.
  return applyEvents(events, DEFAULT_CONFIG).intentions;
}

/**
 * Appends a PLAN_AMENDED and rebuilds, so the quest templates pick the
 * new sentence up — templates are regenerated from the event-derived
 * intentions (db/projections.ts), not stored independently.
 *
 * The idempotency key carries the event's own timestamp rather than
 * only the quest key, because onboarding already claimed
 * `plan:<arc>:<key>`, and an amendment is a new fact rather than a
 * replay of an old one.
 */
export async function amendIntention(
  questKey: CoreQuestKey,
  implementationIntention: ImplementationIntention,
  arcId: string,
  localDate: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  await db.transaction('rw', REBUILD_TABLES, async () => {
    const payload: PlanAmendedPayload = { questKey, implementationIntention };
    await appendEvent({
      id: deps.newId(),
      type: 'PLAN_AMENDED',
      occurred_at: deps.now(),
      local_date: localDate,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `plan-amend:${arcId}:${questKey}:${deps.now()}`,
      schema_v: 1,
    });
    await rebuildProjections(config, deps);
  });
}

/** The arc's own clock, for the read-only rows on the System screen. */
export async function getArcClock(): Promise<{
  id: string;
  timezone: string;
  dayBoundaryHour: number;
  dayCloseHour: number;
} | null> {
  const arc = await db.arc.toCollection().first();
  if (!arc) return null;
  return {
    id: arc.id,
    timezone: arc.timezone,
    dayBoundaryHour: arc.day_boundary_hour,
    dayCloseHour: arc.day_close_hour,
  };
}
