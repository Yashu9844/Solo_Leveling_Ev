// S5 economy + progression (platform/02 §9.4). The daily core budget is a global 500: engines share 400 and
// guardrails 100, weighted by the archetype and (when ranked) by position; every core quest lands in
// [30, 150]; each channel may earn a bounded multiple of its quest, never more than a smallest-engine's
// worth beyond it ("showing up across all domains always beats grinding one"); the level coefficient and the
// checkpoint days come from the arc's length. The owner's numbers fall out as a check, not as an input.
import type { DomainDefinition, ProgressionSection, QuestTemplateDef } from '../blueprint/schema';
import type { Issue } from '../blueprint/validate';
import { checkpointDaysFor, coefficientFor, rankScheduleFor } from '../library/calibration';
import { HEADROOM_MULTIPLE } from '../library/archetypes/types';
import { generatorIssue, type NormalizedDraft, type ResolvedDomain } from './types';
import { allocate } from './util';

export const DAILY_CORE_BUDGET = 500;
export const ENGINE_SHARE = 0.8;
export const MIN_CORE_XP = 30;
export const MAX_CORE_XP = 150;
const XP_UNIT = 10;

/** 1st 1.2, 2nd 1.1, 3rd 1.0, 4th 0.9 ...: a gentle tilt toward what matters most, never below 0.6. */
export const priorityTilt = (position: number): number => Math.max(0.6, 1.2 - 0.1 * position);

export function allocateQuestXp(resolved: ResolvedDomain[], mode: 'ranked' | 'equal'): { xp: Map<number, number>; issues: Issue[] } {
  const issues: Issue[] = [];
  const core = resolved.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.archetype.quest);
  const isEngine = ({ entry }: (typeof core)[number]) => entry.archetype.role === 'engine';
  const rawWeight = (member: (typeof core)[number]) => member.entry.archetype.weight * (mode === 'ranked' ? priorityTilt(member.entry.rolePosition) : 1);
  const groupWeight = (engines: boolean) => core.filter((member) => isEngine(member) === engines).reduce((sum, member) => sum + rawWeight(member), 0);
  const engineWeight = groupWeight(true);
  const guardrailWeight = groupWeight(false);
  // Engines are meant to hold 80% of the budget and guardrails 20%; a group with no members hands its share to the other.
  const engineFraction = guardrailWeight === 0 ? 1 : engineWeight === 0 ? 0 : ENGINE_SHARE;
  // One allocation over everyone: each member's weight is its place in its group times the group's share. A member the
  // [30, 150] band pins (four guardrails cannot each get 25) is held at the band and the others re-share what is left, so the
  // budget always balances whenever the band allows it.
  const items = core.map((member) => {
    const engine = isEngine(member);
    const sum = engine ? engineWeight : guardrailWeight;
    const fraction = engine ? engineFraction : 1 - engineFraction;
    return { weight: sum > 0 ? (fraction * rawWeight(member)) / sum : 0, min: MIN_CORE_XP, max: MAX_CORE_XP };
  });
  const allocated = allocate(DAILY_CORE_BUDGET, items, XP_UNIT);
  const values = new Map<number, number>();
  core.forEach(({ index }, i) => values.set(index, allocated[i]!));
  const total = allocated.reduce((sum, value) => sum + value, 0);
  if (core.length > 0 && total !== DAILY_CORE_BUDGET) {
    issues.push(generatorIssue('G-XP-01', 'error', 'quests', 'THE CORE ECONOMY CANNOT BE BALANCED.', `${core.length} core quests cannot share ${DAILY_CORE_BUDGET} XP between ${MIN_CORE_XP} and ${MAX_CORE_XP} each.`));
  }
  return { xp: values, issues };
}

export function priceEconomy(
  draft: NormalizedDraft,
  resolved: ResolvedDomain[],
  domains: DomainDefinition[],
  quests: QuestTemplateDef[]
): { domains: DomainDefinition[]; quests: QuestTemplateDef[]; progression: ProgressionSection; issues: Issue[] } {
  const { xp, issues } = allocateQuestXp(resolved, draft.priorityMode);
  const questByDomain = new Map(quests.map((quest) => [quest.domainId, quest]));
  const pricedQuests = quests.map((quest) => {
    const index = domains.findIndex((domain) => domain.id === quest.domainId);
    return { ...quest, xp: xp.get(index) ?? 0 };
  });
  const pricedByDomain = new Map(pricedQuests.map((quest) => [quest.domainId, quest]));

  const engineXp = resolved.flatMap((entry, index) => (entry.archetype.role === 'engine' && entry.archetype.quest ? [xp.get(index) ?? 0] : []));
  const allCoreXp = [...xp.values()];
  // The smallest engine's worth of XP: the most any channel may earn beyond its own quest.
  const smallestEngineXp = engineXp.length > 0 ? Math.min(...engineXp) : allCoreXp.length > 0 ? Math.min(...allCoreXp) : MAX_CORE_XP;

  const pricedDomains = domains.map((domain, index): DomainDefinition => {
    const archetype = resolved[index]!.archetype;
    let cap: number;
    if (archetype.headroom === 'study') {
      const blockXp = Math.max(0, ...archetype.instruments.map((template) => (typeof template.params.blockXp === 'number' ? template.params.blockXp : 0)));
      cap = Math.min(3 * (blockXp || 25), smallestEngineXp);
    } else if (archetype.headroom === 'checklist') {
      const rowXp = Math.max(0, ...archetype.instruments.map((template) => (typeof template.params.xp === 'number' ? template.params.xp : 0)));
      cap = Math.min(rowXp || 20, smallestEngineXp);
    } else {
      const questXp = pricedByDomain.get(domain.id)?.xp ?? 0;
      cap = Math.min(Math.round(questXp * HEADROOM_MULTIPLE[archetype.headroom]), questXp + smallestEngineXp);
    }
    return { ...domain, channel: { ...domain.channel, cap } };
  });
  void questByDomain;

  const lengthDays = draft.arc.lengthDays;
  const progression: ProgressionSection = {
    dailyCoreBudget: DAILY_CORE_BUDGET, dailyCap: DAILY_CORE_BUDGET * 1.4, engineShare: ENGINE_SHARE,
    mvdXp: 35, recoveryXp: 40, bossXp: 500, weeklyQuestXp: 200,
    level: { base: 200, coefficient: coefficientFor(lengthDays), exponent: 0.98, roundTo: 10 },
    grace: { daysPer28: 4 },
    // A generated System's Reduced Mode collapses each quest to its floor (loop 8.8); the owner's does not.
    reducedMode: { triggerMisses: 2, exitDays: 2, collapsesQuests: true },
    attributeWindowDays: 28,
    checkpointDays: checkpointDaysFor(lengthDays),
    rankSchedule: rankScheduleFor(lengthDays),
  };
  return { domains: pricedDomains, quests: pricedQuests, progression, issues };
}
