// final/04-physical-lifestyle.md §1-3 — training sessions and steps both
// auto-complete the TRAINING core quest (a session OR >= 8,000 steps,
// same "session_or_steps" criterion as engine/quests.ts's
// CORE_QUEST_CRITERIA.training), and steps additionally grant a flat BODY
// bonus at >= 10,000 (engine/xp.ts's STEPS_LOGGED case). Body measurements
// (weight/waist/bodyfat) share the metric_sample table but take a
// deliberately separate write path with NO auto-complete and NO XP —
// final/04 §1: "No XP for weight, waist, body fat, or any body
// measurement. Ever."
import { estimate1RM } from '../engine/training';
import type { EngineConfig, EngineDeps } from '../engine/types';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { completeQuest } from './quests';
import { rebuildProjections } from '../db/projections';
import type { MetricSampleRow, TrainingSessionRow } from '../db/schema';

const REBUILD_ADJACENT_TABLES = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
  db.training_session,
  db.metric_sample,
];

// Mirrors engine/quests.ts's CORE_QUEST_CRITERIA.training.steps (8,000) —
// same "read the constant from the criterion table, not re-invent it"
// convention store/career.ts and store/dsa.ts already use for their own
// thresholds.
const STEPS_COMPLETION_THRESHOLD = 8000;

async function maybeCompleteTrainingQuest(
  today: string,
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const templates = await db.quest_template.toArray();
  const trainingTemplate = templates.find((t) => t.key === 'training' && t.type === 'core');
  if (!trainingTemplate) return;

  const instance = (await db.quest_instance.where('local_date').equals(today).toArray()).find(
    (i) => i.template_id === trainingTemplate.id
  );
  if (!instance || instance.state === 'complete') return;

  const sessionsToday = await db.training_session.where('local_date').equals(today).count();
  const stepsToday = await getTodaySteps(today);

  if (sessionsToday >= 1 || stepsToday >= STEPS_COMPLETION_THRESHOLD) {
    await completeQuest(instance, 'training', arcId, config, deps);
  }
}

export interface LogTrainingSessionInput {
  type: string;
  minutes: number;
  rpe?: number;
  lifts?: { name: string; weight_kg: number; reps: number }[];
}

export async function logTrainingSession(
  today: string,
  arcId: string,
  input: LogTrainingSessionInput,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const id = deps.newId();
  const lifts = (input.lifts ?? []).map((lift) => ({
    ...lift,
    est_1rm: estimate1RM(lift.weight_kg, lift.reps),
  }));

  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'TRAINING_SESSION_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { localDate: today, type: input.type, minutes: input.minutes, rpe: input.rpe, lifts },
      source: 'user',
      idem_key: `training-session:${id}`,
      schema_v: 1,
    });
    const row: TrainingSessionRow = { id, local_date: today, type: input.type, minutes: input.minutes, rpe: input.rpe, lifts };
    await db.training_session.add(row);
  });

  await maybeCompleteTrainingQuest(today, arcId, config, deps);
}

export async function logSteps(today: string, arcId: string, steps: number, config: EngineConfig, deps: EngineDeps): Promise<void> {
  const id = deps.newId();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'STEPS_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { localDate: today, steps },
      source: 'user',
      idem_key: `steps:${id}`,
      schema_v: 1,
    });
    const row: MetricSampleRow = { id, local_date: today, kind: 'steps', value: steps, unit: 'steps' };
    await db.metric_sample.add(row);
  });

  await maybeCompleteTrainingQuest(today, arcId, config, deps);
  // The steps bonus (engine/xp.ts) needs a rebuild too; maybeComplete...
  // already triggers one when the quest fires, but that's conditional —
  // do it unconditionally so the bonus lands even on a day the quest was
  // already complete via a session. Same shape as store/build.ts's ship
  // bonus.
  await rebuildProjections(config, deps);
}

export async function getTodaySteps(today: string): Promise<number> {
  const samples = await db.metric_sample.where('local_date').equals(today).toArray();
  return samples.filter((s) => s.kind === 'steps').reduce((sum, s) => sum + s.value, 0);
}

