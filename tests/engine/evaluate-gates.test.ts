// platform/05 loop 4.5 — the Blueprint gate evaluator against the live
// getCheckpointReport (evaluateGates + computeGateEvidence): same rank, same
// target, and the same condition LABELS (with their live numbers) and met
// flags, on every checkpoint day, with and without sealed checkpoints (E2).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { compareTo, evaluateCondition, formatValue } from '../../src/blueprint/evaluate/condition';
import { evaluateGate, rankSealedBefore } from '../../src/blueprint/evaluate/gate';
import { readModelEnv } from '../../src/blueprint/evaluate/readModel';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import type { CheckpointRow } from '../../src/db/schema';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { verdictTextFor, type Checkpoint } from '../../src/engine/rank';
import type { Rank } from '../../src/engine/types';
import { getCheckpointReport } from '../../src/store/checkpoint';
import { dateAt, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

const bp = LEGACY_BLUEPRINT_V1;
const DAYS: Checkpoint['day'][] = [0, 14, 30, 60, 90, 120];

function sealed(day: number, rank: Rank): CheckpointRow {
  return {
    id: `cp-${day}`, day, export_verified: true, metrics: {}, self_efficacy: {}, automaticity: {}, enjoyment: {}, rank_before: 'E',
    gates: {}, controlled: {}, external: {}, quest_templates_snapshot: {}, sealed_at: '2026-10-01T00:00:00Z', rank_after: rank,
  };
}
const VARIANTS: { name: string; rows: CheckpointRow[] }[] = [
  { name: 'nothing sealed', rows: [] },
  { name: 'Day 14 and 30 sealed', rows: [sealed(14, 'D'), sealed(30, 'C')] },
  { name: 'every prior checkpoint sealed', rows: [sealed(14, 'D'), sealed(30, 'C'), sealed(60, 'B'), sealed(90, 'A')] },
];

describe('gate evaluator (loop 4.5)', () => {
  const golden = legacyActivityLog({ seed: 42, days: 120 });

  it('reproduces getCheckpointReport for every gate, on many days, with and without sealed checkpoints', async () => {
    let met = 0;
    let unmet = 0;
    let comparisons = 0;
    // Every day with nothing sealed; the two sealed variants (rank continuity, arc sealed) on the days where they matter.
    const matrix = [13, 29, 44, 59, 76, 89, 104, 119].flatMap((offset) => VARIANTS.filter((variant) => variant.rows.length === 0 || [59, 119].includes(offset)).map((variant) => ({ offset, variant })));
    for (const { offset, variant } of matrix) {
      const today = dateAt(offset);
      const prefix = prefixOf(golden, today);
      {
        await loadLegacyDb(prefix, today, variant.rows);
        const env = readModelEnv({ blueprint: bp, events: prefix, checkpoints: variant.rows, asOf: today });
        for (const day of DAYS) {
          const legacy = await getCheckpointReport(day, today, DEFAULT_CONFIG);
          const gate = bp.gates.find((g) => g.day === day)!;
          const v2 = evaluateGate(gate, rankSealedBefore(variant.rows, day), env);
          expect(v2, `${variant.name}, day ${offset + 1}, gate ${day}`).toEqual(legacy.result);
          expect(verdictTextFor(v2)).toBe(legacy.verdictText);
          for (const condition of v2.conditions) {
            if (condition.met) met++;
            else unmet++;
          }
          comparisons++;
        }
      }
    }
    expect(comparisons).toBe(12 * 6);
    expect(met).toBeGreaterThan(30);
    expect(unmet).toBeGreaterThan(100);
  }, 300_000);

  it('never regresses rank: a failed gate returns the rank already sealed', async () => {
    const today = dateAt(40);
    const rows = [sealed(14, 'D')];
    const env = readModelEnv({ blueprint: bp, events: prefixOf(golden, today), checkpoints: rows, asOf: today });
    const result = evaluateGate(bp.gates.find((g) => g.day === 60)!, rankSealedBefore(rows, 60), env);
    expect(result.targetRank).toBe('B');
    expect(result.rank).toBe('D');
  });

  it('rank continuity: the latest sealed checkpoint strictly before the gate decides', () => {
    expect(rankSealedBefore([], 30)).toBe('E');
    expect(rankSealedBefore([sealed(14, 'D'), sealed(30, 'C')], 30)).toBe('D');
    expect(rankSealedBefore([sealed(14, 'D'), sealed(30, 'C')], 60)).toBe('C');
    expect(rankSealedBefore([{ day: 14, rank_after: 'D' }], 30)).toBe('E'); // unsealed rows do not count
  });
});

describe('condition evaluator (loop 4.5)', () => {
  it('compares with every comparator, including an inclusive band', () => {
    expect([compareTo(5, '>=', 5), compareTo(5, '<=', 5), compareTo(5, '<', 5), compareTo(5, '>', 5)]).toEqual([true, true, false, false]);
    expect([compareTo(0.6, 'between', [0.6, 0.85]), compareTo(0.85, 'between', [0.6, 0.85]), compareTo(0.86, 'between', [0.6, 0.85]), compareTo(0.59, 'between', [0.6, 0.85])]).toEqual([true, true, false, false]);
  });
  it('formats the slots as the legacy labels do', () => {
    expect(formatValue(0.7, 'percent')).toBe('70%');
    expect(formatValue(0.5049, 'percent')).toBe('50%');
    expect(formatValue(44.6, 'round')).toBe('45');
    expect(formatValue(8123.4, 'locale')).toBe((8123).toLocaleString());
    expect(formatValue(12, 'int')).toBe('12');
  });
  it('treats an empty clause list as met, and any/all modes correctly', () => {
    const env = readModelEnv({ blueprint: bp, events: legacyActivityLog({ seed: 1, days: 3 }), checkpoints: [], asOf: '2026-09-02' });
    const start = bp.gates[0]!.conditions[0]!;
    expect(evaluateCondition(start, env)).toMatchObject({ label: 'Start', met: true });
    const publicEvidence = bp.achievements.find((a) => a.id === 'in_public')!.condition;
    expect(publicEvidence.clauseMode).toBe('any');
    expect(evaluateCondition(publicEvidence, env).met).toBe(false);
  });
});
