import { describe, it, expect } from 'vitest';
import { evaluateBoss, BOSS_II_TOPICS, type BossEvidence } from '../../src/engine/boss';
import type { FoundationTopic } from '../../src/engine/foundations';
import type { MasteryState } from '../../src/engine/types';

function fullEvidence(overrides: Partial<BossEvidence> = {}): BossEvidence {
  const boss2TopicStates = Object.fromEntries(BOSS_II_TOPICS.map((t) => [t, 'unseen'])) as Record<
    FoundationTopic,
    MasteryState
  >;
  return {
    problemsTotal: 0,
    trainingSessionsTotal: 0,
    qualityApplicationsTotal: 0,
    aiFeaturePublicRepo: false,
    day30CheckpointSealed: false,
    boss2TopicStates,
    systemDesignsStudied: 0,
    systemDesignsWrittenUp: 0,
    publicProjectsWithEvalSuite: 0,
    publicProjectsDeployedReachable: 0,
    costPerTaskMeasured: false,
    publishedWriteups: 0,
    problemsFirstAttemptRateM: 0,
    foundationTopicsFluentPlus: 0,
    foundationTopicsRetainedPlus: 0,
    systemDesignsExplainedAloud: 0,
    resumeVersionsTotal: 0,
    resumeExternallyReviewed: false,
    recordedMocks: 0,
    interviewBenchmarkPassed: false,
    arcSealed: false,
    ...overrides,
  };
}

describe('evaluateBoss — Boss I (FIRST EVIDENCE)', () => {
  const ALL_MET: Partial<BossEvidence> = {
    problemsTotal: 55,
    trainingSessionsTotal: 12,
    qualityApplicationsTotal: 70,
    aiFeaturePublicRepo: true,
    day30CheckpointSealed: true,
  };

  it('does not offer clearing before day 25', () => {
    const result = evaluateBoss('I', 24, fullEvidence(ALL_MET), false);
    expect(result.windowOpen).toBe(false);
    expect(result.cleared).toBe(false);
  });

  it('clears at day 25 once every condition is met', () => {
    const result = evaluateBoss('I', 25, fullEvidence(ALL_MET), false);
    expect(result.windowOpen).toBe(true);
    expect(result.cleared).toBe(true);
  });

  it('stays clearable past day 35 — a missed narrow window is never a permanent lock-out', () => {
    const result = evaluateBoss('I', 50, fullEvidence(ALL_MET), false);
    expect(result.windowOpen).toBe(true);
    expect(result.cleared).toBe(true);
  });

  it('does not clear with one condition short', () => {
    const result = evaluateBoss('I', 30, fullEvidence({ ...ALL_MET, day30CheckpointSealed: false }), false);
    expect(result.cleared).toBe(false);
  });

  it('a boss cannot be un-cleared once cleared, even outside its window', () => {
    const result = evaluateBoss('I', 5, fullEvidence(), true);
    expect(result.cleared).toBe(true);
  });
});

describe('evaluateBoss — Boss II (STRONG ENGINEERING BASE) — the six-topic subset', () => {
  it('requires ALL SIX named topics at >= Applied, not just some', () => {
    const states = Object.fromEntries(BOSS_II_TOPICS.map((t) => [t, 'applied' as MasteryState])) as Record<
      FoundationTopic,
      MasteryState
    >;
    states['Concurrency'] = 'introduced'; // one topic short of Applied
    const result = evaluateBoss(
      'II',
      50,
      fullEvidence({ boss2TopicStates: states, systemDesignsStudied: 6, systemDesignsWrittenUp: 2 }),
      false
    );
    expect(result.conditions[0]!.met).toBe(false);
    expect(result.cleared).toBe(false);
  });

  it('clears when all six are >= Applied, >= 3 are Fluent, and design counts clear', () => {
    const states = Object.fromEntries(BOSS_II_TOPICS.map((t) => [t, 'applied' as MasteryState])) as Record<
      FoundationTopic,
      MasteryState
    >;
    states['Operating Systems'] = 'fluent';
    states['Networking'] = 'fluent';
    states['Databases'] = 'fluent';
    const result = evaluateBoss(
      'II',
      50,
      fullEvidence({ boss2TopicStates: states, systemDesignsStudied: 6, systemDesignsWrittenUp: 2 }),
      false
    );
    expect(result.cleared).toBe(true);
  });
});

describe('evaluateBoss — Boss III and IV never clear without the missing data sources', () => {
  it('Boss III cannot clear — cost-per-task has no data source', () => {
    const result = evaluateBoss(
      'III',
      75,
      fullEvidence({ publicProjectsWithEvalSuite: 1, publicProjectsDeployedReachable: 1, publishedWriteups: 1 }),
      false
    );
    expect(result.cleared).toBe(false);
    expect(result.conditions.find((c) => c.label.includes('Cost-per-task'))?.met).toBe(false);
  });

  it('Boss IV cannot clear — the interview benchmark has no data source', () => {
    const result = evaluateBoss(
      'IV',
      100,
      fullEvidence({
        problemsTotal: 200,
        problemsFirstAttemptRateM: 0.6,
        foundationTopicsFluentPlus: 8,
        foundationTopicsRetainedPlus: 3,
        systemDesignsStudied: 12,
        systemDesignsWrittenUp: 4,
        systemDesignsExplainedAloud: 2,
        resumeVersionsTotal: 3,
        resumeExternallyReviewed: true,
        recordedMocks: 4,
        arcSealed: true,
      }),
      false
    );
    expect(result.cleared).toBe(false);
  });
});
