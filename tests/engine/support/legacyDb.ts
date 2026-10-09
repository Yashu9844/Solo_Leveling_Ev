// Harness for the E2 equivalence tests (platform/02 §22.2): put a PREFIX of an
// event log into a fresh fake-indexeddb through the real import path, so the
// legacy store functions answer exactly what the app would have shown on that
// day. (Importing the full log and asking about day D would leak later data
// into cumulative counts.) The V2 evaluators are then run on the same prefix.
import { db } from '../../../src/db/db';
import { DEFAULT_CONFIG } from '../../../src/engine/config';
import type { ArcStartedPayload, EngineDeps, SystemEvent } from '../../../src/engine/types';
import { importSnapshotJson } from '../../../src/store/checkpoint';

export function prefixOf(events: readonly SystemEvent[], localDate: string): SystemEvent[] {
  return events.filter((event) => event.local_date <= localDate);
}

export function exportJson(events: readonly SystemEvent[]): string {
  const started = events.find((event) => event.type === 'ARC_STARTED')!.payload as unknown as ArcStartedPayload;
  return JSON.stringify({
    schema_v: 1,
    events,
    arc: {
      id: started.arcId, start_date: started.startDate, end_date: started.endDate, timezone: started.timezone,
      day_boundary_hour: started.dayBoundaryHour, day_close_hour: started.dayCloseHour, main_quest_text: started.mainQuestText, status: 'active',
    },
    profile: null,
    checkpoints: [],
  });
}

/** Clears the database and imports `events`. Returns the deps the legacy functions should be called with. */
export async function loadLegacyDb(events: readonly SystemEvent[], today: string, checkpoints: unknown[] = []): Promise<EngineDeps> {
  const now = `${today}T08:30:00.000Z`;
  const deps: EngineDeps = { now: () => now, newId: () => 'e2-harness-id' };
  await Promise.all(db.tables.map((table) => table.clear()));
  const payload = JSON.parse(exportJson(events)) as Record<string, unknown>;
  payload.checkpoints = checkpoints;
  await importSnapshotJson(JSON.stringify(payload), DEFAULT_CONFIG, deps);
  return deps;
}
