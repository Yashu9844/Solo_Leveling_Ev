import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { getAttributes } from '../../src/store/attributes';
import { logTrainingSession, logSteps } from '../../src/store/training';
import { logProblem } from '../../src/store/dsa';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { EngineDeps } from '../../src/engine/types';

function seededDeps(prefix = 'id'): EngineDeps {
  let counter = 0;
  let clockMs = Date.parse('2026-09-05T10:00:00Z');
  return {
    now: () => {
      const iso = new Date(clockMs).toISOString();
      clockMs += 1000;
      return iso;
    },
    newId: () => `${prefix}-${String(counter++).padStart(6, '0')}`,
  };
}

async function clearAll() {
  await db.event.clear();
  await db.arc.clear();
  await db.quest_template.clear();
  await db.quest_instance.clear();
  await db.xp_ledger.clear();
  await db.checkpoint.clear();
  await db.profile.clear();
  await db.training_session.clear();
  await db.metric_sample.clear();
  await db.dsa_attempt.clear();
  await db.dsa_problem.clear();
}

const ONBOARDING_INPUT: Omit<OnboardingInput, 'intentions' | 'baseline'> = {
  name: 'Test',
  startDate: DEFAULT_CONFIG.arc.startDate,
  endDate: DEFAULT_CONFIG.arc.endDate,
  timezone: DEFAULT_CONFIG.arc.timezone,
  dayBoundaryHour: DEFAULT_CONFIG.arc.dayBoundaryHour,
  dayCloseHour: DEFAULT_CONFIG.arc.dayCloseHour,
  wakeTime: '08:30',
  sleepTime: '02:00',
  trainingDays: [],
  stepsTarget: 8000,
  screenCapMinutes: 60,
  attentionApps: [],
  mainQuestText: 'Ship it.',
};

describe('store/attributes — getAttributes', () => {
  beforeEach(clearAll);

  it('returns all six attributes at 0 for a freshly onboarded arc with no activity', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const results = await getAttributes(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(results).toHaveLength(6);
    for (const r of results) expect(r.value).toBe(0);
  });

  it('VITALITY rises with logged training sessions and steps', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    await logTrainingSession(day, arcId, { type: 'Push', minutes: 40 }, DEFAULT_CONFIG, deps);
    await logSteps(day, arcId, 8000, DEFAULT_CONFIG, deps);

    const results = await getAttributes(day, DEFAULT_CONFIG);
    const vitality = results.find((r) => r.attribute === 'VITALITY')!;
    // 1 session of 16 -> 0.4*(1/16); 8000 steps -> 0.3*1; wakeSd with a
    // single sample (or none) is 0 -> 0.3*(1-0). 1/16*0.4 + 0.3 + 0.3.
    expect(vitality.value).toBeGreaterThan(0);
    expect(vitality.components.steps).toBeCloseTo(0.3, 5);
  });

  it('PROBLEM_SOLVING rises with logged DSA problems', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    await logProblem(
      day,
      arcId,
      { slug: 'two-sum', title: 'Two Sum', topic: 'Arrays', difficulty: 'M', outcome: 'first_attempt', minutes: 20 },
      DEFAULT_CONFIG,
      deps
    );

    const results = await getAttributes(day, DEFAULT_CONFIG);
    const problemSolving = results.find((r) => r.attribute === 'PROBLEM_SOLVING')!;
    expect(problemSolving.components.first_attempt_m).toBeCloseTo(0.35, 5); // 100% first-attempt on the one M problem
    expect(problemSolving.value).toBeGreaterThan(0);
  });

  it('a body-weight METRIC_RECORDED entry never moves any attribute (final/01 §5: no composite body-comp term)', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;
    const before = await getAttributes(day, DEFAULT_CONFIG);

    const { logBodyMetric } = await import('../../src/store/training');
    await logBodyMetric(day, arcId, 'weight_kg', 72, 'kg', DEFAULT_CONFIG, deps);

    const after = await getAttributes(day, DEFAULT_CONFIG);
    expect(after).toEqual(before);
  });
});
