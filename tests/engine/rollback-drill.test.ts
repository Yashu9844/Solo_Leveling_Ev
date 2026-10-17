// Loop 15.3: the rollback drill of platform/04 §38, automated, and the Dexie downgrade hazard of §38.4 verified rather than assumed.
//
// A rollback is "install the previous build" (N-1). What must hold: it opens the database N left behind, it skips what it does not know without
// failing, the tables it does know are exactly what they were, and rolling forward again loses nothing. The browser half of the drill (a real
// profile, a real service worker) is the owner's to run: platform/07-ROLLBACK-RUNBOOK.md.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { activationEvent } from '../../src/blueprint/activation';
import { instrumentIdemKey } from '../../src/blueprint/events';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { buildProjections } from '../../src/db/projections';
import { verifyIntegrity } from '../../src/db/projections';
import { SCHEMA_V1, SCHEMA_V2_ADDITIONS, SCHEMA_V3_ADDITIONS, SCHEMA_V4_ADDITIONS, SCHEMA_V5_ADDITIONS } from '../../src/db/schema';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { KNOWN_EVENT_TYPES, applyEvents } from '../../src/engine/reduce';
import type { SystemEvent } from '../../src/engine/types';
import { exportSnapshotJson, importSnapshotJson } from '../../src/store/checkpoint';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

describe('§38.4 - what Dexie does when the code is older than the database', () => {
  afterEach(async () => { await Dexie.delete('drill-downgrade'); });

  it('Dexie 4 opens a database whose version is higher than the code declares, keeping its data and ignoring the tables it has never heard of', async () => {
    const newer = new Dexie('drill-downgrade');
    newer.version(1).stores({ kept: 'id' });
    newer.version(2).stores({ kept: 'id', added: 'id' });
    await newer.open();
    await newer.table('kept').add({ id: 'a' });
    await newer.table('added').add({ id: 'b' });
    newer.close();

    const older = new Dexie('drill-downgrade');
    older.version(1).stores({ kept: 'id' });
    await older.open(); // would throw VersionError if it did not tolerate this
    expect(await older.table('kept').count()).toBe(1);
    expect(older.tables.map((table) => table.name)).toEqual(['kept']);
    older.close();

    // And nothing was lost for the build that comes back.
    const forward = new Dexie('drill-downgrade');
    forward.version(1).stores({ kept: 'id' });
    forward.version(2).stores({ kept: 'id', added: 'id' });
    await forward.open();
    expect(await forward.table('added').count()).toBe(1);
    forward.close();
  });
});

describe('the schema only ever grows (§38.3), which is what makes a rollback build safe', () => {
  it('each version adds tables; none re-declares, re-indexes or removes one that an earlier version declared', () => {
    const versions = [SCHEMA_V1, SCHEMA_V2_ADDITIONS, SCHEMA_V3_ADDITIONS, SCHEMA_V4_ADDITIONS, SCHEMA_V5_ADDITIONS];
    const seen = new Set<string>();
    for (const [index, additions] of versions.entries()) {
      for (const table of Object.keys(additions)) {
        expect(seen.has(table), `v${index + 1} re-declares "${table}"`).toBe(false);
        seen.add(table);
      }
    }
    // The database the current build opens declares every one of them: a rollback build is the older code with these same declarations.
    expect(db.tables.map((table) => table.name).sort()).toEqual([...seen].sort());
  });
});

describe('the rollback drill (§38.6)', () => {
  const log = legacyActivityLog({ seed: 11, days: 30 });
  const future: SystemEvent = {
    id: 'zzzz-future-1', type: 'FUTURE_EVENT_FROM_A_NEWER_BUILD' as SystemEvent['type'], occurred_at: `${dateAt(20)}T10:00:00Z`, local_date: dateAt(20), arc_id: LEGACY_ARC_ID,
    payload: { anything: 1 }, source: 'user', idem_key: 'future:1', schema_v: 9,
  };

  /** Everything build N writes that build N-1 has never seen: an explicit Blueprint version, a generic instrument record, an event from the future. */
  function withNewerEvents(events: SystemEvent[]): SystemEvent[] {
    const v2 = legacyBlueprintFor({ ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID });
    v2.version = 2;
    v2.activeFrom = dateAt(20);
    v2.changeClass = 'operational';
    const activation = activationEvent(v2, { id: 'zzzz-activation-1', occurred_at: `${dateAt(19)}T10:00:00Z`, local_date: dateAt(19) });
    const record: SystemEvent = {
      id: 'zzzz-record-1', type: 'INSTRUMENT_RECORDED', occurred_at: `${dateAt(21)}T10:00:00Z`, local_date: dateAt(21), arc_id: LEGACY_ARC_ID, source: 'user',
      idem_key: instrumentIdemKey('zzzz-record-1'), schema_v: 1,
      payload: { instrumentId: 'foundations.pages', instrumentType: 'threshold', domainId: 'foundations', blueprintVersion: 2, record: { value: 25 } },
    };
    return [...events, activation, record, future].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  it('build N-1 skips what it does not know, counts it, and builds the tables it does know exactly as before', () => {
    const newer = withNewerEvents(log);
    // N-1 knows none of the platform's events: model it as a reducer that has never heard of them.
    const platformTypes = new Set(['BLUEPRINT_ACTIVATED', 'INSTRUMENT_RECORDED']);
    const asOlderBuildSees = newer.filter((event) => !platformTypes.has(event.type));
    expect(() => applyEvents(newer, DEFAULT_CONFIG)).not.toThrow();
    const state = applyEvents(newer, DEFAULT_CONFIG);
    expect(state.skipped).toEqual({ FUTURE_EVENT_FROM_A_NEWER_BUILD: 1 });
    expect(KNOWN_EVENT_TYPES.has('FUTURE_EVENT_FROM_A_NEWER_BUILD')).toBe(false);

    const deps = { now: () => '2026-10-01T00:00:00Z', newId: () => 'drill' };
    const before = buildProjections(log, DEFAULT_CONFIG, deps);
    const afterRollback = buildProjections(asOlderBuildSees, DEFAULT_CONFIG, deps);
    for (const table of ['templates', 'instances', 'ledger', 'dayRollups', 'playerState'] as const) expect(JSON.stringify(afterRollback[table]), table).toBe(JSON.stringify(before[table]));
  });

  it('install N, write every new event type, roll back, roll forward: nothing is lost and the log still verifies', async () => {
    const newer = withNewerEvents(prefixOf(log, dateAt(25)));
    const deps = await loadLegacyDb(newer, dateAt(25));

    // Roll back: the database the older build opens is this one (Dexie opens it, tables included), and the known tables rebuild clean.
    const events = await getAllEvents();
    expect(events.map((event) => event.id)).toEqual(expect.arrayContaining(['zzzz-activation-1', 'zzzz-record-1', 'zzzz-future-1']));
    expect(await verifyIntegrity(DEFAULT_CONFIG, deps)).toMatchObject({ clean: true });

    // Roll forward: export from here, wipe, import - every event is back, and so is every table.
    const exported = await exportSnapshotJson(deps);
    await Promise.all(db.tables.map((table) => table.clear()));
    await importSnapshotJson(exported, DEFAULT_CONFIG, deps);
    const after = await getAllEvents();
    expect(after.map((event) => event.id)).toEqual(events.map((event) => event.id));
    expect(after.find((event) => event.id === 'zzzz-future-1')).toBeDefined();
    expect(await verifyIntegrity(DEFAULT_CONFIG, deps)).toMatchObject({ clean: true });
  }, 60_000);
});
