// final/02 §2.2's interview-readiness benchmark and final/03 §4.4's
// "cost per task measured and stated" -- both were hardcoded false
// everywhere (no data source). Now real: logInterviewBenchmark
// (store/training.ts) and ArtifactRow.cost_per_task_stated.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { computeGateEvidence } from '../../src/store/checkpoint';
import { computeBossEvidence } from '../../src/store/boss';
import { logInterviewBenchmark, getInterviewBenchmarkPassed, getInterviewBenchmarkHistory } from '../../src/store/training';
import { logBuildSession } from '../../src/store/build';
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
  await db.day_rollup.clear();
  await db.player_state.clear();
  await db.checkpoint.clear();
  await db.profile.clear();
  await db.metric_sample.clear();
  await db.artifact.clear();
  await db.build_session.clear();
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

describe('logInterviewBenchmark / getInterviewBenchmarkPassed', () => {
  beforeEach(clearAll);

  it('is false with no attempts logged', async () => {
    expect(await getInterviewBenchmarkPassed()).toBe(false);
  });

  it('stays false after a logged attempt that did not pass', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await logInterviewBenchmark(DEFAULT_CONFIG.arc.startDate, arcId, false, DEFAULT_CONFIG, deps);
    expect(await getInterviewBenchmarkPassed()).toBe(false);
    expect(await getInterviewBenchmarkHistory()).toEqual([{ local_date: DEFAULT_CONFIG.arc.startDate, passed: false }]);
  });

  it('becomes true forever once any attempt passes, even after a later unpassed retry', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await logInterviewBenchmark(DEFAULT_CONFIG.arc.startDate, arcId, false, DEFAULT_CONFIG, deps);
    await logInterviewBenchmark(DEFAULT_CONFIG.arc.startDate, arcId, true, DEFAULT_CONFIG, deps);
    expect(await getInterviewBenchmarkPassed()).toBe(true);

    await logInterviewBenchmark(DEFAULT_CONFIG.arc.startDate, arcId, false, DEFAULT_CONFIG, deps);
    expect(await getInterviewBenchmarkPassed()).toBe(true); // "repeatable" means retrying, not re-proving
  });

  it('grants no XP -- self-report only, same rule as body metrics', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await logInterviewBenchmark(DEFAULT_CONFIG.arc.startDate, arcId, true, DEFAULT_CONFIG, deps);
    const ledger = await db.xp_ledger.toArray();
    expect(ledger).toHaveLength(0);
  });
});

describe('computeGateEvidence -- interviewBenchmarkPassed and costPerTaskMeasured are real', () => {
  beforeEach(clearAll);

  it('both start false on a fresh arc', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const evidence = await computeGateEvidence(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(evidence.interviewBenchmarkPassed).toBe(false);
    expect(evidence.costPerTaskMeasured).toBe(false);
  });

  it('interviewBenchmarkPassed flips true after a real pass', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await logInterviewBenchmark(DEFAULT_CONFIG.arc.startDate, arcId, true, DEFAULT_CONFIG, deps);
    const evidence = await computeGateEvidence(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(evidence.interviewBenchmarkPassed).toBe(true);
  });

  it('costPerTaskMeasured flips true only for a project artifact explicitly flagged, not a feature', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);

    await logBuildSession(
      DEFAULT_CONFIG.arc.startDate,
      arcId,
      { mode: 'SHIP', minutes: 60, projectKey: 'p1', shippedArtifact: { kind: 'feature', title: 'A feature', costPerTaskStated: true } },
      DEFAULT_CONFIG,
      deps
    );
    let evidence = await computeGateEvidence(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(evidence.costPerTaskMeasured).toBe(false); // a 'feature' flag doesn't count, only 'project'

    await logBuildSession(
      DEFAULT_CONFIG.arc.startDate,
      arcId,
      { mode: 'SHIP', minutes: 60, projectKey: 'p2', shippedArtifact: { kind: 'project', title: 'P2 agent', costPerTaskStated: true } },
      DEFAULT_CONFIG,
      deps
    );
    evidence = await computeGateEvidence(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(evidence.costPerTaskMeasured).toBe(true);
  });
});

describe('computeBossEvidence -- same two fields, independently wired (store/boss.ts)', () => {
  beforeEach(clearAll);

  it('both real here too', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    let evidence = await computeBossEvidence();
    expect(evidence.interviewBenchmarkPassed).toBe(false);
    expect(evidence.costPerTaskMeasured).toBe(false);

    await logInterviewBenchmark(DEFAULT_CONFIG.arc.startDate, arcId, true, DEFAULT_CONFIG, deps);
    await logBuildSession(
      DEFAULT_CONFIG.arc.startDate,
      arcId,
      { mode: 'SHIP', minutes: 60, projectKey: 'p1', shippedArtifact: { kind: 'project', title: 'P1 agent', costPerTaskStated: true } },
      DEFAULT_CONFIG,
      deps
    );
    evidence = await computeBossEvidence();
    expect(evidence.interviewBenchmarkPassed).toBe(true);
    expect(evidence.costPerTaskMeasured).toBe(true);
  });
});
