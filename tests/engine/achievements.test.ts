import { describe, it, expect } from 'vitest';
import { achievementsFrom, identitiesFrom, type AchievementEvidence } from '../../src/engine/achievements';

function baseEvidence(overrides: Partial<AchievementEvidence> = {}): AchievementEvidence {
  return {
    firstQuestCompleted: false,
    totalMvdDays: 0,
    mvdDaysInTrailing90: 0,
    problemsTotal: 0,
    firstAttemptRateM: 0,
    aiFeaturePublicRepo: false,
    returnedAfterGap: false,
    wakeSdMin: 999,
    publicProjectsDeployedReachable: 0,
    publishedWriteups: 0,
    publicProjectsTotal: 0,
    trainingSessionsTotal: 0,
    ifThenFiringRate: 0,
    day120Sealed: false,
    ...overrides,
  };
}

function find<T extends { id: string }>(results: T[], id: string): T {
  return results.find((r) => r.id === id)!;
}

describe('achievementsFrom', () => {
  it('none earned with no evidence', () => {
    expect(achievementsFrom(baseEvidence()).every((a) => !a.earned)).toBe(true);
  });

  it('each achievement fires exactly on its own condition', () => {
    expect(find(achievementsFrom(baseEvidence({ firstQuestCompleted: true })), 'first_move').earned).toBe(true);
    expect(find(achievementsFrom(baseEvidence({ totalMvdDays: 14 })), 'two_weeks').earned).toBe(true);
    expect(find(achievementsFrom(baseEvidence({ totalMvdDays: 13 })), 'two_weeks').earned).toBe(false);
    expect(find(achievementsFrom(baseEvidence({ problemsTotal: 100 })), 'century').earned).toBe(true);
    expect(find(achievementsFrom(baseEvidence({ problemsTotal: 99 })), 'century').earned).toBe(false);
    expect(find(achievementsFrom(baseEvidence({ aiFeaturePublicRepo: true })), 'shipped').earned).toBe(true);
    expect(find(achievementsFrom(baseEvidence({ returnedAfterGap: true })), 'return').earned).toBe(true);
    expect(find(achievementsFrom(baseEvidence({ wakeSdMin: 44 })), 'regular').earned).toBe(true);
    expect(find(achievementsFrom(baseEvidence({ wakeSdMin: 45 })), 'regular').earned).toBe(false);
    expect(find(achievementsFrom(baseEvidence({ publishedWriteups: 1 })), 'in_public').earned).toBe(true);
    expect(find(achievementsFrom(baseEvidence({ publicProjectsDeployedReachable: 1 })), 'in_public').earned).toBe(true);
    expect(find(achievementsFrom(baseEvidence({ day120Sealed: true })), 'the_arc').earned).toBe(true);
  });

  it('returns exactly 8 achievements', () => {
    expect(achievementsFrom(baseEvidence())).toHaveLength(8);
  });
});

describe('identitiesFrom', () => {
  it('none earned with no evidence', () => {
    expect(identitiesFrom(baseEvidence()).every((i) => !i.earned)).toBe(true);
  });

  it('Problem Solver requires BOTH the volume and the rate', () => {
    expect(find(identitiesFrom(baseEvidence({ problemsTotal: 100, firstAttemptRateM: 0.45 })), 'problem_solver').earned).toBe(true);
    expect(find(identitiesFrom(baseEvidence({ problemsTotal: 100, firstAttemptRateM: 0.44 })), 'problem_solver').earned).toBe(false);
    expect(find(identitiesFrom(baseEvidence({ problemsTotal: 99, firstAttemptRateM: 0.9 })), 'problem_solver').earned).toBe(false);
  });

  it('the rest fire exactly on their own threshold', () => {
    expect(find(identitiesFrom(baseEvidence({ publicProjectsTotal: 2 })), 'builder').earned).toBe(true);
    expect(find(identitiesFrom(baseEvidence({ mvdDaysInTrailing90: 60 })), 'consistent').earned).toBe(true);
    expect(find(identitiesFrom(baseEvidence({ mvdDaysInTrailing90: 59 })), 'consistent').earned).toBe(false);
    expect(find(identitiesFrom(baseEvidence({ trainingSessionsTotal: 40 })), 'trains').earned).toBe(true);
    expect(find(identitiesFrom(baseEvidence({ ifThenFiringRate: 0.8 })), 'keeps_promises').earned).toBe(true);
  });

  it('returns exactly 5 identities', () => {
    expect(identitiesFrom(baseEvidence())).toHaveLength(5);
  });
});
