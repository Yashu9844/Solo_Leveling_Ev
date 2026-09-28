import type { SystemEvent } from '../engine/types';
import { db } from './db';
import type { EventRow } from './schema';

/**
 * Appends an event. Rejects (no-ops) a duplicate idem_key rather than
 * throwing at the call site — idempotency is a guarantee, not an edge case.
 */
export async function appendEvent(e: SystemEvent): Promise<void> {
  const existing = await db.event.where('idem_key').equals(e.idem_key).first();
  if (existing) {
    return;
  }
  await db.event.add(e as EventRow);
}

/** All events, ordered by id — uuidv7 is time-ordered, so this is chronological. */
export async function getAllEvents(): Promise<SystemEvent[]> {
  const rows = await db.event.orderBy('id').toArray();
  return rows as SystemEvent[];
}
