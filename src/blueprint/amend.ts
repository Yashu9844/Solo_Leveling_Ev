// Amending a System (platform/02 §19.2, platform/03 §28.5). A person stages small edits against the version in force; the edits become a draft
// version whose change class is COMPUTED from the diff, never chosen, and whose start is set by that class. Nothing here writes: the draft is
// local, and only blueprint-store's activate (which re-validates) puts a version in the log. Pure except for the hashing the class needs.
import { addDays, format, parseISO } from 'date-fns';
import type { Criterion, QuestTemplateDef, SystemBlueprint, Weekday } from './schema';
import { computeChangeClass, validateBlueprint, validateTransition, type ComputedChangeClass, type Issue } from './validate';

/** One staged edit, relative to the version it was staged against (so replaying it on that version always gives the same draft). */
export type AmendOp =
  | { kind: 'designation'; domainId: string; value: string }
  /** Every number a quest asks for, scaled by `percent` (−25..+25 stays operational; beyond that is structural). */
  | { kind: 'target'; questId: string; percent: number }
  | { kind: 'floor'; questId: string; percent: number }
  | { kind: 'days'; questId: string; days: Weekday[] | null }
  /** Move `xp` of the daily budget from one core quest to another: the total never changes. */
  | { kind: 'weight'; fromQuestId: string; toQuestId: string; xp: number };

const scale = (criterion: Criterion, percent: number): Criterion =>
  criterion.kind === 'signal'
    ? { ...criterion, target: Math.max(1, Math.round(criterion.target * (1 + percent / 100))) }
    : { ...criterion, of: criterion.of.map((part) => scale(part, percent)) };

/** The same kind of edit on the same thing replaces the one before it: the draft holds the person's last word. */
export function stageOp(ops: readonly AmendOp[], op: AmendOp): AmendOp[] {
  const same = (other: AmendOp): boolean => {
    if (other.kind !== op.kind) return false;
    switch (op.kind) {
      case 'designation': return (other as typeof op).domainId === op.domainId;
      case 'weight': return (other as typeof op).fromQuestId === op.fromQuestId && (other as typeof op).toQuestId === op.toQuestId;
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
