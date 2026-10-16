// Pinning (platform/03 §28.3). A person who adjusts a field on the Reveal has made a decision, and a later change to the interview must
// not undo it: re-generation after "Change" keeps every pinned value and lets only the unpinned ones move. A pin is a value on a domain
// (its good day, its hard day, its designation) or on the arc (its length), keyed by what the domain IS - its archetype and, for a thing of
// their own, its name - not by a generated id, so it still finds its domain after the Blueprint is built again.
import type { DomainChoice, DraftState } from '../generator/types';
import { isCustomArchetypeId } from '../library/archetypes/custom';
import { ARCHETYPES } from '../library/archetypes';
import { customArchetype } from '../library/archetypes/custom';
import { defaultGoodDay, measureBounds } from './content';

export type PinField = 'goodDay' | 'hardDay' | 'designation';

export interface Pins {
  /** Arc length in days. */
  arcLength?: number;
  domains: Record<string, Partial<Record<PinField, number | string>>>;
}

export const NO_PINS: Pins = { domains: {} };

/** The stable identity of a domain across re-generation. */
export function domainKey(archetypeId: string, name?: string): string {
  return isCustomArchetypeId(archetypeId) && name ? `${archetypeId}:${name.trim().toLowerCase()}` : archetypeId;
}

const choiceKey = (choice: DomainChoice): string => domainKey(choice.archetypeId, choice.answers?.topic);

/** The draft paths a set of pins covers, as the generator's `pinned` lists them. */
export function pinnedPaths(pins: Pins): string[] {
  const paths = pins.arcLength !== undefined ? ['arc.lengthDays'] : [];
  for (const [key, fields] of Object.entries(pins.domains)) for (const field of Object.keys(fields)) paths.push(`domain:${key}.${field}`);
  return paths.sort();
}

export const hasPins = (pins: Pins): boolean => pinnedPaths(pins).length > 0;

/** A pin set with one more value, or one fewer (`undefined` unpins). Pure. */
export function withPin(pins: Pins, key: string, field: PinField, value: number | string | undefined): Pins {
  const fields = { ...pins.domains[key] };
  if (value === undefined) delete fields[field];
  else fields[field] = value;
  const domains = { ...pins.domains };
  if (Object.keys(fields).length === 0) delete domains[key];
  else domains[key] = fields;
  return { ...pins, domains };
}

export function withArcLength(pins: Pins, days: number | undefined): Pins {
  const { arcLength: _previous, ...rest } = pins;
  void _previous;
  return days === undefined ? rest : { ...rest, arcLength: Math.min(365, Math.max(60, Math.round(days))) };
}

/** A pinned number brought inside what the question allows for that kind of work. */
export function clampPin(archetypeId: string, value: number): number {
  const bounds = measureBounds(archetypeId);
  if (!bounds) return Math.max(1, Math.round(value));
  const stepped = bounds.min + Math.round((Math.min(bounds.max, Math.max(bounds.min, value)) - bounds.min) / bounds.step) * bounds.step;
  return Math.min(bounds.max, Math.max(bounds.min, stepped));
}

/**
 * The draft with every pin laid over it. Pinned values never change; unpinned ones move to stay coherent with them
 * (a hard day is never above the good day beside it). A pin whose domain is no longer in the draft is simply not applied.
 */
export function applyPins(draft: DraftState, pins: Pins): DraftState {
  const domains = draft.domains.map((choice): DomainChoice => {
    const fields = pins.domains[choiceKey(choice)];
    if (!fields) return choice;
    const answers = { ...choice.answers };
    if (typeof fields.goodDay === 'number') answers.goodDay = clampPin(choice.archetypeId, fields.goodDay);
    if (typeof fields.hardDay === 'number') answers.hardDay = clampPin(choice.archetypeId, fields.hardDay);
    if (typeof fields.designation === 'string') answers.designation = fields.designation;
    const good = answers.goodDay;
    const hard = answers.hardDay;
    if (good !== undefined && hard !== undefined && hard > good) {
      // Both pinned and incoherent is refused when the pin is made; here the one that is not pinned gives way.
      if (typeof fields.hardDay === 'number' && typeof fields.goodDay !== 'number') answers.goodDay = hard;
      else answers.hardDay = good;
    }
    return { ...choice, answers };
  });
  const arc = pins.arcLength === undefined ? draft.arc : { ...draft.arc, lengthDays: Math.min(365, Math.max(60, Math.round(pins.arcLength))) };
  return { ...draft, domains, arc, pinned: pinnedPaths(pins) };
}

/** What the Reveal lets a person adjust on a domain, and where it stands now. A held domain (a limit, a rhythm) has a designation to choose and no numbers. */
export interface Adjustable {
  key: string;
  archetypeId: string;
  designations: readonly string[];
  bounds?: { noun: string; min: number; max: number; step: number };
  goodDay?: number;
  hardDay?: number;
}

export function adjustables(draft: DraftState): Adjustable[] {
  return draft.domains.map((choice): Adjustable => {
    const archetype = ARCHETYPES[choice.archetypeId] ?? customArchetype(choice.archetypeId, { guardrail: choice.answers?.guardrail === true });
    const bounds = measureBounds(choice.archetypeId);
    const pushed = bounds !== undefined && archetype?.role !== 'guardrail' && choice.answers?.guardrail !== true;
    const goodDay = pushed ? (choice.answers?.goodDay ?? defaultGoodDay(choice.archetypeId)) : undefined;
    const hardDay = goodDay !== undefined ? (choice.answers?.hardDay ?? Math.max(1, Math.round(goodDay / 3))) : undefined;
    return { key: choiceKey(choice), archetypeId: choice.archetypeId, designations: archetype?.designations ?? [], ...(pushed ? { bounds } : {}), goodDay, hardDay };
  });
}
