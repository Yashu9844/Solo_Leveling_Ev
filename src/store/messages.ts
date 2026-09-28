// final/05-motivation-moments-notifications.md §1.1 — real evidence for
// engine/messages.ts's P1-P3 tiers. Every field is computed from the
// same tables store/checkpoint.ts's computeGateEvidence and
// store/attributes.ts's getAttributes already read; nothing new is
// invented here, just a different cut of the same data.
import { addDays, format, parseISO } from 'date-fns';
import type { EngineConfig } from '../engine/types';
import type { DayFacts, MessageContext } from '../engine/messages';
import { selectMessage, selectSpecificMessage } from '../engine/messages';
import type { ReflectionContext } from '../engine/reflections';
import { pickReflection } from './reflections';
import { applyEvents } from '../engine/reduce';
import { getAllEvents } from '../db/events';
import { db } from '../db/db';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}

const TREND_MIN_SAMPLE = 3;
const CORRELATION_MIN_SAMPLE = 5;

export async function computeMessageContext(today: string, config: EngineConfig): Promise<MessageContext> {
  const [
    dsaAttempts,
    dsaProblems,
    artifacts,
    buildSessions,
    learningBlocks,
    systemDesigns,
    metricSamples,
    events,
    dayRollups,
  ] = await Promise.all([
    db.dsa_attempt.toArray(),
    db.dsa_problem.toArray(),
    db.artifact.toArray(),
    db.build_session.toArray(),
    db.learning_block.toArray(),
    db.system_design_study.toArray(),
    db.metric_sample.toArray(),
    getAllEvents(),
    db.day_rollup.toArray(),
  ]);

  const state = applyEvents(events, config);

  // day_rollup already carries the exact per-day core_completed/core_total
  // (db/projections.ts's rebuildProjections keeps it current on every
  // write) — reusing it directly instead of re-deriving an approximation
  // from mvd_met, which is a DIFFERENT, coarser fact (floor-day vs a
  // fully-complete day) and would silently inflate P4's "fully complete"
  // count if conflated with it.
  const rollupByDate = new Map(dayRollups.map((r) => [r.local_date, r]));
  const todayRollup = rollupByDate.get(today);
  const today_facts: DayFacts = {
    local_date: today,
    core_completed: todayRollup?.core_completed ?? 0,
    core_total: todayRollup?.core_total ?? 0,
  };
  const trailingDays: DayFacts[] = dayRollups
    .filter((r) => r.local_date < today)
    .sort((a, b) => a.local_date.localeCompare(b.local_date))
    .map((r) => ({ local_date: r.local_date, core_completed: r.core_completed, core_total: r.core_total }));

  // P1 — deep-work personal record.
  const deepByDate = new Map<string, number>();
  for (const s of [...buildSessions, ...learningBlocks, ...systemDesigns]) {
    deepByDate.set(s.local_date, Math.max(deepByDate.get(s.local_date) ?? 0, s.minutes));
  }
  const todayLongest = deepByDate.get(today) ?? 0;
  const priorMax = Math.max(0, ...[...deepByDate.entries()].filter(([d]) => d < today).map(([, m]) => m));
  const newLongestDeepBlockMinutes = todayLongest > 0 && todayLongest > priorMax ? todayLongest : undefined;

  // P1 — first hard problem solved first-attempt, ever.
  const problemById = new Map(dsaProblems.map((p) => [p.id, p]));
  const hardFirstAttempts = dsaAttempts
    .filter((a) => !a.is_revisit && a.outcome === 'first_attempt' && problemById.get(a.problem_id)?.difficulty === 'H')
    .sort((a, b) => a.local_date.localeCompare(b.local_date));
  const firstHardProblemFirstAttempt = hardFirstAttempts.length > 0 && hardFirstAttempts[0]!.local_date === today;

  // P1 — first reachable deployment, ever.
  const deployments = artifacts.filter((a) => a.kind === 'deployment').sort((a, b) => a.local_date.localeCompare(b.local_date));
  const firstDeploymentReachable = deployments.length > 0 && deployments[0]!.local_date === today;

  // P2 — medium first-attempt-rate trend, current 14d vs the 14 before that.
  const cur14Start = shiftDate(today, -13);
  const prev14Start = shiftDate(today, -27);
  const prev14End = shiftDate(today, -14);
  const nonRevisitM = dsaAttempts
    .filter((a) => !a.is_revisit)
    .map((a) => ({ ...a, difficulty: problemById.get(a.problem_id)?.difficulty }))
    .filter((a) => a.difficulty === 'M');
  const curWindow = nonRevisitM.filter((a) => a.local_date >= cur14Start && a.local_date <= today);
  const prevWindow = nonRevisitM.filter((a) => a.local_date >= prev14Start && a.local_date <= prev14End);
  const firstAttemptRateMTrend =
    curWindow.length >= TREND_MIN_SAMPLE && prevWindow.length >= TREND_MIN_SAMPLE
      ? {
          current: curWindow.filter((a) => a.outcome === 'first_attempt').length / curWindow.length,
          previous: prevWindow.filter((a) => a.outcome === 'first_attempt').length / prevWindow.length,
        }
      : undefined;

  // P2 — wake-SD trend, current 28d vs the 28 before that.
  const cur28Start = shiftDate(today, -27);
  const prev28Start = shiftDate(today, -55);
  const prev28End = shiftDate(today, -28);
  const wakeSamples = metricSamples.filter((s) => s.kind === 'wake_time');
  const curWake = wakeSamples.filter((s) => s.local_date >= cur28Start && s.local_date <= today).map((s) => s.value);
  const prevWake = wakeSamples.filter((s) => s.local_date >= prev28Start && s.local_date <= prev28End).map((s) => s.value);
  const wakeSdTrend =
    curWake.length >= 2 && prevWake.length >= 2 ? { current: stddev(curWake), fourWeeksAgo: stddev(prevWake) } : undefined;

  // P3 — DSA first-attempt rate conditioned on whether SLEEP was complete that day.
  const sleepHitDates = new Set(
    Object.values(state.quests)
      .filter((c) => c.quest_key === 'sleep')
      .map((c) => c.local_date)
  );
  const nonRevisitAll = dsaAttempts.filter((a) => !a.is_revisit);
  const afterHitAttempts = nonRevisitAll.filter((a) => sleepHitDates.has(a.local_date));
  const afterMissAttempts = nonRevisitAll.filter((a) => !sleepHitDates.has(a.local_date));
  const dsaFirstAttemptBySleep =
    afterHitAttempts.length >= CORRELATION_MIN_SAMPLE && afterMissAttempts.length >= CORRELATION_MIN_SAMPLE
      ? {
          afterHit: afterHitAttempts.filter((a) => a.outcome === 'first_attempt').length / afterHitAttempts.length,
          afterMiss: afterMissAttempts.filter((a) => a.outcome === 'first_attempt').length / afterMissAttempts.length,
        }
      : undefined;

  return {
    today: today_facts,
    trailingDays,
    newLongestDeepBlockMinutes,
    firstHardProblemFirstAttempt,
    firstDeploymentReachable,
    firstAttemptRateMTrend,
    wakeSdTrend,
    dsaFirstAttemptBySleep,
  };
}

