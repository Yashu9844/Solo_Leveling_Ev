// The Blueprint versions in force for the active arc, held for the UI
// (platform/05 loop 7.1) the way store/engineConfig.ts holds the engine config:
// loaded once when the arc is resolved, refreshed whenever a version is
// activated, and read at render time with useBlueprintVersions() or at call
// time with getBlueprintVersionsSnapshot().
//
// Only the events the resolver reads (ARC_* and BLUEPRINT_ACTIVATED) are loaded,
// so this stays cheap on a log of thousands of events. With no arc, or if the
// log cannot be read, the owner's System (LEGACY_BLUEPRINT_V1) stands in - the
// same fallback the engine config makes to DEFAULT_CONFIG.
import { create } from 'zustand';
import { LEGACY_BLUEPRINT_V1 } from '../blueprint/legacy/legacyV1';
import { resolveBlueprints } from '../blueprint/resolve';
import type { SystemBlueprint } from '../blueprint/schema';
import { db } from '../db/db';
import type { SystemEvent } from '../engine/types';
import { getActiveArc } from './arc';

interface BlueprintVersionsStore {
  versions: readonly SystemBlueprint[];
}

const FALLBACK: readonly SystemBlueprint[] = [LEGACY_BLUEPRINT_V1];

const useBlueprintVersionsStore = create<BlueprintVersionsStore>(() => ({ versions: FALLBACK }));

/** Render-time read; re-renders when a version is activated or the arc is reset. */
export function useBlueprintVersions(): readonly SystemBlueprint[] {
  return useBlueprintVersionsStore((state) => state.versions);
}

/** Call-time read for handlers, effects and non-React code. */
export function getBlueprintVersionsSnapshot(): readonly SystemBlueprint[] {
  return useBlueprintVersionsStore.getState().versions;
}

/** Re-reads the versions from the log. Called when the arc is resolved and after every activation. */
export async function refreshBlueprintVersions(): Promise<void> {
  try {
    if (!(await getActiveArc())) {
      resetBlueprintVersions();
      return;
    }
    const rows = await db.event.where('type').startsWith('ARC_').or('type').equals('BLUEPRINT_ACTIVATED').toArray();
    rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const { versions } = resolveBlueprints(rows as SystemEvent[]);
    useBlueprintVersionsStore.setState({ versions: versions.length > 0 ? versions : FALLBACK });
  } catch {
    // A screen must still render against the owner's System rather than a blank page.
    resetBlueprintVersions();
  }
}

/** No arc (fresh install, or after a reset). */
export function resetBlueprintVersions(): void {
  useBlueprintVersionsStore.setState({ versions: FALLBACK });
}
