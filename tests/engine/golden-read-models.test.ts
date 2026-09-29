// platform/05-ROADMAP.md loop 0.3 — the golden master, broadened from
// XP/streak (golden-120.test.ts) to every read model the owner sees:
// attributes, rank gates, checkpoint comparisons, bosses, achievements,
// identities, reality, skills, weekly review, daily report, evidence
// messages and the System transmission.
//
// For each sampled day D, the log PREFIX up to D is imported through the
// real import path into a fresh database, and every read model is
// computed "as of D" — exactly what the app would have shown that day.
// (Importing the full log and asking about D would leak later data into
// cumulative counts such as "problems solved".)
//
// This snapshot is what the platform's blueprint engine must reproduce
// for the owner (platform/02 §22.2, equivalence level E2). Updating it
// (`vitest run -u`) is a deliberate, reviewed act, same as golden-120.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../../src/db/db';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { arcDay } from '../../src/engine/time';
import { BOSSES } from '../../src/engine/boss';
import type { SystemEvent } from '../../src/engine/types';
import type { Checkpoint } from '../../src/engine/rank';
import { importSnapshotJson, getCheckpointReport, getCheckpointComparison } from '../../src/store/checkpoint';
import { getAttributes } from '../../src/store/attributes';
import { getBossStatus } from '../../src/store/boss';
import { getAchievementsReport } from '../../src/store/achievements';
import { getRealitySummary } from '../../src/store/reality';
import { getWeeklyReview } from '../../src/store/weeklyReview';
import { getDailyReport } from '../../src/store/review';
import { computeMessageContext } from '../../src/store/messages';
import { getStreakState } from '../../src/store/streak';
import { getRecoverableDay } from '../../src/store/recovery';
import { resolveTransmission } from '../../src/store/systemMessage';
import {
  getAiSkillsOverview,
  getCareerTreeOverview,
  getDsaSkillsOverview,
  getFoundationSkillsOverview,
} from '../../src/store/skills';
import { dateAt, LEGACY_ARC_ID, LEGACY_START, legacyActivityLog } from './support/legacyActivityLog';

const LOG = legacyActivityLog({ seed: 42, days: 120 });

// 0-based day offsets: the checkpoint days (arc days 14/30/60/90/120),
// the pause window's edges, a lapse-prone stretch, and weekly samples.
const CHECKPOINT_OFFSETS: Record<number, Checkpoint['day']> = { 13: 14, 29: 30, 59: 60, 89: 90, 119: 120 };
const SAMPLE_OFFSETS = [6, 13, 20, 29, 44, 49, 53, 59, 76, 89, 104, 119];

function exportJsonUpTo(localDate: string): string {
  const events: SystemEvent[] = LOG.filter((e) => e.local_date <= localDate);
  return JSON.stringify({
    schema_v: 1,
    events,
    arc: {
      id: LEGACY_ARC_ID,
      start_date: LEGACY_START,
      end_date: DEFAULT_CONFIG.arc.endDate,
      timezone: DEFAULT_CONFIG.arc.timezone,
      day_boundary_hour: DEFAULT_CONFIG.arc.dayBoundaryHour,
      day_close_hour: DEFAULT_CONFIG.arc.dayCloseHour,
      main_quest_text: 'Ship a working agent and land an offer.',
      status: 'active',
    },
    profile: null,
    checkpoints: [],
  });
}

/** Rounds every float so the snapshot is stable and readable. */
function round(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value), (_k, v: unknown) =>
    typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 10_000) / 10_000 : v
  );
}

async function readModelsAsOf(offset: number) {
  const today = dateAt(offset);
  // 14:00 IST on `today` — well inside the day, never in the closed window.
  const now = `${today}T08:30:00.000Z`;
  const deps = { now: () => now, newId: () => 'golden-read-id' };

  await Promise.all(db.tables.map((t) => t.clear()));
  await importSnapshotJson(exportJsonUpTo(today), DEFAULT_CONFIG, deps);

  const dayNumber = arcDay(now, LEGACY_START, DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);
  const checkpointDay = CHECKPOINT_OFFSETS[offset];

  return round({
    today,
    arcDay: dayNumber,
    streak: await getStreakState(today, DEFAULT_CONFIG),
    recoverable: await getRecoverableDay(today, DEFAULT_CONFIG),
    attributes: await getAttributes(today, DEFAULT_CONFIG),
    bosses: await Promise.all(BOSSES.map((b) => getBossStatus(b.id, today))),
    achievements: await getAchievementsReport(today, DEFAULT_CONFIG),
    reality: await getRealitySummary(today),
    skills: {
      dsa: await getDsaSkillsOverview(),
      foundations: await getFoundationSkillsOverview(),
      ai: await getAiSkillsOverview(),
      career: await getCareerTreeOverview(),
    },
    dailyReport: await getDailyReport(today, DEFAULT_CONFIG),
    weeklyReview: offset % 7 === 6 ? await getWeeklyReview(today, DEFAULT_CONFIG, deps) : undefined,
    messageContext: await computeMessageContext(today, DEFAULT_CONFIG),
    transmission: await resolveTransmission(today, dayNumber, DEFAULT_CONFIG, deps),
    checkpoint: checkpointDay
      ? {
          report: await getCheckpointReport(checkpointDay, today, DEFAULT_CONFIG),
          comparison: await getCheckpointComparison(checkpointDay, today, DEFAULT_CONFIG),
        }
      : undefined,
  });
}

describe('Golden read models — legacy 120-day activity log', () => {
  it('the activity log itself is stable', () => {
    const types: Record<string, number> = {};
    for (const e of LOG) types[e.type] = (types[e.type] ?? 0) + 1;
    expect({ events: LOG.length, types }).toMatchSnapshot();
  });

  for (const offset of SAMPLE_OFFSETS) {
    it(`every read model as of arc day ${offset + 1}`, async () => {
      expect(await readModelsAsOf(offset)).toMatchSnapshot();
    }, 30_000); // a full import + every read model; the 120-day sample is the slowest
  }
});
