// blueprint_version: the cache of BLUEPRINT_ACTIVATED events (platform/02
// §43.1). Like every projection it is derivable from the log alone, so a
// rebuild or an import can always recreate it, and verifyIntegrity diffs it.
// The owner's implicit legacy v1 is never a row ("no rows written for
// migration"), so an arc without explicit versions has none.
//
// Deliberately NOT part of rebuildProjections: that function runs inside the
// transaction of nearly every store write, and none of those transactions
// list this table. Versions change only at activation and at import, so the
// cache is refreshed exactly there.
import { hashesFor } from '../blueprint/hash';
import { resolveBlueprints } from '../blueprint/resolve';
import { isActivation } from '../blueprint/events';
import type { SystemEvent } from '../engine/types';
import { db } from './db';
import type { BlueprintVersionRow } from './schema';

/** The rows the log implies: one per accepted explicit version, in version order. */
export async function blueprintVersionRows(events: readonly SystemEvent[]): Promise<BlueprintVersionRow[]> {
  const { versions } = resolveBlueprints(events);
  const eventByKey = new Map(events.filter(isActivation).map((event) => [`${event.payload.blueprint.lineageId}@${event.payload.blueprint.version}`, event]));
  const rows: BlueprintVersionRow[] = [];
  for (const blueprint of versions) {
    const id = `${blueprint.lineageId}@${blueprint.version}`;
    const event = eventByKey.get(id);
    if (!event) continue; // the implicit legacy genesis has no event and no row
    const { computationalHash, presentationHash } = await hashesFor(blueprint);
    rows.push({
      id, lineage_id: blueprint.lineageId, arc_id: blueprint.arcId, version: blueprint.version, active_from: blueprint.activeFrom,
      change_class: blueprint.changeClass, computational_hash: computationalHash, presentation_hash: presentationHash, event_id: event.id, blueprint,
    });
  }
  return rows;
}

/**
 * Replaces the cache with `rows`. Call inside a transaction that includes
 * db.blueprint_version. Compute the rows FIRST (blueprintVersionRows hashes with
 * WebCrypto, and awaiting a non-IndexedDB promise inside a transaction commits it).
 */
export async function replaceBlueprintVersions(rows: readonly BlueprintVersionRow[]): Promise<void> {
  await db.blueprint_version.clear();
  if (rows.length > 0) await db.blueprint_version.bulkAdd([...rows]);
}
