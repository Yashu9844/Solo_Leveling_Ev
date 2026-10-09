// The gate every Blueprint passes before it can become active (platform/02
// §19.1, invariant H9): the document must validate, the transition from the
// version in force must be legal, and the arc must be the right one. Pure and
// async only because the change-class check hashes documents.
import type { SystemEvent } from '../engine/types';
import { activationIdemKey, type BlueprintActivatedPayload } from './events';
import type { SystemBlueprint } from './schema';
import { validateBlueprint, validateTransition, type Issue } from './validate';

export class ActivationError extends Error {
  readonly issues: Issue[];
  constructor(message: string, issues: Issue[] = []) {
    super(message);
    this.name = 'ActivationError';
    this.issues = issues;
  }
}

export interface ActivationContext {
  /** The local date the activation is happening on. */
  today: string;
  /** 1-based arc day of `today`. */
  arcDay: number;
  /** The day number of the next checkpoint (for the structural-change rule). */
  nextCheckpointDay: number;
  arcId: string;
}

/** Throws ActivationError, carrying every blocking issue, unless `next` may become active after `previous`. */
export async function assertActivatable(next: SystemBlueprint, previous: SystemBlueprint | undefined, context: ActivationContext): Promise<void> {
  if (next.arcId !== context.arcId) throw new ActivationError('This Blueprint belongs to a different arc.');
  if (previous) {
    if (next.lineageId !== previous.lineageId) throw new ActivationError('A new version must continue the same lineage.');
    if (next.version !== previous.version + 1) throw new ActivationError(`Expected version ${previous.version + 1}, got ${next.version}.`);
  } else if (next.version !== 1) {
    throw new ActivationError('The first Blueprint of an arc must be version 1.');
  }
  const blocking = [
    ...validateBlueprint(next, { today: context.today }),
    ...(previous ? await validateTransition(previous, next, { today: context.today, arcDay: context.arcDay, nextCheckpointDay: context.nextCheckpointDay }) : []),
  ].filter((issue) => issue.severity === 'error');
  if (blocking.length > 0) throw new ActivationError(`The Blueprint cannot become active: ${blocking.map((issue) => issue.code).join(', ')}.`, blocking);
}

/** The event that carries a Blueprint into the log. */
export function activationEvent(next: SystemBlueprint, draft: Pick<SystemEvent, 'id' | 'occurred_at' | 'local_date'>): SystemEvent<BlueprintActivatedPayload> {
  return {
    id: draft.id,
    type: 'BLUEPRINT_ACTIVATED',
    occurred_at: draft.occurred_at,
    local_date: draft.local_date,
    arc_id: next.arcId,
    payload: { blueprint: next },
    source: 'user',
    idem_key: activationIdemKey(next),
    schema_v: 1,
  };
}
