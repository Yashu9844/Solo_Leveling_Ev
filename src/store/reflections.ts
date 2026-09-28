// final/05-motivation-moments-notifications.md §1.2 — the live half of
// the reflection library: reading db.reflection_state for
// engine/reflections.ts's selectReflection, and recording a show.
import { REFLECTIONS, selectReflection, type Reflection, type ReflectionContext, type ReflectionShowState } from '../engine/reflections';
import { db } from '../db/db';

async function loadShowStates(): Promise<Map<string, ReflectionShowState>> {
  const rows = await db.reflection_state.toArray();
  return new Map(rows.map((row) => [row.id, { times_shown: row.times_shown, last_shown_at: row.last_shown_at }]));
}

export async function pickReflection(
  context: ReflectionContext,
  arcDay: number,
  isPostLapse: boolean,
  today: string
): Promise<Reflection | null> {
  const states = await loadShowStates();
  return selectReflection(REFLECTIONS, states, { context, arcDay, isPostLapse, today });
}

/**
 * Records that `reflectionId` was shown today — bumps times_shown and
 * sets last_shown_at, creating the row on first show. Idempotent per
 * day: a caller like Today.tsx may re-run its refresh on every
 * visibility/focus event, and re-marking the same reflection shown each
 * time would inflate times_shown for a single real display.
 */
export async function recordReflectionShown(reflectionId: string, today: string): Promise<void> {
  const existing = await db.reflection_state.get(reflectionId);
  if (existing?.last_shown_at === today) return;
  await db.reflection_state.put({
    id: reflectionId,
    times_shown: (existing?.times_shown ?? 0) + 1,
    last_shown_at: today,
  });
}
