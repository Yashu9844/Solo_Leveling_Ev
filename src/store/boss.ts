// final/01-quests-xp-level-rank.md §7 — boss evidence gathering and the
// clear action. Reuses the same real data sources store/checkpoint.ts's
// computeGateEvidence already established (Slice 12) rather than
// re-deriving them a second way.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { EngineConfig, EngineDeps, BossClearedPayload } from '../engine/types';
import { evaluateBoss, type BossId, type BossEvidence, type BossResult, BOSS_II_TOPICS } from '../engine/boss';
import { foundationMasteryFor } from '../engine/foundations';
import type { ApplicationFixture, ApplicationStatus } from '../engine/career';
import { getAllEvents, appendEvent } from '../db/events';
import { rebuildProjections } from '../db/projections';
import { db } from '../db/db';

async function isBossCleared(bossId: BossId): Promise<boolean> {
  const events = await getAllEvents();
  return events.some(
    (e) => e.type === 'BOSS_CLEARED' && (e.payload as unknown as BossClearedPayload).bossId === bossId
  );
}

export async function computeBossEvidence(): Promise<BossEvidence> {
  const [dsaAttempts, dsaProblems, applications, artifacts, learningBlocks, systemDesigns, trainingSessions, resumeVersions, checkpoints, events, metricSamples] =
    await Promise.all([
      db.dsa_attempt.toArray(),
      db.dsa_problem.toArray(),
      db.application.toArray(),
      db.artifact.toArray(),
      db.learning_block.toArray(),
      db.system_design_study.toArray(),
      db.training_session.toArray(),
      db.resume_version.toArray(),
      db.checkpoint.toArray(),
      getAllEvents(),
      db.metric_sample.toArray(),
    ]);

  const problemById = new Map(dsaProblems.map((p) => [p.id, p]));
  const nonRevisit = dsaAttempts.filter((a) => !a.is_revisit);
  const mediumAttempts = nonRevisit
    .map((a) => ({ ...a, difficulty: problemById.get(a.problem_id)?.difficulty ?? 'E' }))
    .filter((a) => a.difficulty === 'M');

  const applicationFixtures: ApplicationFixture[] = applications.map((a) => ({
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

  const blocks = learningBlocks.map((b) => ({ topic: b.topic, local_date: b.local_date }));
  const allFoundationStates = ['Operating Systems', 'Networking', 'Databases', 'Distributed Systems', 'Concurrency', 'Backend Engineering', 'System Design', 'Performance', 'Production Architecture'].map(
    (topic) => foundationMasteryFor(topic, blocks)
  );
  const boss2TopicStates = Object.fromEntries(BOSS_II_TOPICS.map((t) => [t, foundationMasteryFor(t, blocks)])) as BossEvidence['boss2TopicStates'];

  const projectKeys = new Set(artifacts.filter((a) => a.kind === 'project').map((a) => a.project_key));
  const evalProjectKeys = new Set(artifacts.filter((a) => a.kind === 'eval').map((a) => a.project_key));

  const substituteEvents = events.filter((e) => e.type === 'CAREER_SUBSTITUTE_LOGGED');
  const recordedMocks = substituteEvents.filter((e) => (e.payload as unknown as { kind: string }).kind === 'mock').length;

  const day30 = checkpoints.find((c) => c.day === 30);
  const priorCheckpointDays: (14 | 30 | 60 | 90)[] = [14, 30, 60, 90];
  const arcSealed = priorCheckpointDays.every((d) => checkpoints.some((c) => c.day === d && c.sealed_at !== undefined));

  return {
    problemsTotal: nonRevisit.length,
    trainingSessionsTotal: trainingSessions.length,
    qualityApplicationsTotal: applicationFixtures.filter((a) => a.quality_pass).length,
    aiFeaturePublicRepo: artifacts.some((a) => a.kind === 'feature' && !!a.url),
    day30CheckpointSealed: day30?.sealed_at !== undefined,
    boss2TopicStates,
    systemDesignsStudied: systemDesigns.length,
    systemDesignsWrittenUp: systemDesigns.filter((s) => s.mode === 'written_up').length,
    publicProjectsWithEvalSuite: [...projectKeys].filter((k) => evalProjectKeys.has(k)).length,
    publicProjectsDeployedReachable: artifacts.filter((a) => a.kind === 'deployment').length,
    costPerTaskMeasured: artifacts.some((a) => a.kind === 'project' && a.cost_per_task_stated === true),
    publishedWriteups: artifacts.filter((a) => a.kind === 'writeup').length,
    problemsFirstAttemptRateM: mediumAttempts.length > 0 ? mediumAttempts.filter((a) => a.outcome === 'first_attempt').length / mediumAttempts.length : 0,
    foundationTopicsFluentPlus: allFoundationStates.filter((s) => s === 'fluent' || s === 'retained').length,
    foundationTopicsRetainedPlus: allFoundationStates.filter((s) => s === 'retained').length,
    systemDesignsExplainedAloud: systemDesigns.filter((s) => s.mode === 'explained_aloud').length,
    resumeVersionsTotal: resumeVersions.length,
    resumeExternallyReviewed: resumeVersions.some((r) => r.external_review === true),
    recordedMocks,
    interviewBenchmarkPassed: metricSamples.some((s) => s.kind === 'interview_benchmark' && s.value === 1),
    arcSealed,
  };
}

export async function getBossStatus(bossId: BossId, today: string): Promise<BossResult> {
  const arc = await db.arc.toCollection().first();
  // Both are already local_date strings in the arc's own timezone — a
  // plain calendar-day difference is exact here, unlike engine/time.ts's
  // arcDay (which converts an instant, not a date, and would need a
  // fabricated time-of-day to round-trip through).
  const dayNumber = arc ? differenceInCalendarDays(parseISO(today), parseISO(arc.start_date)) + 1 : 0;
  const [evidence, cleared] = await Promise.all([computeBossEvidence(), isBossCleared(bossId)]);
  return evaluateBoss(bossId, dayNumber, evidence, cleared);
}

/** Clears a boss — a real, player-initiated action, only allowed when
 * evaluateBoss already says every condition is met (mirrors the "server
 * re-validates" discipline: the store never trusts the UI's own copy of
 * the gate state). Idempotent per boss via idem_key. */
export async function clearBoss(bossId: BossId, arcId: string, today: string, config: EngineConfig, deps: EngineDeps): Promise<BossResult> {
  const status = await getBossStatus(bossId, today);
  if (!status.windowOpen || !status.conditions.every((c) => c.met)) {
    return status;
  }

  const payload: BossClearedPayload = { bossId };
  await appendEvent({
    id: deps.newId(),
    type: 'BOSS_CLEARED',
    occurred_at: deps.now(),
    local_date: today,
    arc_id: arcId,
    payload: payload as unknown as Record<string, unknown>,
    source: 'user',
    idem_key: `boss:${bossId}`,
    schema_v: 1,
  });
  await rebuildProjections(config, deps);

  return getBossStatus(bossId, today);
}
