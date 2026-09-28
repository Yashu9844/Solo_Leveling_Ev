// final/01-quests-xp-level-rank.md §4 — the evidence system. "Level
// measures effort. Rank measures evidence. They are not convertible."
// Every gate is externally verifiable but entirely within the player's
// control — never a recruiter response, interview or offer (final/02 §1's
// CONTROLLED/EXTERNAL split, structurally the same invariant
// engine/xp.ts and engine/career.ts already enforce). Rank never
// regresses: a checkpoint that doesn't clear its gate returns the
// previous rank, not a lower one, and stalling is informative rather than
// punitive (final/01 §4.1).
import type { Rank } from './types';

export interface Checkpoint {
  day: 0 | 14 | 30 | 60 | 90 | 120;
  previousRank: Rank;
}

/**
 * Every field a rank gate anywhere in final/01 §4.2 / final/00 §2 reads.
 * The store layer computes all of these from real DB data (the four
 * bossXCleared fields as of Slice 13's store/boss.ts; costPerTaskMeasured
 * and interviewBenchmarkPassed as of Slice 14's ArtifactRow.cost_per_
 * task_stated and store/training.ts's logInterviewBenchmark).
 */
export interface GateEvidence {
  mvdConsistency14d: number; // 0-1, trailing 14 days, effort-only (final/01 §4.2's D gate)
  coreCompletion28d: number; // 0-1
  problemsTotal: number; // cumulative DSA problems logged, non-revisit
  firstAttemptRateM28d: number; // 0-1, Medium-difficulty first-attempt rate, 28d window
  trainingSessionsTotal: number; // cumulative
  meanSteps: number; // mean daily steps, trailing 28d
  wakeSdMin: number; // wake-time standard deviation, trailing 28d
  screenTimeAvgMin: number; // mean daily screen time, trailing 28d
  qualityApplicationsTotal: number; // cumulative
  followThroughRate: number; // 0-1
  networkingConversations: number; // cumulative CAREER_SUBSTITUTE_LOGGED kind='networking'
  recordedMocks: number; // cumulative CAREER_SUBSTITUTE_LOGGED kind='mock'
  aiFeaturePublicRepo: boolean; // >= 1 shipped 'feature' artifact with a url
  publicProjectsTotal: number; // 'project' artifacts
  publicProjectsWithEvalSuite: number; // 'project' artifacts with an associated 'eval'
  publicProjectsDeployedReachable: number; // 'deployment' artifacts
  publishedWriteups: number; // 'writeup' artifacts
  resumeVersionsTotal: number;
  resumeExternallyReviewed: boolean; // any resume_version.externalReview
  foundationTopicsIntroducedPlus: number; // of the 9, at >= Introduced
  foundationTopicsFluentPlus: number; // of the 9, at >= Fluent
  foundationTopicsRetainedPlus: number; // of the 9, at Retained
  systemDesignsStudied: number;
  systemDesignsWrittenUp: number;
  systemDesignsExplainedAloud: number;
  trainingEst1RmGainPct: number; // 0-1; 0 without >= 2 dated samples to compare
  costPerTaskMeasured: boolean; // final/03 §4.4 — self-certified on a 'project' artifact (ArtifactRow.cost_per_task_stated)
  interviewBenchmarkPassed: boolean; // final/02 §2.2 — self-administered, logged via store/training.ts's logInterviewBenchmark
  bossICleared: boolean; // final/01 §7 — real as of Slice 13's store/boss.ts
  bossIICleared: boolean;
  bossIIICleared: boolean;
  bossIVCleared: boolean;
  arcSealed: boolean; // every prior checkpoint (14/30/60/90) already sealed
}

export interface GateCondition {
  label: string;
  met: boolean;
}

export interface GateResult {
  rank: Rank;
  targetRank: Rank;
  conditions: GateCondition[];
}

