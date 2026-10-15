// The generator (platform/03 §29): DraftState -> Blueprint, in stages. Loop 8.2 lands S1-S5 (normalize,
// archetypes, domains and instruments, quests, economy and progression); S6-S14 follow in 8.3-8.4, and
// `generateBlueprint` then assembles all of it. Pure and total: same draft + same library -> deep-equal
// output, and a draft the library cannot honour comes back with issues, never an exception.
import { ARCHETYPES } from '../library/archetypes';
import type { ArchetypeDef } from '../library/archetypes/types';
import { normalize } from './s1Normalize';
import { resolveArchetypes } from './s2Archetypes';
import { buildDomains } from './s3Domains';
import { buildQuests } from './s4Quests';
import { priceEconomy } from './s5Economy';
import type { CoreGeneration, DraftState } from './types';

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
