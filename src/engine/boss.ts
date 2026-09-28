// final/01-quests-xp-level-rank.md §7 — four real-world milestones,
// announced 7 days ahead, "cannot be failed; a missed window reopens at
// the next checkpoint." 500 XP each (engine/xp.ts's BOSS_CLEARED
// handling — final/01 §2.1.1's uncapped-grant exemption already covers
// any BOSS-category grant generically). Clearing is a real
// player-initiated action (store/boss.ts's clearBoss), not something
// that fires itself — same "the system proposes, you dispose" posture
// as the weekly review's rule proposals.
import type { FoundationTopic } from './foundations';
import type { MasteryState } from './types';

export type BossId = 'I' | 'II' | 'III' | 'IV';

export interface BossWindow {
  id: BossId;
  title: string;
  windowStartDay: number;
  windowEndDay: number;
}

export const BOSSES: BossWindow[] = [
  { id: 'I', title: 'FIRST EVIDENCE', windowStartDay: 25, windowEndDay: 35 },
  { id: 'II', title: 'STRONG ENGINEERING BASE', windowStartDay: 50, windowEndDay: 70 },
  { id: 'III', title: 'AI ENGINEER', windowStartDay: 75, windowEndDay: 95 },
  { id: 'IV', title: 'INTERVIEW READY', windowStartDay: 100, windowEndDay: 120 },
];

// final/01 §7's Boss II names these six specifically — not all nine
// foundation topics (System Design, Performance and Production
// Architecture are excluded from this particular gate).
export const BOSS_II_TOPICS: FoundationTopic[] = [
  'Operating Systems',
  'Networking',
  'Databases',
  'Distributed Systems',
  'Concurrency',
  'Backend Engineering',
];

export interface BossEvidence {
  problemsTotal: number;
  trainingSessionsTotal: number;
  qualityApplicationsTotal: number;
  aiFeaturePublicRepo: boolean;
  day30CheckpointSealed: boolean;
  boss2TopicStates: Record<FoundationTopic, MasteryState>; // just the six above
  systemDesignsStudied: number;
  systemDesignsWrittenUp: number;
  publicProjectsWithEvalSuite: number; // 'eval' artifact sharing a project_key with a 'project' artifact
  publicProjectsDeployedReachable: number;
  costPerTaskMeasured: boolean; // final/03 §4.4 — self-certified on a 'project' artifact
  publishedWriteups: number;
  problemsFirstAttemptRateM: number; // all-time, not windowed — Boss IV reads "200+ problems ... first-attempt M >= 60%" as a single cumulative fact
  foundationTopicsFluentPlus: number; // of all 9
  foundationTopicsRetainedPlus: number;
  systemDesignsExplainedAloud: number;
  resumeVersionsTotal: number;
  resumeExternallyReviewed: boolean;
  recordedMocks: number;
  interviewBenchmarkPassed: boolean; // final/02 §2.2 — self-administered, logged
  arcSealed: boolean; // every prior checkpoint (14/30/60/90) sealed
}

export interface BossCondition {
  label: string;
  met: boolean;
}

export interface BossResult {
  boss: BossWindow;
  windowOpen: boolean; // today's arc day falls within [windowStartDay, windowEndDay]
  conditions: BossCondition[];
  cleared: boolean;
}

function masteryAtLeastApplied(state: MasteryState): boolean {
  return state === 'applied' || state === 'fluent' || state === 'retained';
}
function masteryAtLeastFluent(state: MasteryState): boolean {
  return state === 'fluent' || state === 'retained';
}

