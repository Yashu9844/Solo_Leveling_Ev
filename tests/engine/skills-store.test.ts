import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { logProblem } from '../../src/store/dsa';
import { logLearningBlock, logBuildSession } from '../../src/store/build';
import { logApplication, logCareerEvent, createResumeVersion } from '../../src/store/career';
import { getDsaSkillsOverview, getFoundationSkillsOverview, getCareerTreeOverview } from '../../src/store/skills';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { DSA_TOPICS } from '../../src/engine/dsa';
import { FOUNDATION_TOPICS } from '../../src/engine/foundations';
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
  await db.learning_block.clear();
  await db.application.clear();
  await db.career_event.clear();
  await db.resume_version.clear();
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

describe('getDsaSkillsOverview / getFoundationSkillsOverview', () => {
  beforeEach(clearAll);

  it('covers every topic, all unseen on a fresh arc', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const dsa = await getDsaSkillsOverview();
    const foundations = await getFoundationSkillsOverview();
    expect(dsa.map((d) => d.topic)).toEqual([...DSA_TOPICS]);
    expect(dsa.every((d) => d.state === 'unseen')).toBe(true);
    expect(foundations.map((f) => f.topic)).toEqual([...FOUNDATION_TOPICS]);
    expect(foundations.every((f) => f.state === 'unseen')).toBe(true);
  });

  it('reflects real logged progress for the specific topic touched', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await logProblem(
      DEFAULT_CONFIG.arc.startDate,
      arcId,
      { slug: 'a', title: 'a', topic: 'Graphs', difficulty: 'E', outcome: 'first_attempt', minutes: 10 },
      DEFAULT_CONFIG,
      deps
    );
    await logLearningBlock(DEFAULT_CONFIG.arc.startDate, arcId, 'Networking', 15, DEFAULT_CONFIG, deps);

    const dsa = await getDsaSkillsOverview();
    const foundations = await getFoundationSkillsOverview();
    expect(dsa.find((d) => d.topic === 'Graphs')?.state).toBe('introduced');
    expect(dsa.find((d) => d.topic === 'Arrays')?.state).toBe('unseen');
    expect(foundations.find((f) => f.topic === 'Networking')?.state).toBe('introduced');
    expect(foundations.find((f) => f.topic === 'Operating Systems')?.state).toBe('unseen');
  });
});

describe('getCareerTreeOverview', () => {
  beforeEach(clearAll);

  it('is all zeros on a fresh arc', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const tree = await getCareerTreeOverview();
    expect(tree.applications).toBe(0);
    expect(tree.qualityApplications).toBe(0);
    expect(tree.resumeVersions).toBe(0);
    expect(tree.interviews).toBe(0);
    expect(tree.offers).toBe(0);
  });

  it('rolls up real applications, resume versions, interviews and offers', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    await createResumeVersion(day, 'v1', 'first version', arcId, deps);
    await logApplication(
      day,
      arcId,
      { company: 'Acme', role: 'SWE', roleCategory: 'backend', source: 'referral', resumeVersionId: 'r1', whyLine: 'A genuinely specific reason for this role' },
      DEFAULT_CONFIG,
      deps
    );
    await logCareerEvent(day, arcId, 'interview', deps);
    await logCareerEvent(day, arcId, 'offer', deps);
    await logBuildSession(
      day,
      arcId,
      { mode: 'SHIP', minutes: 60, projectKey: 'p1', shippedArtifact: { kind: 'project', title: 'Agent' } },
      DEFAULT_CONFIG,
      deps
    );

    const tree = await getCareerTreeOverview();
    expect(tree.applications).toBe(1);
    expect(tree.qualityApplications).toBe(1);
    expect(tree.resumeVersions).toBe(1);
    expect(tree.interviews).toBe(1);
    expect(tree.offers).toBe(1);
    expect(tree.artifactsByKind.project).toBe(1);
  });
});
