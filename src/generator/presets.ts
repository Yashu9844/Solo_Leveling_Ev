// From a preset, or from the areas a Quick interview chose, to a DraftState (platform/03 §23.4, §25.4). This is the
// Quick tier's whole generator input: the same Blueprint sections as any other tier, with defaults for what was not asked.
import { ARCHETYPES } from '../library/archetypes';
import { DEFAULT_ENGINES, DEFAULT_GUARDRAIL_ARCHETYPES, AREAS, presetById, type PresetDef } from '../library/presets';
import type { DomainChoice, DraftState } from './types';

export interface DraftContext {
  lineageId: string;
  today: string;
  displayName: string;
  primaryObjective: string;
  timezone: string;
  startDate?: string;
  lengthDays?: number;
  rhythm?: { wakeTime?: string; sleepTime?: string };
  priorityMode?: 'ranked' | 'equal';
}

const MAX_CORE = 8;

function baseDraft(context: DraftContext, domains: DomainChoice[], lengthDays: number): DraftState {
  return {
    lineageId: context.lineageId, today: context.today,
    identity: { displayName: context.displayName, primaryObjective: context.primaryObjective },
    domains, priorityMode: context.priorityMode ?? 'ranked', rhythm: context.rhythm,
    arc: { startDate: context.startDate ?? context.today, lengthDays: context.lengthDays ?? lengthDays, timezone: context.timezone },
  };
}

/** Engines and guardrails beside them, never fewer than two engines or more than eight core domains. */
export function withGuardrails(domains: DomainChoice[], guardrails: readonly string[]): DomainChoice[] {
  const present = new Set(domains.map((choice) => choice.archetypeId));
  const isGuardrail = (id: string) => ARCHETYPES[id]?.role === 'guardrail';
  const chosen = [...domains];
  for (const guardrail of guardrails) if (!present.has(guardrail)) chosen.push({ archetypeId: guardrail });
  // Fewer than two engines cannot carry a System: offer the defaults, in order, that are not already in.
  let engines = chosen.filter((choice) => !isGuardrail(choice.archetypeId)).length;
  for (const fallback of DEFAULT_ENGINES) {
    if (engines >= 2) break;
    if (chosen.some((choice) => choice.archetypeId === fallback)) continue;
    chosen.unshift({ archetypeId: fallback });
    engines++;
  }
  // More than eight core domains cannot be priced: the lowest-priority engines give way, guardrails stay.
  while (chosen.length > MAX_CORE) {
    let index = -1;
    for (let i = chosen.length - 1; i >= 0; i--) if (!isGuardrail(chosen[i]!.archetypeId)) { index = i; break; }
    if (index < 0) break;
    chosen.splice(index, 1);
  }
  return chosen;
}

/** A preset's draft; 'exam' presets take their length from the context (default 90). */
export function draftFromPreset(presetId: string, context: DraftContext): DraftState | undefined {
  const preset: PresetDef | undefined = presetById(presetId);
  if (!preset) return undefined;
  const domains = withGuardrails(preset.domains.map((domain) => ({ archetypeId: domain.archetypeId, ...(domain.answers ? { answers: { ...domain.answers } } : {}) })), preset.guardrails);
  return baseDraft(context, domains, preset.lengthDays === 'exam' ? 90 : preset.lengthDays);
}

/** The Quick tier: the areas the person picked, in the order they ranked them. A custom area needs an action, so it is not Quick. */
export function draftFromAreas(areaIds: readonly string[], context: DraftContext): DraftState {
  const seen = new Set<string>();
  const domains: DomainChoice[] = [];
  for (const id of areaIds) {
    const archetypeId = AREAS.find((area) => area.id === id)?.archetypeId;
    if (!archetypeId || seen.has(archetypeId)) continue;
    seen.add(archetypeId);
    domains.push({ archetypeId });
  }
  return baseDraft(context, withGuardrails(domains, DEFAULT_GUARDRAIL_ARCHETYPES), 120);
}