function conditionsFor(id: BossId, e: BossEvidence): BossCondition[] {
  switch (id) {
    case 'I':
      return [
        { label: `${e.problemsTotal} problems (need 55)`, met: e.problemsTotal >= 55 },
        { label: `${e.trainingSessionsTotal} training sessions (need 12)`, met: e.trainingSessionsTotal >= 12 },
        { label: `${e.qualityApplicationsTotal} quality applications (need 70)`, met: e.qualityApplicationsTotal >= 70 },
        { label: 'AI feature in a public repo with a README', met: e.aiFeaturePublicRepo },
        { label: 'Day-30 checkpoint sealed', met: e.day30CheckpointSealed },
      ];
    case 'II': {
      const appliedCount = BOSS_II_TOPICS.filter((t) => masteryAtLeastApplied(e.boss2TopicStates[t])).length;
      const fluentCount = BOSS_II_TOPICS.filter((t) => masteryAtLeastFluent(e.boss2TopicStates[t])).length;
      return [
        {
          label: `${appliedCount}/6 of OS/networking/databases/distributed/concurrency/backend at >= Applied`,
          met: appliedCount === BOSS_II_TOPICS.length,
        },
        { label: `${fluentCount} of those six at Fluent (need 3)`, met: fluentCount >= 3 },
        { label: `${e.systemDesignsStudied} system designs studied (need 6)`, met: e.systemDesignsStudied >= 6 },
        { label: `${e.systemDesignsWrittenUp} written up (need 2)`, met: e.systemDesignsWrittenUp >= 2 },
      ];
    }
    case 'III':
      return [
        { label: 'Public repo project with README + eval suite (golden set)', met: e.publicProjectsWithEvalSuite >= 1 },
        { label: 'Deployed and reachable', met: e.publicProjectsDeployedReachable >= 1 },
        { label: 'Cost-per-task measured', met: e.costPerTaskMeasured },
        { label: 'Technical write-up published', met: e.publishedWriteups >= 1 },
      ];
    case 'IV':
      return [
        { label: `${e.problemsTotal} problems (need 200)`, met: e.problemsTotal >= 200 },
        {
          label: `First-attempt M ${Math.round(e.problemsFirstAttemptRateM * 100)}% (need 60%)`,
          met: e.problemsFirstAttemptRateM >= 0.6,
        },
        {
          label: `${e.foundationTopicsFluentPlus} topics Fluent (need 8), ${e.foundationTopicsRetainedPlus} Retained (need 3)`,
          met: e.foundationTopicsFluentPlus >= 8 && e.foundationTopicsRetainedPlus >= 3,
        },
        {
          label: `${e.systemDesignsStudied} designs studied (need 12), ${e.systemDesignsWrittenUp} written (need 4), ${e.systemDesignsExplainedAloud} explained (need 2)`,
          met: e.systemDesignsStudied >= 12 && e.systemDesignsWrittenUp >= 4 && e.systemDesignsExplainedAloud >= 2,
        },
        {
          label: 'Resume v3 with an external review',
          met: e.resumeVersionsTotal >= 3 && e.resumeExternallyReviewed,
        },
        { label: `${e.recordedMocks} recorded mocks (need 4)`, met: e.recordedMocks >= 4 },
        { label: 'Interview-readiness benchmark passed', met: e.interviewBenchmarkPassed },
        { label: 'Arc data sealed', met: e.arcSealed },
      ];
  }
}

/**
 * Pure. `arcDayNumber` is the current arc day (1-based, engine/time.ts's
 * arcDay). final/01 §7 says a boss "cannot be failed; a missed window
 * reopens at the next checkpoint" — read literally that's a specific
 * reopening schedule, but the plainer and better-supported reading (the
 * "cannot be failed" framing, and the general "never regresses, no
 * miss is punished" posture running through every other final/01 §6
 * mechanic) is simpler: missing the narrow window is never a permanent
 * lock-out. So `windowOpen` here only checks the START day, not the
 * end — `windowEndDay` stays in BossWindow purely for display ("Days
 * 25-35"). Flagged as a resolved ambiguity in the Slice 13 report.
 * `alreadyCleared` short-circuits everything else true, since a boss
 * can't be un-cleared.
 */
export function evaluateBoss(id: BossId, arcDayNumber: number, evidence: BossEvidence, alreadyCleared: boolean): BossResult {
  const boss = BOSSES.find((b) => b.id === id)!;
  const windowOpen = arcDayNumber >= boss.windowStartDay;
  const conditions = conditionsFor(id, evidence);
  const cleared = alreadyCleared || (windowOpen && conditions.every((c) => c.met));
  return { boss, windowOpen, conditions, cleared };
}
