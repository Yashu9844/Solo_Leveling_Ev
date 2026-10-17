// Amending a System (platform/02 §19.2, platform/03 §28.5). A person stages small edits against the version in force; the edits become a draft
// version whose change class is COMPUTED from the diff, never chosen, and whose start is set by that class. Nothing here writes: the draft is
// local, and only blueprint-store's activate (which re-validates) puts a version in the log. Pure except for the hashing the class needs.
import { addDays, format, parseISO } from 'date-fns';
import { INSTRUMENT_CATALOGUE } from '../instruments/catalog';
import type { Criterion, GateCondition, QuestTemplateDef, SystemBlueprint, Weekday } from './schema';
import { computeChangeClass, validateBlueprint, validateTransition, type ComputedChangeClass, type Issue } from './validate';

/** One staged edit, relative to the version it was staged against (so replaying it on that version always gives the same draft). */
export type AmendOp =
  | { kind: 'designation'; domainId: string; value: string }
  /** Every number a quest asks for, scaled by `percent` (−25..+25 stays operational; beyond that is structural). */
  | { kind: 'target'; questId: string; percent: number }
  | { kind: 'floor'; questId: string; percent: number }
  | { kind: 'days'; questId: string; days: Weekday[] | null }
  /** Move `xp` of the daily budget from one core quest to another: the total never changes. */
  | { kind: 'weight'; fromQuestId: string; toQuestId: string; xp: number }
  // — Advanced. Every one is bounded by the validator; none edits XP directly. —
  /** One term of an attribute counts for `weight` of it; the others share the rest in proportion, so the formula still sums to one. */
  | { kind: 'attributeWeight'; attributeId: string; termId: string; weight: number }
  /** A rank gate asks `percent` more (or less) of one condition. */
  | { kind: 'gate'; rank: string; conditionId: string; percent: number }
  /** A numeric parameter of an instrument (never an XP amount) scaled by `percent`. */
  | { kind: 'param'; instrumentId: string; key: string; percent: number }
  /** One rung of a milestone's ladder (0 = rank C ... 3 = rank S) scaled by `percent`. */
  | { kind: 'rung'; milestoneId: string; index: number; percent: number };

/** Instrument parameters that are XP or the like: never offered, whatever the catalogue bounds say. */
const XP_PARAMS = new Set(['bonusXp', 'blockXp', 'amount', 'grant']);

/** The numeric parameters of an instrument a person may adjust: those the catalogue bounds, less anything that is XP. */
export function editableParams(instrument: { type: keyof typeof INSTRUMENT_CATALOGUE; params: Record<string, unknown> }): string[] {
  const bounded = Object.keys(INSTRUMENT_CATALOGUE[instrument.type]?.numericBounds ?? {});
  return bounded.filter((key) => !XP_PARAMS.has(key) && typeof instrument.params[key] === 'number');
}

const scale = (criterion: Criterion, percent: number): Criterion =>
  criterion.kind === 'signal'
    ? { ...criterion, target: Math.max(1, Math.round(criterion.target * (1 + percent / 100))) }
    : { ...criterion, of: criterion.of.map((part) => scale(part, percent)) };

/** One threshold of a gate condition (its clauses', or its own) moved by a percentage; ranges and flags are left alone. */
function scaleCondition(condition: GateCondition, percent: number): void {
  const parts = condition.clauses && condition.clauses.length > 0 ? condition.clauses : [condition];
  for (const part of parts) {
    if (typeof part.threshold !== 'number' || part.threshold <= 1 && part.format !== 'percent') continue;
    // A rate is a fraction of one; a count is a whole number.
    part.threshold = part.format === 'percent' ? Math.min(1, Math.max(0.01, Math.round(part.threshold * (1 + percent / 100) * 100) / 100)) : Math.max(1, Math.round(part.threshold * (1 + percent / 100)));
  }
}

