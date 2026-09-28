// player_state is a projection — recomputed by summing db.xp_ledger,
// never incremented in place (final/11-SLICE-3-PROMPT.md Step 3). At
// this scale (a few thousand ledger rows over a 120-day arc) summing on
// every read is the correct choice, not a shortcut — final/07 §4.7.
import { db } from '../db/db';

export async function getTotalXp(): Promise<number> {
  const rows = await db.xp_ledger.toArray();
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

/** Maps instance id -> the XP actually granted (post-cap) for today's
 * completed rows, so TODAY can show "+100" (or a capped lower amount). */
export async function getDayXpByInstance(
  localDate: string
): Promise<Record<string, { amount: number; cappedFrom?: number }>> {
  const rows = await db.xp_ledger.where('local_date').equals(localDate).toArray();
  const result: Record<string, { amount: number; cappedFrom?: number }> = {};
  for (const row of rows) {
    if (!row.instance_id) continue;
    const existing = result[row.instance_id];
    result[row.instance_id] = {
      amount: (existing?.amount ?? 0) + row.amount,
      cappedFrom: row.capped_from ?? existing?.cappedFrom,
    };
  }
  return result;
}
