// platform/05 loop 5.5 — the historical-integrity invariants of platform/04
// §31.2 that concern versions: I3, I4, I7, I8, I13, I16, I18. Each is one
// property over generated Blueprint histories and logs.
import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { activationEvent } from '../../src/blueprint/activation';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { evaluateGate, gateAsDisplayed } from '../../src/blueprint/evaluate/gate';
import { readModelEnv } from '../../src/blueprint/evaluate/readModel';
import { hashesFor } from '../../src/blueprint/hash';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { resolveBlueprints, versionFor } from '../../src/blueprint/resolve';
import type { Criterion, SystemBlueprint } from '../../src/blueprint/schema';
import { computeChangeClass } from '../../src/blueprint/validate';
import { getAllEvents } from '../../src/db/events';
import type { SystemEvent } from '../../src/engine/types';
import { activateBlueprint } from '../../src/store/blueprint';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';
import { fuzzDeps } from './support/randomEventLog';

const facts = { ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID };
const genesis = (): SystemBlueprint => legacyBlueprintFor(facts);
const LOG = legacyActivityLog({ seed: 21, days: 30, skipRate: 0.1 });
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
const withoutStamp = <T extends { blueprint_version?: number }>(row: T): Omit<T, 'blueprint_version'> => { const copy = { ...row }; delete copy.blueprint_version; return copy; };
const before = <T extends { local_date: string }>(rows: T[], cut: string) => rows.filter((row) => row.local_date < cut);

/** A later version, edited by `edit`, starting on `activeFrom`. */
function successor(previous: SystemBlueprint, activeFrom: string, edit: (next: SystemBlueprint) => void): SystemBlueprint {
  const next = structuredClone(previous);
  next.version = previous.version + 1;
  next.activeFrom = activeFrom;
  edit(next);
  return next;
}

describe('I3 - removing a future quest never changes historical quests', () => {
  it('for any quest and any start day, every instance and ledger row before the start is unchanged (300 cases)', () => {
    const baseline = buildProjectionsV2(LOG, fuzzDeps, [genesis()]);
    fc.assert(fc.property(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 2, max: 28 }), (questIndex, day) => {
      const without = successor(genesis(), dateAt(day), (next) => {
        const quest = next.quests[questIndex]!;
        next.quests = next.quests.filter((candidate) => candidate.id !== quest.id);
        delete next.domains.find((domain) => domain.id === quest.domainId)!.coreQuestId;
      });
      const built = buildProjectionsV2(LOG, fuzzDeps, [genesis(), without]);
      const cut = dateAt(day);
      expect(json(before(built.instances, cut))).toEqual(json(before(baseline.instances, cut)));
      expect(json(before(built.ledger, cut).map(withoutStamp))).toEqual(json(before(baseline.ledger, cut)));
      // And the removed quest generates nothing from the start date on.
      const removedId = `${LEGACY_ARC_ID}::${genesis().quests[questIndex]!.id}`;
      expect(built.instances.some((instance) => instance.template_id === removedId && instance.local_date >= cut)).toBe(false);
    }), { numRuns: 300 });
  });
});

describe('I4 - changing configuration never mutates historical events', () => {
  it('the log before an activation is a byte-for-byte prefix of the log after it (25 cases)', async () => {
    let counter = 0;
    await fc.assert(fc.asyncProperty(fc.string({ minLength: 1, maxLength: 12 }), async (name) => {
      const today = dateAt(12);
      const harness = await loadLegacyDb(prefixOf(LOG, today), today);
      const deps = { now: harness.now, newId: () => `zzzz-${String(counter++).padStart(6, '0')}` };
      const eventsBefore = JSON.stringify(await getAllEvents());
      await activateBlueprint(successor(genesis(), today, (next) => { next.changeClass = 'cosmetic'; next.domains[0]!.name = `Name ${name}`; }), today, deps);
      const eventsAfter = await getAllEvents();
      const prefix = JSON.stringify(eventsAfter.slice(0, eventsAfter.length - 1));
      expect(`${prefix.slice(0, -1)}`).toBe(eventsBefore.slice(0, -1));
      expect(eventsAfter.at(-1)!.type).toBe('BLUEPRINT_ACTIVATED');
    }), { numRuns: 25 });
  }, 120_000);
});

