// final/01-quests-xp-level-rank.md §8 — 8 achievements ("each a statement
// of accumulated fact... no achievement for perfect days, perfect weeks,
// or streak length") and 5 identities ("strictly retrospective, never
// aspirational"). Both are pure derived facts with no write path of
// their own — nothing here is ever "unlocked" by an event, only computed
// live from the same real evidence engine/rank.ts's gates already read.
export type AchievementId =
  | 'first_move'
  | 'two_weeks'
  | 'century'
  | 'shipped'
  | 'return'
  | 'regular'
  | 'in_public'
  | 'the_arc';

export type IdentityId = 'problem_solver' | 'builder' | 'consistent' | 'trains' | 'keeps_promises';

export interface AchievementEvidence {
  firstQuestCompleted: boolean;
  totalMvdDays: number; // all-time, cumulative
  mvdDaysInTrailing90: number;
  problemsTotal: number;
  firstAttemptRateM: number; // 0-1
  aiFeaturePublicRepo: boolean;
  returnedAfterGap: boolean; // any QUEST_RECOVERED where the missed day is >= 2 days before the claim
  wakeSdMin: number;
  publicProjectsDeployedReachable: number;
  publishedWriteups: number;
  publicProjectsTotal: number;
  trainingSessionsTotal: number;
  ifThenFiringRate: number; // 0-1 — engine/ifThen.ts, trailing 60 days, on-day completion of career/DSA/training (the 3 keys with an if-then plan)
  day120Sealed: boolean;
}

export interface AchievementResult {
  id: AchievementId;
  label: string;
  earned: boolean;
}

export interface IdentityResult {
  id: IdentityId;
  label: string;
  earned: boolean;
}

const ACHIEVEMENT_LABELS: Record<AchievementId, string> = {
  first_move: 'First Move',
  two_weeks: 'Two Weeks',
  century: 'Century',
  shipped: 'Shipped',
  return: 'Return',
  regular: 'Regular',
  in_public: 'In Public',
  the_arc: 'The Arc',
};

const IDENTITY_LABELS: Record<IdentityId, string> = {
  problem_solver: 'Problem Solver',
  builder: 'Builder',
  consistent: 'Consistent',
  trains: 'Someone Who Trains',
  keeps_promises: 'Someone Who Keeps Promises',
};

/** Pure. All 8 achievements, in final/01 §8's table order. */
export function achievementsFrom(e: AchievementEvidence): AchievementResult[] {
  const earned: Record<AchievementId, boolean> = {
    first_move: e.firstQuestCompleted,
    two_weeks: e.totalMvdDays >= 14,
    century: e.problemsTotal >= 100,
    shipped: e.aiFeaturePublicRepo,
    return: e.returnedAfterGap,
    regular: e.wakeSdMin < 45,
    in_public: e.publicProjectsDeployedReachable >= 1 || e.publishedWriteups >= 1,
    the_arc: e.day120Sealed,
  };
  return (Object.keys(ACHIEVEMENT_LABELS) as AchievementId[]).map((id) => ({
    id,
    label: ACHIEVEMENT_LABELS[id],
    earned: earned[id],
  }));
}

/** Pure. All 5 identities. */
export function identitiesFrom(e: AchievementEvidence): IdentityResult[] {
  const earned: Record<IdentityId, boolean> = {
    problem_solver: e.problemsTotal >= 100 && e.firstAttemptRateM >= 0.45,
    builder: e.publicProjectsTotal >= 2,
    consistent: e.mvdDaysInTrailing90 >= 60,
    trains: e.trainingSessionsTotal >= 40,
    keeps_promises: e.ifThenFiringRate >= 0.8,
  };
  return (Object.keys(IDENTITY_LABELS) as IdentityId[]).map((id) => ({
    id,
    label: IDENTITY_LABELS[id],
    earned: earned[id],
  }));
}
