import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { getAchievementsReport } from '../../src/store/achievements';
import { loadTodayQuests, completeQuest } from '../../src/store/quests';
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

describe('store/achievements — getAchievementsReport', () => {
  beforeEach(clearAll);

  it('nothing earned on a fresh arc with no activity', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const report = await getAchievementsReport(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(report.achievements.every((a) => !a.earned)).toBe(true);
    expect(report.identities.every((i) => !i.earned)).toBe(true);
  });

  it('First Move earns the moment any quest is completed', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;
    const { instances } = await loadTodayQuests(day, DEFAULT_CONFIG, deps);
    await completeQuest(instances[0]!, 'career', arcId, DEFAULT_CONFIG, deps);

    const report = await getAchievementsReport(day, DEFAULT_CONFIG);
    expect(report.achievements.find((a) => a.id === 'first_move')?.earned).toBe(true);
  });

  it("Keeps Promises earns once career/DSA/training fire on-day at >= 80% (engine/ifThen.ts's real wiring)", async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const templates = await db.quest_template.toArray();
    const byKey = (key: string) => templates.find((t) => t.key === key && t.type === 'core')!;

    const days = ['2026-09-01', '2026-09-02', '2026-09-03'];
    for (const day of days) {
      const { instances } = await loadTodayQuests(day, DEFAULT_CONFIG, deps);
      for (const key of ['career', 'dsa', 'training']) {
        const instance = instances.find((i) => i.template_id === byKey(key).id)!;
        await completeQuest(instance, key, arcId, DEFAULT_CONFIG, deps);
      }
    }

    const report = await getAchievementsReport(days[days.length - 1]!, DEFAULT_CONFIG);
    expect(report.identities.find((i) => i.id === 'keeps_promises')?.earned).toBe(true);
  });

  it('Keeps Promises is not earned when nothing has ever fired', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const report = await getAchievementsReport(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(report.identities.find((i) => i.id === 'keeps_promises')?.earned).toBe(false);
  });
});
