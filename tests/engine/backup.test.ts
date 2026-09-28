import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { exportSnapshotJson, importSnapshotJson, ImportValidationError, sealCheckpoint, markExported } from '../../src/store/checkpoint';
import { verifyIntegrity } from '../../src/db/projections';
import { logApplication, createResumeVersion } from '../../src/store/career';
import { logProblem, logRevisit } from '../../src/store/dsa';
import { logLearningBlock, logBuildSession } from '../../src/store/build';
import { logTrainingSession, logSteps } from '../../src/store/training';
import { logSleep, logMaintenance } from '../../src/store/lifestyle';
import { completeQuest, loadTodayQuests } from '../../src/store/quests';
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

async function clearEverything() {
  await db.event.clear();
  await db.arc.clear();
  await db.profile.clear();
  await db.checkpoint.clear();
  await db.quest_template.clear();
  await db.quest_instance.clear();
  await db.xp_ledger.clear();
  await db.day_rollup.clear();
  await db.player_state.clear();
  await db.application.clear();
  await db.career_event.clear();
  await db.resume_version.clear();
  await db.dsa_problem.clear();
  await db.dsa_attempt.clear();
  await db.learning_block.clear();
  await db.system_design_study.clear();
  await db.build_session.clear();
  await db.artifact.clear();
  await db.training_session.clear();
  await db.metric_sample.clear();
  await db.maintenance_log.clear();
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

async function fullSnapshot() {
  return {
    events: (await db.event.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    arc: await db.arc.toArray(),
    profile: await db.profile.toArray(),
    checkpoint: (await db.checkpoint.toArray()).sort((a, b) => a.day - b.day),
    quest_template: (await db.quest_template.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    quest_instance: (await db.quest_instance.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    xp_ledger: (await db.xp_ledger.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    application: (await db.application.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    dsa_problem: (await db.dsa_problem.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    dsa_attempt: (await db.dsa_attempt.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    learning_block: (await db.learning_block.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    build_session: (await db.build_session.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    training_session: (await db.training_session.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    metric_sample: (await db.metric_sample.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    maintenance_log: (await db.maintenance_log.toArray()).sort((a, b) => a.local_date.localeCompare(b.local_date)),
  };
}

describe('export -> wipe -> import round-trip', () => {
  beforeEach(clearEverything);

  it('reproduces every table byte-for-byte after a full wipe', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: { heightCm: 178, weightKg: 72 } }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    // A rich mix: quest completion, career, DSA (+ a revisit), BUILD,
    // training, sleep, maintenance, and a sealed checkpoint.
    const { instances } = await loadTodayQuests(day, DEFAULT_CONFIG, deps);
    await completeQuest(instances[0]!, 'career', arcId, DEFAULT_CONFIG, deps);

    const resumeId = await createResumeVersion(day, 'v1', 'first version', arcId, deps, true);
    await logApplication(day, arcId, { company: 'Acme', role: 'SWE', roleCategory: 'backend', source: 'referral', resumeVersionId: resumeId, whyLine: 'A genuinely specific reason for Acme' }, DEFAULT_CONFIG, deps);

    await logProblem(day, arcId, { slug: 'two-sum', title: 'Two Sum', topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 10 }, DEFAULT_CONFIG, deps);
    const problems = await db.dsa_problem.toArray();
    await logRevisit(day, arcId, problems[0]!.id, 'first_attempt', 8, DEFAULT_CONFIG, deps);

    await logLearningBlock(day, arcId, 'Networking', 15, DEFAULT_CONFIG, deps);
    await logBuildSession(day, arcId, { mode: 'SHIP', minutes: 60, projectKey: 'agent', shippedArtifact: { kind: 'feature', title: 'Retry logic', url: 'https://github.com/x/y' } }, DEFAULT_CONFIG, deps);
    await logTrainingSession(day, arcId, { type: 'Push', minutes: 40, lifts: [{ name: 'Bench', weight_kg: 60, reps: 8 }] }, DEFAULT_CONFIG, deps);
    await logSteps(day, arcId, 9500, DEFAULT_CONFIG, deps);
    await logSleep(day, arcId, '08:15', DEFAULT_CONFIG, deps);
    await logMaintenance(day, arcId, { bath: true, fuel: true, laundry: false }, DEFAULT_CONFIG, deps);

    await markExported(30, deps);
    await sealCheckpoint(30, day, DEFAULT_CONFIG, deps);

    // Snapshotted AFTER exporting, not before: exportSnapshotJson itself
    // records the backup-nudge marker onto the profile row (last_export_at),
    // so "the state this backup captured" already includes that write —
    // comparing against a pre-export snapshot would spuriously fail on
    // exactly that one field once it's restored.
    const json = await exportSnapshotJson(deps);
    const before = await fullSnapshot();
    const beforeIntegrity = await verifyIntegrity(DEFAULT_CONFIG, deps);
    expect(beforeIntegrity.clean).toBe(true);

    await clearEverything();
    expect(await db.event.count()).toBe(0);

    await importSnapshotJson(json, DEFAULT_CONFIG, deps);

    const after = await fullSnapshot();
    expect(after).toEqual(before);

    const afterIntegrity = await verifyIntegrity(DEFAULT_CONFIG, deps);
    expect(afterIntegrity.clean).toBe(true);
  });

  it('rejects malformed JSON without touching the database', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const before = await fullSnapshot();

    await expect(importSnapshotJson('{ not json', DEFAULT_CONFIG, deps)).rejects.toThrow(ImportValidationError);
    await expect(importSnapshotJson('{"foo": "bar"}', DEFAULT_CONFIG, deps)).rejects.toThrow(ImportValidationError);
    await expect(importSnapshotJson('{"events": "not-an-array"}', DEFAULT_CONFIG, deps)).rejects.toThrow(ImportValidationError);

    expect(await fullSnapshot()).toEqual(before);
  });

  it('importing an empty-events snapshot produces an empty database, not an error', async () => {
    const deps = seededDeps();
    await importSnapshotJson(JSON.stringify({ events: [] }), DEFAULT_CONFIG, deps);
    expect(await db.event.count()).toBe(0);
    expect(await db.arc.count()).toBe(0);
  });
});