const RANK_FOR_DAY: Record<Checkpoint['day'], Rank> = { 0: 'E', 14: 'D', 30: 'C', 60: 'B', 90: 'A', 120: 'S' };

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function conditionsFor(day: Checkpoint['day'], e: GateEvidence): GateCondition[] {
  switch (day) {
    case 0:
      return [{ label: 'Start', met: true }];

    case 14:
      // final/01 §4.2 — effort-only, so early rank is reachable.
      return [{ label: `MVD consistency ${pct(e.mvdConsistency14d)} (need 70%)`, met: e.mvdConsistency14d >= 0.7 }];

    case 30:
      return [
        { label: `Core completion ${pct(e.coreCompletion28d)} (need 60%)`, met: e.coreCompletion28d >= 0.6 },
        { label: `${e.problemsTotal} problems (need 55)`, met: e.problemsTotal >= 55 },
        { label: `${e.trainingSessionsTotal} training sessions (need 12)`, met: e.trainingSessionsTotal >= 12 },
        { label: 'AI feature committed to a public repo', met: e.aiFeaturePublicRepo },
        { label: `${e.qualityApplicationsTotal} quality applications (need 70)`, met: e.qualityApplicationsTotal >= 70 },
        {
          label: `${e.foundationTopicsIntroducedPlus} foundation topics at Introduced (need 3)`,
          met: e.foundationTopicsIntroducedPlus >= 3,
        },
      ];

    case 60:
      return [
        { label: `Core completion ${pct(e.coreCompletion28d)} (need 65%)`, met: e.coreCompletion28d >= 0.65 },
        { label: `${e.problemsTotal} problems (need 130)`, met: e.problemsTotal >= 130 },
        {
          label: `First-attempt M ${pct(e.firstAttemptRateM28d)} (need 50%)`,
          met: e.firstAttemptRateM28d >= 0.5,
        },
        { label: `${e.trainingSessionsTotal} training sessions (need 28)`, met: e.trainingSessionsTotal >= 28 },
        { label: 'Public project with README + eval suite', met: e.publicProjectsWithEvalSuite >= 1 },
        { label: `${e.qualityApplicationsTotal} quality applications (need 150)`, met: e.qualityApplicationsTotal >= 150 },
        { label: 'Resume v2 with an external review', met: e.resumeVersionsTotal >= 2 && e.resumeExternallyReviewed },
        {
          label: `${e.foundationTopicsFluentPlus} foundation topics at Fluent (need 3)`,
          met: e.foundationTopicsFluentPlus >= 3,
        },
        { label: 'Boss I cleared', met: e.bossICleared },
      ];

    case 90:
      return [
        { label: `Core completion ${pct(e.coreCompletion28d)} (need 65%)`, met: e.coreCompletion28d >= 0.65 },
        { label: `${e.problemsTotal} problems (need 200)`, met: e.problemsTotal >= 200 },
        {
          label: `First-attempt M ${pct(e.firstAttemptRateM28d)} (need 60%)`,
          met: e.firstAttemptRateM28d >= 0.6,
        },
        { label: `${e.trainingSessionsTotal} training sessions (need 42)`, met: e.trainingSessionsTotal >= 42 },
        {
          label: `${e.publicProjectsTotal} public projects, >= 1 deployed (need 2)`,
          met: e.publicProjectsTotal >= 2 && e.publicProjectsDeployedReachable >= 1,
        },
        { label: 'Published technical write-up', met: e.publishedWriteups >= 1 },
        { label: `${e.qualityApplicationsTotal} quality applications (need 230)`, met: e.qualityApplicationsTotal >= 230 },
        { label: `Follow-through ${pct(e.followThroughRate)} (need 70%)`, met: e.followThroughRate >= 0.7 },
        { label: `${e.networkingConversations} networking conversations (need 8)`, met: e.networkingConversations >= 8 },
        { label: `${e.recordedMocks} recorded mocks (need 2)`, met: e.recordedMocks >= 2 },
        { label: `Wake SD ${Math.round(e.wakeSdMin)}min (need < 60)`, met: e.wakeSdMin < 60 },
        {
          label: `${e.foundationTopicsFluentPlus} Fluent (need 5), ${e.foundationTopicsRetainedPlus} Retained (need 2)`,
          met: e.foundationTopicsFluentPlus >= 5 && e.foundationTopicsRetainedPlus >= 2,
        },
        { label: 'Bosses I-II cleared', met: e.bossICleared && e.bossIICleared },
      ];

    case 120:
      // final/00 §2's Day-120 thresholds + final/01 §4.2's S-specific additions.
      return [
        { label: `${e.problemsTotal} problems (need 240)`, met: e.problemsTotal >= 240 },
        {
          label: `First-attempt M ${pct(e.firstAttemptRateM28d)} (need 60%)`,
          met: e.firstAttemptRateM28d >= 0.6,
        },
        { label: 'Interview-readiness benchmark passed', met: e.interviewBenchmarkPassed },
        {
          label: `${e.foundationTopicsIntroducedPlus}/9 foundations >= Applied, ${e.foundationTopicsFluentPlus} Fluent (need 8), ${e.foundationTopicsRetainedPlus} Retained (need 3)`,
          met: e.foundationTopicsIntroducedPlus >= 9 && e.foundationTopicsFluentPlus >= 8 && e.foundationTopicsRetainedPlus >= 3,
        },
        {
          label: `${e.systemDesignsStudied} designs studied (need 12), ${e.systemDesignsWrittenUp} written (need 4), ${e.systemDesignsExplainedAloud} explained (need 2)`,
          met: e.systemDesignsStudied >= 12 && e.systemDesignsWrittenUp >= 4 && e.systemDesignsExplainedAloud >= 2,
        },
        {
          label: `${e.publicProjectsWithEvalSuite} public projects with evals (need 3)`,
          met: e.publicProjectsWithEvalSuite >= 3,
        },
        { label: '>= 1 project deployed and reachable', met: e.publicProjectsDeployedReachable >= 1 },
        { label: 'Cost-per-task measured on >= 1 project', met: e.costPerTaskMeasured },
        { label: 'Published technical write-up', met: e.publishedWriteups >= 1 },
        {
          label: 'Resume v3 with an external review',
          met: e.resumeVersionsTotal >= 3 && e.resumeExternallyReviewed,
        },
        { label: `${e.qualityApplicationsTotal} quality applications (need 280)`, met: e.qualityApplicationsTotal >= 280 },
        { label: `Follow-through ${pct(e.followThroughRate)} (need 70%)`, met: e.followThroughRate >= 0.7 },
        { label: `${e.networkingConversations} networking conversations (need 8)`, met: e.networkingConversations >= 8 },
        { label: `${e.recordedMocks} recorded mocks (need 4)`, met: e.recordedMocks >= 4 },
        { label: `${e.trainingSessionsTotal} training sessions (need 55)`, met: e.trainingSessionsTotal >= 55 },
        {
          label: `Est. 1RM aggregate ${pct(e.trainingEst1RmGainPct)} (need +12%)`,
          met: e.trainingEst1RmGainPct >= 0.12,
        },
        { label: `Mean steps ${Math.round(e.meanSteps).toLocaleString()} (need >= 8,000)`, met: e.meanSteps >= 8000 },
        {
          label: `Core completion ${pct(e.coreCompletion28d)} (need 60-85%)`,
          met: e.coreCompletion28d >= 0.6 && e.coreCompletion28d <= 0.85,
        },
        { label: `Wake SD ${Math.round(e.wakeSdMin)}min (need < 45)`, met: e.wakeSdMin < 45 },
        { label: `Screen time ${Math.round(e.screenTimeAvgMin)}min/day (need <= 60)`, met: e.screenTimeAvgMin <= 60 },
        { label: 'Bosses I-IV cleared', met: e.bossICleared && e.bossIICleared && e.bossIIICleared && e.bossIVCleared },
        { label: 'Arc data sealed and exported', met: e.arcSealed },
      ];
  }
}

