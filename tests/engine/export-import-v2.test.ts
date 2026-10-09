// platform/05 loop 5.6 — export/import schema v2. An export of a multi-version
// log must reproduce every table, including the two platform projections, and
// both the old (v1) and new (v2) formats must import.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { verifyIntegrity } from '../../src/db/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { activateBlueprint } from '../../src/store/blueprint';
import { EXPORT_SCHEMA_V, exportSnapshotJson, ImportValidationError, importSnapshotJson } from '../../src/store/checkpoint';
import { recordInstrument } from '../../src/store/instruments';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { exportJson, loadLegacyDb, prefixOf } from './support/legacyDb';

const log = legacyActivityLog({ seed: 3, days: 30 });
const facts = { ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID };

/** v2 adds a generic "pages read" instrument (operational); v3 renames a domain (cosmetic). */
function versions(): { v2: SystemBlueprint; v3: SystemBlueprint } {
  const v2 = legacyBlueprintFor(facts);
  v2.version = 2;
  v2.activeFrom = dateAt(16);
  v2.changeClass = 'operational';
  v2.domains.find((d) => d.id === 'foundations')!.instrumentIds.push('foundations.pages');
  v2.instruments.push({
    id: 'foundations.pages', domainId: 'foundations', type: 'threshold', label: 'Pages read', logVerb: 'Log Pages',
    params: { unit: 'pages', comparator: '>=', target: 20, bonusAt: 30, bonusXp: 10, grant: { amount: 10, reason: 'pages' } }, controllability: 'effort', eventBinding: { kind: 'generic' },
  });
  const v3 = structuredClone(v2);
  v3.version = 3;
  v3.activeFrom = dateAt(20);
  v3.changeClass = 'cosmetic';
  v3.domains[0]!.name = 'Job search, renamed';
  return { v2, v3 };
}

