// final/04-physical-lifestyle.md §4-6 — SLEEP (numeric wake-time entry
// within tolerance of the target), ATTENTION (numeric screen-time entry
// under the limit — "Never yes/no. Never an estimate."), and Maintenance
// (one zero-pressure daily row, its own flat XP, excluded from every
// attribute/rank gate and from core-completion %).
import { isLaundryDue, maintenanceAllDone } from '../engine/maintenance';
import { withinWakeWindow } from '../engine/sleep';
import type { EngineConfig, EngineDeps } from '../engine/types';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { completeQuest } from './quests';
import { rebuildProjections } from '../db/projections';
import type { MaintenanceLogRow, MetricSampleRow } from '../db/schema';

const REBUILD_ADJACENT_TABLES = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
  db.metric_sample,
  db.maintenance_log,
];

// Mirrors engine/quests.ts's CORE_QUEST_CRITERIA — same convention as
// store/training.ts's STEPS_COMPLETION_THRESHOLD. Exported so
// store/weeklyReview.ts's sleep/DSA correlation uses the exact same
// tolerance, not a fourth hand-copied 30.
export const SLEEP_TOLERANCE_MINUTES = 30;
const ATTENTION_LIMIT_MINUTES = 60;

async function findCoreInstance(today: string, key: 'sleep' | 'attention') {
  const templates = await db.quest_template.toArray();
  const template = templates.find((t) => t.key === key && t.type === 'core');
  if (!template) return undefined;
  const instance = (await db.quest_instance.where('local_date').equals(today).toArray()).find(
    (i) => i.template_id === template.id
  );
  if (!instance || instance.state === 'complete') return undefined;
  return instance;
}

export async function logSleep(
  today: string,
  arcId: string,
  wakeTime: string,
  config: EngineConfig,
  deps: EngineDeps,
  sleepTime?: string
): Promise<void> {
  const id = deps.newId();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'SLEEP_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { localDate: today, wakeTime, sleepTime },
      source: 'user',
      idem_key: `sleep:${id}`,
      schema_v: 1,
    });
    const wakeRow: MetricSampleRow = { id, local_date: today, kind: 'wake_time', value: toMinutesSinceMidnight(wakeTime), unit: 'min' };
    await db.metric_sample.add(wakeRow);
    if (sleepTime) {
      // Deterministic from the event's own id (not a fresh deps.newId())
      // so db/domainProjections.ts's rebuild fold — which only has the
      // event, not a second generated id — can reproduce this row's pk
      // exactly, the same reasoning as every composite-key id elsewhere
      // in this codebase (engine/quests.ts's template/instance ids).
      const sleepRow: MetricSampleRow = {
        id: `${id}::sleep`,
        local_date: today,
        kind: 'sleep_time',
        value: toMinutesSinceMidnight(sleepTime),
        unit: 'min',
      };
      await db.metric_sample.add(sleepRow);
    }
  });

  const instance = await findCoreInstance(today, 'sleep');
  if (instance && withinWakeWindow(wakeTime, config.wakeTargetTime, SLEEP_TOLERANCE_MINUTES)) {
    await completeQuest(instance, 'sleep', arcId, config, deps);
  }
}

function toMinutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export async function logScreentime(
  today: string,
  arcId: string,
  minutes: number,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const id = deps.newId();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'SCREENTIME_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { localDate: today, minutes },
      source: 'user',
      idem_key: `screentime:${id}`,
      schema_v: 1,
    });
    const row: MetricSampleRow = { id, local_date: today, kind: 'screen_time_min', value: minutes, unit: 'min' };
    await db.metric_sample.add(row);
  });

  const instance = await findCoreInstance(today, 'attention');
  if (instance && minutes <= ATTENTION_LIMIT_MINUTES) {
    await completeQuest(instance, 'attention', arcId, config, deps);
  }
}

export interface MaintenanceInput {
  bath: boolean;
  fuel: boolean;
  laundry: boolean;
}

/** Upserts today's single Maintenance row (pk = local_date) and appends a
 * MAINTENANCE_LOGGED event carrying the computed all-done flag — the flat
 * 20 XP (engine/xp.ts) fires only when it's true. Never touches any core
 * quest, attribute, or rank gate — final/04 §6. */
export async function logMaintenance(
  today: string,
  arcId: string,
  input: MaintenanceInput,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const arc = await db.arc.toCollection().first();
  const arcStartDate = arc?.start_date ?? today;
  const laundryDue = isLaundryDue(today, arcStartDate, config.maintenanceLaundryEveryDays);
  const allDone = maintenanceAllDone(input.bath, input.fuel, laundryDue, input.laundry);

  const id = deps.newId();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'MAINTENANCE_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { localDate: today, bath: input.bath, fuel: input.fuel, laundry: input.laundry, allDone },
      source: 'user',
      idem_key: `maintenance:${id}`,
      schema_v: 1,
    });
    const row: MaintenanceLogRow = { local_date: today, bath: input.bath, fuel: input.fuel, laundry: input.laundry, all_done: allDone };
    await db.maintenance_log.put(row);
  });

  await rebuildProjections(config, deps);
}

export async function getTodayMaintenance(today: string, arcStartDate: string, everyDays: number): Promise<{ row: MaintenanceLogRow | undefined; laundryDue: boolean }> {
  const row = await db.maintenance_log.get(today);
  return { row, laundryDue: isLaundryDue(today, arcStartDate, everyDays) };
}
