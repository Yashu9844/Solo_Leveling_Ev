// S9 gates (platform/02 §16.2): what it takes to seal each rank. Level measures effort; Rank measures
// evidence - so every gate from C upward carries at least one condition a stranger could check (E1), no
// gate reads an outcome other people decide (E2), and the ladders only ever rise.
import { BOSS_CLEARED, clause, condition, coreCompletion, glob, inst } from '../blueprint/build';
import type { GateCondition, ProgressionSection, Rank, RankGateDef } from '../blueprint/schema';
import type { QuestTemplateDef } from '../blueprint/schema';
import type { RankStep } from '../library/archetypes/types';
import { RANK_STEPS, RECORDS_SIGNAL, signalOf, type DomainContext } from './derive';
import { bossIds, conditionFrom, thresholdAt } from './s10Bosses';

const CORE_FLOOR: Record<RankStep, number | 'band'> = { C: 60, B: 65, A: 65, S: 'band' };

export function buildGates(
  contexts: DomainContext[],
  quests: QuestTemplateDef[],
  thresholds: Map<string, number[]>,
  progression: ProgressionSection,
  bossCount: number
): RankGateDef[] {
  const [dDay, ...stepDays] = progression.checkpointDays;
  const bosses = bossIds(bossCount);
  const core = contexts.filter((ctx) => quests.some((quest) => quest.domainId === ctx.domain.id));
  const engines = core.filter((ctx) => ctx.resolved.archetype.role === 'engine');

  const gates: RankGateDef[] = [
    { rank: 'E', day: 0, conditions: [condition('start', 'Start', 'structural', [])] },
    { rank: 'D', day: dDay!, conditions: [condition('mvd-14', 'MVD consistency {0} (need {t0})', 'count', [clause(glob('consistency_14'), '>=', 0.7, 'percent')])] },
  ];

  RANK_STEPS.forEach((step, index) => {
    const conditions: GateCondition[] = [];
    const floor = CORE_FLOOR[step];
    conditions.push(floor === 'band'
      ? condition('core-band', 'Core completion {0} (need 60-85%)', 'count', [clause(glob('consistency_28'), 'between', [0.6, 0.85], 'percent')])
      : coreCompletion('core', floor));

    // Each engine's ladder, then the other conditions its archetype carries at this rank.
    for (const ctx of engines) {
      const ladder = ctx.resolved.archetype.ladder;
      const steps = thresholds.get(ctx.domain.id);
      if (ladder && steps) conditions.push(condition(`${ctx.domain.id}.${ladder.key}`, `{0} ${ladder.noun} (need {t0})`, ladder.verifiability, [clause(signalOf(ladder.signal, ctx.ids), '>=', steps[index]!, 'int')]));
    }
    for (const ctx of core) {
      for (const template of ctx.resolved.archetype.conditions ?? []) {
        if (template.at[step] === undefined) continue;
        conditions.push(conditionFrom(template, thresholdAt(template, step, ctx)!, ctx, ctx.domain.id));
      }
    }

    // E1: from C upward the gate must hold something a stranger could check. If the archetypes in play brought none,
    // the top engine's dated records stand in for it - they exist and could be shown.
    if (!conditions.some((candidate) => candidate.verifiability === 'public_url' || candidate.verifiability === 'recorded')) {
      const lead = engines[0] ?? core[0];
      if (lead) {
        const primary = lead.instruments[0];
        const signal = primary ? RECORDS_SIGNAL[primary.type] : undefined;
        const ladderStep = thresholds.get(lead.domain.id)?.[index] ?? (index + 1) * 5;
        if (primary && signal) {
          conditions.push(condition(`${lead.domain.id}.records`, `{0} dated ${primary.label.toLowerCase()} on file (need {t0})`, 'recorded', [clause(inst(primary.id, signal, 'total'), '>=', ladderStep, 'int')]));
        }
      }
    }

    // Bosses: B needs the first, A the first two, S all of them and the sealed arc.
    if (step === 'B' && bosses.length > 0) conditions.push(condition('boss-i', 'Boss I cleared', 'structural', [clause(BOSS_CLEARED(bosses[0]!), '>=', 1)]));
    if (step === 'A' && bosses.length > 1) conditions.push(condition('bosses-i-ii', 'Bosses I-II cleared', 'structural', bosses.slice(0, 2).map((id) => clause(BOSS_CLEARED(id), '>=', 1))));
    if (step === 'S') {
      if (bosses.length > 0) conditions.push(condition('bosses-all', `Bosses I-${bosses[bosses.length - 1]} cleared`, 'structural', bosses.map((id) => clause(BOSS_CLEARED(id), '>=', 1))));
      conditions.push(condition('arc-sealed', 'Arc data sealed and exported', 'structural', [clause(glob('prior_checkpoints_sealed'), '>=', 4)]));
    }
    gates.push({ rank: step as Rank, day: stepDays[index]!, conditions });
  });
  return gates;
}
