import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import {
  computeGateEvidence,
  getCheckpointReport,
  getCheckpointComparison,
  exportSnapshotJson,
  getBackupStatus,
  markExported,
  sealCheckpoint,
  CheckpointSealError,
} from '../../src/store/checkpoint';
import { logApplication } from '../../src/store/career';
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
  await db.application.clear();
  await db.resume_version.clear();
  await db.dsa_problem.clear();
  await db.dsa_attempt.clear();
  await db.day_rollup.clear();
  await db.player_state.clear();
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

describe('computeGateEvidence — real data wiring', () => {
  beforeEach(clearAll);

  it('a fresh arc with no activity computes all-zero/fail-safe evidence', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const evidence = await computeGateEvidence(DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);

    expect(evidence.problemsTotal).toBe(0);
    expect(evidence.qualityApplicationsTotal).toBe(0);
    expect(evidence.aiFeaturePublicRepo).toBe(false);
    expect(evidence.bossICleared).toBe(false);
    expect(evidence.costPerTaskMeasured).toBe(false);
    expect(evidence.wakeSdMin).toBe(999); // fail-safe, not "perfectly consistent"
  });

  it('quality applications feed qualityApplicationsTotal for real', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const day = DEFAULT_CONFIG.arc.startDate;

    await logApplication(
      day,
      arcId,
      { company: 'Acme', role: 'SWE', roleCategory: 'backend', source: 'referral', resumeVersionId: 'r1', whyLine: 'A genuinely specific reason for this role' },
      DEFAULT_CONFIG,
      deps
    );

    const evidence = await computeGateEvidence(day, DEFAULT_CONFIG);
    expect(evidence.qualityApplicationsTotal).toBe(1);
  });
});

describe('getCheckpointReport — Day 30 report before any checkpoint row exists', () => {
  beforeEach(clearAll);

  it('previews the gate cleanly with previousRank E and no checkpoint row', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const report = await getCheckpointReport(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(report.checkpoint).toBeUndefined();
    expect(report.result.rank).toBe('E'); // nothing met yet, stalls at E
    expect(report.result.targetRank).toBe('C');
    expect(report.verdictText).toContain('Rank E -> C requires');
  });
});

describe('sealCheckpoint — export gate and write-once enforcement', () => {
  beforeEach(clearAll);

  it('refuses to seal before export is verified', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await expect(sealCheckpoint(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps)).rejects.toThrow(CheckpointSealError);
    const row = await db.checkpoint.where('day').equals(30).first();
    expect(row?.sealed_at).toBeUndefined();
  });

  it('seals once export is verified, freezing rank_after and gates', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await markExported(30, deps);

    const result = await sealCheckpoint(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);
    expect(result.rank).toBe('E'); // gate unmet with no activity, stalls

    const row = await db.checkpoint.where('day').equals(30).first();
    expect(row?.sealed_at).toBeDefined();
    expect(row?.rank_after).toBe('E');
  });

  it('a sealed checkpoint rejects a second seal attempt', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await markExported(30, deps);
    await sealCheckpoint(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);

    await expect(sealCheckpoint(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps)).rejects.toThrow(CheckpointSealError);
  });

  it('a sealed checkpoint rejects markExported too — sealed rows are immutable', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await markExported(30, deps);
    await sealCheckpoint(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);

    const before = await db.checkpoint.where('day').equals(30).first();
    await markExported(30, deps); // should be a silent no-op, not an error and not a write
    const after = await db.checkpoint.where('day').equals(30).first();
    expect(after).toEqual(before);
  });
});

describe('exportSnapshotJson', () => {
  beforeEach(clearAll);

  it('produces valid JSON containing every event in the log', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const json = await exportSnapshotJson(deps);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.events)).toBe(true);
    expect(parsed.events.length).toBeGreaterThan(0);
    expect(parsed.events[0].type).toBe('ARC_STARTED');
  });

  it('records the backup-nudge marker (last_export_at) on the profile row', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const before = await getBackupStatus(deps);
    expect(before.lastExportAt).toBeNull();

    await exportSnapshotJson(deps);
    const after = await getBackupStatus(deps);
    expect(after.lastExportAt).not.toBeNull();
    expect(after.daysSince).toBe(0);
  });
});

describe('getCheckpointComparison — final/05 §2.1s "sealed with improvement" gate', () => {
  beforeEach(clearAll);

  it('reports no improvement when nothing was logged before the first checkpoint', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await markExported(14, deps);
    await sealCheckpoint(14, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);

    const comparison = await getCheckpointComparison(14, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(comparison.improved).toBe(false);
  });

  it('reports improvement against the implicit Day-0 zero baseline once real problems are logged', async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    for (const slug of ['a', 'b', 'c']) {
      await logProblem(
        DEFAULT_CONFIG.arc.startDate,
        arcId,
        { slug, title: slug, topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 20 },
        DEFAULT_CONFIG,
        deps
      );
    }
    await markExported(14, deps);
    await sealCheckpoint(14, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);

    const comparison = await getCheckpointComparison(14, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    expect(comparison.improved).toBe(true);
    expect(comparison.rows.find((r) => r.label === 'Problems solved')).toEqual({
      label: 'Problems solved',
      before: '0',
      after: '3',
      improved: true,
    });
  });

  it("uses the previous SEALED checkpoint's frozen evidence as the baseline, not always Day 0", async () => {
    const deps = seededDeps();
    const arcId = await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);

    await logProblem(
      DEFAULT_CONFIG.arc.startDate,
      arcId,
      { slug: 'a', title: 'a', topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 20 },
      DEFAULT_CONFIG,
      deps
    );
    await markExported(14, deps);
    await sealCheckpoint(14, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);

    // Two more problems between Day 14 and Day 30.
    for (const slug of ['b', 'c']) {
      await logProblem(
        DEFAULT_CONFIG.arc.startDate,
        arcId,
        { slug, title: slug, topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 20 },
        DEFAULT_CONFIG,
        deps
      );
    }
    await markExported(30, deps);
    await sealCheckpoint(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);

    const comparison = await getCheckpointComparison(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG);
    // Baseline is Day 14's frozen 1, not Day 0's 0 -- the delta is +2, not +3.
    expect(comparison.rows.find((r) => r.label === 'Problems solved')).toEqual({
      label: 'Problems solved',
      before: '1',
      after: '3',
      improved: true,
    });
  });
});
