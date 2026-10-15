// S2 resolve archetypes: each choice becomes an archetype and a priority. An id the library does not
// know is reported and skipped - the generator is total.
import type { Issue } from '../blueprint/validate';
import { ARCHETYPES } from '../library/archetypes';
import { customArchetype } from '../library/archetypes/custom';
import type { ArchetypeDef } from '../library/archetypes/types';
import { generatorIssue, type NormalizedDraft, type ResolvedDomain } from './types';

export function resolveArchetypes(draft: NormalizedDraft, archetypes: Readonly<Record<string, ArchetypeDef>> = ARCHETYPES): { resolved: ResolvedDomain[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const roleCounts: Record<string, number> = {};
  const resolved: ResolvedDomain[] = [];
  draft.domains.forEach((choice, index) => {
    const archetype = archetypes[choice.archetypeId] ?? customArchetype(choice.archetypeId);
    if (!archetype) {
      issues.push(generatorIssue('G-ARCH-01', 'error', `domains.${index}`, 'THE SYSTEM DOES NOT KNOW THAT KIND OF DOMAIN.', `"${choice.archetypeId}" is not in the library, so it was left out.`));
      return;
    }
    const rolePosition = roleCounts[archetype.role] ?? 0;
    roleCounts[archetype.role] = rolePosition + 1;
    resolved.push({ archetype, answers: choice.answers, priority: resolved.length + 1, rolePosition });
  });
  return { resolved, issues };
}