export interface TodaySystemLine {
  text: string;
  source: 'system_message' | 'reflection';
  /** Present only when source is 'reflection' — the caller (Today.tsx)
   * uses this to call store/reflections.ts's recordReflectionShown once
   * the line has actually been displayed. */
  reflectionId?: string;
}

/**
 * The one line final/06 §5.2 lists alongside Today's priority line:
 * "reflection." Combines both content systems per final/05 §1.2's
 * selection rule — "if a P1/P2/P3 System Message is available, show
 * that instead [of a reflection]" — real evidence always wins over
 * texture; only when no P1-P3 evidence exists does an eligible
 * reflection get a turn, and only when NEITHER exists does this fall
 * back to the always-available P4/P5 system message.
 */
export async function getTodaySystemLine(
  today: string,
  arcDay: number,
  isPostLapse: boolean,
  reflectionContext: ReflectionContext,
  config: EngineConfig
): Promise<TodaySystemLine> {
  const context = await computeMessageContext(today, config);

  const specific = selectSpecificMessage(context);
  if (specific) return { text: specific, source: 'system_message' };

  const reflection = await pickReflection(reflectionContext, arcDay, isPostLapse, today);
  if (reflection) return { text: reflection.text, source: 'reflection', reflectionId: reflection.id };

  return { text: selectMessage(context), source: 'system_message' };
}
