// platform/05 loop 5.1 — Dexie v5 is additive, and an upgrade can never leave
// the app frozen on a stale tab. Runs against fake-indexeddb with a database
// built exactly as the shipped v4 build declares it.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { installConnectionSafety } from '../../src/db/connection';
import { SystemDb } from '../../src/db/db';
import { SCHEMA_V1, SCHEMA_V2_ADDITIONS, SCHEMA_V3_ADDITIONS, SCHEMA_V4_ADDITIONS, SCHEMA_V5_ADDITIONS } from '../../src/db/schema';
import { legacyActivityLog } from './support/legacyActivityLog';

const NAME = 'system-arc';

/** The v4 build's database, seeded with a real 40-day log's events and a few derived rows. */
async function seedV4(): Promise<{ tables: string[]; before: Record<string, unknown[]> }> {
  const old = new Dexie(NAME);
  old.version(1).stores(SCHEMA_V1);
  old.version(2).stores({ ...SCHEMA_V1, ...SCHEMA_V2_ADDITIONS });
  old.version(3).stores({ ...SCHEMA_V1, ...SCHEMA_V2_ADDITIONS, ...SCHEMA_V3_ADDITIONS });
  old.version(4).stores({ ...SCHEMA_V1, ...SCHEMA_V2_ADDITIONS, ...SCHEMA_V3_ADDITIONS, ...SCHEMA_V4_ADDITIONS });
  await old.open();
  await old.table('event').bulkAdd(legacyActivityLog({ seed: 5, days: 40 }));
  await old.table('xp_ledger').add({ id: 'x1', event_id: 'e', local_date: '2026-09-02', amount: 100, category: 'MIND', reason: 'core:dsa' });
  await old.table('day_rollup').add({ local_date: '2026-09-02', xp_earned: 100 });
  await old.table('profile').add({ id: 'p', name: 'Owner', created_at: '2026-09-01T00:00:00Z', arc_timezone: 'Asia/Kolkata', settings: {} });
  const tables = old.tables.map((table) => table.name);
  const before: Record<string, unknown[]> = {};
  for (const name of tables) before[name] = await old.table(name).toArray();
  old.close();
  return { tables, before };
}

describe('Dexie v5 (loop 5.1)', () => {
  it('upgrades a seeded v4 database: every existing row intact, the two new stores empty', async () => {
    const { tables, before } = await seedV4();
    const db = new SystemDb({ reload() {}, blocked() {} });
    await db.open();
    expect(db.verno).toBe(5);
    for (const name of tables) expect(JSON.stringify(await db.table(name).toArray()), name).toBe(JSON.stringify(before[name]));
    expect(await db.blueprint_version.count()).toBe(0);
    expect(await db.instrument_record.count()).toBe(0);
    expect(Object.keys(SCHEMA_V5_ADDITIONS).sort()).toEqual(['blueprint_version', 'instrument_record']);
    expect(db.tables.map((t) => t.name).sort()).toEqual([...tables, 'blueprint_version', 'instrument_record'].sort());
    // The event store is untouched down to its indexes.
    expect(db.table('event').schema.indexes.map((i) => i.name).sort()).toEqual(['arc_id', 'idem_key', 'local_date', 'occurred_at', 'type', '[type+local_date]'].sort());
    db.close();
    await Dexie.delete(NAME);
  });

  it('a stale tab closes itself and reloads when a newer version wants in, so the upgrade is never blocked', async () => {
    await seedV4();
    const staleReloads: string[] = [];
    const stale = new Dexie(NAME);
    stale.version(4).stores({ ...SCHEMA_V1, ...SCHEMA_V2_ADDITIONS, ...SCHEMA_V3_ADDITIONS, ...SCHEMA_V4_ADDITIONS });
    installConnectionSafety(stale, { reload: () => staleReloads.push('reload'), blocked: () => staleReloads.push('blocked') });
    await stale.open();
    expect(stale.isOpen()).toBe(true);

    const fresh = new SystemDb({ reload() {}, blocked() {} });
    await fresh.open();
    expect(fresh.verno).toBe(5);
    expect(stale.isOpen()).toBe(false);
    expect(staleReloads).toEqual(['reload']);
    expect(await fresh.event.count()).toBeGreaterThan(100);
    fresh.close();
    await Dexie.delete(NAME);
  });

  it('a deletion closes the connection so the delete can finish, but does not reload the page', async () => {
    await seedV4();
    const events: string[] = [];
    const open = new SystemDb({ reload: () => events.push('reload'), blocked: () => events.push('blocked') });
    await open.open();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    expect(open.isOpen()).toBe(false);
    expect(events).toEqual([]);
  });

  it('tells the person when an upgrade is blocked by a tab that will not close, and completes once it does', async () => {
    await seedV4();
    // A raw connection with no versionchange handler: it never yields.
    const holdout = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const events: string[] = [];
    const fresh = new SystemDb({ reload: () => events.push('reload'), blocked: () => events.push('blocked') });
    const opening = fresh.open();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(events).toContain('blocked');
    holdout.close();
    await opening;
    expect(fresh.verno).toBe(5);
    fresh.close();
    await Dexie.delete(NAME);
  });
});
