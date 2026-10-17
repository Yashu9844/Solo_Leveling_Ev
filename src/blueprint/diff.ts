// What changed between two versions of a System, in plain words (platform/03 §28.5). Pure. A line names the thing by the System's own
// designation or name, never by an id, and says the old and the new value. An unchanged System yields no lines.
import type { Criterion, DomainDefinition, GateCondition, QuestTemplateDef, SystemBlueprint } from './schema';

const leaves = (criterion: Criterion): number[] => (criterion.kind === 'signal' ? [criterion.target] : criterion.of.flatMap(leaves));
const joined = (values: readonly number[]): string => values.join(' · ');
const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function scheduleText(quest: QuestTemplateDef): string {
  return quest.schedule.kind === 'daily' ? 'every day' : quest.schedule.days.join(', ');
}

function domainLines(previous: SystemBlueprint, next: SystemBlueprint): string[] {
  const before = byId(previous.domains);
  const after = byId(next.domains);
  const out: string[] = [];
  for (const domain of next.domains) {
    const old = before.get(domain.id);
    if (!old) { out.push(`Added ${domain.designation} (${domain.name}).`); continue; }
    if (old.designation !== domain.designation) out.push(`${old.designation} is now called ${domain.designation}.`);
    if (old.name !== domain.name) out.push(`${domain.designation}: renamed from “${old.name}” to “${domain.name}”.`);
    if (old.priority !== domain.priority) out.push(`${domain.designation}: priority ${old.priority} → ${domain.priority}.`);
    if (!sameJson(old.presentation, domain.presentation)) out.push(`${domain.designation}: icon or colour changed.`);
    if (old.description !== domain.description) out.push(`${domain.designation}: description reworded.`);
    if (!sameJson(old.intention, domain.intention)) out.push(`${domain.designation}: reminders ${domain.intention?.allowed ? 'allowed' : 'not allowed'}.`);
  }
  for (const domain of previous.domains) if (!after.has(domain.id)) out.push(`Retired ${domain.designation} (${domain.name}). Its history stays.`);
  return out;
}

function questLines(previous: SystemBlueprint, next: SystemBlueprint): string[] {
  const before = byId(previous.quests);
  const designation = (domainId: string, fallback: string): string => next.domains.find((domain: DomainDefinition) => domain.id === domainId)?.designation ?? previous.domains.find((domain) => domain.id === domainId)?.designation ?? fallback;
  const out: string[] = [];
  for (const quest of next.quests) {
    const old = before.get(quest.id);
    const label = designation(quest.domainId, quest.designation);
    if (!old) { out.push(`New quest: ${quest.objective}`); continue; }
    if (!sameJson(old.criterion, quest.criterion)) out.push(`${label}: target ${joined(leaves(old.criterion))} → ${joined(leaves(quest.criterion))}.`);
    if (!sameJson(old.floor, quest.floor)) out.push(`${label}: hard-day floor ${joined(leaves(old.floor))} → ${joined(leaves(quest.floor))}.`);
    if (old.xp !== quest.xp) out.push(`${label}: weight ${old.xp} → ${quest.xp} XP.`);
    if (!sameJson(old.schedule, quest.schedule)) out.push(`${label}: now ${scheduleText(quest)}.`);
    if (!sameJson(old.timeWindow, quest.timeWindow)) out.push(`${label}: time window changed.`);
    if (old.objective !== quest.objective && sameJson(old.criterion, quest.criterion)) out.push(`${label}: objective reworded.`);
    if (old.designation !== quest.designation) out.push(`${old.designation} quest is now called ${quest.designation}.`);
    if (!sameJson(old.bonus, quest.bonus)) out.push(`${label}: bonus rules changed.`);
  }
  for (const quest of previous.quests) if (!next.quests.some((candidate) => candidate.id === quest.id)) out.push(`Removed quest: ${quest.objective}`);
  return out;
}

const clauseText = (condition: GateCondition): string => (condition.clauses && condition.clauses.length > 0 ? condition.clauses : [condition]).map((clause) => `${clause.comparator ?? ''} ${clause.threshold ?? ''}`.trim()).join(' / ');

function gateLines(previous: SystemBlueprint, next: SystemBlueprint): string[] {
  const out: string[] = [];
  for (const gate of next.gates) {
    const old = previous.gates.find((candidate) => candidate.rank === gate.rank);
    if (!old) { out.push(`New gate: rank ${gate.rank} on day ${gate.day}.`); continue; }
    if (old.day !== gate.day) out.push(`Rank ${gate.rank} gate moved from day ${old.day} to day ${gate.day}.`);
    const before = byId(old.conditions);
    for (const condition of gate.conditions) {
      const was = before.get(condition.id);
      if (!was) out.push(`Rank ${gate.rank} gate: new condition “${condition.label}”.`);
      else if (clauseText(was) !== clauseText(condition)) out.push(`Rank ${gate.rank} gate: “${condition.label}” ${clauseText(was)} → ${clauseText(condition)}.`);
    }
    for (const condition of old.conditions) if (!gate.conditions.some((candidate) => candidate.id === condition.id)) out.push(`Rank ${gate.rank} gate: “${condition.label}” removed.`);
  }
  for (const gate of previous.gates) if (!next.gates.some((candidate) => candidate.rank === gate.rank)) out.push(`Rank ${gate.rank} gate removed.`);
  return out;
}