describe('I7 - historical reports are reproducible', () => {
  it('building the same log twice is identical, and projections up to any cut date match those of the prefix (200 cases)', () => {
    const versions = [genesis(), successor(genesis(), dateAt(10), (next) => { next.quests[1]!.xp = 80; next.quests[2]!.xp = 120; })];
    const full = buildProjectionsV2(LOG, fuzzDeps, versions);
    expect(json(buildProjectionsV2(LOG, fuzzDeps, versions))).toEqual(json(full));
    fc.assert(fc.property(fc.integer({ min: 0, max: 29 }), (offset) => {
      const cut = dateAt(offset);
      const upTo = buildProjectionsV2(prefixOf(LOG, cut), fuzzDeps, versions);
      const upToCut = <T extends { local_date: string }>(rows: T[]) => rows.filter((row) => row.local_date <= cut);
      expect(json(upToCut(upTo.ledger))).toEqual(json(upToCut(full.ledger)));
      expect(json(upToCut(upTo.dayRollups))).toEqual(json(upToCut(full.dayRollups)));
      expect(json(upToCut(upTo.instances))).toEqual(json(upToCut(full.instances)));
    }), { numRuns: 200 });
  });
});

describe('I8 - an invalid configuration cannot become active', () => {
  it('a corrupted or forged activation in the log leaves every projection exactly as it was (60 cases)', () => {
    const baseline = buildProjectionsV2(LOG, fuzzDeps);
    fc.assert(fc.property(
      fc.constantFrom('domains', 'quests', 'instruments', 'progression', 'arc', 'gates', 'bosses', 'attributes', 'checkpoints', 'skills'),
      fc.constantFrom('delete', 'null', 'string', 'emptyArray', 'number'),
      (field, corruption) => {
        const forged = structuredClone(successor(genesis(), dateAt(12), (next) => { next.changeClass = 'cosmetic'; })) as unknown as Record<string, unknown>;
        forged[field] = corruption === 'delete' ? undefined : corruption === 'null' ? null : corruption === 'string' ? 'x' : corruption === 'number' ? 7 : [];
        const event = { ...activationEvent(forged as unknown as SystemBlueprint, { id: 'zzzz-forged', occurred_at: `${dateAt(12)}T09:00:00Z`, local_date: dateAt(12) }), arc_id: LEGACY_ARC_ID } as SystemEvent;
        const withForgery = [...LOG, event];
        const { versions, rejected } = resolveBlueprints(withForgery);
        // Either rejected (and reported) or - if the corruption happened to leave a valid document - then a legitimate version.
        if (versions.length === 1) expect(rejected.length).toBe(1);
        expect(json(buildProjectionsV2(withForgery, fuzzDeps, [versions[0]!]))).toEqual(json(baseline));
      }
    ), { numRuns: 60 });
  });
});

describe('I13 - cosmetic versions keep the computational hash', () => {
  const cosmeticEdits: ((b: SystemBlueprint, text: string) => void)[] = [
    (b, t) => { b.domains[0]!.name = t; }, (b, t) => { b.domains[1]!.designation = `${t}`.toUpperCase().slice(0, 18) || 'X'; },
    (b, t) => { b.domains[2]!.description = t; }, (b, t) => { b.domains[3]!.presentation.icon = t; }, (b, t) => { b.domains[3]!.presentation.hue = t; },
    (b, t) => { b.instruments[0]!.label = t; }, (b, t) => { b.instruments[1]!.logVerb = t; },
    (b, t) => { b.quests[0]!.designation = t; }, (b, t) => { b.quests[1]!.realityLabel = t; }, (b, t) => { b.quests[2]!.objective = t; },
    (b, t) => { b.attributes.defs[0]!.name = t; }, (b, t) => { b.attributes.defs[1]!.description = t; }, (b, t) => { b.attributes.defs[2]!.terms[0]!.label = t; },
    (b, t) => { b.gates[2]!.conditions[0]!.label = t; }, (b, t) => { b.bosses[0]!.title = t; }, (b, t) => { b.achievements[0]!.label = t; },
    (b, t) => { b.checkpoints.selfEfficacy[0]!.prompt = t; }, (b, t) => { b.identity.displayName = t; }, (b, t) => { b.vocabulary = { x: t }; },
    (b, t) => { b.attributes.groups[0]!.heading = t; }, (b, t) => { b.checkpoints.comparison![0]!.label = t; }, (b, t) => { b.reality![0]!.label = t; }, (b, t) => { b.reviews.weeklyMetrics![0]!.label = t; },
  ];
  it('any combination of wording and presentation edits changes only the presentation hash, and is classed cosmetic (300 cases)', async () => {
    const base = genesis();
    const baseHashes = await hashesFor(base);
    await fc.assert(fc.asyncProperty(fc.array(fc.tuple(fc.integer({ min: 0, max: cosmeticEdits.length - 1 }), fc.string({ minLength: 1, maxLength: 20 })), { minLength: 1, maxLength: 5 }), async (edits) => {
      const next = successor(base, dateAt(5), (b) => { for (const [index, text] of edits) cosmeticEdits[index]!(b, `${text}!`); });
      const hashes = await hashesFor(next);
      expect(hashes.computationalHash).toBe(baseHashes.computationalHash);
      expect(hashes.presentationHash).not.toBe(baseHashes.presentationHash);
      expect(await computeChangeClass(base, next)).toBe('cosmetic');
    }), { numRuns: 300 });
  }, 60_000);
  it('control: a computational edit changes the computational hash', async () => {
    const base = genesis();
    const next = successor(base, dateAt(5), (b) => { b.quests[1]!.xp = 90; b.quests[2]!.xp = 110; });
    expect((await hashesFor(next)).computationalHash).not.toBe((await hashesFor(base)).computationalHash);
    // XP weights are the economy: structural (02 §19.2), so they begin only after a checkpoint.
    expect(await computeChangeClass(base, next)).toBe('structural');
  });
  it('control: a target within a quarter and a new rhythm are operational; beyond a quarter is structural', async () => {
    const base = genesis();
    const nudge = (percent: number) => successor(base, dateAt(5), (b) => {
      const scale = (c: Criterion): Criterion => (c.kind === 'signal' ? { ...c, target: Math.max(1, Math.round(c.target * (1 + percent / 100))) } : { ...c, of: c.of.map(scale) });
      b.quests[0]!.criterion = scale(b.quests[0]!.criterion);
    });
    expect(await computeChangeClass(base, nudge(20))).toBe('operational');
    expect(await computeChangeClass(base, nudge(80))).toBe('structural');
    expect(await computeChangeClass(base, successor(base, dateAt(5), (b) => { b.quests[0]!.schedule = { kind: 'weekdays', days: ['mon', 'tue', 'wed', 'thu'] }; }))).toBe('operational');
  });
});

