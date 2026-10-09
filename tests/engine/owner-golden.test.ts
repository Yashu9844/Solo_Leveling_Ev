// platform/05-ROADMAP.md loop 0.2 — the owner golden-master harness.
//
// Two suites:
//   1. SYNTHETIC — always runs (CI included). Feeds the harness an export
//      built from the committed golden-120 log, so the harness code itself
//      is tested without any personal data.
//   2. OWNER (private) — runs only when platform-fixtures/private/
//      owner-export.json exists. First run records owner-golden.json next
//      to it (also private); every later run must reproduce that digest.
//      Re-record deliberately with OWNER_GOLDEN_UPDATE=1 — the same
//      "deliberate, reviewed act" as updating the golden-120 snapshot.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/db';
import { verifyIntegrity } from '../../src/db/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { ArcStartedPayload, SystemEvent } from '../../src/engine/types';
import { exportSnapshotJson, importSnapshotJson } from '../../src/store/checkpoint';
import { randomEventLog } from './support/randomEventLog';
import {
  deriveGolden,
  harnessDeps,
  loadOwnerExport,
  loadOwnerGolden,
  writeOwnerGolden,
  type ExportSnapshot,
} from './support/ownerFixture';

async function clearDb() {
  await Promise.all(db.tables.map((t) => t.clear()));
}

/** An export in exactly store/checkpoint.ts#exportSnapshotJson's shape,
 * built from a generated log — the arc row mirrors its ARC_STARTED. */
function syntheticExport(events: SystemEvent[]): string {
  const started = events.find((e) => e.type === 'ARC_STARTED')!;
  const p = started.payload as unknown as ArcStartedPayload;
  const snapshot: ExportSnapshot = {
    schema_v: 1,
    events,
    arc: {
      id: p.arcId,
      start_date: p.startDate,
      end_date: p.endDate,
      timezone: p.timezone,
      day_boundary_hour: p.dayBoundaryHour,
      day_close_hour: p.dayCloseHour,
      main_quest_text: p.mainQuestText,
      status: 'active',
    },
    profile: null,
    checkpoints: [],
  };
  return JSON.stringify(snapshot);
}

/**
 * The shared generator's ids (`evt-42-N`) don't sort numerically as
 * strings, but the real app relies on id order being chronological —
 * db/events.ts#getAllEvents orders by id because uuidv7 is time-ordered.
 * An export read back from IndexedDB therefore comes back in id order.
 * Zero-padded ids restore the uuidv7 property for this fixture without
 * touching the shared generator (which golden-120 and the fuzz depend on).
 */
function withSortableIds(events: SystemEvent[]): SystemEvent[] {
  return events.map((e, i) => ({ ...e, id: `evt-${String(i).padStart(6, '0')}` }));
}

describe('Owner golden harness — synthetic export', () => {
  beforeEach(clearDb);

  const events = withSortableIds(randomEventLog(42, 120));

  it('derives the same digest on every run', () => {
    expect(deriveGolden(events).digest).toBe(deriveGolden(withSortableIds(randomEventLog(42, 120))).digest);
  });

  it('is sensitive to a real change in derived state', () => {
    const withoutLastEvent = events.slice(0, -1);
    expect(deriveGolden(withoutLastEvent).digest).not.toBe(deriveGolden(events).digest);
  });

  it('import -> verifyIntegrity is clean, and re-export reproduces the digest', async () => {
    await importSnapshotJson(syntheticExport(events), DEFAULT_CONFIG, harnessDeps);
    const report = await verifyIntegrity(DEFAULT_CONFIG, harnessDeps);
    expect(report.discrepancies).toEqual([]);

    const reExported = JSON.parse(await exportSnapshotJson(harnessDeps)) as ExportSnapshot;
    expect(deriveGolden(reExported.events).digest).toBe(deriveGolden(events).digest);
  });

  // platform/05 loop 1.1 — the rollback scenario end to end: an export
  // containing event types from a newer build imports, verifies clean,
  // reports the skip, and derives exactly what the known events alone do.
  it('an export from a newer build imports cleanly and reports the unknown events', async () => {
    const future = { ...events[5]!, id: 'evt-999999', type: 'NEXT_GEN_EVENT' as SystemEvent['type'], idem_key: 'next-gen:x:2', payload: {} };
    await importSnapshotJson(syntheticExport([...events, future]), DEFAULT_CONFIG, harnessDeps);
    const report = await verifyIntegrity(DEFAULT_CONFIG, harnessDeps);
    expect(report.clean).toBe(true);
    expect(report.skipped).toEqual({ NEXT_GEN_EVENT: 1 });
    expect(deriveGolden([...events, future]).digest).toBe(deriveGolden(events).digest);
  });
});

const owner = loadOwnerExport();

describe.skipIf(!owner)('Owner golden harness — private owner export', () => {
  beforeEach(clearDb);

  it('replays through the real import path with a clean integrity report', async () => {
    await importSnapshotJson(owner!.json, DEFAULT_CONFIG, harnessDeps);
    const report = await verifyIntegrity(DEFAULT_CONFIG, harnessDeps);
    expect(report.discrepancies).toEqual([]);
  });

  it('reproduces the recorded golden digest', () => {
    const current = deriveGolden(owner!.snapshot.events);
    const recorded = loadOwnerGolden();

    if (!recorded || process.env.OWNER_GOLDEN_UPDATE === '1') {
      writeOwnerGolden(current);
      console.info(`[owner-golden] recorded digest ${current.digest.slice(0, 12)}…`, current.summary);
      return;
    }

    // Summary first: a mismatch there is the readable version of the
    // same failure the digest comparison below would report.
    expect(current.summary).toEqual(recorded.summary);
    expect(current.digest).toBe(recorded.digest);
  });
});
