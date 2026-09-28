// Arc Pause — final/01 §6.5: "Illness, travel, work crisis. One tap, up
// to 7 days. No quests generate, streak preserved, ... end date shifts.
// Zero penalty." Commits to a duration upfront; see engine/reduce.ts's
// ARC_PAUSED/ARC_RESUMED handling for why an early resume doesn't claw
// back the end-date shift.
import type { EngineConfig, EngineDeps, ArcPausedPayload, ArcResumedPayload } from '../engine/types';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { rebuildProjections } from '../db/projections';

const REBUILD_TABLES_FOR_PAUSE = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
];

/** `days` must be 1-7 (final/01 §6.5's "up to 7 days"). Enforced at the
 * call site (the UI control), not here — this function trusts its input
 * the way every other store/ write in this codebase does. */
export async function pauseArc(
  localDate: string,
  days: number,
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  await db.transaction('rw', REBUILD_TABLES_FOR_PAUSE, async () => {
    const payload: ArcPausedPayload = { localDate, days };
    await appendEvent({
      id: deps.newId(),
      type: 'ARC_PAUSED',
      occurred_at: deps.now(),
      local_date: localDate,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `arc-paused:${arcId}:${localDate}`,
      schema_v: 1,
    });
    await rebuildProjections(config, deps);
  });
}

export async function resumeArc(
  localDate: string,
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  await db.transaction('rw', REBUILD_TABLES_FOR_PAUSE, async () => {
    const payload: ArcResumedPayload = { localDate };
    await appendEvent({
      id: deps.newId(),
      type: 'ARC_RESUMED',
      occurred_at: deps.now(),
      local_date: localDate,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `arc-resumed:${arcId}:${localDate}`,
      schema_v: 1,
    });
    await rebuildProjections(config, deps);
  });
}
