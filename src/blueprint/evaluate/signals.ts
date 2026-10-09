// The one way anything reads a number from a System (platform/02 §12).
// Quest criteria, attributes, gates, bosses and achievements all resolve a
// SignalRef through `resolveSignal`, so a number means the same thing wherever
// it is read. Pure: it sees only the Blueprint, the instrument records and the
// arc-wide facts handed to it.
import { addDays, format, parseISO } from 'date-fns';
import type { MasteryState as EngineMasteryState } from '../../engine/types';
import type { InstrumentRecord } from '../../instruments/framework';
import { INSTRUMENT_DEFINITIONS } from '../../instruments/registry';
import { practiceItemMastery } from '../../instruments/types/practiceItem';
import { studyBlockMastery, type BlockCountPolicy, type StudyBlockRecord } from '../../instruments/types/studyBlock';
import type { Aggregate, GlobalSignalName, InstrumentConfig, MasteryState, SignalRef, SkillTreeDef, SystemBlueprint } from '../schema';
import type { PracticeItemRecord } from '../../instruments/types/practiceItem';

/** Arc-wide facts no single instrument owns. Supplied by the caller from the event log and checkpoints. */
export interface SignalFacts {
  global(signal: GlobalSignalName, id: string | undefined, aggregate: Aggregate | undefined): number;
  /** Distinct days in the window on which the quest ('*' = any core quest) was completed. */
  questCompletedDays(questId: string, aggregate: Aggregate | undefined): number;
  /** Values of a manual metric, oldest first, over the whole log up to `asOf`. */
  metricValues(metricId: string): readonly number[];
}

export interface SignalEnv {
  blueprint: SystemBlueprint;
  /** The date being evaluated, inclusive (a local_date). */
  asOf: string;
  arcStartDate: string;
  /** Every record up to `asOf`, per instrument, in log order. */
  recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>;
  /** The attribute window: the last N non-paused dates up to `asOf`. */
  eligibleDates?: ReadonlySet<string>;
  facts?: SignalFacts;
}

/** Filter keys that steer a signal rather than select records. */
const PASS_THROUGH = new Set(['stage', 'kinds', 'tree', 'topics']);

