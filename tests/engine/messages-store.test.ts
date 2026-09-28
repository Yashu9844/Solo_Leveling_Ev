import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { getTodaySystemLine, computeMessageContext } from '../../src/store/messages';
import { recordReflectionShown } from '../../src/store/reflections';
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
  await db.day_rollup.clear();
  await db.dsa_attempt.clear();
  await db.dsa_problem.clear();
  await db.reflection_state.clear();
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

describe('computeMessageContext — real data wiring', () => {
  beforeEach(clearAll);

  it('a fresh arc has no P1-P3 evidence', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const context = await computeMessageContext(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(context.firstHardProblemFirstAttempt).toBe(false);
    expect(context.firstDeploymentReachable).toBe(false);
    expect(context.newLongestDeepBlockMinutes).toBeUndefined();
  });

  it('logging the first-ever hard problem solved first-attempt sets the P1 flag for that day only', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;
    await logProblem(day, arcId, { slug: 'hard-one', title: 'Hard One', topic: 'Graphs', difficulty: 'H', outcome: 'first_attempt', minutes: 40 }, DEFAULT_CONFIG, deps);

    const context = await computeMessageContext(day, DEFAULT_CONFIG);
    expect(context.firstHardProblemFirstAttempt).toBe(true);

    // A second H first-attempt later must NOT re-fire the "first" flag.
    const day2 = '2026-09-06';
    await logProblem(day2, arcId, { slug: 'hard-two', title: 'Hard Two', topic: 'Graphs', difficulty: 'H', outcome: 'first_attempt', minutes: 40 }, DEFAULT_CONFIG, deps);
    const context2 = await computeMessageContext(day2, DEFAULT_CONFIG);
    expect(context2.firstHardProblemFirstAttempt).toBe(false);
  });
});

describe('getTodaySystemLine — combines System Message and reflection selection', () => {
  beforeEach(clearAll);

  it('falls back to a reflection on a fresh arc (no P1-P3 evidence yet)', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    const line = await getTodaySystemLine(day, 1, false, 'MORNING', DEFAULT_CONFIG);
    expect(line.source).toBe('reflection');
    expect(line.reflectionId).toBeDefined();
  });

  it('real P1 evidence overrides any reflection', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;
    await logProblem(day, arcId, { slug: 'hard-one', title: 'Hard One', topic: 'Graphs', difficulty: 'H', outcome: 'first_attempt', minutes: 40 }, DEFAULT_CONFIG, deps);

    const line = await getTodaySystemLine(day, 1, false, 'MORNING', DEFAULT_CONFIG);
    expect(line.source).toBe('system_message');
    expect(line.text).toBe('First hard problem first-attempt.');
  });

  it('recordReflectionShown puts the same reflection on cooldown for the next call', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    const first = await getTodaySystemLine(day, 1, false, 'MORNING', DEFAULT_CONFIG);
    expect(first.reflectionId).toBeDefined();
    await recordReflectionShown(first.reflectionId!, day);

    const day2 = '2026-09-06';
    const second = await getTodaySystemLine(day2, 2, false, 'MORNING', DEFAULT_CONFIG);
    expect(second.reflectionId).not.toBe(first.reflectionId); // the shown one is on a 21-day cooldown
  });

  it('post-lapse restricts the reflection pool to setbacks/calm/reflective, even though other MORNING-context reflections exist', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    const line = await getTodaySystemLine(day, 5, true, 'POST_LAPSE', DEFAULT_CONFIG);
    expect(line.source).toBe('reflection');
    expect(line.reflectionId).toMatch(/^setbacks-/);
  });
});
