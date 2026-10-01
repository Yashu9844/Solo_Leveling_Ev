import type { SystemBlueprint } from './schema';

/** Stable JSON for documents, hashes and reproducible exports. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

export interface BlueprintPartitions { computational: unknown; presentation: unknown }

/**
 * Explicit partition: all engine-readable definitions are computational;
 * wording and visual affordances are presentation. Keeping this in one place
 * makes the cosmetic-version invariant testable before an engine consumes it.
 */
export function partitionBlueprint(blueprint: SystemBlueprint): BlueprintPartitions {
  const { identity, arc, domains, instruments, quests, metrics, skills, attributes, milestones, gates, bosses, checkpoints, achievements, reviews, rules, messaging, vocabulary, ...metadata } = blueprint;
  return {
    computational: {
      ...metadata,
      arc: { lengthDays: arc.lengthDays, startDate: arc.startDate, endDate: arc.endDate, timezone: arc.timezone, dayBoundaryHour: arc.dayBoundaryHour, dayCloseHour: arc.dayCloseHour, wakeTime: arc.wakeTime, sleepTime: arc.sleepTime },
      progression: blueprint.progression,
      domains: domains.map(({ name, designation, description, presentation, evidenceSurface, ...domain }) => domain),
      instruments: instruments.map(({ label, logVerb, ...instrument }) => instrument),
      quests: quests.map(({ designation, realityLabel, objective, ...quest }) => quest), metrics, skills: skills.map(({ name, designation, nodes, ...skill }) => ({ ...skill, nodes: nodes.map(({ name: _name, tier: _tier, ...node }) => node) })),
      attributes: { groups: attributes.groups.map(({ heading, tagline, icon, ...group }) => group), defs: attributes.defs.map(({ name, description, terms, ...definition }) => ({ ...definition, terms: terms.map(({ label, ...term }) => term) })) },
      milestones: milestones.map(({ label, condition }) => ({ condition })), gates: gates.map(({ conditions, rank, day }) => ({ rank, day, conditions: conditions.map(({ label, ...condition }) => condition) })),
      bosses: bosses.map(({ title, ...boss }) => boss), checkpoints: { selfEfficacy: checkpoints.selfEfficacy.map(({ id }) => ({ id })), automaticity: checkpoints.automaticity.map(({ id }) => ({ id })), enjoyment: checkpoints.enjoyment.map(({ id, domainId }) => ({ id, domainId })) },
      achievements: achievements.map(({ label, ...achievement }) => achievement), reviews: { domainPrompts: reviews.domainPrompts.map(({ prompt, options, ...review }) => review) }, rules,
      messaging: { evidenceTemplates: messaging.evidenceTemplates.map(({ template, ...message }) => message) },
    },
    presentation: { identity, domains: domains.map(({ id, name, designation, description, presentation, evidenceSurface }) => ({ id, name, designation, description, presentation, evidenceSurface })), instruments: instruments.map(({ id, label, logVerb }) => ({ id, label, logVerb })), quests: quests.map(({ id, designation, realityLabel, objective }) => ({ id, designation, realityLabel, objective })), skills: skills.map(({ id, name, designation, nodes }) => ({ id, name, designation, nodes })), attributes, milestones: milestones.map(({ id, label }) => ({ id, label })), gates: gates.map(({ rank, day, conditions }) => ({ rank, day, conditions: conditions.map(({ id, label }) => ({ id, label })) })), bosses: bosses.map(({ id, title }) => ({ id, title })), checkpoints, achievements: achievements.map(({ id, label }) => ({ id, label })), reviews, messaging, vocabulary },
  };
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashesFor(blueprint: SystemBlueprint): Promise<{ computationalHash: string; presentationHash: string }> {
  const partitions = partitionBlueprint(blueprint);
  return { computationalHash: await sha256(canonicalJson(partitions.computational)), presentationHash: await sha256(canonicalJson(partitions.presentation)) };
}