function shift(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

function windowStart(aggregate: Aggregate | undefined, asOf: string): string | undefined {
  switch (aggregate) {
    case 'window_14': return shift(asOf, -13);
    case 'window_28': case 'rate_28': case 'mean_28': case 'sd_28': return shift(asOf, -27);
    case 'window_90': return shift(asOf, -89);
    default: return undefined;
  }
}

/** The records an aggregate reads: a date range (or the attribute window), then the filter. */
export function recordsFor(records: readonly InstrumentRecord[], aggregate: Aggregate | undefined, filter: Record<string, string> | undefined, env: SignalEnv): InstrumentRecord[] {
  const start = windowStart(aggregate, env.asOf);
  const selected = records.filter((record) => {
    if (record.localDate > env.asOf) return false;
    if (aggregate === 'day') return record.localDate === env.asOf;
    if (aggregate === 'eligible_28') return env.eligibleDates?.has(record.localDate) ?? false;
    return start === undefined || record.localDate >= start;
  });
  if (!filter) return selected;
  const entries = Object.entries(filter).filter(([key]) => !PASS_THROUGH.has(key));
  if (entries.length === 0) return selected;
  return selected.filter((record) => entries.every(([key, value]) => {
    if (key === 'hasUrl') return Boolean(record.record.url) === (value === 'true');
    return String(record.record[key]) === value;
  }));
}

function treeFor(env: SignalEnv, filter: Record<string, string> | undefined): SkillTreeDef | undefined {
  return filter?.tree ? env.blueprint.skills.find((skill) => skill.id === filter.tree) : undefined;
}

function topicsFor(instrument: InstrumentConfig, tree: SkillTreeDef | undefined, filter: Record<string, string> | undefined): string[] {
  const base = tree ? tree.nodes.map((node) => node.name) : ((instrument.params.topics as string[] | undefined) ?? []);
  const subset = filter?.topics ? new Set(filter.topics.split('|')) : undefined;
  return subset ? base.filter((topic) => subset.has(topic)) : base;
}

const RANK: Record<EngineMasteryState, number> = { unseen: 0, introduced: 1, applied: 2, fluent: 3, retained: 4 };

function masteryOf(instrument: InstrumentConfig, topic: string, records: readonly InstrumentRecord[], tree: SkillTreeDef | undefined): EngineMasteryState {
  if (instrument.type === 'practice_item') return practiceItemMastery(topic, records as InstrumentRecord<PracticeItemRecord>[]);
  const policy = tree?.policy.kind === 'block_count' ? (tree.policy as BlockCountPolicy) : (instrument.params.mastery as BlockCountPolicy | undefined);
  return studyBlockMastery(topic, records as InstrumentRecord<StudyBlockRecord>[], policy);
}

function instrumentFor(env: SignalEnv, instrumentId: string): InstrumentConfig {
  const instrument = env.blueprint.instruments.find((candidate) => candidate.id === instrumentId);
  if (!instrument) throw new Error(`Unknown instrument "${instrumentId}"`);
  return instrument;
}

function resolveInstrument(ref: Extract<SignalRef, { source: 'instrument' }>, env: SignalEnv): number {
  const instrument = instrumentFor(env, ref.instrumentId);
  const all = env.recordsByInstrument.get(ref.instrumentId) ?? [];
  const tree = treeFor(env, ref.filter);

  if (typeof ref.aggregate === 'string' && ref.aggregate.startsWith('mastery_count_at_least:')) {
    const threshold = RANK[ref.aggregate.slice('mastery_count_at_least:'.length) as MasteryState];
    const records = recordsFor(all, 'total', ref.filter, env);
    return topicsFor(instrument, tree, ref.filter).filter((topic) => RANK[masteryOf(instrument, topic, records, tree)] >= threshold).length;
  }

  const records = recordsFor(all, ref.aggregate, ref.filter, env);
  let params = instrument.params;
  if (instrument.type === 'study_block' && tree) {
    // A skill tree names the topics (and thresholds) a mastery signal ranges over.
    params = { ...params, topics: topicsFor(instrument, tree, ref.filter), ...(tree.policy.kind === 'block_count' ? { mastery: tree.policy } : {}) };
  }
  const values = INSTRUMENT_DEFINITIONS[instrument.type].signals(records, params, {
    localDate: env.asOf, from: windowStart(ref.aggregate, env.asOf) ?? env.arcStartDate, to: env.asOf, arcStartDate: env.arcStartDate, filter: ref.filter,
  });
  const value = values[ref.signal];
  if (value === undefined) throw new Error(`Instrument "${ref.instrumentId}" (${instrument.type}) has no signal "${ref.signal}"`);
  return value;
}

/** Resolves any SignalRef to a number. Division by zero reads as 0, never NaN or Infinity. */
export function resolveSignal(ref: SignalRef, env: SignalEnv): number {
  switch (ref.source) {
    case 'instrument': return resolveInstrument(ref, env);
    case 'sum': return ref.of.reduce((total, part) => total + resolveSignal(part, env), 0);
    case 'ratio': {
      const denominator = resolveSignal(ref.den, env);
      return denominator === 0 ? 0 : resolveSignal(ref.num, env) / denominator;
    }
    case 'global': return requireFacts(env).global(ref.signal, ref.id, ref.aggregate);
    case 'quest': return requireFacts(env).questCompletedDays(ref.questId, ref.aggregate);
    case 'metric': {
      const values = requireFacts(env).metricValues(ref.metricId);
      if (values.length === 0) return 0;
      if (ref.aggregate === 'max') return Math.max(...values);
      if (ref.aggregate === 'total') return values.reduce((a, b) => a + b, 0);
      return values[values.length - 1]!; // 'latest'
    }
  }
}

function requireFacts(env: SignalEnv): SignalFacts {
  if (!env.facts) throw new Error('This signal needs arc-wide facts, but none were supplied.');
  return env.facts;
}
