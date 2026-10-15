import type { SystemBlueprint } from './schema';

/** Stable JSON for documents, hashes and reproducible exports. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

export interface BlueprintPartitions { computational: unknown; presentation: unknown }

function omit<T extends object>(value: T, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !keys.includes(key)));
}

/**
 * Explicit partition: all engine-readable definitions are computational;
 * wording and visual affordances are presentation. Keeping this in one place
 * makes the cosmetic-version invariant testable before an engine consumes it.
 */
export function partitionBlueprint(blueprint: SystemBlueprint): BlueprintPartitions {
  const { identity, arc, domains, instruments, quests, metrics, skills, attributes, milestones, gates, bosses, checkpoints, achievements, reviews, rules, messaging, vocabulary } = blueprint;
  const reality = blueprint.reality ?? [];
  return {
    computational: {
      schema: blueprint.schema, lineageId: blueprint.lineageId, arcId: blueprint.arcId,
      arc: { lengthDays: arc.lengthDays, startDate: arc.startDate, endDate: arc.endDate, timezone: arc.timezone, dayBoundaryHour: arc.dayBoundaryHour, dayCloseHour: arc.dayCloseHour, wakeTime: arc.wakeTime, sleepTime: arc.sleepTime },
      progression: blueprint.progression,
      domains: domains.map((domain) => omit(domain, ['name', 'designation', 'description', 'presentation', 'evidenceSurface'])),
      instruments: instruments.map((instrument) => omit(instrument, ['label', 'logVerb'])),
      quests: quests.map((quest) => omit(quest, ['designation', 'realityLabel', 'objective'])), metrics,
      skills: skills.map((skill) => ({ ...omit(skill, ['name', 'designation', 'nodes']), nodes: skill.nodes.map((node) => omit(node, ['name', 'tier'])) })),
      attributes: { groups: attributes.groups.map((group) => omit(group, ['heading', 'tagline', 'icon'])), defs: attributes.defs.map((definition) => ({ ...omit(definition, ['name', 'description', 'terms']), terms: definition.terms.map((term) => omit(term, ['label'])) })) },
      milestones: milestones.map((milestone) => ({ condition: milestone.condition })), gates: gates.map(({ conditions, rank, day }) => ({ rank, day, conditions: conditions.map((condition) => omit(condition, ['label'])) })),
      bosses: bosses.map((boss) => omit(boss, ['title'])), checkpoints: { selfEfficacy: checkpoints.selfEfficacy.map(({ id }) => ({ id })), automaticity: checkpoints.automaticity.map(({ id }) => ({ id })), enjoyment: checkpoints.enjoyment.map(({ id, domainId }) => ({ id, domainId })), evidence: checkpoints.evidence ?? [], comparison: (checkpoints.comparison ?? []).map((row) => omit(row, ['label'])) },
      achievements: achievements.map((achievement) => omit(achievement, ['label'])), reviews: { domainPrompts: reviews.domainPrompts.map((review) => omit(review, ['prompt', 'options'])), weeklyMetrics: (reviews.weeklyMetrics ?? []).map((row) => omit(row, ['label'])) }, rules,
      messaging: { evidenceTemplates: messaging.evidenceTemplates.map((message) => omit(message, ['template'])) },
      reality: reality.map((row) => omit(row, ['label', 'display'])),
    },
    presentation: { identity, domains: domains.map(({ id, name, designation, description, presentation, evidenceSurface }) => ({ id, name, designation, description, presentation, evidenceSurface })), instruments: instruments.map(({ id, label, logVerb }) => ({ id, label, logVerb })), quests: quests.map(({ id, designation, realityLabel, objective }) => ({ id, designation, realityLabel, objective })), skills: skills.map(({ id, name, designation, nodes }) => ({ id, name, designation, nodes })), attributes, milestones: milestones.map(({ id, label }) => ({ id, label })), gates: gates.map(({ rank, day, conditions }) => ({ rank, day, conditions: conditions.map(({ id, label }) => ({ id, label })) })), bosses: bosses.map(({ id, title }) => ({ id, title })), checkpoints: { selfEfficacy: checkpoints.selfEfficacy, automaticity: checkpoints.automaticity, enjoyment: checkpoints.enjoyment }, achievements: achievements.map(({ id, label }) => ({ id, label })), reviews: { domainPrompts: reviews.domainPrompts, weeklyMetrics: (reviews.weeklyMetrics ?? []).map(({ key, label }) => ({ key, label })) }, messaging, vocabulary, reality: reality.map(({ key, label, display }) => ({ key, label, display })), origin: blueprint.origin, comparison: (checkpoints.comparison ?? []).map(({ id, label }) => ({ id, label })) },
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
