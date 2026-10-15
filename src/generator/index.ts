// The generator (platform/03 §29): DraftState -> Blueprint, in stages. Loop 8.2 landed S1-S5 (normalize,
// archetypes, domains and instruments, quests, economy and progression), 8.3 lands S6-S10 (metrics and
// milestones, skills, attributes, gates, bosses); S11-S14 follow in 8.4, and `generateBlueprint` then
// assembles all of it. Pure and total: same draft + same library -> deep-equal
// output, and a draft the library cannot honour comes back with issues, never an exception.
import { ARCHETYPES } from '../library/archetypes';
import type { ArchetypeDef } from '../library/archetypes/types';
import { normalize } from './s1Normalize';
import { resolveArchetypes } from './s2Archetypes';
import { buildDomains } from './s3Domains';
import { buildQuests } from './s4Quests';
import { priceEconomy } from './s5Economy';
import { buildLadders, buildMetrics, buildSkills } from './s6Metrics';
import { buildAttributes } from './s8Attributes';
import { buildGates } from './s9Gates';
import { buildBosses } from './s10Bosses';
import { domainContexts } from './derive';
import type { CoreGeneration, DerivedSections, DraftState } from './types';

export * from './types';

export function generateCore(draft: DraftState, archetypes: Readonly<Record<string, ArchetypeDef>> = ARCHETYPES): CoreGeneration {
  const { draft: normalized, issues: s1 } = normalize(draft);
  const { resolved, issues: s2 } = resolveArchetypes(normalized, archetypes);
  const { built, issues: s3 } = buildDomains(normalized, resolved);
  const { quests, issues: s4 } = buildQuests(resolved, built.domains, built, built.instruments);
  const priced = priceEconomy(normalized, resolved, built.domains, quests);
  return {
    draft: normalized, resolved, domains: priced.domains, instruments: built.instruments, quests: priced.quests, progression: priced.progression,
    issues: [...s1, ...s2, ...s3, ...s4, ...priced.issues],
  };
}

/** S6-S10: the sections derived from the core. */
export function deriveSections(core: CoreGeneration): DerivedSections {
  const contexts = domainContexts(core);
  const metrics = buildMetrics(contexts);
  const { milestones: ladders, thresholds } = buildLadders(contexts);
  const { skills, issues } = buildSkills(contexts);
  const attributes = buildAttributes(contexts, core.quests);
  const { bosses, milestones: anchors } = buildBosses(contexts, thresholds, core.progression, core.draft.arc.lengthDays);
  const gates = buildGates(contexts, core.quests, thresholds, core.progression, bosses.length);
  return { metrics, milestones: [...ladders, ...anchors], skills, attributes, gates, bosses, issues };
}
