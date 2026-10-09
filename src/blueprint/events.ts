// The BLUEPRINT_ACTIVATED event (platform/02 §19, §43.2): the only way a
// System Blueprint version enters the log. The payload is the full document,
// so a log alone — an export — reproduces every version a person ever lived
// under, with no side table to lose.
import type { SystemEvent } from '../engine/types';
import type { SystemBlueprint } from './schema';

export interface BlueprintActivatedPayload extends Record<string, unknown> {
  blueprint: SystemBlueprint;
}

/** One activation per (lineage, version): replaying or re-sending it is a no-op. */
export function activationIdemKey(blueprint: Pick<SystemBlueprint, 'lineageId' | 'version'>): string {
  return `blueprint:${blueprint.lineageId}:${blueprint.version}`;
}

export function isActivation(event: SystemEvent): event is SystemEvent<BlueprintActivatedPayload> {
  return event.type === 'BLUEPRINT_ACTIVATED';
}
