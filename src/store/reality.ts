// final/06-ux-screens-design.md §5.5 — the REALITY sub-tab: cumulative,
// all-time real-world numbers (not the 28-day rolling window store/
// attributes.ts computes for the game-facing SYSTEM sub-tab).
import { funnelFrom, followThroughRate, type ApplicationFixture, type ApplicationStatus } from '../engine/career';
import type { DsaAttemptFixture } from '../engine/dsa';
import { FOUNDATION_TOPICS, foundationMasteryFor } from '../engine/foundations';
import { db } from '../db/db';

export interface RealitySummary {
  problems: number;
  firstAttemptRateM: number;
  publicProjects: number;
  evals: number;
  applications: number;
  qualityRate: number;
  followThroughRate: number;
  foundationsFluentOrBetter: number;
}

export async function getRealitySummary(today: string): Promise<RealitySummary> {
  const [dsaAttempts, dsaProblems, applications, artifacts, learningBlocks] = await Promise.all([
    db.dsa_attempt.toArray(),
    db.dsa_problem.toArray(),
    db.application.toArray(),
    db.artifact.toArray(),
    db.learning_block.toArray(),
  ]);

  const problemById = new Map(dsaProblems.map((p) => [p.id, p]));
  const nonRevisitFixtures: DsaAttemptFixture[] = dsaAttempts
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
  const mediumAttempts = nonRevisitFixtures.filter((a) => a.difficulty === 'M');

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
  const funnel = funnelFrom(applicationFixtures, []);

  const blocks = learningBlocks.map((b) => ({ topic: b.topic, local_date: b.local_date }));
  const foundationsFluentOrBetter = FOUNDATION_TOPICS.filter((topic) => {
    const state = foundationMasteryFor(topic, blocks);
    return state === 'fluent' || state === 'retained';
  }).length;

  return {
    problems: nonRevisitFixtures.length,
    firstAttemptRateM:
      mediumAttempts.length > 0 ? mediumAttempts.filter((a) => a.outcome === 'first_attempt').length / mediumAttempts.length : 0,
    publicProjects: artifacts.filter((a) => a.kind === 'project').length,
    evals: artifacts.filter((a) => a.kind === 'eval').length,
    applications: applicationFixtures.length,
    qualityRate: funnel.qualityPassRate,
    followThroughRate: followThroughRate(applicationFixtures, today),
    foundationsFluentOrBetter,
  };
}