/**
 * Pure. Evaluates the rank gate for this checkpoint's day against
 * `evidence`. Never references an external outcome. Never regresses:
 * `rank` is `targetRank` only when every condition is met, otherwise
 * `checkpoint.previousRank` — stalling, not demotion.
 */
export function evaluateGates(checkpoint: Checkpoint, evidence: GateEvidence): GateResult {
  const targetRank = RANK_FOR_DAY[checkpoint.day];
  const conditions = conditionsFor(checkpoint.day, evidence);
  const allMet = conditions.every((c) => c.met);
  return { rank: allMet ? targetRank : checkpoint.previousRank, targetRank, conditions };
}

/** Pure. The Profile screen's "most important sentence" — final/01
 * §4.3's display format, e.g. "Rank C -> B requires 8 conditions. You
 * meet 5." At a fully-met gate it states the advance instead. */
export function verdictTextFor(result: GateResult): string {
  const metCount = result.conditions.filter((c) => c.met).length;
  const total = result.conditions.length;
  if (result.rank === result.targetRank && metCount === total) {
    return `Rank ${result.targetRank} reached. ${metCount} of ${total} conditions met.`;
  }
  return `Rank ${result.rank} -> ${result.targetRank} requires ${total} conditions. You meet ${metCount}.`;
}

/**
 * What a checkpoint's evidence would read at the very start of the arc —
 * used as checkpointComparison's implicit "before" when no earlier
 * checkpoint carries a real GateEvidence snapshot to diff against (Day
 * 0's own `metrics` field holds raw baseline body metrics, a different
 * shape entirely — see store/checkpoint.ts's sealCheckpoint vs
 * store/onboarding.ts's Day-0 checkpoint row). Every field is the true
 * value of an arc with zero activity, not a guess: wakeSdMin uses the
 * same 999 fail-safe computeGateEvidence itself returns for "no wake
 * data yet," so a later real measurement is never miscounted as an
 * improvement over a sentinel.
 */
