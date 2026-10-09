// Which Blueprint is in force on a date (platform/02 §19.4, §21.1).
//
// A log with no BLUEPRINT_ACTIVATED event is the owner's: LEGACY_BLUEPRINT_V1
// over the arc the log recorded, implicitly — nothing is written, so rolling
// back means deploying the previous build. A log with explicit versions uses
// those, and prepends the implicit legacy v1 unless one of them IS version 1.
//
// H9, "invalid configuration can never become active": the writer validates
// before it appends, and this resolver re-validates on every replay and
// IGNORES (and reports) anything that fails, so a forged or damaged import
// cannot change what a past day meant.
import { applyEvents } from '../engine/reduce';
import { DEFAULT_CONFIG } from '../engine/config';
import type { SystemEvent } from '../engine/types';
import { isActivation } from './events';
import { legacyBlueprintFor } from './legacy/legacyV1';
import type { SystemBlueprint } from './schema';
import { validateBlueprint } from './validate';

export interface RejectedActivation {
  eventId: string;
  reason: string;
}

export interface ResolvedBlueprints {
  /** Sorted by activeFrom, strictly increasing. */
  versions: SystemBlueprint[];
  /** Explicit versions the log carries that were ignored, and why. */
  rejected: RejectedActivation[];
  /** True when versions[0] is the implicit legacy v1 rather than a logged document. */
  implicitGenesis: boolean;
}

/** The latest version whose activeFrom is on or before `localDate`; binary search over the sorted list. */
export function versionFor(versions: readonly SystemBlueprint[], localDate: string): SystemBlueprint | undefined {
  let low = 0;
  let high = versions.length - 1;
  let found: SystemBlueprint | undefined;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (versions[middle]!.activeFrom <= localDate) {
      found = versions[middle];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

function looksLikeBlueprint(value: unknown): value is SystemBlueprint {
  const candidate = value as Partial<SystemBlueprint> | null | undefined;
  return !!candidate && candidate.schema === 'system-blueprint/1' && typeof candidate.version === 'number' && typeof candidate.activeFrom === 'string'
    && Array.isArray(candidate.domains) && Array.isArray(candidate.quests) && Array.isArray(candidate.instruments) && !!candidate.progression && !!candidate.arc;
}

export function resolveBlueprints(events: readonly SystemEvent[]): ResolvedBlueprints {
  const rejected: RejectedActivation[] = [];
  const accepted: { blueprint: SystemBlueprint; event: SystemEvent }[] = [];
  const seenKeys = new Set<string>();

  for (const event of events) {
    if (!isActivation(event) || seenKeys.has(event.idem_key)) continue;
    seenKeys.add(event.idem_key);
    const blueprint = event.payload.blueprint;
    if (!looksLikeBlueprint(blueprint)) { rejected.push({ eventId: event.id, reason: 'The payload is not a Blueprint document.' }); continue; }
    if (blueprint.arcId !== event.arc_id) { rejected.push({ eventId: event.id, reason: 'The Blueprint belongs to a different arc.' }); continue; }
    // A later version must not rewrite the past; genesis may begin on the arc's own start date, which can precede the activation day.
    if (blueprint.version > 1 && blueprint.activeFrom < event.local_date) { rejected.push({ eventId: event.id, reason: 'The Blueprint is dated before the day it was activated.' }); continue; }
    // A forged or damaged document can be wrong in ways the validator never imagined; failing to validate is failing.
    let errors: string[];
    try {
      errors = validateBlueprint(blueprint, { today: event.local_date }).filter((issue) => issue.severity === 'error').map((issue) => issue.code);
    } catch {
      rejected.push({ eventId: event.id, reason: 'The Blueprint document is malformed.' });
      continue;
    }
    if (errors.length > 0) { rejected.push({ eventId: event.id, reason: `Invalid Blueprint: ${errors.join(', ')}` }); continue; }
    accepted.push({ blueprint, event });
  }

  // One version per start date and strictly increasing version numbers; the first activation to claim a slot keeps it.
  accepted.sort((a, b) => a.blueprint.activeFrom.localeCompare(b.blueprint.activeFrom) || a.blueprint.version - b.blueprint.version);
  const versions: SystemBlueprint[] = [];
  for (const { blueprint, event } of accepted) {
    const last = versions[versions.length - 1];
    if (last && last.activeFrom === blueprint.activeFrom) { rejected.push({ eventId: event.id, reason: 'Another version already starts on that date.' }); continue; }
    if (last && blueprint.version <= last.version) { rejected.push({ eventId: event.id, reason: 'Version numbers must increase.' }); continue; }
    versions.push(blueprint);
  }

  if (versions.some((blueprint) => blueprint.version === 1)) return { versions, rejected, implicitGenesis: false };

  const arc = applyEvents([...events], DEFAULT_CONFIG).arc;
  if (!arc) return { versions, rejected, implicitGenesis: false };
  const legacy = legacyBlueprintFor({
    id: arc.id, start_date: arc.start_date, end_date: arc.end_date, timezone: arc.timezone,
    day_boundary_hour: arc.day_boundary_hour, day_close_hour: arc.day_close_hour, main_quest_text: arc.main_quest_text, stake_text: arc.stake_text,
  });
  return { versions: [legacy, ...versions.filter((blueprint) => blueprint.activeFrom > legacy.activeFrom)], rejected, implicitGenesis: true };
}
