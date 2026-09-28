import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { buildDomainTables } from '../../src/db/domainProjections';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { logApplication, logCareerEvent, logFollowup, createResumeVersion, logSubstituteWork } from '../../src/store/career';
import { logProblem, logRevisit } from '../../src/store/dsa';
import { logLearningBlock, logSystemDesignStudy, logBuildSession } from '../../src/store/build';
import { logTrainingSession, logSteps, logBodyMetric } from '../../src/store/training';
import { logSleep, logScreentime, logMaintenance } from '../../src/store/lifestyle';
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
    // Zero-padded: getAllEvents() orders by id lexicographically (real
    // uuidv7 is designed to sort that way). An unpadded counter breaks
    // that assumption past 10 calls ("id-10" sorts before "id-2"), which
    // silently reorders events this test's fold depends on being
    // chronological — exactly the bug this padding avoids.
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

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

describe('db/domainProjections — buildDomainTables reproduces every live domain table exactly', () => {
  beforeEach(clearAll);

  it('a full pass through every domain write path folds to byte-identical rows', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;
    const day2 = '2026-09-02';

    // Career: two applications (exercising the duplicate-why-line quality
    // check), a status update, a follow-up, substitute work, a resume version.
    const resumeId = await createResumeVersion(day, 'v1', 'first version', arcId, deps, true);
    await logApplication(day, arcId, { company: 'Acme', role: 'SWE', roleCategory: 'backend', source: 'referral', resumeVersionId: resumeId, whyLine: 'A genuinely specific reason for Acme' }, DEFAULT_CONFIG, deps);
    await logApplication(day, arcId, { company: 'Globex', role: 'SWE', roleCategory: 'backend', source: 'jobboard', resumeVersionId: resumeId, whyLine: 'A different specific reason for Globex' }, DEFAULT_CONFIG, deps);
    const applications = await db.application.toArray();
    const acme = applications.find((a) => a.company === 'Acme')!;
    await logCareerEvent(day2, arcId, 'response', deps, acme.id);
    await logFollowup(day2, arcId, acme.id, deps);
    await logSubstituteWork(day, arcId, 25, 'networking', DEFAULT_CONFIG, deps);

    // DSA: a new problem, a second attempt at the same problem, a revisit.
    await logProblem(day, arcId, { slug: 'two-sum', title: 'Two Sum', topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 10 }, DEFAULT_CONFIG, deps);
    await logProblem(day2, arcId, { slug: 'two-sum', title: 'Two Sum (relogged)', topic: 'Arrays', difficulty: 'E', outcome: 'hint', minutes: 12 }, DEFAULT_CONFIG, deps);
    const problems = await db.dsa_problem.toArray();
    await logRevisit(day2, arcId, problems[0]!.id, 'first_attempt', 8, DEFAULT_CONFIG, deps);

    // Foundations / BUILD: a learning block, a system design study, a
    // LEARN session and a SHIP session that ships an artifact.
    await logLearningBlock(day, arcId, 'Networking', 15, DEFAULT_CONFIG, deps, 'note');
    await logSystemDesignStudy(day, arcId, 'URL shortener', 'written_up', 30, DEFAULT_CONFIG, deps, 'https://example.com', 'notes');
    await logBuildSession(day, arcId, { mode: 'LEARN', minutes: 45, projectKey: 'agent' }, DEFAULT_CONFIG, deps);
    await logBuildSession(day2, arcId, { mode: 'SHIP', minutes: 60, projectKey: 'agent', shippedArtifact: { kind: 'project', title: 'Retry logic', url: 'https://github.com/x/y', costPerTaskStated: true } }, DEFAULT_CONFIG, deps);

    // Physical/lifestyle: a training session with lifts, steps, a body
    // metric, sleep (with a sleep time), screen time, maintenance.
    await logTrainingSession(day, arcId, { type: 'Push', minutes: 40, rpe: 7, lifts: [{ name: 'Bench', weight_kg: 60, reps: 8 }] }, DEFAULT_CONFIG, deps);
    await logSteps(day, arcId, 9500, DEFAULT_CONFIG, deps);
    await logBodyMetric(day, arcId, 'weight_kg', 72.4, 'kg', DEFAULT_CONFIG, deps, 'morning');
    await logSleep(day, arcId, '08:15', DEFAULT_CONFIG, deps, '01:45');
    await logScreentime(day, arcId, 45, DEFAULT_CONFIG, deps);
    await logMaintenance(day, arcId, { bath: true, fuel: false, laundry: false }, DEFAULT_CONFIG, deps);
    await logMaintenance(day, arcId, { bath: true, fuel: true, laundry: false }, DEFAULT_CONFIG, deps); // second tick same day -> upsert wins

    const events = await getAllEvents();
    const built = buildDomainTables(events, DEFAULT_CONFIG);

    expect(sortById(built.applications)).toEqual(sortById(await db.application.toArray()));
    expect(sortById(built.careerEvents)).toEqual(sortById(await db.career_event.toArray()));
    expect(sortById(built.resumeVersions)).toEqual(sortById(await db.resume_version.toArray()));
    expect(sortById(built.dsaProblems)).toEqual(sortById(await db.dsa_problem.toArray()));
    expect(sortById(built.dsaAttempts)).toEqual(sortById(await db.dsa_attempt.toArray()));
    expect(sortById(built.learningBlocks)).toEqual(sortById(await db.learning_block.toArray()));
    expect(sortById(built.systemDesigns)).toEqual(sortById(await db.system_design_study.toArray()));
    expect(sortById(built.buildSessions)).toEqual(sortById(await db.build_session.toArray()));
    expect(sortById(built.artifacts)).toEqual(sortById(await db.artifact.toArray()));
    expect(sortById(built.trainingSessions)).toEqual(sortById(await db.training_session.toArray()));
    expect(sortById(built.metricSamples)).toEqual(sortById(await db.metric_sample.toArray()));

    const liveMaintenance = await db.maintenance_log.toArray();
    expect(built.maintenanceLogs.sort((a, b) => a.local_date.localeCompare(b.local_date))).toEqual(
      liveMaintenance.sort((a, b) => a.local_date.localeCompare(b.local_date))
    );
    // The upsert-wins assertion specifically: only the LAST maintenance
    // submission for the day should survive, matching store/lifestyle.ts's
    // .put() semantics, not both.
    expect(built.maintenanceLogs).toHaveLength(1);
    expect(built.maintenanceLogs[0]).toMatchObject({ bath: true, fuel: true, laundry: false });
  });

  it('an empty event log folds to all-empty tables', () => {
    const built = buildDomainTables([], DEFAULT_CONFIG);
    expect(built.applications).toEqual([]);
    expect(built.dsaProblems).toEqual([]);
    expect(built.maintenanceLogs).toEqual([]);
  });

  it('onboarding baseline METRIC_RECORDED events never produce a metric_sample row (they live in checkpoint.metrics instead)', async () => {
    const deps = seededDeps();
    await initialiseArc(
      { ...ONBOARDING_INPUT, intentions: {}, baseline: { heightCm: 178, weightKg: 72, bodyFatPct: 18, problemsSolvedSoFar: 10 } },
      DEFAULT_CONFIG,
      deps
    );
    const events = await getAllEvents();
    const built = buildDomainTables(events, DEFAULT_CONFIG);
    expect(built.metricSamples).toEqual([]);

    const liveMetricSamples = await db.metric_sample.toArray();
    expect(liveMetricSamples).toEqual([]); // confirms this matches live behavior, not just the fold's assumption
  });
});
