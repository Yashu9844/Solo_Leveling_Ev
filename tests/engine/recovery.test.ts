import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { getRecoverableDay, claimRecovery } from '../../src/store/recovery';
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
  startDate: DEFAULT_CONFIG.arc.startDate, // 2026-09-01
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

describe('getRecoverableDay — never-opened days are not recoverable', () => {
  beforeEach(clearAll);

  it('a freshly onboarded arc whose start_date is days before "today" offers no bogus recovery', async () => {
    // arc.start_date is 2026-09-01, but the arc is only initialised (and
    // therefore only ever opened) on 2026-09-05 -- days 1-4 were never
    // opened, and must not read as "missed" (the Slice 11 regression this
    // guards: an e2e viewport test caught the recovery card rendering on
    // a fresh onboarding for exactly this reason).
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await loadTodayQuests('2026-09-05', DEFAULT_CONFIG, deps); // only today gets opened

    const recoverable = await getRecoverableDay('2026-09-05', DEFAULT_CONFIG);
    expect(recoverable).toBeNull();
  });

  it('a genuinely opened-but-incomplete day IS still recoverable', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const { instances } = await loadTodayQuests('2026-09-05', DEFAULT_CONFIG, deps);
    const careerInstance = instances[0]!;
    await completeQuest(careerInstance, 'career', arcId, DEFAULT_CONFIG, deps);

    const recoverable = await getRecoverableDay('2026-09-06', DEFAULT_CONFIG);
    expect(recoverable).not.toBeNull();
    expect(recoverable!.localDate).toBe('2026-09-05');
    expect(recoverable!.coreCompleted).toBe(1);
  });

  it('claiming with a reason records it on the QUEST_RECOVERED event', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await loadTodayQuests('2026-09-05', DEFAULT_CONFIG, deps);

    await claimRecovery('2026-09-05', '2026-09-06', arcId, DEFAULT_CONFIG, deps, 'wrong_time');
    const events = await db.event.toArray();
    const recoveryEvent = events.find((e) => e.type === 'QUEST_RECOVERED');
    expect((recoveryEvent?.payload as { reason?: string })?.reason).toBe('wrong_time');
  });
});