function listLines(noun: string, before: readonly { id: string; title?: string; label?: string; name?: string }[], after: readonly { id: string; title?: string; label?: string; name?: string }[]): string[] {
  const nameOf = (item: { title?: string; label?: string; name?: string; id: string }): string => item.title ?? item.label ?? item.name ?? item.id;
  const out: string[] = [];
  const old = byId(before);
  const now = byId(after);
  for (const item of after) {
    const was = old.get(item.id);
    if (!was) out.push(`New ${noun}: ${nameOf(item)}.`);
    else if (nameOf(was) !== nameOf(item)) out.push(`${noun[0]!.toUpperCase()}${noun.slice(1)} “${nameOf(was)}” is now “${nameOf(item)}”.`);
  }
  for (const item of before) if (!now.has(item.id)) out.push(`Removed ${noun}: ${nameOf(item)}.`);
  return out;
}

/** One line per thing that changed. `previous` undefined is the genesis: nothing to compare. */
export function describeChange(previous: SystemBlueprint | undefined, next: SystemBlueprint): string[] {
  if (!previous) return ['The System was bound.'];
  const out: string[] = [
    ...domainLines(previous, next),
    ...questLines(previous, next),
    ...gateLines(previous, next),
    ...listLines('boss', previous.bosses, next.bosses),
    ...listLines('milestone', previous.milestones, next.milestones),
  ];

  const attributeBefore = byId(previous.attributes.defs);
  for (const def of next.attributes.defs) {
    const old = attributeBefore.get(def.id);
    if (!old) { out.push(`New attribute: ${def.name}.`); continue; }
    if (old.name !== def.name) out.push(`Attribute “${old.name}” is now “${def.name}”.`);
    const oldTerms = byId(old.terms);
    for (const term of def.terms) {
      const was = oldTerms.get(term.id);
      if (was && was.weight !== term.weight) out.push(`${def.name}: ${term.label} counts ${was.weight} → ${term.weight}.`);
    }
  }
  for (const def of previous.attributes.defs) if (!next.attributes.defs.some((candidate) => candidate.id === def.id)) out.push(`Removed attribute: ${def.name}.`);

  for (const tree of next.skills) {
    const old = previous.skills.find((candidate) => candidate.id === tree.id);
    if (!old) { out.push(`New skill tree: ${tree.name}.`); continue; }
    const added = tree.nodes.filter((node) => !old.nodes.some((candidate) => candidate.id === node.id));
    const removed = old.nodes.filter((node) => !tree.nodes.some((candidate) => candidate.id === node.id));
    if (added.length > 0) out.push(`${tree.name}: added ${added.map((node) => node.name).join(', ')}.`);
    if (removed.length > 0) out.push(`${tree.name}: removed ${removed.map((node) => node.name).join(', ')}.`);
  }

  for (const rule of next.rules) {
    const old = previous.rules.find((candidate) => candidate.id === rule.id);
    if (old && old.enabled !== rule.enabled) out.push(`The ${rule.id} rule is ${rule.enabled ? 'on' : 'off'}.`);
  }
  if (!sameJson(previous.reviews.domainPrompts, next.reviews.domainPrompts)) out.push('Review prompts reworded.');
  if (!sameJson(previous.checkpoints.selfEfficacy, next.checkpoints.selfEfficacy) || !sameJson(previous.checkpoints.enjoyment, next.checkpoints.enjoyment)) out.push('Checkpoint questions changed.');
  if (!sameJson(previous.vocabulary, next.vocabulary)) out.push('Vocabulary overrides changed.');
  if (previous.identity.displayName !== next.identity.displayName || previous.identity.primaryObjective !== next.identity.primaryObjective) out.push('Identity reworded.');

  return out.length > 0 ? out : ['Wording only; nothing that counts changed.'];
}

export interface Revision {
  version: number;
  activeFrom: string;
  /** Arc day the version takes effect (1-based); 0 for the genesis. */
  day: number;
  changeClass: SystemBlueprint['changeClass'];
  lines: string[];
  state: 'ACTIVE' | 'SUPERSEDED' | 'SCHEDULED';
}

const dayNumber = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** The timeline of an arc's versions, oldest first, each with its diff against the one before and where it stands as of `today`. */
export function revisionTimeline(versions: readonly SystemBlueprint[], today: string): Revision[] {
  const inForce = [...versions].filter((version) => version.activeFrom <= today).pop();
  return versions.map((version, index) => ({
    version: version.version,
    activeFrom: version.activeFrom,
    day: index === 0 ? 0 : dayNumber(versions[0]!.arc.startDate, version.activeFrom),
    changeClass: version.changeClass,
    lines: describeChange(versions[index - 1], version),
    state: version.activeFrom > today ? 'SCHEDULED' : version === inForce ? 'ACTIVE' : 'SUPERSEDED',
  }));
}
