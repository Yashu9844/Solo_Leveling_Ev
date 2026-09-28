import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { appendEvent } from '../../src/db/events';
import { initialiseArc, type OnboardingInput } from '../../src/store/onboarding';
import { loadTodayQuests, completeQuest } from '../../src/store/quests';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { EngineDeps } from '../../src/engine/types';
import { buildSystemMessageContext, resolveTransmission } from '../../src/store/systemMessage';

const TODAY = '2026-09-05';

/** A clock that can be moved, so the IST wall clock is a test input. */
function depsAt(isoInstant: string): EngineDeps {
  let counter = 0;
  return {
    now: () => isoInstant,
    newId: () => `id-${String(counter++).padStart(6, '0')}`,
  };
}

const ONBOARDING: OnboardingInput = {
  name: 'Ada',
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
  mainQuestText: 'Ship a working agent and land an offer.',
  intentions: {
    career: { time: '09:00', place: 'desk', first_action: 'apply' },
    dsa: { time: '10:00', place: 'desk', first_action: 'solve' },
    training: { time: '18:00', place: 'gym', first_action: 'lift' },
  },
  baseline: { heightCm: 178, weightKg: 72 },
};

async function reset(deps: EngineDeps) {
  await Promise.all(
    db.tables.map((t) => t.clear())
  );
  await initialiseArc(ONBOARDING, DEFAULT_CONFIG, deps);
  await loadTodayQuests(TODAY, DEFAULT_CONFIG, deps);
}

describe('buildSystemMessageContext', () => {
  const deps = depsAt('2026-09-05T02:30:00Z'); // 08:00 IST

  beforeEach(async () => {
    await reset(deps);
  });

  it('reads the day from the arc timezone, not the machine timezone', async () => {
    const context = await buildSystemMessageContext(TODAY, 5, DEFAULT_CONFIG, deps);
    // 02:30Z is 08:00 in Asia/Kolkata — morning, whatever the host is set to.
    expect(context?.minutesOfDay).toBe(8 * 60);
    expect(context?.phase).toBe('MORNING');
  });

  it('derives the target from the core quest table rather than hard-coding 500', async () => {
    const context = await buildSystemMessageContext(TODAY, 5, DEFAULT_CONFIG, deps);
    const expected = Object.values(DEFAULT_CONFIG.coreQuests).reduce((sum, q) => sum + q.xp, 0);
    expect(context?.xpTarget).toBe(expected);
  });

  it('starts an untouched day at ZERO', async () => {
    const context = await buildSystemMessageContext(TODAY, 5, DEFAULT_CONFIG, deps);
    expect(context?.band).toBe('ZERO');
    expect(context?.xpEarned).toBe(0);
    expect(context?.coreCompleted).toBe(0);
  });

  it('follows the quest engine once a quest is completed', async () => {
    const arc = await db.arc.toCollection().first();
    const { templates, instances } = await loadTodayQuests(TODAY, DEFAULT_CONFIG, deps);
    const career = templates.find((t) => t.key === 'career')!;
    const instance = instances.find((i) => i.template_id === career.id)!;
    await completeQuest(instance, 'career', arc!.id, DEFAULT_CONFIG, deps);

    const context = await buildSystemMessageContext(TODAY, 5, DEFAULT_CONFIG, deps);
    expect(context!.coreCompleted).toBe(1);
    expect(context!.band).not.toBe('ZERO');
    expect(context!.firstActionOfDay).toBe(true);
  });

  it('returns null before an arc exists', async () => {
    await db.arc.clear();
    expect(await buildSystemMessageContext(TODAY, 1, DEFAULT_CONFIG, deps)).toBeNull();
  });
});

describe('resolveTransmission — the stability contract', () => {
  const deps = depsAt('2026-09-05T02:30:00Z');

  beforeEach(async () => {
    await reset(deps);
  });

  it('returns the same message across repeated resolutions in the same state', async () => {
    const first = await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    for (let i = 0; i < 5; i += 1) {
      const again = await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
      expect(again?.message.id).toBe(first?.message.id);
    }
  });

  it('records the show exactly once for a state it has already reported on', async () => {
    const first = await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    const row = await db.system_message_state.get(first!.message.id);
    expect(row?.times_shown).toBe(1);
  });

  it('persists the fingerprint it chose for', async () => {
    const resolved = await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    const row = await db.system_transmission.get(TODAY);
    expect(row?.fingerprint).toBe(resolved?.fingerprint);
    expect(row?.message_id).toBe(resolved?.message.id);
  });

  it('speaks again when the hour moves the phase', async () => {
    const morning = await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    const afternoonDeps = depsAt('2026-09-05T09:00:00Z'); // 14:30 IST
    const afternoon = await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, afternoonDeps);
    expect(afternoon?.fingerprint).not.toBe(morning?.fingerprint);
    expect(afternoon?.message.id).not.toBe(morning?.message.id);
  });

  it('falls back to a fresh selection when a cached id is no longer in the library', async () => {
    const first = await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    await db.system_transmission.put({
      local_date: TODAY,
      fingerprint: first!.fingerprint,
      message_id: 'a-line-that-was-deleted-in-a-later-release',
      chosen_at: deps.now(),
    });
    const again = await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    expect(again).not.toBeNull();
    expect(again!.message.id).not.toBe('a-line-that-was-deleted-in-a-later-release');
  });

  it('never writes an event — the displayed line is not evidence about the arc', async () => {
    const before = await db.event.count();
    await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    await resolveTransmission(TODAY, 5, DEFAULT_CONFIG, deps);
    expect(await db.event.count()).toBe(before);
  });

  it('reports a return after an absence', async () => {
    const arc = await db.arc.toCollection().first();
    await appendEvent({
      id: 'opened-earlier',
      type: 'APP_OPENED',
      occurred_at: '2026-09-01T02:30:00.000Z',
      local_date: '2026-09-01',
      arc_id: arc!.id,
      payload: { seconds: 0 },
      source: 'system',
      idem_key: 'app-opened:2026-09-01',
      schema_v: 1,
    });
    const context = await buildSystemMessageContext(TODAY, 5, DEFAULT_CONFIG, deps);
    expect(context?.daysSinceLastOpen).toBe(4);
  });
});
