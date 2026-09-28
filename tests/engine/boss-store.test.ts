import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { getBossStatus, clearBoss } from '../../src/store/boss';
import { logApplication } from '../../src/store/career';
import { logTrainingSession } from '../../src/store/training';
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

describe('store/boss — clearBoss end-to-end', () => {
  beforeEach(clearAll);

  it('a fresh arc has no boss cleared and Boss I is not yet in its window', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const status = await getBossStatus('I', DEFAULT_CONFIG.arc.startDate);
    expect(status.cleared).toBe(false);
    expect(status.windowOpen).toBe(false); // day 1, Boss I opens at day 25
  });

  it('clearBoss refuses (returns uncleared) when conditions are unmet, even inside the window', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day30 = '2026-10-01'; // 30 days after 2026-09-01, well inside Boss I's window
    const result = await clearBoss('I', arcId, day30, DEFAULT_CONFIG, deps);
    expect(result.cleared).toBe(false);

    const events = await db.event.toArray();
    expect(events.some((e) => e.type === 'BOSS_CLEARED')).toBe(false);
  });

  it('clearBoss appends BOSS_CLEARED and grants config.bossXp once every condition is real', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = '2026-10-01';

    // 55 problems, 12 sessions, 70 quality applications, 1 AI feature
    // with a repo, Day-30 checkpoint sealed -- Boss I's five conditions.
    for (let i = 0; i < 55; i++) {
      await logProblem(day, arcId, { slug: `p${i}`, title: `P${i}`, topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 5 }, DEFAULT_CONFIG, deps);
    }
    for (let i = 0; i < 12; i++) {
      await logTrainingSession(day, arcId, { type: 'Push', minutes: 30 }, DEFAULT_CONFIG, deps);
    }
    for (let i = 0; i < 70; i++) {
      await logApplication(
        day,
        arcId,
        { company: `Co${i}`, role: 'SWE', roleCategory: 'backend', source: 'referral', resumeVersionId: 'r1', whyLine: `A specific reason number ${i} for this role` },
        DEFAULT_CONFIG,
        deps
      );
    }
    await db.artifact.add({ id: 'art-1', kind: 'feature', title: 'Agent tool', url: 'https://github.com/x/y', project_key: 'proj', local_date: day });
    await db.checkpoint.add({
      id: 'cp-30',
      day: 30,
      sealed_at: deps.now(),
      export_verified: true,
      metrics: {},
      self_efficacy: {},
      automaticity: {},
      enjoyment: {},
      rank_before: 'E',
      rank_after: 'C',
      gates: {},
      controlled: {},
      external: {},
      quest_templates_snapshot: {},
    });

    const before = await getBossStatus('I', day);
    expect(before.conditions.every((c) => c.met)).toBe(true);

    const result = await clearBoss('I', arcId, day, DEFAULT_CONFIG, deps);
    expect(result.cleared).toBe(true);

    const ledger = await db.xp_ledger.toArray();
    const bossEntry = ledger.find((r) => r.reason === 'boss');
    expect(bossEntry?.amount).toBe(DEFAULT_CONFIG.bossXp);
    expect(bossEntry?.category).toBe('BOSS');

    // Idempotent: clearing again does not double-grant.
    await clearBoss('I', arcId, day, DEFAULT_CONFIG, deps);
    const ledgerAfter = await db.xp_ledger.toArray();
    expect(ledgerAfter.filter((r) => r.reason === 'boss')).toHaveLength(1);
  });
});
