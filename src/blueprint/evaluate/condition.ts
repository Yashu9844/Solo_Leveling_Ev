// One test of evidence, shared by rank gates, boss checklists and
// achievements (platform/02 §16.2). A condition is one or more clauses over
// signals; its label is a template whose {n} slots take each clause's
// formatted value, so the player reads the live number beside the target
// ("46 problems (need 55)").
import type { Comparator, ConditionFormat, GateClause, GateCondition } from '../schema';
import { resolveSignal, type SignalEnv } from './signals';

export interface ConditionResult {
  label: string;
  met: boolean;
  /** Each clause's signal value, in order. */
  values: number[];
}

export function compareTo(value: number, comparator: Comparator, threshold: number | [number, number]): boolean {
  if (comparator === 'between') {
    const [low, high] = threshold as [number, number];
    return value >= low && value <= high;
  }
  const limit = threshold as number;
  switch (comparator) {
    case '>=': return value >= limit;
    case '<=': return value <= limit;
    case '<': return value < limit;
    case '>': return value > limit;
  }
}

export function formatValue(value: number, format: ConditionFormat | undefined): string {
  switch (format) {
    case 'percent': return `${Math.round(value * 100)}%`;
    case 'round': return String(Math.round(value));
    case 'locale': return Math.round(value).toLocaleString();
    default: return String(value);
  }
}

function clausesOf(condition: GateCondition): GateClause[] {
  return condition.clauses ?? [{ signal: condition.signal, comparator: condition.comparator, threshold: condition.threshold, ...(condition.format ? { format: condition.format } : {}) }];
}

export function evaluateCondition(condition: GateCondition, env: SignalEnv): ConditionResult {
  const clauses = clausesOf(condition);
  const values = clauses.map((clause) => resolveSignal(clause.signal, env));
  const results = clauses.map((clause, index) => compareTo(values[index]!, clause.comparator, clause.threshold));
  const met = condition.clauseMode === 'any' ? results.some(Boolean) : results.every(Boolean);
  const label = condition.label.replace(/\{(\d+)\}/g, (_slot, index: string) => {
    const at = Number(index);
    return formatValue(values[at] ?? 0, clauses[at]?.format);
  });
  return { label, met, values };
}
