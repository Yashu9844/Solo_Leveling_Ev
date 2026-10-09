// The checkpoint and reality read models (platform/02 §16.3–16.4). At seal,
// a System freezes the evidence it was judged on into the checkpoint row; the
// next checkpoint's comparison reads that frozen snapshot as its baseline, so
// "vs last time" never changes after the fact (invariant H5). For the owner
// the snapshot is engine/rank.ts's GateEvidence, field for field, so a
// checkpoint sealed by either engine reads the same.
import { checkpointImproved, type ComparisonRow } from '../../engine/rank';
import type { ComparisonRowDef, SystemBlueprint } from '../schema';
import { resolveSignal, type SignalEnv } from './signals';

export type EvidenceSnapshot = Record<string, number | boolean>;

/** The evidence a seal freezes, evaluated now. */
export function evidenceSnapshot(blueprint: SystemBlueprint, env: SignalEnv): EvidenceSnapshot {
  const snapshot: EvidenceSnapshot = {};
  for (const def of blueprint.checkpoints.evidence ?? []) {
    const value = resolveSignal(def.signal, env);
    snapshot[def.key] = def.atLeast === undefined ? value : value >= def.atLeast;
  }
  return snapshot;
}

/** What an arc with no activity would freeze: the implicit Day-0 baseline. */
export function zeroEvidence(blueprint: SystemBlueprint): EvidenceSnapshot {
  return Object.fromEntries((blueprint.checkpoints.evidence ?? []).map((def) => [def.key, def.zero]));
}

function formatRow(format: ComparisonRowDef['format'], value: number): string {
  switch (format) {
    case 'percent': return `${Math.round(value * 100)}%`;
    case 'of9': return `${value}/9`;
    case 'minutes': return `${Math.round(value)}min`;
    default: return String(value);
  }
}

/** Before/after lines, direction-aware, in the Blueprint's order. */
export function compareEvidence(blueprint: SystemBlueprint, before: EvidenceSnapshot, after: EvidenceSnapshot): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  for (const def of blueprint.checkpoints.comparison ?? []) {
    const was = before[def.evidenceKey] as number;
    const now = after[def.evidenceKey] as number;
    if (def.onlyWhenBaselineBelow !== undefined && !(was < def.onlyWhenBaselineBelow)) continue;
    rows.push({
      label: def.label,
      before: formatRow(def.format, was),
      after: formatRow(def.format, now),
      improved: def.direction === 'higher' ? now > was : now < was,
    });
  }
  return rows;
}

export { checkpointImproved };

export interface SealedCheckpointEvidence { day: number; sealed_at?: string; metrics?: Record<string, unknown> }

/**
 * The "vs previous checkpoint" comparison for the checkpoint at `day`: the
 * baseline is the frozen evidence of the checkpoint on the PREVIOUS schedule
 * day if that one was sealed (Day 0's `metrics` is a different shape and is
 * never used), otherwise the zero baseline.
 */
export function checkpointComparisonFor(
  blueprint: SystemBlueprint,
  checkpoints: readonly SealedCheckpointEvidence[],
  day: number,
  env: SignalEnv
): { rows: ComparisonRow[]; improved: boolean } {
  const schedule = [0, ...blueprint.progression.checkpointDays];
  const previousDay = schedule.filter((d) => d < day).sort((a, b) => b - a)[0];
  const previousSealed = previousDay !== undefined ? checkpoints.find((c) => c.day === previousDay && c.sealed_at !== undefined && c.day !== 0) : undefined;
  const before = previousSealed?.metrics ? (previousSealed.metrics as EvidenceSnapshot) : zeroEvidence(blueprint);
  const rows = compareEvidence(blueprint, before, evidenceSnapshot(blueprint, env));
  return { rows, improved: checkpointImproved(rows) };
}

/** The REALITY tab's headline numbers, by key. */
export function realitySummary(blueprint: SystemBlueprint, env: SignalEnv): Record<string, number> {
  return Object.fromEntries((blueprint.reality ?? []).map((row) => [row.key, resolveSignal(row.signal, env)]));
}
