// docs/04 §5.2-5.3 / docs/13-day0-baseline.md — the three self-report
// instruments (self-efficacy, automaticity, enjoyment), administered at
// Day 0/30/60/90/120. Supplementary self-report, never a gate.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { getCheckpoint, instrumentsComplete, saveCheckpointInstruments } from '../../src/store/checkpoint';
import { markExported, sealCheckpoint } from '../../src/store/checkpoint';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
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

describe('instrumentsComplete', () => {
  it('is false for undefined and for a checkpoint with an empty self_efficacy', () => {
    expect(instrumentsComplete(undefined)).toBe(false);
    expect(
      instrumentsComplete({
        id: 'c1',
        day: 30,
        export_verified: false,
        metrics: {},
        self_efficacy: {},
        automaticity: {},
        enjoyment: {},
        rank_before: 'E',
        gates: {},
        controlled: {},
        external: {},
        quest_templates_snapshot: {},
      })
    ).toBe(false);
  });
});

describe('saveCheckpointInstruments', () => {
  beforeEach(clearAll);

  it('creates a fresh checkpoint row for a day with none yet, unsealed and unexported', async () => {
    const deps = seededDeps();
    await saveCheckpointInstruments(
      30,
      { selfEfficacy: [50, 50, 50, 50, 50, 50], automaticity: [4, 4, 4, 4], enjoyment: [5, 5, 5] },
      deps
    );
    const row = await getCheckpoint(30);
    expect(row).toBeDefined();
    expect(row?.sealed_at).toBeUndefined();
    expect(row?.export_verified).toBe(false);
    expect(instrumentsComplete(row)).toBe(true);
  });

  it('computes the mean of each instrument correctly', async () => {
    const deps = seededDeps();
    await saveCheckpointInstruments(
      30,
      { selfEfficacy: [0, 20, 40, 60, 80, 100], automaticity: [1, 3, 5, 7], enjoyment: [0, 5, 10] },
      deps
    );
    const row = await getCheckpoint(30);
    expect(row?.self_efficacy).toEqual({ items: [0, 20, 40, 60, 80, 100], mean: 50 });
    expect(row?.automaticity).toEqual({ items: [1, 3, 5, 7], mean: 4 });
    expect(row?.enjoyment).toEqual({ items: [0, 5, 10], mean: 5 });
  });

  it('only writes the fields provided, leaving the others untouched', async () => {
    const deps = seededDeps();
    await saveCheckpointInstruments(30, { selfEfficacy: [50, 50, 50, 50, 50, 50] }, deps);
    let row = await getCheckpoint(30);
    expect(instrumentsComplete(row)).toBe(true);
    expect(row?.automaticity).toEqual({});

    await saveCheckpointInstruments(30, { automaticity: [4, 4, 4, 4] }, deps);
    row = await getCheckpoint(30);
    expect(row?.self_efficacy).toEqual({ items: [50, 50, 50, 50, 50, 50], mean: 50 });
    expect(row?.automaticity).toEqual({ items: [4, 4, 4, 4], mean: 4 });
  });

  it('writes onto an existing (Day 0) row without duplicating it', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    const before = await getCheckpoint(0);
    expect(before).toBeDefined();
    expect(instrumentsComplete(before)).toBe(false);

    await saveCheckpointInstruments(
      0,
      { selfEfficacy: [50, 50, 50, 50, 50, 50], automaticity: [4, 4, 4, 4], enjoyment: [5, 5, 5] },
      deps
    );
    const rows = await db.checkpoint.where('day').equals(0).toArray();
    expect(rows).toHaveLength(1); // updated in place, not duplicated
    expect(instrumentsComplete(rows[0])).toBe(true);
  });

  it('can still write instruments after the checkpoint has been sealed -- supplementary data, not part of the gate', async () => {
    const deps = seededDeps();
    await initialiseArc({ ...ONBOARDING_INPUT, intentions: {}, baseline: {} }, DEFAULT_CONFIG, deps);
    await markExported(30, deps);
    await sealCheckpoint(30, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG, deps);

    await saveCheckpointInstruments(30, { selfEfficacy: [10, 10, 10, 10, 10, 10] }, deps);
    const row = await getCheckpoint(30);
    expect(row?.sealed_at).toBeDefined(); // still sealed
    expect(instrumentsComplete(row)).toBe(true); // instrument write still landed
  });
});
