// generateBlueprint: S1-S14 end to end (platform/03 §29). Pure and total - same draft and library, same
// Blueprint; every draft yields one, with the issues the validator found beside it, never an exception.
//
// The two hashes a Blueprint carries (computational, presentation) are the activation path's business
// (blueprint/hash.ts, async by WebCrypto); the generator is synchronous and records only a digest of the
// answers - never the answers themselves, which can hold health, finance and relationship detail.
import { canonicalJson } from '../blueprint/hash';
import type { SystemBlueprint } from '../blueprint/schema';
import { validateBlueprint, type Issue } from '../blueprint/validate';
import { ARCHETYPES } from '../library/archetypes';
import type { ArchetypeDef } from '../library/archetypes/types';
import { LIBRARY_VERSION } from '../library';
import { deriveSections, generateCore } from './pipeline';
import { domainContexts } from './derive';
import { buildAchievements, buildCheckpoints } from './s11Checkpoints';
import { buildMessaging, buildRules, buildReality, buildReviews } from './s12Reviews';
import { assignPresentation } from './s13Presentation';
import { shortHash } from './util';
import type { DraftState } from './types';

export const GENERATOR_ID = 'generator/1';

export interface GeneratedBlueprint {
  blueprint: SystemBlueprint;
  /** The generator's own notes, then the validator's findings; errors here mean the System cannot be activated as it stands. */
  issues: Issue[];
}

export function generateBlueprint(draft: DraftState, archetypes: Readonly<Record<string, ArchetypeDef>> = ARCHETYPES): GeneratedBlueprint {
  const core = generateCore(draft, archetypes);
  const sections = deriveSections(core);
  const contexts = domainContexts(core);
  const checkpoints = buildCheckpoints(contexts, sections.gates);
  const achievements = buildAchievements(contexts, core.progression, core.draft.arc.lengthDays);
  const reviews = buildReviews(contexts);
  const rules = buildRules(contexts, sections.skills.length > 0);
  const messaging = buildMessaging(contexts);
  const reality = buildReality(contexts);
  const domains = assignPresentation(core.domains);

  const answersDigest = shortHash(canonicalJson(draft)) + shortHash(canonicalJson(core.draft.domains));
  const blueprint: SystemBlueprint = {
    schema: 'system-blueprint/1', lineageId: core.draft.lineageId, version: 1, arcId: core.draft.lineageId, activeFrom: core.draft.arc.startDate, changeClass: 'genesis',
    provenance: { generator: GENERATOR_ID, libraryVersion: String(LIBRARY_VERSION), answersDigest },
    identity: core.draft.identity, arc: core.draft.arc, progression: core.progression,
    domains, instruments: core.instruments, quests: core.quests, metrics: sections.metrics, skills: sections.skills,
    attributes: sections.attributes, milestones: sections.milestones, gates: sections.gates, bosses: sections.bosses,
    checkpoints, achievements, reviews, rules, messaging, vocabulary: {}, reality,
  };

  // The validator is the last stage: whatever it finds is reported beside the System, never thrown.
  let found: Issue[];
  try {
    found = validateBlueprint(blueprint, { today: core.draft.today });
  } catch {
    found = [{ code: 'G-VAL-01', severity: 'error', path: '', system: 'THE SYSTEM COULD NOT BE CHECKED.', plain: 'Validation failed unexpectedly; the System was not activated.' }];
  }
  const issues = [...core.issues, ...sections.issues, ...found].filter((issue, index, all) => all.findIndex((other) => other.code === issue.code && other.path === issue.path) === index);
  return { blueprint, issues };
}