async function dumpEveryTable(): Promise<Record<string, string>> {
  const dump: Record<string, string> = {};
  for (const table of db.tables) {
    const rows = await table.toArray();
    dump[table.name] = JSON.stringify(rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  }
  return dump;
}

describe('export/import v2 (loop 5.6)', () => {
  it('round-trips a multi-version log: the export carries the versions, a wipe and import reproduces every table', async () => {
    const today = dateAt(15);
    const harness = await loadLegacyDb(prefixOf(log, today), today);
    let n = 0;
    const deps = (now: string) => ({ now: () => now, newId: () => `zzzz-${String(n++).padStart(6, '0')}` });
    const { v2, v3 } = versions();
    await activateBlueprint(v2, today, deps(harness.now()));
    await recordInstrument('foundations.pages', { value: 35 }, dateAt(16), deps(`${dateAt(16)}T09:00:00.000Z`));
    await recordInstrument('foundations.pages', { value: 12 }, dateAt(17), deps(`${dateAt(17)}T09:00:00.000Z`));
    await activateBlueprint(v3, dateAt(20), deps(`${dateAt(20)}T09:00:00.000Z`));
    expect(await db.blueprint_version.count()).toBe(2);
    expect(await db.instrument_record.count()).toBe(2);

    const json = await exportSnapshotJson({ now: () => '2026-10-01T00:00:00.000Z' });
    const exported = JSON.parse(json) as { schema_v: number; blueprint_versions: SystemBlueprint[]; events: unknown[] };
    expect(exported.schema_v).toBe(EXPORT_SCHEMA_V);
    expect(exported.schema_v).toBe(2);
    expect(exported.blueprint_versions.map((v) => v.version)).toEqual([2, 3]); // the implicit legacy v1 is not a logged version
    expect(exported.events.length).toBe((await getAllEvents()).length);

    const before = await dumpEveryTable();
    await Promise.all(db.tables.map((table) => table.clear()));
    await importSnapshotJson(json, DEFAULT_CONFIG, deps('2026-10-01T00:00:00.000Z'));
    const after = await dumpEveryTable();
    expect(after).toEqual(before);
    expect(await db.blueprint_version.count()).toBe(2);
    expect(await db.instrument_record.count()).toBe(2);
    const report = await verifyIntegrity(DEFAULT_CONFIG, deps('2026-10-01T00:00:00.000Z'));
    expect(report.discrepancies).toEqual([]);
    expect(report.clean).toBe(true);
  }, 120_000);

  it('verifyIntegrity notices a missing or altered platform projection row', async () => {
    const today = dateAt(15);
    const harness = await loadLegacyDb(prefixOf(log, today), today);
    let n = 0;
    const deps = { now: harness.now, newId: () => `zzzz-${String(n++).padStart(6, '0')}` };
    await activateBlueprint(versions().v2, today, deps);
    expect((await verifyIntegrity(DEFAULT_CONFIG, deps)).clean).toBe(true);
    await db.blueprint_version.clear();
    const report = await verifyIntegrity(DEFAULT_CONFIG, deps);
    expect(report.clean).toBe(false);
    expect(report.discrepancies.join(' ')).toContain('blueprint_version');
  }, 60_000);

  it('imports a v1 export (and one with no schema_v at all) with the platform tables empty', async () => {
    const today = dateAt(10);
    const events = prefixOf(log, today);
    const deps = { now: () => `${today}T08:30:00.000Z`, newId: () => 'x' };
    for (const edit of [(o: Record<string, unknown>) => o, (o: Record<string, unknown>) => { delete o.schema_v; return o; }]) {
      await Promise.all(db.tables.map((table) => table.clear()));
      const payload = edit(JSON.parse(exportJson(events)) as Record<string, unknown>);
      expect(payload.schema_v === 1 || payload.schema_v === undefined).toBe(true);
      await importSnapshotJson(JSON.stringify(payload), DEFAULT_CONFIG, deps);
      expect(await db.event.count()).toBe(events.length);
      expect(await db.blueprint_version.count()).toBe(0);
      expect(await db.instrument_record.count()).toBe(0);
      expect((await verifyIntegrity(DEFAULT_CONFIG, deps)).clean).toBe(true);
    }
  }, 60_000);

  it('refuses an export from a newer format before touching anything', async () => {
    const today = dateAt(10);
    const events = prefixOf(log, today);
    const deps = { now: () => `${today}T08:30:00.000Z`, newId: () => 'x' };
    await loadLegacyDb(events, today);
    const before = await dumpEveryTable();
    const future = { ...(JSON.parse(exportJson(events)) as Record<string, unknown>), schema_v: 3 };
    await expect(importSnapshotJson(JSON.stringify(future), DEFAULT_CONFIG, deps)).rejects.toBeInstanceOf(ImportValidationError);
    await expect(importSnapshotJson(JSON.stringify({ ...future, schema_v: 'two' }), DEFAULT_CONFIG, deps)).rejects.toBeInstanceOf(ImportValidationError);
    expect(await dumpEveryTable()).toEqual(before);
  }, 60_000);

  it('rebuilds the platform tables from the events and does not trust the file: a tampered blueprint_versions field is ignored', async () => {
    const today = dateAt(15);
    const harness = await loadLegacyDb(prefixOf(log, today), today);
    let n = 0;
    const deps = { now: harness.now, newId: () => `zzzz-${String(n++).padStart(6, '0')}` };
    await activateBlueprint(versions().v2, today, deps);
    const exported = JSON.parse(await exportSnapshotJson(deps)) as Record<string, unknown>;
    exported.blueprint_versions = [{ hello: 'tampered' }];
    await Promise.all(db.tables.map((table) => table.clear()));
    await importSnapshotJson(JSON.stringify(exported), DEFAULT_CONFIG, deps);
    expect((await db.blueprint_version.toArray()).map((row) => row.version)).toEqual([2]);
    expect((await verifyIntegrity(DEFAULT_CONFIG, deps)).clean).toBe(true);
  }, 60_000);
});
