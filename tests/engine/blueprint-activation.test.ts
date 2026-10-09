// platform/05 loop 5.2 — BLUEPRINT_ACTIVATED, the version resolver, and the
// activation writer. Covers invariants H9 (invalid configuration can never
// become active) and I8, and the implicit-legacy rule (no events -> legacy v1).
import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ActivationError, activationEvent, assertActivatable } from '../../src/blueprint/activation';
import { activationIdemKey } from '../../src/blueprint/events';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { resolveBlueprints, versionFor } from '../../src/blueprint/resolve';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { hashesFor } from '../../src/blueprint/hash';
import { blueprintVersionRows } from '../../src/db/blueprintProjection';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import type { SystemEvent } from '../../src/engine/types';
import { activateBlueprint } from '../../src/store/blueprint';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

const base = (): SystemBlueprint => legacyBlueprintFor({ ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID });

/** A legal next version: cosmetic (a rename), so it may take effect today. */
function renamed(previous: SystemBlueprint, activeFrom: string, version = previous.version + 1): SystemBlueprint {
  const next = structuredClone(previous);
  next.version = version;
  next.activeFrom = activeFrom;
  next.changeClass = 'cosmetic';
  next.domains[0]!.name = `Job search v${version}`;
  return next;
}

function activation(blueprint: SystemBlueprint, localDate: string, id: string, arcId = LEGACY_ARC_ID): SystemEvent {
  return { ...activationEvent(blueprint, { id, occurred_at: `${localDate}T09:00:00Z`, local_date: localDate }), arc_id: arcId } as SystemEvent;
}

const log = legacyActivityLog({ seed: 3, days: 20 });

describe('version resolver (loop 5.2)', () => {
  it('a log with no activation resolves to the implicit legacy v1 for its arc', () => {
    const { versions, rejected, implicitGenesis } = resolveBlueprints(log);
    expect(implicitGenesis).toBe(true);
    expect(rejected).toEqual([]);
    expect(versions).toHaveLength(1);
    // The arc-owned fields come from the arc the log recorded.
    expect(versions[0]).toEqual(legacyBlueprintFor({ ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID, main_quest_text: 'Ship a working agent and land an offer.' }));
    expect(versionFor(versions, dateAt(0))).toBe(versions[0]);
    expect(versionFor(versions, dateAt(119))).toBe(versions[0]);
    expect(versionFor(versions, '2026-08-31')).toBeUndefined();
    expect(resolveBlueprints([]).versions).toEqual([]);
  });

  it('versionFor is the latest version on or before the date, for any sorted list (binary search == linear scan)', () => {
    fc.assert(fc.property(fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { maxLength: 12 }).map((days) => days.sort((a, b) => a - b)), fc.integer({ min: -5, max: 210 }), (days, probe) => {
      const versions = days.map((day, index) => ({ ...base(), version: index + 1, activeFrom: dateAt(day) }));
      const date = dateAt(probe);
      const linear = [...versions].reverse().find((version) => version.activeFrom <= date);
      expect(versionFor(versions, date)).toBe(linear);
    }), { numRuns: 500 });
  });

  it('an owner who adopts an explicit v2 keeps the implicit v1 before it', () => {
    const v2 = renamed(base(), dateAt(10));
    const { versions, implicitGenesis } = resolveBlueprints([...log, activation(v2, dateAt(10), 'zz-1')]);
    expect(implicitGenesis).toBe(true);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versionFor(versions, dateAt(9))!.version).toBe(1);
    expect(versionFor(versions, dateAt(10))!.version).toBe(2);
  });

  it('an explicit genesis version replaces the implicit one', () => {
    const genesis = base();
    genesis.domains[0]!.name = 'Explicit';
    const { versions, implicitGenesis } = resolveBlueprints([...log, activation(genesis, dateAt(0), 'zz-1')]);
    expect(implicitGenesis).toBe(false);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.domains[0]!.name).toBe('Explicit');
  });

  it('replays idempotently: the same activation twice is one version', () => {
    const v2 = renamed(base(), dateAt(10));
    const once = resolveBlueprints([...log, activation(v2, dateAt(10), 'zz-1')]);
    const twice = resolveBlueprints([...log, activation(v2, dateAt(10), 'zz-1'), activation(v2, dateAt(10), 'zz-2')]);
    expect(twice.versions).toEqual(once.versions);
  });
});

