import { describe, expect, it } from 'vitest';
import { buildDomainTables } from '../../src/db/domainProjections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { SystemEvent } from '../../src/engine/types';
import { LEGACY_INSTRUMENTS, type LegacyInstrumentId } from '../../src/instruments/legacy/ids';
import { upcastLegacyEvents } from '../../src/instruments/legacy/upcasters';
import { isLegacyInstrumentId, legacyEventFor } from '../../src/instruments/legacy/writeAdapters';
import { legacyActivityLog } from './support/legacyActivityLog';
import { loadOwnerExport } from './support/ownerFixture';
import { randomEventLog } from './support/randomEventLog';
import { normalize, recordsFromDomainTables, ROW_DERIVABLE_INSTRUMENTS, type NormalizedRecord } from './support/rowRecords';

/** Maintenance: the table keeps one row per date (the last write), so compare the last event per date. */
function lastMaintenancePerDate(records: NormalizedRecord[]): NormalizedRecord[] {
  const byDate = new Map<string, NormalizedRecord>();
  for (const r of records.filter((x) => x.instrumentId === 'maintenance.daily')) byDate.set(r.localDate, r);
  return [...records.filter((x) => x.instrumentId !== 'maintenance.daily'), ...byDate.values()];
}

function fromEvents(events: SystemEvent[]): NormalizedRecord[] {
  const upcast = upcastLegacyEvents(events).map((r) => ({ instrumentId: r.instrumentId as LegacyInstrumentId, localDate: r.localDate, record: r.record }));
  return lastMaintenancePerDate(upcast).filter((r) => ROW_DERIVABLE_INSTRUMENTS.includes(r.instrumentId));
}

function assertEqualToRows(events: SystemEvent[]) {
  const fromRows = recordsFromDomainTables(buildDomainTables(events, DEFAULT_CONFIG));
  const derived = normalize(fromEvents(events));
  expect(derived.length).toBe(fromRows.length);
  expect(derived).toEqual(normalize(fromRows));
  return fromRows.length;
}

describe('legacy upcasters (loop 3.7)', () => {
  it('derive exactly the records the domain tables hold, on the golden 120-day log', () => {
    const events = legacyActivityLog({ seed: 42, days: 120 });
    const records = upcastLegacyEvents(events);
    // Every instrument the owner's System declares is exercised by the fixture.
    for (const id of Object.keys(LEGACY_INSTRUMENTS)) expect(records.some((r) => r.instrumentId === id), id).toBe(true);
    expect(assertEqualToRows(events)).toBeGreaterThan(500);
  });

  it('agree with the owner export when it is present locally (skipped in CI)', () => {
    const owner = loadOwnerExport();
    if (!owner) return;
    assertEqualToRows(owner.snapshot.events);
  });

  it('agree with the tables over 60 other activity seeds', () => {
    for (let seed = 1; seed <= 60; seed++) assertEqualToRows(legacyActivityLog({ seed, days: 40, skipRate: 0.2 }));
  });

  it('agree with the tables over 300 random raw-event fuzz logs', () => {
    for (let seed = 1; seed <= 300; seed++) assertEqualToRows(randomEventLog(seed));
  });

  it('a re-logged problem keeps the topic and difficulty of its first log, as the dsa_problem row does', () => {
    const base = { occurred_at: '2026-09-02T04:30:00Z', local_date: '2026-09-02', arc_id: 'a', source: 'user' as const, schema_v: 1 };
    const log = (id: string, difficulty: 'E' | 'H', topic: string): SystemEvent => ({ ...base, id, type: 'PROBLEM_LOGGED', idem_key: id, payload: { problemId: 'p1', slug: 's', title: 'T', topic, difficulty, outcome: 'first_attempt', minutes: 10 } });
    assertEqualToRows([log('e1', 'E', 'Arrays'), log('e2', 'H', 'Graphs')]);
  });

  it('give every record a stable id, its source event and the legacy instrument binding', () => {
    const events = legacyActivityLog({ seed: 7, days: 30 });
    const ids = new Set(events.map((e) => e.id));
    for (const r of upcastLegacyEvents(events)) {
      expect(ids.has(r.eventId)).toBe(true);
      expect(r.instrumentType).toBe(LEGACY_INSTRUMENTS[r.instrumentId as LegacyInstrumentId].type);
      expect(r.domainId).toBe(LEGACY_INSTRUMENTS[r.instrumentId as LegacyInstrumentId].domainId);
    }
  });
});

describe('legacy write adapters (loop 3.7)', () => {
  it('round-trip: upcast(adapter(record)) reproduces the record for every append-only legacy event', () => {
    const events = legacyActivityLog({ seed: 11, days: 60 });
    const records = upcastLegacyEvents(events);
    const byEvent = new Map(events.map((e) => [e.id, e]));
    let checked = 0;
    for (const record of records) {
      const source = byEvent.get(record.eventId)!;
      // An application's stage and follow-up are folded in from LATER events;
      // the adapter writes only the creation event, so compare creation state.
      if (record.record.kind === 'application') {
        const created = { ...record.record, status: 'applied', statusHistory: [{ status: 'applied', date: record.localDate }] };
        delete (created as Record<string, unknown>).followedUpAt;
        record.record = created;
      }
      expect(isLegacyInstrumentId(record.instrumentId)).toBe(true);
      const draft = legacyEventFor(record.instrumentId as LegacyInstrumentId, record);
      expect(draft.type).toBe(source.type);
      const replayed = upcastLegacyEvents([{ ...source, payload: draft.payload }]);
      // A lone revisit has no problem to look up, so compare only its own facts.
      const expected = record.record.isRevisit ? { problemId: record.record.problemId, outcome: record.record.outcome, minutes: record.record.minutes, isRevisit: true } : record.record;
      const actual = record.record.isRevisit
        ? { problemId: replayed[0]!.record.problemId, outcome: replayed[0]!.record.outcome, minutes: replayed[0]!.record.minutes, isRevisit: true }
        : replayed[0]!.record;
      expect(replayed).toHaveLength(1);
      expect(JSON.parse(JSON.stringify(actual))).toEqual(JSON.parse(JSON.stringify(expected)));
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });
});
