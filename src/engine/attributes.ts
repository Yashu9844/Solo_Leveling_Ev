import type { Attribute } from './types';
export type { Attribute };

// final/01-quests-xp-level-rank.md §5 — the six formulas, transcribed
// verbatim. Weights and denominators are structural parts of the formula
// itself, not tunable gameplay numbers (same precedent as engine/dsa.ts's
// DIFFICULTY_WEIGHT and engine/build.ts's 3:1 ratio) — hardcoded here
// rather than routed through EngineConfig.

export const ATTRIBUTE_GROUPS: Record<Attribute, 'Mind' | 'Craft' | 'Career' | 'Body'> = {
  DISCIPLINE: 'Mind',
  DEPTH: 'Mind',
  PROBLEM_SOLVING: 'Mind',
  ENGINEERING: 'Craft',
  MOMENTUM: 'Career',
  VITALITY: 'Body',
};

export interface AttributeInputs {
  discipline: {
    mvdDays: number; // out of windowDays
    sleepHits: number; // SLEEP quest completions, out of windowDays
    attentionHits: number; // ATTENTION quest completions, out of windowDays
    windowDays: number;
  };
  depth: {
    meanDailyDeepMin: number; // mean of (BUILD + LEARN block + system design) minutes per day
    meanBlockLenMin: number; // mean minutes per individual session/block logged
  };
  problemSolving: {
    weightedProblems28d: number; // engine/dsa.ts's weightedVolume over the window
    firstAttemptRateM: number; // first-attempt success rate among Medium-difficulty attempts
    revisitSuccessRate: number; // share of revisits that were first_attempt (i.e. solved)
  };
  engineering: {
    foundationMasteryPoints: number; // engine/foundations.ts's foundationMasteryPoints, max 36
    shippedUnits28d: number; // ARTIFACT_SHIPPED count over the window
    evalCoverage: number; // share of shipped units that are eval-grade (final/03 §4.3)
  };
  momentum: {
    applications28d: number;
    qualityRate: number; // engine/career.ts's funnelFrom(...).qualityPassRate
    followThroughRate: number; // engine/career.ts's followThroughRate
  };
  vitality: {
    sessions28d: number; // training_session count over the window
    meanSteps: number; // mean of daily steps entries in the window
    wakeSdMin: number; // standard deviation of logged wake times, in minutes
  };
}

export interface AttributeResult {
  attribute: Attribute;
  value: number; // 0-100
  components: Record<string, number>; // each term's contribution to value/100, sums to value/100
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Pure. Computes all six derived attributes from their pre-aggregated
 * window inputs (the store layer owns turning 28 days of DB rows into
 * these scalars — see store/attributes.ts). Every term is clamped to
 * [0,1] before weighting, then the weighted terms are summed and
 * multiplied by 100 — final/01 §5.
 */
export function attributesFrom(inputs: AttributeInputs): AttributeResult[] {
  const discipline = {
    mvd: 0.4 * clamp01(inputs.discipline.mvdDays / inputs.discipline.windowDays),
    sleep: 0.35 * clamp01(inputs.discipline.sleepHits / inputs.discipline.windowDays),
    attention: 0.25 * clamp01(inputs.discipline.attentionHits / inputs.discipline.windowDays),
  };

  const depthFactor1 = clamp01(inputs.depth.meanDailyDeepMin / 150);
  const depthFactor2 = clamp01(inputs.depth.meanBlockLenMin / 45);
  const depth = { deep_minutes: depthFactor1 * depthFactor2 };

  const problemSolving = {
    volume: 0.45 * clamp01(inputs.problemSolving.weightedProblems28d / 110),
    first_attempt_m: 0.35 * clamp01(inputs.problemSolving.firstAttemptRateM),
    revisit_success: 0.2 * clamp01(inputs.problemSolving.revisitSuccessRate),
  };

  const engineering = {
    foundation_mastery: 0.35 * clamp01(inputs.engineering.foundationMasteryPoints / 24),
    shipped_units: 0.4 * clamp01(inputs.engineering.shippedUnits28d / 6),
    eval_coverage: 0.25 * clamp01(inputs.engineering.evalCoverage),
  };

  const momentum = {
    applications: 0.4 * clamp01(inputs.momentum.applications28d / 70),
    quality: 0.35 * clamp01(inputs.momentum.qualityRate),
    follow_through: 0.25 * clamp01(inputs.momentum.followThroughRate),
  };

  const vitality = {
    sessions: 0.4 * clamp01(inputs.vitality.sessions28d / 16),
    steps: 0.3 * clamp01(inputs.vitality.meanSteps / 8000),
    wake_consistency: 0.3 * (1 - clamp01(inputs.vitality.wakeSdMin / 90)),
  };

  function total(components: Record<string, number>): number {
    return Object.values(components).reduce((sum, v) => sum + v, 0) * 100;
  }

  const results: AttributeResult[] = [
    { attribute: 'DISCIPLINE', value: total(discipline), components: discipline },
    { attribute: 'DEPTH', value: total(depth), components: depth },
    { attribute: 'PROBLEM_SOLVING', value: total(problemSolving), components: problemSolving },
    { attribute: 'ENGINEERING', value: total(engineering), components: engineering },
    { attribute: 'MOMENTUM', value: total(momentum), components: momentum },
    { attribute: 'VITALITY', value: total(vitality), components: vitality },
  ];

  return results;
}