describe('H9 - a forged or damaged activation is ignored and reported on replay', () => {
  const reasonFor = (events: SystemEvent[]) => resolveBlueprints(events).rejected.map((r) => r.reason);

  it('ignores a document that fails validation', () => {
    const broken = renamed(base(), dateAt(10));
    broken.domains[1]!.designation = broken.domains[0]!.designation; // collides: V-DOM-02
    const { versions, rejected } = resolveBlueprints([...log, activation(broken, dateAt(10), 'zz-1')]);
    expect(versions.map((v) => v.version)).toEqual([1]);
    expect(rejected[0]!.reason).toContain('V-DOM-02');
  });

  it('ignores structurally wrong payloads, another arc, retroactive dates, duplicate dates and non-increasing versions', () => {
    const v2 = renamed(base(), dateAt(10));
    expect(reasonFor([...log, { ...activation(v2, dateAt(10), 'zz-1'), payload: { blueprint: { hello: 'world' } } }])).toEqual(['The payload is not a Blueprint document.']);
    expect(reasonFor([...log, { ...activation(v2, dateAt(10), 'zz-1'), payload: {} }])).toEqual(['The payload is not a Blueprint document.']);
    expect(reasonFor([...log, activation(v2, dateAt(10), 'zz-1', 'someone-elses-arc')])).toEqual(['The Blueprint belongs to a different arc.']);
    expect(reasonFor([...log, activation(renamed(base(), dateAt(5)), dateAt(10), 'zz-1')])).toEqual(['The Blueprint is dated before the day it was activated.']);
    const dup = renamed(base(), dateAt(10), 3);
    expect(reasonFor([...log, activation(v2, dateAt(10), 'zz-1'), activation(dup, dateAt(10), 'zz-2')])).toEqual(['Another version already starts on that date.']);
    const stale = renamed(base(), dateAt(12), 2);
    stale.lineageId = 'other-lineage'; // same version number 2 as v2, later date: not increasing
    expect(reasonFor([...log, activation(v2, dateAt(10), 'zz-1'), activation(stale, dateAt(11), 'zz-2')]).length).toBe(1);
  });

  it('property: random corruption of a valid document never changes what a past day meant', async () => {
    const baseline = resolveBlueprints(log).versions;
    await fc.assert(fc.asyncProperty(
      fc.constantFrom('domains', 'quests', 'instruments', 'progression', 'arc', 'gates', 'bosses', 'attributes'),
      fc.constantFrom('delete', 'null', 'string', 'emptyArray'),
      async (field, corruption) => {
        const forged = renamed(base(), dateAt(10)) as unknown as Record<string, unknown>;
        forged[field] = corruption === 'delete' ? undefined : corruption === 'null' ? null : corruption === 'string' ? 'x' : [];
        const { versions } = resolveBlueprints([...log, activation(forged as unknown as SystemBlueprint, dateAt(10), 'zz-1')]);
        // Either the forgery is rejected (the common case) or it was still a valid document; the past is untouched either way.
        expect(versionFor(versions, dateAt(9))).toEqual(baseline[0]);
        for (const version of versions.slice(1)) expect(await hashesFor(version)).toBeDefined();
      }
    ), { numRuns: 60 });
  });
});

describe('the activation writer (loop 5.2)', () => {
  const prefix = prefixOf(log, dateAt(15));

  it('refuses an invalid or illegal Blueprint without touching the log, and activates a legal one', async () => {
    const harness = await loadLegacyDb(prefix, dateAt(15));
    // Ids sort chronologically (uuidv7); the harness's constant id would sort first.
    let issued = 0;
    const deps = { now: harness.now, newId: () => `zzzz-activation-${String(issued++).padStart(3, '0')}` };
    const eventsBefore = (await getAllEvents()).length;
    const today = dateAt(15);

    const invalid = renamed(base(), today);
    invalid.arc.timezone = 'Nope/Nowhere';
    await expect(activateBlueprint(invalid, today, deps)).rejects.toBeInstanceOf(ActivationError);
    await expect(activateBlueprint(renamed(base(), today, 5), today, deps)).rejects.toThrow('Expected version 2');
    const structural = renamed(base(), today);
    structural.changeClass = 'structural'; // wrong: the diff is cosmetic
    await expect(activateBlueprint(structural, today, deps)).rejects.toBeInstanceOf(ActivationError);
    const retroactive = renamed(base(), dateAt(3));
    await expect(activateBlueprint(retroactive, today, deps)).rejects.toBeInstanceOf(ActivationError);
    expect((await getAllEvents()).length).toBe(eventsBefore);
    expect(await db.blueprint_version.count()).toBe(0);

    await activateBlueprint(renamed(base(), today), today, deps);
    const events = await getAllEvents();
    expect(events.length).toBe(eventsBefore + 1);
    expect(events.at(-1)).toMatchObject({ type: 'BLUEPRINT_ACTIVATED', local_date: today, idem_key: activationIdemKey({ lineageId: LEGACY_ARC_ID, version: 2 }) });
    const rows = await db.blueprint_version.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: `${LEGACY_ARC_ID}@2`, version: 2, active_from: today, change_class: 'cosmetic' });
    // Re-activating the same version is a no-op.
    await activateBlueprint(renamed(base(), today), today, deps);
    expect((await getAllEvents()).length).toBe(eventsBefore + 1);
    // The cache equals what the log implies.
    expect(JSON.parse(JSON.stringify(rows))).toEqual(JSON.parse(JSON.stringify(await blueprintVersionRows(events))));
  }, 60_000);

  it('I8: any mutation that makes a Blueprint invalid makes activation throw, and a valid one never does', async () => {
    const today = dateAt(15);
    const previous = base();
    const context = { today, arcDay: 16, nextCheckpointDay: 30, arcId: LEGACY_ARC_ID };
    const mutations: ((b: SystemBlueprint) => void)[] = [
      (b) => { b.arc.timezone = 'Nope/Nowhere'; },
      (b) => { b.domains = b.domains.slice(0, 3); },
      (b) => { b.quests[0]!.xp = 300; },
      (b) => { b.progression.dailyCap = 600; },
      (b) => { b.instruments[0]!.params = {}; },
      (b) => { b.quests[0]!.criterion = { kind: 'signal', instrumentId: 'gone', signal: 'minutes', comparator: '>=', target: 1 }; },
      (b) => { b.gates.find((g) => g.day === 30)!.conditions = []; },
      (b) => { b.bosses[0]!.anchorMilestoneId = 'gone'; },
    ];
    for (const [index, mutate] of mutations.entries()) {
      const next = renamed(previous, today);
      mutate(next);
      await expect(assertActivatable(next, previous, context), `mutation ${index}`).rejects.toBeInstanceOf(ActivationError);
    }
    await expect(assertActivatable(renamed(previous, today), previous, context)).resolves.toBeUndefined();
  });
});
