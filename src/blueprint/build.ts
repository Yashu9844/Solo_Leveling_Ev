// The small builders every Blueprint author uses to write signals and conditions: the owner's
// System (legacy/legacyV1.ts) and the generator (generator/*) share them, so a condition means the
// same thing whichever wrote it.
import type { Comparator, ConditionFormat, GateClause, GateCondition, SignalRef } from './schema';

export type Aggregate = Extract<SignalRef, { source: 'instrument' }>['aggregate'];

/** A signal read from an instrument. */
export const inst = (instrumentId: string, signal: string, aggregate: Aggregate, filter?: Record<string, string>): SignalRef =>
  filter ? { source: 'instrument', instrumentId, signal, aggregate, filter } : { source: 'instrument', instrumentId, signal, aggregate };

/** An arc-wide fact no single instrument owns (consistency, bosses cleared, checkpoints sealed...). */
export const glob = (signal: Extract<SignalRef, { source: 'global' }>['signal'], id?: string, aggregate?: Aggregate): SignalRef => {
  const ref: Extract<SignalRef, { source: 'global' }> = { source: 'global', signal };
  if (id !== undefined) ref.id = id;
  if (aggregate !== undefined) ref.aggregate = aggregate;
  return ref;
};

export const sum = (...of: SignalRef[]): SignalRef => ({ source: 'sum', of });
export const ratio = (num: SignalRef, den: SignalRef): SignalRef => ({ source: 'ratio', num, den });

export const clause = (signal: SignalRef, comparator: Comparator, threshold: number | [number, number], format?: ConditionFormat): GateClause =>
  format ? { signal, comparator, threshold, format } : { signal, comparator, threshold };

/** A condition; its top-level signal/comparator/threshold mirror the first clause. */
export function condition(id: string, label: string, verifiability: GateCondition['verifiability'], clauses: GateClause[], clauseMode?: 'any'): GateCondition {
  const first = clauses[0] ?? clause(glob('first_quest'), '>=', 0);
  const result: GateCondition = { id, label, signal: first.signal, comparator: first.comparator, threshold: first.threshold, verifiability, clauses };
  if (first.format) result.format = first.format;
  if (clauseMode) result.clauseMode = clauseMode;
  return result;
}

/** "{0} problems (need {t0})": a count that must reach n. */
export const need = (id: string, noun: string, signal: SignalRef, n: number): GateCondition =>
  condition(id, `{0} ${noun} (need {t0})`, 'count', [clause(signal, '>=', n, 'int')]);

/** "Core completion {0} (need {t0})" over the last 28 eligible days. */
export const coreCompletion = (id: string, floor: number): GateCondition =>
  condition(id, `Core completion {0} (need {t0})`, 'count', [clause(glob('consistency_28'), '>=', floor / 100, 'percent')]);

/** A yes/no: the signal reaches n (default 1). */
export const flag = (id: string, label: string, verifiability: GateCondition['verifiability'], signal: SignalRef, n = 1): GateCondition =>
  condition(id, label, verifiability, [clause(signal, '>=', n)]);

export const BOSS_CLEARED = (id: string): SignalRef => glob('boss_cleared', id);
