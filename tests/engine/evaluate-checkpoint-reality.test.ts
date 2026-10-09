// platform/05 loop 4.7 (a) — the evidence a seal freezes, the checkpoint
// comparison and the REALITY summary, against computeGateEvidence,
// getCheckpointComparison and getRealitySummary (E2).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { checkpointComparisonFor, compareEvidence, evidenceSnapshot, realitySummary, zeroEvidence } from '../../src/blueprint/evaluate/checkpoint';
import { readModelEnv } from '../../src/blueprint/evaluate/readModel';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import type { CheckpointRow } from '../../src/db/schema';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { checkpointComparison, ZERO_EVIDENCE, type Checkpoint } from '../../src/engine/rank';
import { computeGateEvidence, getCheckpointComparison } from '../../src/store/checkpoint';
import { getRealitySummary } from '../../src/store/reality';
import { dateAt, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

const bp = LEGACY_BLUEPRINT_V1;

function row(day: number, metrics: object): CheckpointRow {
  return {
    id: `cp-${day}`, day, export_verified: true, metrics: metrics as Record<string, unknown>, self_efficacy: {}, automaticity: {}, enjoyment: {}, rank_before: 'E',
    gates: {}, controlled: {}, external: {}, quest_templates_snapshot: {}, sealed_at: '2026-10-01T00:00:00Z', rank_after: 'D',
  };
}

describe('checkpoint evidence, comparison and reality (loop 4.7a)', () => {
  const golden = legacyActivityLog({ seed: 42, days: 120 });

  it('freezes exactly the legacy GateEvidence, field for field, across the arc', async () => {
    for (const offset of [0, 13, 29, 44, 59, 76, 89, 104, 119]) {
      const today = dateAt(offset);
      const prefix = prefixOf(golden, today);
      await loadLegacyDb(prefix, today);
      const legacy = await computeGateEvidence(today, DEFAULT_CONFIG);
      const v2 = evidenceSnapshot(bp, readModelEnv({ blueprint: bp, events: prefix, checkpoints: [], asOf: today }));
      expect(v2, `day ${offset + 1}`).toEqual(legacy);
    }
  }, 200_000);

  it('the zero baseline is ZERO_EVIDENCE', () => {
    expect(zeroEvidence(bp)).toEqual(ZERO_EVIDENCE);
  });

  it('compares like checkpointComparison, including the conditional Wake SD row', () => {
    const before = { ...ZERO_EVIDENCE, problemsTotal: 10, wakeSdMin: 50, trainingSessionsTotal: 3 };
    const after = { ...ZERO_EVIDENCE, problemsTotal: 30, wakeSdMin: 40, trainingSessionsTotal: 3, firstAttemptRateM28d: 0.5 };
    expect(compareEvidence(bp, before, after)).toEqual(checkpointComparison(before, after));
    expect(compareEvidence(bp, ZERO_EVIDENCE, after)).toEqual(checkpointComparison(ZERO_EVIDENCE, after));
    expect(compareEvidence(bp, ZERO_EVIDENCE, after).some((r) => r.label === 'Wake SD')).toBe(false); // the 999 sentinel is no baseline
  });

  it('matches getCheckpointComparison against the zero baseline and against a previous sealed checkpoint', async () => {
    let improvedRows = 0;
    for (const [day, offset] of [[14, 13], [30, 29], [60, 59], [90, 89], [120, 119]] as [Checkpoint['day'], number][]) {
      const today = dateAt(offset);
      const prefix = prefixOf(golden, today);

      // Nothing sealed: baseline is zero.
      await loadLegacyDb(prefix, today);
      const none = await getCheckpointComparison(day, today, DEFAULT_CONFIG);
      expect(checkpointComparisonFor(bp, [], day, readModelEnv({ blueprint: bp, events: prefix, checkpoints: [], asOf: today })), `day ${day} unsealed`).toEqual(none);

      // The previous schedule day sealed with the real evidence of its own day.
      const previousDay = ({ 14: 0, 30: 14, 60: 30, 90: 60, 120: 90 } as Record<number, number>)[day]!;
      if (previousDay === 0) continue;
      const previousToday = dateAt(previousDay - 1);
      await loadLegacyDb(prefixOf(golden, previousToday), previousToday);
      const frozen = await computeGateEvidence(previousToday, DEFAULT_CONFIG);
      const rows = [row(previousDay, frozen)];
      await loadLegacyDb(prefix, today, rows);
      const sealed = await getCheckpointComparison(day, today, DEFAULT_CONFIG);
      const v2 = checkpointComparisonFor(bp, rows, day, readModelEnv({ blueprint: bp, events: prefix, checkpoints: rows, asOf: today }));
      expect(v2, `day ${day} vs ${previousDay}`).toEqual(sealed);
      improvedRows += v2.rows.filter((r) => r.improved).length;
    }
    expect(improvedRows).toBeGreaterThan(4);
  }, 300_000);

  it('matches getRealitySummary across the arc', async () => {
    for (const offset of [0, 6, 29, 59, 89, 119]) {
      const today = dateAt(offset);
      const prefix = prefixOf(golden, today);
      await loadLegacyDb(prefix, today);
      const legacy = await getRealitySummary(today);
      expect(realitySummary(bp, readModelEnv({ blueprint: bp, events: prefix, checkpoints: [], asOf: today })), `day ${offset + 1}`).toEqual({ ...legacy });
    }
  }, 120_000);
});
