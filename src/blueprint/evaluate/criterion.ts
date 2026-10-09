// One function replaces six (platform/02 §9.2): evaluateCriterion decides
// whether a quest is complete from the day's instrument signals, replacing
// maybeCompleteCareerQuest, …DsaQuest, …BuildQuest, …TrainingQuest and the
// sleep and attention checks. `progress` gives the quest row a real partial
// meter and `explanation` says what completed it.
import type { Criterion } from '../schema';
import { resolveSignal, type SignalEnv } from './signals';

export interface CriterionResult {
  met: boolean;
  /** 0..1. A leaf is value/target (capped); `any` is its best branch; `all` is the mean of its branches. */
  progress: number;
  /** Human-readable lines: what is done and what is left, e.g. "quality_count 2 of 3". */
  explanation: string[];
}

type Leaf = Extract<Criterion, { kind: 'signal' }>;

function compare(value: number, comparator: Leaf['comparator'], target: number): boolean {
  return comparator === '>=' ? value >= target : value <= target;
}

function leafProgress(value: number, leaf: Leaf): number {
  if (leaf.comparator === '<=') return value <= leaf.target ? 1 : 0;
  if (leaf.target <= 0) return value >= leaf.target ? 1 : 0;
  return Math.max(0, Math.min(1, value / leaf.target));
}

/** Evaluates a criterion for `env.asOf`: every leaf reads that day's signal. */
export function evaluateCriterion(criterion: Criterion, env: SignalEnv): CriterionResult {
  if (criterion.kind === 'signal') {
    const value = resolveSignal({ source: 'instrument', instrumentId: criterion.instrumentId, signal: criterion.signal, aggregate: 'day', ...(criterion.filter ? { filter: criterion.filter } : {}) }, env);
    const met = compare(value, criterion.comparator, criterion.target);
    const filter = criterion.filter ? ` [${Object.entries(criterion.filter).map(([k, v]) => `${k}=${v}`).join(', ')}]` : '';
    return {
      met,
      progress: leafProgress(value, criterion),
      explanation: [`${criterion.instrumentId}.${criterion.signal}${filter} ${value} (${criterion.comparator} ${criterion.target}) ${met ? 'met' : 'not yet'}`],
    };
  }
  const parts = criterion.of.map((child) => evaluateCriterion(child, env));
  if (criterion.kind === 'any') {
    const winners = parts.filter((part) => part.met);
    return {
      met: winners.length > 0,
      progress: parts.reduce((best, part) => Math.max(best, part.progress), 0),
      explanation: (winners.length > 0 ? winners : parts).flatMap((part) => part.explanation),
    };
  }
  return {
    met: parts.every((part) => part.met),
    progress: parts.length === 0 ? 1 : parts.reduce((sum, part) => sum + part.progress, 0) / parts.length,
    explanation: parts.flatMap((part) => part.explanation),
  };
}

/** The explanation alone, for the quest detail sheet. */
export function explainCriterion(criterion: Criterion, env: SignalEnv): string[] {
  return evaluateCriterion(criterion, env).explanation;
}
