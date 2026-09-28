import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { getWeeklyQuestProposal, acceptWeeklyQuest, getActiveWeeklyQuest } from '../../src/store/weeklyQuest';
import { logProblem } from '../../src/store/dsa';
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
  await db.dsa_problem.clear();
  await db.dsa_attempt.clear();
  await db.artifact.clear();
  await db.build_session.clear();
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

describe('getWeeklyQuestProposal', () => {
  beforeEach(clearAll);

  it('a fresh arc with no DSA history proposes a ship-focused quest', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const proposal = await getWeeklyQuestProposal(DEFAULT_CONFIG.arc.startDate);
    expect(proposal.kind).toBe('ship_project');
  });

  it('targets the real weakest topic from the trailing 7 days', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;
    for (let i = 0; i < 3; i++) {
      await logProblem(day, arcId, { slug: `arr${i}`, title: `arr${i}`, topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 5 }, DEFAULT_CONFIG, deps);
    }
    for (let i = 0; i < 3; i++) {
      await logProblem(day, arcId, { slug: `graph${i}`, title: `graph${i}`, topic: 'Graphs', difficulty: 'M', outcome: 'unsolved', minutes: 5 }, DEFAULT_CONFIG, deps);
    }
    const proposal = await getWeeklyQuestProposal(day);
    expect(proposal.kind).toBe('dsa_topic_volume');
    expect(proposal.topic).toBe('Graphs'); // 0% first-attempt vs Arrays' 100%
  });
});

describe('acceptWeeklyQuest / getActiveWeeklyQuest', () => {
  beforeEach(clearAll);

  it('accepting creates a 7-day-window row; a second accept the same week is refused', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;
    const proposal = await getWeeklyQuestProposal(day);

    const accepted = await acceptWeeklyQuest(day, proposal, deps);
    expect(accepted).not.toBeNull();
    expect(accepted!.week_start_date).toBe(day);
    expect(accepted!.week_end_date).toBe('2026-09-07');

    const secondAttempt = await acceptWeeklyQuest(day, proposal, deps);
    expect(secondAttempt).toBeNull();
  });

  it('with no active quest, getActiveWeeklyQuest returns null', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const arc = await db.arc.toCollection().first();
    const result = await getActiveWeeklyQuest(DEFAULT_CONFIG.arc.startDate, arc!.id, DEFAULT_CONFIG, deps);
    expect(result).toBeNull();
  });

  it('live progress reflects real logged problems in the accepted topic, excluding other topics and revisits', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    await acceptWeeklyQuest(day, { kind: 'dsa_topic_volume', description: '18 problems, Graphs focus', target: 18, topic: 'Graphs' }, deps);

    await logProblem(day, arcId, { slug: 'g1', title: 'g1', topic: 'Graphs', difficulty: 'M', outcome: 'first_attempt', minutes: 10 }, DEFAULT_CONFIG, deps);
    await logProblem(day, arcId, { slug: 'g2', title: 'g2', topic: 'Graphs', difficulty: 'M', outcome: 'unsolved', minutes: 10 }, DEFAULT_CONFIG, deps);
    await logProblem(day, arcId, { slug: 'a1', title: 'a1', topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 5 }, DEFAULT_CONFIG, deps); // wrong topic

    const active = await getActiveWeeklyQuest(day, arcId, DEFAULT_CONFIG, deps);
    expect(active).not.toBeNull();
    expect(active!.progress).toBe(2); // only the two Graphs attempts
    expect(active!.justCompleted).toBe(false);
  });

  it('claims exactly once, grants config.weeklyQuestXp as BONUS, and stays claimed on a later read', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    await acceptWeeklyQuest(day, { kind: 'dsa_topic_volume', description: '2 problems, Graphs focus', target: 2, topic: 'Graphs' }, deps);
    await logProblem(day, arcId, { slug: 'g1', title: 'g1', topic: 'Graphs', difficulty: 'M', outcome: 'first_attempt', minutes: 10 }, DEFAULT_CONFIG, deps);
    await logProblem(day, arcId, { slug: 'g2', title: 'g2', topic: 'Graphs', difficulty: 'M', outcome: 'unsolved', minutes: 10 }, DEFAULT_CONFIG, deps);

    const first = await getActiveWeeklyQuest(day, arcId, DEFAULT_CONFIG, deps);
    expect(first!.justCompleted).toBe(true);
    expect(first!.row.xp).toBe(DEFAULT_CONFIG.weeklyQuestXp);
    expect(first!.row.completed_at).toBeDefined();

    const ledger = await db.xp_ledger.toArray();
    const bonusRow = ledger.find((r) => r.reason === 'weekly_quest');
    expect(bonusRow?.amount).toBe(DEFAULT_CONFIG.weeklyQuestXp);
    expect(bonusRow?.category).toBe('BONUS');

    // Second read: no longer "active" (it's completed), so no double claim.
    const second = await getActiveWeeklyQuest(day, arcId, DEFAULT_CONFIG, deps);
    expect(second).toBeNull();
    const ledgerAfter = await db.xp_ledger.toArray();
    expect(ledgerAfter.filter((r) => r.reason === 'weekly_quest')).toHaveLength(1);
  });

  it('a ship_project quest counts real artifacts logged in the window', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    await acceptWeeklyQuest(day, { kind: 'ship_project', description: 'Ship one real unit of progress this week', target: 1 }, deps);
    const active = await getActiveWeeklyQuest(day, arcId, DEFAULT_CONFIG, deps);
    expect(active!.progress).toBe(0);

    await logBuildSession(day, arcId, { mode: 'SHIP', minutes: 60, projectKey: 'p1', shippedArtifact: { kind: 'feature', title: 'Retry logic' } }, DEFAULT_CONFIG, deps);
    const afterShip = await getActiveWeeklyQuest(day, arcId, DEFAULT_CONFIG, deps);
    expect(afterShip!.justCompleted).toBe(true);
  });
});
