import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { logProblem } from '../../src/store/dsa';
import { logLearningBlock, logSystemDesignStudy } from '../../src/store/build';
import { getDsaTopicMastery, getFoundationTopicMastery } from '../../src/store/mastery';
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
  await db.checkpoint.clear();
  await db.profile.clear();
  await db.quest_template.clear();
  await db.quest_instance.clear();
  await db.xp_ledger.clear();
  await db.day_rollup.clear();
  await db.player_state.clear();
  await db.dsa_problem.clear();
  await db.dsa_attempt.clear();
  await db.learning_block.clear();
  await db.system_design_study.clear();
  await db.build_session.clear();
  await db.artifact.clear();
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

describe('getDsaTopicMastery — reads live dsa_attempt/dsa_problem tables', () => {
  beforeEach(clearAll);

  it('is unseen for a topic with no attempts', async () => {
    expect(await getDsaTopicMastery('Graphs')).toBe('unseen');
  });

  it('advances to introduced on the first logged problem', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await logProblem(
      DEFAULT_CONFIG.arc.startDate,
      arcId,
      { slug: 'two-sum', title: 'Two Sum', topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 20 },
      DEFAULT_CONFIG,
      deps
    );
    expect(await getDsaTopicMastery('Arrays')).toBe('introduced');
  });

  it('advances to applied on the third logged problem in a topic', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    for (const slug of ['a', 'b', 'c']) {
      await logProblem(
        DEFAULT_CONFIG.arc.startDate,
        arcId,
        { slug, title: slug, topic: 'Arrays', difficulty: 'E', outcome: 'unsolved', minutes: 20 },
        DEFAULT_CONFIG,
        deps
      );
    }
    expect(await getDsaTopicMastery('Arrays')).toBe('applied');
  });
});

describe('getFoundationTopicMastery — reads live learning_block table', () => {
  beforeEach(clearAll);

  it('is unseen for a topic with no logged blocks', async () => {
    expect(await getFoundationTopicMastery('Operating Systems')).toBe('unseen');
  });

  it('advances to introduced on the first logged block', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await logLearningBlock(DEFAULT_CONFIG.arc.startDate, arcId, 'Operating Systems', 15, DEFAULT_CONFIG, deps);
    expect(await getFoundationTopicMastery('Operating Systems')).toBe('introduced');
  });

  it('advances to applied on the third logged block', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    for (let i = 0; i < 3; i++) {
      await logLearningBlock(DEFAULT_CONFIG.arc.startDate, arcId, 'Networking', 15, DEFAULT_CONFIG, deps);
    }
    expect(await getFoundationTopicMastery('Networking')).toBe('applied');
  });

  it('a logged System Design study session is recorded in its own table (final/03 §3.3s richer log, separate from learning_block by existing design — see engine/foundations.ts)', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await logSystemDesignStudy(
      DEFAULT_CONFIG.arc.startDate,
      arcId,
      'URL shortener',
      'studied',
      30,
      DEFAULT_CONFIG,
      deps
    );
    const rows = await db.system_design_study.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.system).toBe('URL shortener');
    expect(rows[0]?.mode).toBe('studied');
    // Doesn't (by existing, documented design) feed foundation block-count
    // mastery on its own -- only db.learning_block does.
    expect(await getFoundationTopicMastery('System Design')).toBe('unseen');
  });
});
