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
export interface SealedCheckpointFact { day: number; sealed_at?: string; rank_after?: Rank }

/** The rank already sealed at the latest sealed checkpoint strictly before `day`; 'E' before any. */
export function rankSealedBefore(checkpoints: readonly SealedCheckpointFact[], day: number): Rank {
  const sealed = checkpoints.filter((checkpoint) => checkpoint.day < day && checkpoint.sealed_at !== undefined && checkpoint.rank_after !== undefined);
  if (sealed.length === 0) return 'E';
  return sealed.reduce((latest, candidate) => (candidate.day > latest.day ? candidate : latest)).rank_after!;
}

export function evaluateGate(gate: RankGateDef, previousRank: Rank, env: SignalEnv): GateResult {
  const conditions = gate.conditions.map((condition) => {
    const { label, met } = evaluateCondition(condition, env);
    return { label, met };
  });
  return { rank: conditions.every((condition) => condition.met) ? gate.rank : previousRank, targetRank: gate.rank, conditions };
}
