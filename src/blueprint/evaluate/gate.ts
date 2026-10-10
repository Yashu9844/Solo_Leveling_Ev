// Rank gates (platform/02 §16): one evaluator replaces evaluateGates and
// computeGateEvidence's thirty-odd bespoke fields. A gate's conditions all
// hold → the target rank; otherwise rank never regresses, it stays where the
// last sealed checkpoint left it (final/01 §4.1).
import type { GateResult } from '../../engine/rank';
import type { Rank } from '../../engine/types';
import type { RankGateDef } from '../schema';
import { evaluateCondition } from './condition';
import type { SignalEnv } from './signals';

/** The part of a checkpoint row rank continuity needs. */
export interface SealedCheckpointFact { day: number; sealed_at?: string; rank_after?: string }

/** The rank already sealed at the latest sealed checkpoint strictly before `day`; 'E' before any. */
export function rankSealedBefore(checkpoints: readonly SealedCheckpointFact[], day: number): Rank {
  const sealed = checkpoints.filter((checkpoint) => checkpoint.day < day && checkpoint.sealed_at !== undefined && checkpoint.rank_after !== undefined);
  if (sealed.length === 0) return 'E';
  return sealed.reduce((latest, candidate) => (candidate.day > latest.day ? candidate : latest)).rank_after as Rank;
}

export function evaluateGate(gate: RankGateDef, previousRank: Rank, env: SignalEnv): GateResult {
  const conditions = gate.conditions.map((condition) => {
    const { label, met } = evaluateCondition(condition, env);
    return { label, met };
  });
  return { rank: conditions.every((condition) => condition.met) ? gate.rank : previousRank, targetRank: gate.rank, conditions };
}

/** What sealing froze into a checkpoint row's `gates` column. */
export interface SealedGateSnapshot { conditions: { label: string; met: boolean }[]; targetRank: Rank }

/**
 * A past checkpoint is shown from the snapshot taken when it was sealed, never
 * re-evaluated (invariant H5/I16): amending the gates afterwards cannot change
 * what a sealed Day-30 said. An unsealed checkpoint is shown live.
 */
export function gateAsDisplayed(row: { sealed_at?: string; rank_after?: string; gates: Record<string, unknown> }, live: () => GateResult): GateResult {
  const snapshot = row.gates as Partial<SealedGateSnapshot>;
  if (row.sealed_at === undefined || !snapshot.conditions || !snapshot.targetRank) return live();
  return { rank: (row.rank_after ?? snapshot.targetRank) as Rank, targetRank: snapshot.targetRank, conditions: snapshot.conditions };
}