export const ZERO_EVIDENCE: GateEvidence = {
  mvdConsistency14d: 0,
  coreCompletion28d: 0,
  problemsTotal: 0,
  firstAttemptRateM28d: 0,
  trainingSessionsTotal: 0,
  meanSteps: 0,
  wakeSdMin: 999,
  screenTimeAvgMin: 0,
  qualityApplicationsTotal: 0,
  followThroughRate: 0,
  networkingConversations: 0,
  recordedMocks: 0,
  aiFeaturePublicRepo: false,
  publicProjectsTotal: 0,
  publicProjectsWithEvalSuite: 0,
  publicProjectsDeployedReachable: 0,
  publishedWriteups: 0,
  resumeVersionsTotal: 0,
  resumeExternallyReviewed: false,
  foundationTopicsIntroducedPlus: 0,
  foundationTopicsFluentPlus: 0,
  foundationTopicsRetainedPlus: 0,
  systemDesignsStudied: 0,
  systemDesignsWrittenUp: 0,
  systemDesignsExplainedAloud: 0,
  trainingEst1RmGainPct: 0,
  costPerTaskMeasured: false,
  interviewBenchmarkPassed: false,
  bossICleared: false,
  bossIICleared: false,
  bossIIICleared: false,
  bossIVCleared: false,
  arcSealed: false,
};

export interface ComparisonRow {
  label: string;
  before: string;
  after: string;
  improved: boolean;
}

/**
 * Pure. final/06 §5.8's "DAY 30 REPORT" comparison table, scoped to
 * only the fields this build actually has a data source for (no
 * fabricated weight/1RM/self-efficacy rows — see store/mastery.ts's
 * comparable "resolved ambiguity" precedent). Each row's `improved`
 * already encodes the right direction per metric (lower is better for
 * wakeSdMin, higher for everything else), so a caller never needs its
 * own per-field logic to decide what counts as progress.
 */
export function checkpointComparison(before: GateEvidence, after: GateEvidence): ComparisonRow[] {
  const rows: ComparisonRow[] = [
    {
      label: 'Problems solved',
      before: String(before.problemsTotal),
      after: String(after.problemsTotal),
      improved: after.problemsTotal > before.problemsTotal,
    },
    {
      label: 'Quality applications',
      before: String(before.qualityApplicationsTotal),
      after: String(after.qualityApplicationsTotal),
      improved: after.qualityApplicationsTotal > before.qualityApplicationsTotal,
    },
    {
      label: 'Public projects',
      before: String(before.publicProjectsTotal),
      after: String(after.publicProjectsTotal),
      improved: after.publicProjectsTotal > before.publicProjectsTotal,
    },
    {
      label: 'Foundations >= Introduced',
      before: `${before.foundationTopicsIntroducedPlus}/9`,
      after: `${after.foundationTopicsIntroducedPlus}/9`,
      improved: after.foundationTopicsIntroducedPlus > before.foundationTopicsIntroducedPlus,
    },
    {
      label: 'Training sessions',
      before: String(before.trainingSessionsTotal),
      after: String(after.trainingSessionsTotal),
      improved: after.trainingSessionsTotal > before.trainingSessionsTotal,
    },
    {
      label: 'First-attempt rate (M)',
      before: pct(before.firstAttemptRateM28d),
      after: pct(after.firstAttemptRateM28d),
      improved: after.firstAttemptRateM28d > before.firstAttemptRateM28d,
    },
  ];
  // wakeSdMin's fail-safe is 999 ("no data") -- only a comparison
  // starting from a real measurement is meaningful.
  if (before.wakeSdMin < 999) {
    rows.push({
      label: 'Wake SD',
      before: `${Math.round(before.wakeSdMin)}min`,
      after: `${Math.round(after.wakeSdMin)}min`,
      improved: after.wakeSdMin < before.wakeSdMin,
    });
  }
  return rows;
}

/** Pure. final/05 §2.1's CHECKPOINT Moment fires only "with
 * improvement" — a checkpoint sealed with zero real progress on every
 * tracked metric (e.g. the very first checkpoint of an inactive arc)
 * gets the plain verdict line only, never a self-congratulatory
 * sequence (final/01 §6.6's no-manufactured-positivity rule). */
export function checkpointImproved(rows: ComparisonRow[]): boolean {
  return rows.some((r) => r.improved);
}
