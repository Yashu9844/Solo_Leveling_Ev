// S10 bosses (platform/02 §15). A boss is a milestone with a ceremony: it exists because the person can
// reach something real by their own effort, never because it sounds cool (B1). Their number follows the
// arc's length, their windows sit at fixed fractions of it, each is anchored to a milestone and bundles
// that milestone's evidence with the ladder targets due by its window and the checkpoint seal before it.
import { clause, condition, flag, glob, need } from '../blueprint/build';
import type { BossDef, GateCondition, MilestoneDef, ProgressionSection, Rank } from '../blueprint/schema';
import type { ConditionTemplate, RankStep } from '../library/archetypes/types';
import { namesExternalOutcome } from '../library/lexicon';
import { signalOf, thresholdOf, type DomainContext } from './derive';

const ROMAN = ['I', 'II', 'III', 'IV'] as const;

/** 60 d -> 2, 90 d -> 3, 120 d and longer -> 4 (02 §15.1). */
export function bossCountFor(lengthDays: number): number {
  return lengthDays < 75 ? 2 : lengthDays < 105 ? 3 : 4;
}

/** Where each boss's window opens, as a fraction of the arc: ~21/42/62/83% for four (the owner's 25/50/75/100 of 120). */
const WINDOW_OPENS: Record<number, readonly number[]> = { 2: [0.25, 0.5], 3: [0.25, 0.5, 0.75], 4: [0.21, 0.42, 0.625, 0.83] };

/** Boss I gates B, Boss II gates A, the last boss gates S (with two bosses, I gates B and II gates A). */
export function bossGatesRank(index: number, count: number): Rank | undefined {
  if (index === 0) return 'B';
  if (index === 1) return 'A';
  return index === count - 1 ? 'S' : undefined;
}

export const bossIds = (count: number): string[] => ROMAN.slice(0, count) as unknown as string[];

const RANK_INDEX: Record<RankStep, number> = { C: 0, B: 1, A: 2, S: 3 };

/** The latest checkpoint at or before `day` (never earlier than C): the ladder rung a window is held to. */
function rungFor(day: number, checkpointDays: number[]): { step: RankStep; checkpointDay: number } {
  const steps: RankStep[] = ['C', 'B', 'A', 'S'];
  let chosen = 0;
  steps.forEach((_, index) => {
    if (checkpointDays[index + 1]! <= day) chosen = index;
  });
  return { step: steps[chosen]!, checkpointDay: checkpointDays[chosen + 1]! };
}

/** The threshold a condition template asks at `step`: its own, else the nearest rank above it, else its highest. */
export function thresholdAt(template: ConditionTemplate, step: RankStep, ctx: DomainContext): number | undefined {
  const order: RankStep[] = ['C', 'B', 'A', 'S'];
  const defined = order.filter((rank) => template.at[rank] !== undefined);
  if (defined.length === 0) return undefined;
  const chosen = defined.find((rank) => RANK_INDEX[rank] >= RANK_INDEX[step]) ?? defined[defined.length - 1]!;
  return thresholdOf(template.at[chosen]!, ctx);
}

export function conditionFrom(template: ConditionTemplate, threshold: number, ctx: DomainContext, idPrefix: string): GateCondition {
  return condition(`${idPrefix}.${template.id}`, template.label, template.verifiability, [clause(signalOf(template.signal, ctx.ids), template.comparator, threshold, template.format)]);
}

export function buildBosses(
  contexts: DomainContext[],
  thresholds: Map<string, number[]>,
  progression: ProgressionSection,
  lengthDays: number
): { bosses: BossDef[]; milestones: MilestoneDef[] } {
  const engines = contexts.filter((ctx) => ctx.resolved.archetype.role === 'engine' && ctx.resolved.archetype.quest);
  const count = engines.length === 0 ? 0 : bossCountFor(lengthDays);
  const opens = WINDOW_OPENS[count] ?? [];
  const bosses: BossDef[] = [];
  const milestones: MilestoneDef[] = [];
  const anchored = engines.filter((ctx) => ctx.resolved.archetype.bossAnchor && ctx.resolved.archetype.ladder);

  for (let index = 0; index < count; index++) {
    const id = ROMAN[index]!;
    const start = Math.max(1, Math.round(lengthDays * opens[index]!));
    const end = index === count - 1 ? lengthDays : Math.min(lengthDays, start + Math.max(10, Math.round(lengthDays * 0.17)));
    const rung = rungFor(end, progression.checkpointDays);
    const ctx = anchored[index];
    const conditions: GateCondition[] = [];
    let title: string;
    let milestone: MilestoneDef;

    if (ctx) {
      const archetype = ctx.resolved.archetype;
      const anchor = archetype.bossAnchor!;
      const ladder = archetype.ladder!;
      title = anchor.title;
      if (anchor.uses.ladder) {
        const ladderThreshold = thresholds.get(ctx.domain.id)![RANK_INDEX[rung.step]]!;
        conditions.push(need(`${id}.${ladder.key}`, ladder.noun, signalOf(ladder.signal, ctx.ids), ladderThreshold));
      }
      for (const conditionId of anchor.uses.conditions ?? []) {
        const template = archetype.conditions?.find((candidate) => candidate.id === conditionId);
        const threshold = template && thresholdAt(template, rung.step, ctx);
        if (template && threshold !== undefined) conditions.push(conditionFrom(template, threshold, ctx, id));
      }
      milestone = {
        id: `${ctx.domain.id}.${anchor.id}`, domainId: ctx.domain.id, label: anchor.milestone,
        condition: conditions[conditions.length - 1] ?? conditions[0] ?? need(`${id}.start`, 'records', signalOf(ladder.signal, ctx.ids), 1), declaredBy: 'archetype',
      };
    } else {
      // No archetype left to anchor on: a boss every System can have - keeping the floor for four weeks.
      const lead = engines[0]!;
      title = index === 0 ? 'FIRST CONSISTENCY TRIAL' : 'LONG CONSISTENCY TRIAL';
      conditions.push(condition(`${id}.consistency`, 'Core completion {0} (need {t0})', 'count', [clause(glob('consistency_28'), '>=', 0.7, 'percent')]));
      milestone = { id: `${lead.domain.id}.consistency-${id}`, domainId: lead.domain.id, label: 'Four weeks keeping the floor', condition: conditions[0]!, declaredBy: 'archetype' };
    }
    // B5: whatever the archetype offered, a title that names an outcome other people decide is never used.
    if (namesExternalOutcome(title)) title = 'LONG CONSISTENCY TRIAL';
    conditions.push(flag(`${id}.checkpoint`, `Day-${rung.checkpointDay} checkpoint sealed`, 'structural', glob('checkpoint_sealed', String(rung.checkpointDay))));
    milestones.push(milestone);
    const gatesRank = bossGatesRank(index, count);
    bosses.push({
      id, title, anchorMilestoneId: milestone.id, windowStartDay: start, windowEndDay: end, conditions,
      ...(gatesRank ? { gatesRank } : {}),
    });
  }
  return { bosses, milestones };
}
