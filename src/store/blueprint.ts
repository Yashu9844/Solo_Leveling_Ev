// Activating a Blueprint version (platform/02 §19). This is the only writer:
// it validates the document and the transition before appending, so an
// invalid configuration cannot enter the log through the app; the resolver
// re-validates on replay for everything that arrives any other way.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { ActivationError, activationEvent, assertActivatable } from '../blueprint/activation';
import { canonicalJson } from '../blueprint/hash';
import { resolveBlueprints } from '../blueprint/resolve';
import type { SystemBlueprint } from '../blueprint/schema';
import { blueprintVersionRows, replaceBlueprintVersions } from '../db/blueprintProjection';
import { db } from '../db/db';
import { rebuildProjections } from '../db/projections';
import { appendEvent, getAllEvents } from '../db/events';
import type { EngineDeps } from '../engine/types';
import { getActiveArc } from './arc';
import { getEngineConfig } from './engineConfig';
import { refreshBlueprintVersions } from './systemBlueprint';

/** The versions in force for the active arc, plus any activations the log carries that were ignored. */
export async function getBlueprintVersions() {
  return resolveBlueprints(await getAllEvents());
}

/**
 * Appends BLUEPRINT_ACTIVATED for `next` and refreshes the version cache.
 * Throws ActivationError (changing nothing) when the document or the
 * transition is invalid. Re-activating a version already in the log is a no-op.
 */
export async function activateBlueprint(next: SystemBlueprint, today: string, deps: EngineDeps): Promise<void> {
  const arc = await getActiveArc();
  if (!arc) throw new Error('There is no active arc to activate a Blueprint for.');
  const events = await getAllEvents();
  const { versions } = resolveBlueprints(events);
  const previous = versions[versions.length - 1];
  // The same document again is a no-op; a different one under a taken number must not vanish silently behind the idem key.
  const existing = versions.find((version) => version.lineageId === next.lineageId && version.version === next.version);
  if (existing) {
    if (canonicalJson(existing) === canonicalJson(next)) return;
    throw new ActivationError(`Version ${next.version} already exists with different content.`);
  }
  const arcDay = differenceInCalendarDays(parseISO(today), parseISO(arc.start_date)) + 1;
  const nextCheckpointDay = (previous?.progression.checkpointDays ?? next.progression.checkpointDays).find((day) => day >= arcDay) ?? arcDay;

  // The owner's implicit legacy v1 is the predecessor of their first explicit version; it is never logged.
  await assertActivatable(next, previous, { today, arcDay, nextCheckpointDay, arcId: arc.id });

  const event = activationEvent(next, { id: deps.newId(), occurred_at: deps.now(), local_date: today });
  // Hash outside the transaction: awaiting WebCrypto inside it would commit it early.
  const rows = await blueprintVersionRows([...events, event]);
  await db.transaction('rw', [db.event, db.blueprint_version], async () => {
    await appendEvent(event);
    await replaceBlueprintVersions(rows);
  });
  // Under ENGINE_V2 every projection depends on the versions in force, so a new version re-derives them
  // (days before its start date come out identical - H2; the legacy engine ignores versions, so there it is a no-op).
  await rebuildProjections(getEngineConfig(), deps);
  await refreshBlueprintVersions();
}
