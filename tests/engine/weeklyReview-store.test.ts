import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { getWeeklyReview } from '../../src/store/weeklyReview';
import { logBuildSession } from '../../src/store/build';
import { logSleep } from '../../src/store/lifestyle';
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
  await db.day_rollup.clear();
  await db.player_state.clear();
  await db.checkpoint.clear();
  await db.profile.clear();
  await db.artifact.clear();
  await db.build_session.clear();
  await db.metric_sample.clear();
  await db.dsa_problem.clear();
  await db.dsa_attempt.clear();
  await db.weekly_quest.clear();
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

describe('getWeeklyReview -- resumeNudge and sleepDsaCorrelation wiring', () => {
  beforeEach(clearAll);

  it('resumeNudge is null with nothing shipped this week', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const report = await getWeeklyReview(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);
    expect(report.resumeNudge).toBeNull();
  });

  it('resumeNudge appears once an artifact ships inside the 7-day window', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;
    await logBuildSession(
      day,
      arcId,
      { mode: 'SHIP', minutes: 60, projectKey: 'p1', shippedArtifact: { kind: 'feature', title: 'Retry logic' } },
      DEFAULT_CONFIG,
      deps
    );
    const report = await getWeeklyReview(day, DEFAULT_CONFIG, deps);
    expect(report.resumeNudge).toBe('You shipped 1 artifact this week. Does your resume say so?');
  });

  it('sleepDsaCorrelation is null without enough real data to compare', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const report = await getWeeklyReview(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);
    expect(report.sleepDsaCorrelation).toBeNull();
  });

  it('sleepDsaCorrelation reflects a real miss-vs-on-time gap from logged wake times and DSA attempts', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    // wakeTargetTime is '08:30' (DEFAULT_CONFIG). 10:00 is far outside
    // the 30-minute tolerance (a miss); 08:30 is exactly on time.
    const day1 = DEFAULT_CONFIG.arc.startDate; // miss
    const day2 = '2026-09-02'; // DSA day after day1 -- low rate
    const day3 = '2026-09-03'; // on-time wake
    const day4 = '2026-09-04'; // DSA day after day3 -- high rate

    await logSleep(day1, arcId, '10:00', DEFAULT_CONFIG, deps);
    await logSleep(day3, arcId, '08:30', DEFAULT_CONFIG, deps);

    await logProblem(day2, arcId, { slug: 'a', title: 'a', topic: 'Arrays', difficulty: 'E', outcome: 'unsolved', minutes: 10 }, DEFAULT_CONFIG, deps);
    await logProblem(day4, arcId, { slug: 'b', title: 'b', topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 10 }, DEFAULT_CONFIG, deps);

    const report = await getWeeklyReview(day4, DEFAULT_CONFIG, deps);
    expect(report.sleepDsaCorrelation).not.toBeNull();
    expect(report.sleepDsaCorrelation!.missedNights).toBe(1);
    expect(report.sleepDsaCorrelation!.afterMissRate).toBe(0);
    expect(report.sleepDsaCorrelation!.afterOnTimeRate).toBe(1);
    expect(report.sleepDsaCorrelation!.deltaPoints).toBe(100);
  });
});
