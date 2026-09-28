// Orchestrates the live TODAY loop: reads templates + today's instances,
// generates any missing ones via the pure generateQuests, and — for
// every write that changes what the derived tables should say —
// appends the event and then calls db/projections.ts's rebuildProjections
// as the ONE mechanism that turns the event log into quest_template,
// quest_instance, xp_ledger, day_rollup and player_state.
//
// This replaced a Slice 3 design that hand-recomputed just one day's
// ledger per write. A full rebuild is simple, always correct by
// construction (there is exactly one code path from events to derived
// state, so it can't drift from itself), and — at this scale (a few
// thousand events over a 120-day arc, final/07 §4.7) — cheap enough that
// "do not optimise anything" wins over hand-rolled incrementality.
import type {
  EngineConfig,
  EngineDeps,
  QuestCompletedPayload,
  QuestInstance,
  QuestTemplate,
  QuestUndonePayload,
} from '../engine/types';
import { isDayClosed } from '../engine/time';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { rebuildProjections } from '../db/projections';

export interface TodayQuests {
  templates: QuestTemplate[];
  instances: QuestInstance[];
}

// Every table an event-append + rebuild can touch, for the outer
// transaction wrapping both — the same "one write, or none" atomicity
// as store/onboarding.ts, just extended to cover the rebuild too.
const REBUILD_TABLES = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
];

/** Loads (and, if needed, generates + persists) today's 6 core quest
 * instances, and records that this local day was opened. */
export async function loadTodayQuests(
  localDate: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<TodayQuests> {
  const arc = await db.arc.toCollection().first();
  if (!arc) {
    return { templates: [], instances: [] };
  }

  const alreadyOpened = await db.event.where('idem_key').equals(`app-opened:${localDate}`).first();
  if (!alreadyOpened) {
    const built = await db.transaction('rw', REBUILD_TABLES, async () => {
      await appendEvent({
        id: deps.newId(),
        type: 'APP_OPENED',
        occurred_at: deps.now(),
        local_date: localDate,
        arc_id: arc.id,
        payload: { seconds: 0 },
        source: 'system',
        idem_key: `app-opened:${localDate}`,
        schema_v: 1,
      });
      return rebuildProjections(config, deps);
    });
    return {
      templates: built.templates,
      instances: built.instances.filter((i) => i.local_date === localDate),
    };
  }

  const templates = await db.quest_template.toArray();
  const instances = await db.quest_instance.where('local_date').equals(localDate).toArray();
  return { templates, instances };
}

/** Number of prior QUEST_COMPLETED/QUEST_UNDONE events for this instance —
 * used as a monotonic idem_key suffix so a real re-completion after an
 * undo gets a fresh event, while two near-simultaneous taps of the SAME
 * toggle compute the same key and collide (the intended debounce). */
async function toggleSequence(instanceId: string): Promise<number> {
  const completed = await db.event.where('type').equals('QUEST_COMPLETED').toArray();
  const undone = await db.event.where('type').equals('QUEST_UNDONE').toArray();
  const matches = (rows: typeof completed) =>
    rows.filter((e) => (e.payload as { instanceId?: string }).instanceId === instanceId).length;
  return matches(completed) + matches(undone);
}

export async function completeQuest(
  instance: QuestInstance,
  templateKey: string,
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const now = deps.now();
  if (isDayClosed(now, config)) {
    return;
  }

  await db.transaction('rw', REBUILD_TABLES, async () => {
    const seq = await toggleSequence(instance.id);
    const payload: QuestCompletedPayload = {
      instanceId: instance.id,
      templateId: instance.template_id,
      questKey: templateKey as QuestCompletedPayload['questKey'],
      localDate: instance.local_date,
    };
    await appendEvent({
      id: deps.newId(),
      type: 'QUEST_COMPLETED',
      occurred_at: now,
      local_date: instance.local_date,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `quest-complete:${instance.id}:${seq}`,
      schema_v: 1,
    });
    await rebuildProjections(config, deps);
  });
}

export async function undoQuest(
  instance: QuestInstance,
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const now = deps.now();
  // Undo is allowed for the rest of the local day only, and never while
  // the day is closed (final/11 Step 5). A completed instance from a
  // prior local_date is never shown on TODAY in the first place — see
  // loadTodayQuests, which only ever reads/generates the current date.
  if (isDayClosed(now, config)) {
    return;
  }

  await db.transaction('rw', REBUILD_TABLES, async () => {
    const seq = await toggleSequence(instance.id);
    const payload: QuestUndonePayload = { instanceId: instance.id, localDate: instance.local_date };
    await appendEvent({
      id: deps.newId(),
      type: 'QUEST_UNDONE',
      occurred_at: now,
      local_date: instance.local_date,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `quest-undo:${instance.id}:${seq}`,
      schema_v: 1,
    });
    // XP is never earned back by deleting a row and never clawed back by
    // a negative one — a full rebuild is the mechanism. This instance is
    // no longer in the completed set, so its grant simply doesn't appear.
    await rebuildProjections(config, deps);
  });
}