/** The same kind of edit on the same thing replaces the one before it: the draft holds the person's last word. */
export function stageOp(ops: readonly AmendOp[], op: AmendOp): AmendOp[] {
  const same = (other: AmendOp): boolean => {
    if (other.kind !== op.kind) return false;
    switch (op.kind) {
      case 'designation': return (other as typeof op).domainId === op.domainId;
      case 'weight': return (other as typeof op).fromQuestId === op.fromQuestId && (other as typeof op).toQuestId === op.toQuestId;
      case 'attributeWeight': return (other as typeof op).attributeId === op.attributeId && (other as typeof op).termId === op.termId;
      case 'gate': return (other as typeof op).rank === op.rank && (other as typeof op).conditionId === op.conditionId;
      case 'param': return (other as typeof op).instrumentId === op.instrumentId && (other as typeof op).key === op.key;
      case 'rung': return (other as typeof op).milestoneId === op.milestoneId && (other as typeof op).index === op.index;
      default: return (other as typeof op).questId === op.questId;
    }
  };
  return [...ops.filter((other) => !same(other)), op];
}

/** The draft version those edits make: version + 1, everything else as it was. `activeFrom` and `changeClass` are set by planAmendment. */
export function applyOps(base: SystemBlueprint, ops: readonly AmendOp[]): SystemBlueprint {
  const next = structuredClone(base);
  next.version = base.version + 1;
  const quest = (id: string): QuestTemplateDef | undefined => next.quests.find((candidate) => candidate.id === id);
  for (const op of ops) {
    switch (op.kind) {
      case 'designation': {
        const domain = next.domains.find((candidate) => candidate.id === op.domainId);
        if (domain) domain.designation = op.value.trim().toUpperCase();
        break;
      }
      case 'target': { const target = quest(op.questId); if (target) target.criterion = scale(target.criterion, op.percent); break; }
      case 'floor': { const target = quest(op.questId); if (target) target.floor = scale(target.floor, op.percent); break; }
      case 'days': { const target = quest(op.questId); if (target) target.schedule = op.days ? { kind: 'weekdays', days: op.days } : { kind: 'daily' }; break; }
      case 'attributeWeight': {
        const def = next.attributes.defs.find((candidate) => candidate.id === op.attributeId);
        const term = def?.terms.find((candidate) => candidate.id === op.termId);
        if (!def || !term || def.combine !== 'sum' || def.terms.length < 2) break;
        const weight = Math.min(0.9, Math.max(0.05, Math.round(op.weight * 100) / 100));
        const others = def.terms.filter((candidate) => candidate !== term);
        const rest = others.reduce((sum, candidate) => sum + candidate.weight, 0);
        for (const other of others) other.weight = Math.round(((1 - weight) * (rest > 0 ? other.weight / rest : 1 / others.length)) * 1000) / 1000;
        term.weight = weight;
        // Rounding must not leave the formula off by a hair: the last other term takes the remainder.
        const last = others[others.length - 1]!;
        last.weight = Math.round((1 - weight - others.slice(0, -1).reduce((sum, candidate) => sum + candidate.weight, 0)) * 1000) / 1000;
        break;
      }
      case 'gate': {
        const condition = next.gates.find((gate) => gate.rank === op.rank)?.conditions.find((candidate) => candidate.id === op.conditionId);
        if (condition) scaleCondition(condition, op.percent);
        break;
      }
      case 'param': {
        const instrument = next.instruments.find((candidate) => candidate.id === op.instrumentId);
        if (instrument && editableParams(instrument).includes(op.key)) instrument.params = { ...instrument.params, [op.key]: Math.max(1, Math.round((instrument.params[op.key] as number) * (1 + op.percent / 100))) };
        break;
      }
      case 'rung': {
        const rung = next.milestones.find((candidate) => candidate.id === op.milestoneId)?.ladder?.[op.index];
        if (rung) rung.threshold = Math.max(1, Math.round(rung.threshold * (1 + op.percent / 100)));
        break;
      }
      case 'weight': {
        const from = quest(op.fromQuestId);
        const to = quest(op.toQuestId);
        if (from && to) {
          from.xp -= op.xp;
          to.xp += op.xp;
          // A channel's cap is its quest's XP plus a fixed headroom (V-XP-03), so the cap moves with the weight.
          const channelOf = (questId: string) => next.domains.find((domain) => domain.coreQuestId === questId)?.channel;
          const fromChannel = channelOf(from.id);
          const toChannel = channelOf(to.id);
          if (fromChannel) fromChannel.cap -= op.xp;
          if (toChannel) toChannel.cap += op.xp;
        }
        break;
      }
    }
  }
  return next;
}

