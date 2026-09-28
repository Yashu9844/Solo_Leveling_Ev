import { describe, it, expect } from 'vitest';
import { attributesFrom, type AttributeInputs } from '../../src/engine/attributes';

function baseInputs(): AttributeInputs {
  return {
    discipline: { mvdDays: 0, sleepHits: 0, attentionHits: 0, windowDays: 28 },
    depth: { meanDailyDeepMin: 0, meanBlockLenMin: 0 },
    problemSolving: { weightedProblems28d: 0, firstAttemptRateM: 0, revisitSuccessRate: 0 },
    engineering: { foundationMasteryPoints: 0, shippedUnits28d: 0, evalCoverage: 0 },
    momentum: { applications28d: 0, qualityRate: 0, followThroughRate: 0 },
    vitality: { sessions28d: 0, meanSteps: 0, wakeSdMin: 90 },
  };
}

function attr(results: ReturnType<typeof attributesFrom>, name: string) {
  return results.find((r) => r.attribute === name)!;
}

describe('attributesFrom — all-zero baseline', () => {
  it('every attribute is exactly 0 with no evidence', () => {
    const results = attributesFrom(baseInputs());
    for (const r of results) {
      expect(r.value).toBeCloseTo(0, 5);
    }
  });
});

describe('attributesFrom — hand-computed fixtures (final/01 §5)', () => {
  it('DISCIPLINE: 0.40*(mvd/28) + 0.35*(sleep/28) + 0.25*(attention/28)', () => {
    const inputs = baseInputs();
    inputs.discipline = { mvdDays: 28, sleepHits: 14, attentionHits: 0, windowDays: 28 };
    const expected = (0.4 * 1 + 0.35 * 0.5 + 0.25 * 0) * 100; // 40 + 17.5 + 0 = 57.5
    expect(attr(attributesFrom(inputs), 'DISCIPLINE').value).toBeCloseTo(expected, 5);
  });

  it('DEPTH: min(1, deepMin/150) * min(1, blockLen/45)', () => {
    const inputs = baseInputs();
    inputs.depth = { meanDailyDeepMin: 75, meanBlockLenMin: 22.5 }; // both exactly half their denominators
    expect(attr(attributesFrom(inputs), 'DEPTH').value).toBeCloseTo(0.5 * 0.5 * 100, 5); // 25
  });

  it('PROBLEM_SOLVING: 0.45*vol + 0.35*firstAttemptM + 0.20*revisitSuccess, each clamped', () => {
    const inputs = baseInputs();
    inputs.problemSolving = { weightedProblems28d: 55, firstAttemptRateM: 0.6, revisitSuccessRate: 0.8 };
    const expected = (0.45 * 0.5 + 0.35 * 0.6 + 0.2 * 0.8) * 100; // 22.5 + 21 + 16 = 59.5
    expect(attr(attributesFrom(inputs), 'PROBLEM_SOLVING').value).toBeCloseTo(expected, 5);
  });

  it('ENGINEERING: 0.35*mastery/24 + 0.40*shipped/6 + 0.25*evalCoverage', () => {
    const inputs = baseInputs();
    inputs.engineering = { foundationMasteryPoints: 12, shippedUnits28d: 3, evalCoverage: 0.4 };
    const expected = (0.35 * 0.5 + 0.4 * 0.5 + 0.25 * 0.4) * 100; // 17.5 + 20 + 10 = 47.5
    expect(attr(attributesFrom(inputs), 'ENGINEERING').value).toBeCloseTo(expected, 5);
  });

  it('MOMENTUM: 0.40*applications/70 + 0.35*quality + 0.25*followThrough', () => {
    const inputs = baseInputs();
    inputs.momentum = { applications28d: 35, qualityRate: 0.8, followThroughRate: 0.76 };
    const expected = (0.4 * 0.5 + 0.35 * 0.8 + 0.25 * 0.76) * 100; // 20 + 28 + 19 = 67
    expect(attr(attributesFrom(inputs), 'MOMENTUM').value).toBeCloseTo(expected, 5);
  });

  it('VITALITY: 0.40*sessions/16 + 0.30*steps/8000 + 0.30*(1 - wakeSd/90)', () => {
    const inputs = baseInputs();
    inputs.vitality = { sessions28d: 8, meanSteps: 4000, wakeSdMin: 45 };
    const expected = (0.4 * 0.5 + 0.3 * 0.5 + 0.3 * 0.5) * 100; // 20 + 15 + 15 = 50
    expect(attr(attributesFrom(inputs), 'VITALITY').value).toBeCloseTo(expected, 5);
  });

  it('every term clamps at 1 — exceeding a denominator never pushes an attribute past 100', () => {
    const inputs = baseInputs();
    inputs.discipline = { mvdDays: 999, sleepHits: 999, attentionHits: 999, windowDays: 28 };
    inputs.momentum = { applications28d: 9999, qualityRate: 5, followThroughRate: 5 };
    for (const r of attributesFrom(inputs)) {
      expect(r.value).toBeLessThanOrEqual(100.0001);
    }
  });
});

describe('attributesFrom — window sensitivity (final/01 §5: "0 missed -> ~100 · 3 -> ~89 · 7 -> ~75 · 14 -> ~50")', () => {
  // DISCIPLINE's three weights sum to exactly 1.0, so when all three hit
  // counts move together it reduces to a plain hits/windowDays curve —
  // exactly the curve final/01 §5 describes.
  it.each([
    [0, 100],
    [3, 89],
    [7, 75],
    [14, 50],
  ])('%i missed days of 28 -> DISCIPLINE ~= %i', (missed, expected) => {
    const hits = 28 - missed;
    const inputs = baseInputs();
    inputs.discipline = { mvdDays: hits, sleepHits: hits, attentionHits: hits, windowDays: 28 };
    expect(Math.round(attr(attributesFrom(inputs), 'DISCIPLINE').value)).toBe(expected);
  });
});

describe('attributesFrom — components sum to value/100', () => {
  it('for every attribute, the returned components sum to value/100', () => {
    const inputs = baseInputs();
    inputs.discipline = { mvdDays: 20, sleepHits: 10, attentionHits: 25, windowDays: 28 };
    inputs.depth = { meanDailyDeepMin: 90, meanBlockLenMin: 30 };
    inputs.vitality = { sessions28d: 10, meanSteps: 6000, wakeSdMin: 20 };
    for (const r of attributesFrom(inputs)) {
      const sum = Object.values(r.components).reduce((s, v) => s + v, 0);
      expect(sum * 100).toBeCloseTo(r.value, 5);
    }
  });
});
