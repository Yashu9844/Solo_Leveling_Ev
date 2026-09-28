// final/01-quests-xp-level-rank.md §5 — turns 28 (or fewer, early in the
// arc) trailing eligible days of raw DB rows into the flat scalars
// engine/attributes.ts's attributesFrom needs. Paused days are excluded
// from the window (final/01 §6.5) by walking further back past them, so
// a pause never thins out the sample the way it would if it just shrank
// the denominator.
import { addDays, format, parseISO } from 'date-fns';
import { attributesFrom, type AttributeInputs, type AttributeResult } from '../engine/attributes';
import { weightedVolume, type DsaAttemptFixture } from '../engine/dsa';
import { foundationMasteryPoints } from '../engine/foundations';
import { followThroughRate, funnelFrom, type ApplicationFixture, type ApplicationStatus } from '../engine/career';
import { applyEvents } from '../engine/reduce';
import { getAllEvents } from '../db/events';
import { db } from '../db/db';
import type { EngineConfig } from '../engine/types';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

/** Walks backward from `today`, skipping paused dates, collecting up to
 * `windowDays` eligible calendar dates (oldest first), never before
 * `arcStartDate`. */
function eligibleWindowDates(today: string, arcStartDate: string, pausedDates: string[], windowDays: number): string[] {
  const pausedSet = new Set(pausedDates);
  const dates: string[] = [];
  let cursor = today;
  while (dates.length < windowDays && cursor >= arcStartDate) {
    if (!pausedSet.has(cursor)) dates.push(cursor);
    cursor = shiftDate(cursor, -1);
  }
  return dates.reverse();
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function getAttributes(today: string, config: EngineConfig): Promise<AttributeResult[]> {
  const events = await getAllEvents();
  const state = applyEvents(events, config);
  if (!state.arc) return attributesFrom(EMPTY_INPUTS);

  const dates = eligibleWindowDates(today, state.arc.start_date, state.arc.paused_dates, config.attributes.windowDays);
  const dateSet = new Set(dates);
  const windowDays = dates.length;
  const inWindow = (localDate: string) => dateSet.has(localDate);

  // DISCIPLINE
  const completions = Object.values(state.quests);
  const sleepHits = new Set(completions.filter((c) => c.quest_key === 'sleep' && inWindow(c.local_date)).map((c) => c.local_date)).size;
  const attentionHits = new Set(
    completions.filter((c) => c.quest_key === 'attention' && inWindow(c.local_date)).map((c) => c.local_date)
  ).size;
  const mvdDays = dates.filter((d) => completions.some((c) => c.local_date === d)).length;

  // DEPTH
  const [buildSessions, learningBlocks, systemDesigns] = await Promise.all([
    db.build_session.toArray(),
    db.learning_block.toArray(),
    db.system_design_study.toArray(),
  ]);
  const deepSessionsInWindow = [
    ...buildSessions.filter((s) => inWindow(s.local_date)).map((s) => s.minutes),
    ...learningBlocks.filter((b) => inWindow(b.local_date)).map((b) => b.minutes),
    ...systemDesigns.filter((s) => inWindow(s.local_date)).map((s) => s.minutes),
  ];
  const deepMinutesByDate = new Map<string, number>();
  for (const s of buildSessions) if (inWindow(s.local_date)) deepMinutesByDate.set(s.local_date, (deepMinutesByDate.get(s.local_date) ?? 0) + s.minutes);
  for (const b of learningBlocks) if (inWindow(b.local_date)) deepMinutesByDate.set(b.local_date, (deepMinutesByDate.get(b.local_date) ?? 0) + b.minutes);
  for (const s of systemDesigns) if (inWindow(s.local_date)) deepMinutesByDate.set(s.local_date, (deepMinutesByDate.get(s.local_date) ?? 0) + s.minutes);
  const meanDailyDeepMin = windowDays > 0 ? [...deepMinutesByDate.values()].reduce((a, b) => a + b, 0) / windowDays : 0;
  const meanBlockLenMin = mean(deepSessionsInWindow);

  // PROBLEM SOLVING
  const [dsaAttempts, dsaProblems] = await Promise.all([db.dsa_attempt.toArray(), db.dsa_problem.toArray()]);
  const problemById = new Map(dsaProblems.map((p) => [p.id, p]));
  const windowAttempts = dsaAttempts.filter((a) => inWindow(a.local_date));
  const nonRevisitFixtures: DsaAttemptFixture[] = windowAttempts
    .filter((a) => !a.is_revisit)
    .map((a) => {
      const problem = problemById.get(a.problem_id);
      return {
        problem_id: a.problem_id,
        topic: problem?.topic ?? '',
        difficulty: problem?.difficulty ?? 'E',
        local_date: a.local_date,
        outcome: a.outcome,
        is_revisit: false,
      };
    });
  const weightedProblems28d = weightedVolume(nonRevisitFixtures);
  const mediumAttempts = nonRevisitFixtures.filter((a) => a.difficulty === 'M');
  const firstAttemptRateM =
    mediumAttempts.length > 0 ? mediumAttempts.filter((a) => a.outcome === 'first_attempt').length / mediumAttempts.length : 0;
  const revisits = windowAttempts.filter((a) => a.is_revisit);
  const revisitSuccessRate = revisits.length > 0 ? revisits.filter((a) => a.outcome === 'first_attempt').length / revisits.length : 0;

  // ENGINEERING — mastery is cumulative (not windowed), same as DSA's masteryFor.
  const allLearningBlocks = learningBlocks.map((b) => ({ topic: b.topic, local_date: b.local_date }));
  const artifacts = await db.artifact.toArray();
  const windowArtifacts = artifacts.filter((a) => inWindow(a.local_date));
  const shippedUnits28d = windowArtifacts.length;
  const evalCoverage = windowArtifacts.length > 0 ? windowArtifacts.filter((a) => a.kind === 'eval').length / windowArtifacts.length : 0;

  // MOMENTUM
  const applications = await db.application.toArray();
  const windowApplications: ApplicationFixture[] = applications
    .filter((a) => inWindow(a.local_date))
    .map((a) => ({
      id: a.id,
      local_date: a.local_date,
      company: a.company,
      role: a.role,
      role_category: a.role_category,
      resume_version_id: a.resume_version_id,
      why_line: a.why_line,
      quality_pass: a.quality_pass,
      status: a.status as ApplicationStatus,
      followed_up_at: a.followed_up_at,
      followup_due_at: a.followup_due_at,
    }));
  const funnel = funnelFrom(windowApplications, []);

  // VITALITY
  const trainingSessions = await db.training_session.toArray();
  const sessions28d = trainingSessions.filter((s) => inWindow(s.local_date)).length;
  const metricSamples = await db.metric_sample.toArray();
  const stepsInWindow = metricSamples.filter((s) => s.kind === 'steps' && inWindow(s.local_date)).map((s) => s.value);
  const wakeTimesInWindow = metricSamples.filter((s) => s.kind === 'wake_time' && inWindow(s.local_date)).map((s) => s.value);
  // A standard deviation needs >= 2 points; with fewer, there's no
  // consistency evidence either way. Reading that as 0 (perfectly
  // consistent) would reward never logging sleep at all, so it's read as
  // the engine's clamp ceiling instead — this term contributes nothing
  // until there's real evidence, positive or negative.
  const wakeSdMin = wakeTimesInWindow.length >= 2 ? stddev(wakeTimesInWindow) : 90;

  const inputs: AttributeInputs = {
    discipline: { mvdDays, sleepHits, attentionHits, windowDays: windowDays || 1 },
    depth: { meanDailyDeepMin, meanBlockLenMin },
    problemSolving: { weightedProblems28d, firstAttemptRateM, revisitSuccessRate },
    engineering: { foundationMasteryPoints: foundationMasteryPoints(allLearningBlocks), shippedUnits28d, evalCoverage },
    momentum: { applications28d: windowApplications.length, qualityRate: funnel.qualityPassRate, followThroughRate: followThroughRate(windowApplications, today) },
    vitality: { sessions28d, meanSteps: mean(stepsInWindow), wakeSdMin },
  };

  return attributesFrom(inputs);
}

const EMPTY_INPUTS: AttributeInputs = {
  discipline: { mvdDays: 0, sleepHits: 0, attentionHits: 0, windowDays: 1 },
  depth: { meanDailyDeepMin: 0, meanBlockLenMin: 0 },
  problemSolving: { weightedProblems28d: 0, firstAttemptRateM: 0, revisitSuccessRate: 0 },
  engineering: { foundationMasteryPoints: 0, shippedUnits28d: 0, evalCoverage: 0 },
  momentum: { applications28d: 0, qualityRate: 0, followThroughRate: 0 },
  vitality: { sessions28d: 0, meanSteps: 0, wakeSdMin: 0 },
};
