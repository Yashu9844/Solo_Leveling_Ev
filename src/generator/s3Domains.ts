// S3 domains + instruments: ids are slug(archetype, topic) plus a short stable hash of the lineage -
// deterministic, never random. The person's answers adapt the archetype's instrument parameters
// (their wake time, their topics, their limit); nothing else about an instrument is theirs to set here.
import type { DomainDefinition, InstrumentConfig, InstrumentParams } from '../blueprint/schema';
import type { Issue } from '../blueprint/validate';
import { isValidDesignation } from '../library/lexicon';
import type { InstrumentTemplate } from '../library/archetypes/types';
import { generatorIssue, type BuiltDomains, type NormalizedDraft, type ResolvedDomain } from './types';
import { shortHash, slug } from './util';

/** The archetype's default parameters, adapted by what the person said. */
function paramsFor(template: InstrumentTemplate, resolved: ResolvedDomain, draft: NormalizedDraft): InstrumentParams {
  const params: InstrumentParams = structuredClone(template.params);
  const { answers } = resolved;
  if (template.type === 'time_window') params.targetTime = draft.rhythm.wakeTime;
  if (template.type === 'threshold' && answers.limit !== undefined && Number.isFinite(answers.limit) && answers.limit > 0) {
    params.target = Math.round(answers.limit);
    if (typeof params.defaultValue === 'number') params.defaultValue = Math.max(1, Math.round(answers.limit * 0.75));
  }
  if ((template.type === 'practice_item' || template.type === 'study_block') && answers.topics && answers.topics.length > 0) {
    params.topics = [...new Set(answers.topics.map((topic) => topic.trim()).filter(Boolean))];
  }
  return params;
}

export function buildDomains(draft: NormalizedDraft, resolved: ResolvedDomain[]): { built: BuiltDomains; issues: Issue[] } {
  const issues: Issue[] = [];
  const domains: DomainDefinition[] = [];
  const instruments: InstrumentConfig[] = [];
  const instrumentIds: Record<string, Record<string, string>> = {};
  const usedIds = new Set<string>();
  const usedDesignations = new Set<string>();
  const usedChannels = new Set<string>();

  for (const entry of resolved) {
    const { archetype, answers } = entry;

    // id: slug(archetype, topic) + a short hash of the lineage; a second domain of the same kind is numbered.
    const base = slug(answers.topic ? `${archetype.id}-${answers.topic}` : archetype.id);
    let candidate = base;
    for (let n = 2; usedIds.has(candidate); n++) candidate = `${base}-${n}`;
    usedIds.add(candidate);
    const id = `${candidate}-${shortHash(`${draft.lineageId}|${candidate}`)}`;

    // designation: the person's own if it is valid and free, else the first of the archetype's offers still free.
    const wanted = answers.designation?.trim().toUpperCase();
    let designation = wanted && isValidDesignation(wanted) && !usedDesignations.has(wanted) ? wanted : undefined;
    if (wanted && !designation) {
      issues.push(generatorIssue('G-DOM-02', 'warning', `domains.${id}.designation`, 'THAT DESIGNATION IS NOT AVAILABLE.', `"${wanted}" is a System word, too long, or already used; an offered one was chosen instead.`));
    }
    designation ??= archetype.designations.find((offer) => !usedDesignations.has(offer));
    if (!designation) {
      let numeral = 2;
      const stem = archetype.designations[0]!;
      while (usedDesignations.has(`${stem} ${numeral}`)) numeral++;
      designation = `${stem} ${numeral}`.slice(0, 18);
    }
    usedDesignations.add(designation);

    // channel: the archetype's, numbered if another domain already took it.
    let channel = archetype.channel;
    for (let n = 2; usedChannels.has(channel); n++) channel = `${archetype.channel}${n}`;
    usedChannels.add(channel);

    const ids: Record<string, string> = {};
    for (const template of archetype.instruments) {
      const instrumentId = `${id}.${template.key}`;
      ids[template.key] = instrumentId;
      instruments.push({
        id: instrumentId, domainId: id, type: template.type, label: template.label, logVerb: template.logVerb,
        params: paramsFor(template, entry, draft), controllability: 'effort', eventBinding: { kind: 'generic' },
      });
    }
    instrumentIds[id] = ids;

    const name = answers.topic ? `${archetype.name}: ${answers.topic}` : archetype.name;
    domains.push({
      id, archetypeId: archetype.id, role: archetype.role, name, designation, description: archetype.description, priority: entry.priority,
      presentation: { ...archetype.presentation }, instrumentIds: Object.values(ids),
      ...(archetype.quest ? { coreQuestId: `${id}.core` } : {}),
      channel: { id: channel, cap: 0 },
      intention: { allowed: archetype.intention === true },
      reviewPromptIds: [],
      ...(archetype.evidenceSurface ? { evidenceSurface: archetype.evidenceSurface } : {}),
    });
  }
  return { built: { domains, instruments, instrumentIds }, issues };
}