export interface AmendmentContext {
  today: string;
  /** 1-based arc day of `today`. */
  arcDay: number;
  /** The next checkpoint day at or after today, or undefined when none remains. */
  nextCheckpointDay?: number;
  /** A checkpoint was sealed today: this is its Amend step, and a structural change begins tomorrow. */
  sealedToday?: boolean;
}

export interface AmendmentPlan {
  /** Nothing staged. */
  empty: boolean;
  candidate: SystemBlueprint;
  changeClass: ComputedChangeClass;
  activeFrom: string;
  /** "TAKES EFFECT TOMORROW." and the like. */
  effect: string;
  /** Whether the draft can be activated now; a structural draft after the calibration week waits for its checkpoint's Amend step. */
  status: 'empty' | 'ready' | 'waits-for-checkpoint' | 'invalid';
  issues: Issue[];
}

const shift = (date: string, days: number): string => format(addDays(parseISO(date), days), 'yyyy-MM-dd');

/** When each class begins (02 §19.2): cosmetic now; operational at the next day boundary; structural the day after its checkpoint (any day, in the calibration week: tomorrow). */
export function activationTiming(changeClass: ComputedChangeClass, context: AmendmentContext): { activeFrom: string; effect: string; waits: boolean } {
  if (changeClass === 'cosmetic') return { activeFrom: context.today, effect: 'TAKES EFFECT NOW.', waits: false };
  if (changeClass === 'operational') return { activeFrom: shift(context.today, 1), effect: 'TAKES EFFECT TOMORROW.', waits: false };
  if (context.sealedToday) return { activeFrom: shift(context.today, 1), effect: 'TAKES EFFECT TOMORROW, THE DAY AFTER THE CHECKPOINT.', waits: false };
  if (context.arcDay <= 7) return { activeFrom: shift(context.today, 1), effect: 'TAKES EFFECT TOMORROW. THE FIRST WEEK FORGIVES EARLY GUESSES.', waits: false };
  if (context.nextCheckpointDay === undefined) return { activeFrom: shift(context.today, 1), effect: 'NO CHECKPOINT REMAINS TO APPLY THIS AFTER.', waits: true };
  return { activeFrom: shift(context.today, context.nextCheckpointDay - context.arcDay + 1), effect: `TAKES EFFECT AFTER THE DAY ${context.nextCheckpointDay} CHECKPOINT.`, waits: true };
}

export async function planAmendment(base: SystemBlueprint, ops: readonly AmendOp[], context: AmendmentContext): Promise<AmendmentPlan> {
  const candidate = applyOps(base, ops);
  if (ops.length === 0) return { empty: true, candidate, changeClass: 'cosmetic', activeFrom: context.today, effect: '', status: 'empty', issues: [] };
  const changeClass = await computeChangeClass(base, candidate);
  const timing = activationTiming(changeClass, context);
  candidate.changeClass = changeClass;
  candidate.activeFrom = timing.activeFrom;
  const issues = [
    ...validateBlueprint(candidate, { today: context.today }),
    ...(await validateTransition(base, candidate, { today: context.today, arcDay: context.arcDay, nextCheckpointDay: context.nextCheckpointDay ?? context.arcDay, sealedToday: context.sealedToday })),
  ].filter((found) => found.severity !== 'info');
  const blocked = issues.some((found) => found.severity === 'error') || (changeClass === 'structural' && context.arcDay > 7 && context.nextCheckpointDay === undefined && !context.sealedToday);
  return { empty: false, candidate, changeClass, activeFrom: timing.activeFrom, effect: timing.effect, status: blocked ? 'invalid' : timing.waits ? 'waits-for-checkpoint' : 'ready', issues };
}
