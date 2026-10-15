// Shared plumbing for stages S6-S10: a domain's archetype, its built definition and the ids its templates
// refer to, and the small functions that turn an archetype's signal and threshold templates into the
// Blueprint's own.
import { glob, inst, ratio } from '../blueprint/build';
import type { DomainDefinition, InstrumentConfig, SignalRef } from '../blueprint/schema';
import type { ArchetypeDef, LadderTemplate, RankStep, SignalTemplate, Threshold } from '../library/archetypes/types';
import type { CoreGeneration, ResolvedDomain } from './types';

export interface DomainContext {
  resolved: ResolvedDomain;
  domain: DomainDefinition;
  /** archetype instrument key -> the domain's instrument id */
  ids: Record<string, string>;
  instruments: InstrumentConfig[];
}

export function domainContexts(core: Pick<CoreGeneration, 'resolved' | 'domains' | 'instruments'>): DomainContext[] {
  return core.resolved.map((resolved, index) => {
    const domain = core.domains[index]!;
    const own = core.instruments.filter((instrument) => instrument.domainId === domain.id);
    const ids = Object.fromEntries(resolved.archetype.instruments.map((template) => [template.key, `${domain.id}.${template.key}`]));
    return { resolved, domain, ids, instruments: own };
  });
}

export function signalOf(template: SignalTemplate, ids: Record<string, string>): SignalRef {
  return inst(ids[template.instrument]!, template.signal, template.aggregate, template.filter);
}

/** The number of eligible days in the 28-day window (paused days do not count): the denominator of a rate over days. */
export const WINDOW_DAYS: SignalRef = glob('window_days', undefined, 'eligible_28');

export function ratioOfTerm(signal: SignalRef, of: SignalTemplate | 'window_days' | undefined, ids: Record<string, string>): SignalRef {
  if (of === undefined) return signal;
  return ratio(signal, of === 'window_days' ? WINDOW_DAYS : signalOf(of, ids));
}

/** A threshold template resolved against the domain's instrument parameters. */
export function thresholdOf(threshold: Threshold, ctx: DomainContext): number {
  if (typeof threshold === 'number') return threshold;
  const instrument = ctx.instruments.find((candidate) => candidate.id === ctx.ids[threshold.instrument]);
  const value = instrument?.params[threshold.param];
  return typeof value === 'number' ? value * (threshold.scale ?? 1) : 0;
}

/** The standard ramp (02 §14), derived from the owner's ladders: C 23%, B 53%, A 82%, S 100% of the success target. */
export const LADDER_RAMP = [0.23, 0.53, 0.82, 1] as const;

export const RANK_STEPS: readonly RankStep[] = ['C', 'B', 'A', 'S'];

/** C, B, A, S thresholds for a ladder: the ramp times the success target, rounded to a natural step, strictly rising, ending exactly on the target. */
export function ladderThresholds(success: number): number[] {
  const step = success >= 100 ? 5 : 1;
  const raw = LADDER_RAMP.map((fraction) => Math.max(step, Math.round((success * fraction) / step) * step));
  raw[3] = success;
  for (let i = 1; i < raw.length; i++) if (raw[i]! <= raw[i - 1]!) raw[i] = raw[i - 1]! + step;
  raw[3] = Math.max(raw[3]!, raw[2]! + step);
  return raw;
}

export const ladderSuccess = (ladder: LadderTemplate, answered: number | undefined): number => {
  if (answered !== undefined && Number.isFinite(answered) && answered >= 1) return Math.round(answered);
  return ladder.success;
};

/** The primary instrument signal that counts a domain's dated records, for the gate-evidence fallback. */
export const RECORDS_SIGNAL: Readonly<Record<string, string>> = {
  practice_item: 'count', pipeline: 'submitted', duration: 'records', session: 'count', threshold: 'days_logged',
  time_window: 'hit_days', artifact: 'count', study_block: 'blocks', checklist: 'all_done_days',
};

export const archetypeOf = (ctx: DomainContext): ArchetypeDef => ctx.resolved.archetype;