export async function getTodayTrainingSessions(today: string): Promise<TrainingSessionRow[]> {
  return db.training_session.where('local_date').equals(today).toArray();
}

/**
 * Body measurements — final/04 §1's hard rule: never gate a quest, never
 * earn XP (engine/xp.ts's computeXp already returns [] for METRIC_RECORDED
 * by default; there is no bypass here). Still runs through
 * rebuildProjections to keep EngineState.baselineMetrics current, the same
 * "every write rebuilds" discipline every other store function follows —
 * not because this write has ledger consequences, it has none.
 */
export async function logBodyMetric(
  today: string,
  arcId: string,
  kind: 'weight_kg' | 'waist_cm' | 'bodyfat_pct',
  value: number,
  unit: string,
  config: EngineConfig,
  deps: EngineDeps,
  note?: string
): Promise<void> {
  const id = deps.newId();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'METRIC_RECORDED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { kind, value, unit, note },
      source: 'user',
      idem_key: `metric:${id}`,
      schema_v: 1,
    });
    const row: MetricSampleRow = { id, local_date: today, kind, value, unit, note };
    await db.metric_sample.add(row);
  });
  await rebuildProjections(config, deps);
}

/**
 * final/02 §2.2 / docs/04-domain-systems.md line 77 — the interview-
 * readiness benchmark ("solve 3 randomly-drawn mediums in 90 minutes
 * total, unseen, first-attempt, with a working solution and a stated
 * complexity") is explicitly "self-administered, logged, repeatable" —
 * no defined schema beyond that, so this is modelled the same way body
 * metrics are: a metric_sample of kind 'interview_benchmark', value 1
 * (pass) or 0 (attempted, not yet passed), no quest tie, no XP. Once
 * ANY attempt passes, engine/rank.ts's interviewBenchmarkPassed gate
 * stays true forever — "repeatable" describes retrying after a miss,
 * not re-proving a pass that already happened.
 */
export async function logInterviewBenchmark(
  today: string,
  arcId: string,
  passed: boolean,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const id = deps.newId();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id,
      type: 'METRIC_RECORDED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { kind: 'interview_benchmark', value: passed ? 1 : 0, unit: 'pass' },
      source: 'user',
      idem_key: `interview-benchmark:${id}`,
      schema_v: 1,
    });
    const row: MetricSampleRow = { id, local_date: today, kind: 'interview_benchmark', value: passed ? 1 : 0, unit: 'pass' };
    await db.metric_sample.add(row);
  });
  await rebuildProjections(config, deps);
}

export interface InterviewBenchmarkAttempt {
  local_date: string;
  passed: boolean;
}

export async function getInterviewBenchmarkHistory(): Promise<InterviewBenchmarkAttempt[]> {
  const rows = await db.metric_sample.where('kind').equals('interview_benchmark').toArray();
  return rows.map((r) => ({ local_date: r.local_date, passed: r.value === 1 })).sort((a, b) => a.local_date.localeCompare(b.local_date));
}

export async function getInterviewBenchmarkPassed(): Promise<boolean> {
  const rows = await db.metric_sample.where('kind').equals('interview_benchmark').toArray();
  return rows.some((r) => r.value === 1);
}

export interface MetricSeriesPoint {
  local_date: string;
  value: number;
}

/** 7-day mean + raw points — final/08's Slice 9 done-criterion. Body
 * metrics NEVER render a target line or a direction comment (final/04
 * §1) — that restriction lives in the UI layer, not here. */
export async function getMetricSeries(
  kind: MetricSampleRow['kind'],
  today: string,
  days = 7
): Promise<{ points: MetricSeriesPoint[]; mean: number | null }> {
  const all = await db.metric_sample.where('kind').equals(kind).toArray();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const points = all
    .filter((s) => s.local_date >= cutoffStr && s.local_date <= today)
    .sort((a, b) => a.local_date.localeCompare(b.local_date))
    .map((s) => ({ local_date: s.local_date, value: s.value }));

  const mean = points.length > 0 ? points.reduce((sum, p) => sum + p.value, 0) / points.length : null;
  return { points, mean };
}
