// S4 quests: each core domain's one quest - criterion, floor, schedule, wording - from the archetype's
// template and the person's numbers. XP is S5's. A criterion is only ever built from an instrument, a
// signal and a number (D10): there is no field that accepts "learn something".
import type { Criterion, DomainDefinition, InstrumentConfig, QuestTemplateDef } from '../blueprint/schema';
import type { Issue } from '../blueprint/validate';
import type { CriterionTemplate, LeafTemplate } from '../library/archetypes/types';
import { generatorIssue, type BuiltDomains, type ResolvedDomain } from './types';
import { minutesOf, timeOf } from './util';

/** 'criterion' is the good day. 'floor' derives every leaf's hard day; 'answered' changes only the leaves that take the person's hard-day number. */
type Mode = 'criterion' | 'floor' | 'answered';

/** The good-day target of a leaf: the person's number where they gave one, else the archetype's. */
function goodTarget(leaf: LeafTemplate, goodDay: number | undefined): number {
  return leaf.answer === 'goodDay' && goodDay !== undefined && Number.isFinite(goodDay) ? Math.max(leaf.min ?? 1, Math.round(goodDay)) : leaf.target;
}

/** A hard day's target for a leaf kept over a number: the person's hard-day number if given, else a third of the good day, never below the instrument's minimum. */
function floorTarget(leaf: LeafTemplate, good: number, hardDay: number | undefined, answeredOnly: boolean): number {
  if (leaf.comparator === '<=') return good;
  if (answeredOnly && !(leaf.answer === 'goodDay' && hardDay !== undefined && Number.isFinite(hardDay))) return good;
  const wanted = leaf.answer === 'goodDay' && hardDay !== undefined && Number.isFinite(hardDay) ? Math.round(hardDay) : Math.ceil(good / 3);
  return Math.min(good, Math.max(leaf.min ?? 1, wanted));
}

function resolve(template: CriterionTemplate, ids: Record<string, string>, goodDay: number | undefined, hardDay: number | undefined, mode: Mode): Criterion {
  if (template.kind !== 'signal') return { kind: template.kind, of: template.of.map((child) => resolve(child, ids, goodDay, hardDay, mode)) };
  const good = goodTarget(template, goodDay);
  const target = mode === 'criterion' ? good : floorTarget(template, good, hardDay, mode === 'answered');
  return {
    kind: 'signal', instrumentId: ids[template.instrument]!, signal: template.signal, comparator: template.comparator, target,
    ...(template.filter ? { filter: template.filter } : {}),
  };
}

/** The first leaf that takes the person's number, else the first leaf: what "{target}" in the wording means. */
function headlineTarget(template: CriterionTemplate, goodDay: number | undefined): number {
  const leaves: LeafTemplate[] = [];
  const collect = (node: CriterionTemplate): void => (node.kind === 'signal' ? void leaves.push(node) : node.of.forEach(collect));
  collect(template);
  const leaf = leaves.find((candidate) => candidate.answer === 'goodDay') ?? leaves[0]!;
  return goodTarget(leaf, goodDay);
}

const windowText = (wake: string, tolerance: number): string => {
  const at = minutesOf(wake) ?? 0;
  return `${timeOf(at - tolerance)}–${timeOf(at + tolerance)}`;
};

function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function buildQuests(resolved: ResolvedDomain[], domains: DomainDefinition[], built: BuiltDomains, instruments: InstrumentConfig[]): { quests: QuestTemplateDef[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const quests: QuestTemplateDef[] = [];
  resolved.forEach((entry, index) => {
    const { archetype, answers } = entry;
    const domain = domains[index]!;
    if (!archetype.quest) return;
    const template = archetype.quest;
    const ids = built.instrumentIds[domain.id]!;
    if (answers.hardDay !== undefined && answers.goodDay !== undefined && answers.hardDay > answers.goodDay) {
      issues.push(generatorIssue('G-QST-01', 'warning', `domains.${domain.id}.hardDay`, 'THE HARD-DAY AMOUNT EXCEEDS THE GOOD-DAY AMOUNT.', 'Your hard-day number was lowered to match your good-day number.'));
    }

    const criterion = resolve(template.criterion, ids, answers.goodDay, answers.hardDay, 'criterion');
    // 'same': the floor IS the criterion, unless the person gave a hard-day number, which then lowers the leaf it belongs to.
    const floor = template.floor === 'same' && answers.hardDay === undefined
      ? criterion
      : resolve(typeof template.floor === 'object' ? template.floor : template.criterion, ids, answers.goodDay, answers.hardDay, template.floor === 'same' ? 'answered' : 'floor');

    const mainTimeWindow = instruments.find((instrument) => instrument.domainId === domain.id && instrument.type === 'time_window');
    const tolerance = typeof mainTimeWindow?.params.toleranceMinutes === 'number' ? mainTimeWindow.params.toleranceMinutes : 30;
    const wake = typeof mainTimeWindow?.params.targetTime === 'string' ? mainTimeWindow.params.targetTime : '';
    const limit = instruments.find((instrument) => instrument.domainId === domain.id && instrument.type === 'threshold' && instrument.params.comparator === '<=');
    const vars: Record<string, string | number> = {
      target: limit && typeof limit.params.target === 'number' ? limit.params.target : headlineTarget(template.criterion, answers.goodDay),
      tolerance, wake, window: wake ? windowText(wake, tolerance) : '',
    };

    quests.push({
      id: `${domain.id}.core`, domainId: domain.id, type: 'core', designation: domain.designation,
      realityLabel: fill(template.realityLabel, vars), objective: fill(template.objective, vars),
      criterion, floor, xp: 0, bonus: [], schedule: template.schedule,
      evidenceMode: template.evidenceMode, recoverable: template.recoverable, intentionAllowed: template.intentionAllowed,
    });
  });
  return { quests, issues };
}