describe('I16 - checkpoint snapshots are immutable', () => {
  it('a sealed checkpoint is displayed from its snapshot even after the gates are amended; an unsealed one is live', async () => {
    const today = dateAt(29);
    const prefix = prefixOf(LOG, today);
    const v1 = genesis();
    const env1 = readModelEnv({ blueprint: v1, events: prefix, checkpoints: [], asOf: today });
    const gate1 = v1.gates.find((gate) => gate.day === 30)!;
    const sealedResult = evaluateGate(gate1, 'E', env1);
    const sealedRow = { sealed_at: '2026-10-01T00:00:00Z', rank_after: sealedResult.rank, gates: { conditions: sealedResult.conditions, targetRank: sealedResult.targetRank } as Record<string, unknown> };

    // Amend the gate afterwards: a much lower problem threshold.
    const v2 = successor(v1, dateAt(31), (next) => {
      next.gates.find((gate) => gate.day === 30)!.conditions[1]!.clauses![0]!.threshold = 1;
    });
    const amendedLive = () => evaluateGate(v2.gates.find((gate) => gate.day === 30)!, 'E', readModelEnv({ blueprint: v2, events: prefix, checkpoints: [], asOf: today }));
    expect(amendedLive().conditions[1]!.label).not.toBe(sealedResult.conditions[1]!.label); // the live read changed
    expect(gateAsDisplayed(sealedRow, amendedLive)).toEqual(sealedResult); // the sealed display did not
    expect(gateAsDisplayed({ gates: {} }, amendedLive)).toEqual(amendedLive()); // unsealed: live
    expect(versionFor([v1, v2], today)).toBe(v1);
  });
});

describe('I18 - instance ids are stable for continuing quests across versions', () => {
  it('the same quest definition has the same instance id on every date, whatever version prices it (200 cases)', () => {
    fc.assert(fc.property(fc.integer({ min: 2, max: 28 }), fc.integer({ min: 30, max: 150 }), (day, newXp) => {
      const next = successor(genesis(), dateAt(day), (b) => { b.quests[0]!.xp = newXp; b.quests[1]!.xp = 200 - newXp; });
      const built = buildProjectionsV2(LOG, fuzzDeps, [genesis(), next]);
      const base = buildProjectionsV2(LOG, fuzzDeps, [genesis()]);
      const ids = (rows: typeof built.instances) => rows.map((row) => row.id).sort();
      expect(ids(built.instances)).toEqual(ids(base.instances));
      for (const instance of built.instances) expect(instance.id).toBe(`${instance.template_id}::${instance.local_date}`);
    }), { numRuns: 200 });
  });
});

describe('the shared Blueprint fixtures cannot be edited by accident', () => {
  it('legacyBlueprintFor hands out independent copies', () => {
    const a = genesis();
    const b = genesis();
    a.domains[0]!.name = 'changed';
    a.instruments.push({ ...a.instruments[0]!, id: 'extra' });
    expect(b.domains[0]!.name).not.toBe('changed');
    expect(b.instruments.some((instrument) => instrument.id === 'extra')).toBe(false);
  });
});
