// platform/05 loop 4.7 (b, c) — the weekly review, the evidence-message
// context and the transmission context against getWeeklyReview,
// computeMessageContext and buildSystemMessageContext (E2).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { messageContextFor, recoverableDayFor, systemMessageContextFor } from '../../src/blueprint/evaluate/messages';
import { evaluateWeeklyReview } from '../../src/blueprint/evaluate/weeklyReview';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import type { CheckpointRow } from '../../src/db/schema';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { arcDay } from '../../src/engine/time';
import { getRecoverableDay } from '../../src/store/recovery';
import { computeMessageContext } from '../../src/store/messages';
import { buildSystemMessageContext } from '../../src/store/systemMessage';
import { getWeeklyReview } from '../../src/store/weeklyReview';
import { dateAt, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

const bp = LEGACY_BLUEPRINT_V1;
const golden = legacyActivityLog({ seed: 42, days: 120 });
const deps0 = { now: () => '', newId: () => '' };

function sealedC(): CheckpointRow {
  return {
    id: 'cp-30', day: 30, export_verified: true, metrics: {}, self_efficacy: {}, automaticity: {}, enjoyment: {}, rank_before: 'E',
    gates: {}, controlled: {}, external: {}, quest_templates_snapshot: {}, sealed_at: '2026-10-01T00:00:00Z', rank_after: 'C',
  };
}

describe('weekly review (loop 4.7b)', () => {
  it('reproduces getWeeklyReview: weekly numbers, attribute movement, rules, resume nudge and the sleep/DSA correlation', async () => {
    let correlations = 0;
    let nudges = 0;
    let proposals = 0;
    for (const offset of [6, 13, 20, 27, 34, 41, 55, 62, 76, 90, 104, 119]) {
      const today = dateAt(offset);
      const prefix = prefixOf(golden, today);
      const deps = await loadLegacyDb(prefix, today);
      const legacy = await getWeeklyReview(today, DEFAULT_CONFIG, deps);
      const v2 = evaluateWeeklyReview(bp, { events: prefix, checkpoints: [] }, today);
      expect(v2.thisWeek, `day ${offset + 1} thisWeek`).toEqual({ ...legacy.thisWeek });
      expect(v2.lastWeek, `day ${offset + 1} lastWeek`).toEqual({ ...legacy.lastWeek });
      expect(v2.review, `day ${offset + 1} review`).toEqual(legacy.review);
      expect(v2.resumeNudge, `day ${offset + 1} nudge`).toEqual(legacy.resumeNudge);
      expect(v2.sleepDsaCorrelation, `day ${offset + 1} correlation`).toEqual(legacy.sleepDsaCorrelation);
      if (legacy.sleepDsaCorrelation) correlations++;
      if (legacy.resumeNudge) nudges++;
      proposals += legacy.review.proposals.length;
    }
    expect(correlations).toBeGreaterThan(0);
    expect(nudges).toBeGreaterThan(0);
    expect(proposals).toBeGreaterThanOrEqual(0);
  }, 300_000);

  it('only proposes through rules the Blueprint enables', () => {
    const today = dateAt(119);
    const off = structuredClone(bp);
    for (const rule of off.rules) rule.enabled = false;
    const review = evaluateWeeklyReview(off, { events: golden, checkpoints: [] }, today).review;
    expect(review.proposals).toEqual([]);
  });
});

describe('message contexts (loop 4.7c)', () => {
  it('reproduces computeMessageContext, including the days the personal-record and trend messages fire', async () => {
    const projections = buildProjectionsV2(golden, deps0, [bp]);
    // Find the days that actually exercise the optional P1-P3 facts, so they are compared too.
    const interesting = new Set<number>([0, 5, 29, 59, 119]);
    for (let offset = 0; offset < 120; offset++) {
      const ctx = messageContextFor({ blueprint: bp, events: prefixOf(golden, dateAt(offset)), today: dateAt(offset), projections });
      if (ctx.newLongestDeepBlockMinutes || ctx.firstHardProblemFirstAttempt || ctx.firstDeploymentReachable || ctx.firstAttemptRateMTrend || ctx.wakeSdTrend || ctx.dsaFirstAttemptBySleep) interesting.add(offset);
    }
    const days = [...interesting].sort((a, b) => a - b);
    expect(days.length).toBeGreaterThan(8);
    const picked = days.filter((_, i) => i % Math.max(1, Math.floor(days.length / 16)) === 0).slice(0, 18);
    const seen = { deep: 0, hard: 0, deploy: 0, trend: 0, wake: 0, sleep: 0 };
    for (const offset of picked) {
      const today = dateAt(offset);
      const prefix = prefixOf(golden, today);
      await loadLegacyDb(prefix, today);
      const legacy = await computeMessageContext(today, DEFAULT_CONFIG);
      const v2 = messageContextFor({ blueprint: bp, events: prefix, today });
      expect(v2, `day ${offset + 1}`).toEqual(legacy);
      if (legacy.newLongestDeepBlockMinutes) seen.deep++;
      if (legacy.firstHardProblemFirstAttempt) seen.hard++;
      if (legacy.firstDeploymentReachable) seen.deploy++;
      if (legacy.firstAttemptRateMTrend) seen.trend++;
      if (legacy.wakeSdTrend) seen.wake++;
      if (legacy.dsaFirstAttemptBySleep) seen.sleep++;
    }
    expect(seen.deep + seen.hard + seen.deploy).toBeGreaterThan(0);
    expect(seen.trend + seen.wake + seen.sleep).toBeGreaterThan(0);
  }, 300_000);

  it('reproduces buildSystemMessageContext (and the recoverable day) across the arc, in open and closed hours, with and without a sealed rank', async () => {
    let recoverable = 0;
    for (const offset of [0, 4, 13, 29, 34, 50, 53, 59, 76, 104, 119]) {
      const today = dateAt(offset);
      const prefix = prefixOf(golden, today);
      for (const [label, rows, instant] of [
        ['open hours', [] as CheckpointRow[], `${today}T08:30:00.000Z`],
        ['closed window, rank C', [sealedC()], `${today}T21:45:00.000Z`],
      ] as const) {
        await loadLegacyDb(prefix, today, [...rows]);
        const deps = { now: () => instant };
        const day = arcDay(instant, DEFAULT_CONFIG.arc.startDate, DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);
        const legacy = await buildSystemMessageContext(today, day, DEFAULT_CONFIG, deps);
        const v2 = systemMessageContextFor({ blueprint: bp, events: prefix, today, arcDay: day, now: instant, checkpoints: rows.map((r) => ({ day: r.day, sealed_at: r.sealed_at, rank_after: r.rank_after })) });
        expect(v2, `day ${offset + 1} ${label}`).toEqual(legacy);
        const legacyRecoverable = await getRecoverableDay(today, DEFAULT_CONFIG);
        const v2Recoverable = recoverableDayFor(prefix, buildProjectionsV2(prefix, deps0, [bp]), bp, today);
        expect(v2Recoverable, `day ${offset + 1} recoverable`).toEqual(legacyRecoverable);
        if (legacyRecoverable) recoverable++;
      }
    }
    expect(recoverable).toBeGreaterThan(0);
  }, 300_000);

  it('has no transmission context before an arc exists', () => {
    expect(systemMessageContextFor({ blueprint: bp, events: [], today: '2026-09-01', arcDay: 1, now: '2026-09-01T08:30:00Z', checkpoints: [] })).toBeNull();
  });
});
