// platform/05 loop 5.4 — projections under several Blueprint versions.
// Properties over 1,000 random version histories:
//   H2  activating a version never changes a day before its start date
//   H3  a quest that continues keeps its instance ids; a retired one stops
//   H6  every ledger row names the version that priced it, and a day can be
//       rebuilt in isolation (from the log up to it) with the same result
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildProjectionsV2, stampsVersions } from '../../src/blueprint/engine/projections';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { versionFor } from '../../src/blueprint/resolve';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { buildProjections } from '../../src/db/projections';
import type { XpLedgerRow } from '../../src/db/schema';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { SystemEvent } from '../../src/engine/types';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { prefixOf } from './support/legacyDb';
import { fuzzDeps } from './support/randomEventLog';

const arcFacts = { ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID };
const genesis = (): SystemBlueprint => legacyBlueprintFor(arcFacts);
/** Rows without the stamp, so a stamped and an unstamped build of the same days compare equal. */
const withoutStamp = <T extends { blueprint_version?: number }>(row: T): Omit<T, 'blueprint_version'> => {
  const copy = { ...row };
  delete copy.blueprint_version;
  return copy;
};
const unstamped = (rows: XpLedgerRow[]) => rows.map(withoutStamp);
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

type Mutation =
  | { kind: 'rebalance'; from: number; to: number; amount: number }
  | { kind: 'cap'; domain: number; cap: number }
  | { kind: 'grant'; amount: number }
  | { kind: 'retire'; quest: number }
  | { kind: 'rename' };

const mutationArb: fc.Arbitrary<Mutation> = fc.oneof(
  fc.record({ kind: fc.constant('rebalance' as const), from: fc.integer({ min: 0, max: 5 }), to: fc.integer({ min: 0, max: 5 }), amount: fc.integer({ min: 5, max: 30 }) }),
  fc.record({ kind: fc.constant('cap' as const), domain: fc.integer({ min: 0, max: 7 }), cap: fc.integer({ min: 40, max: 250 }) }),
  fc.record({ kind: fc.constant('grant' as const), amount: fc.integer({ min: 5, max: 60 }) }),
  fc.record({ kind: fc.constant('retire' as const), quest: fc.integer({ min: 0, max: 5 }) }),
  fc.record({ kind: fc.constant('rename' as const) })
);

/** Cumulative history: v1 is the implicit legacy System, each later version edits its predecessor and starts on a later day. */
function history(days: number[], mutations: Mutation[]): SystemBlueprint[] {
  const versions = [genesis()];
  days.forEach((day, index) => {
    const next = structuredClone(versions[index]!);
    next.version = index + 2;
    next.activeFrom = dateAt(day);
    next.changeClass = 'operational';
    const mutation = mutations[index % mutations.length]!;
    switch (mutation.kind) {
      case 'rebalance': {
        const [a, b] = [next.quests[mutation.from % next.quests.length], next.quests[mutation.to % next.quests.length]];
        if (a && b && a !== b && a.xp - mutation.amount >= 30) { a.xp -= mutation.amount; b.xp += mutation.amount; }
        break;
      }
      case 'cap': next.domains[mutation.domain % next.domains.length]!.channel.cap = mutation.cap; break;
      case 'grant': {
        const blocks = next.instruments.find((instrument) => instrument.id === 'foundations.blocks')!;
        blocks.params = { ...blocks.params, grant: { amount: mutation.amount, reason: 'learning_block' } };
        break;
      }
      case 'retire': {
        const quest = next.quests[mutation.quest % next.quests.length];
        if (quest && next.quests.length > 4) {
          next.quests = next.quests.filter((candidate) => candidate.id !== quest.id);
          const domain = next.domains.find((candidate) => candidate.id === quest.domainId);
          if (domain) delete domain.coreQuestId;
        }
        break;
      }
      case 'rename': next.domains[0]!.name = `Renamed ${index}`; break;
    }
    versions.push(next);
  });
  return versions;
}

const historyArb = fc.record({
  days: fc.uniqueArray(fc.integer({ min: 3, max: 24 }), { minLength: 0, maxLength: 4 }).map((days) => days.sort((a, b) => a - b)),
  mutations: fc.array(mutationArb, { minLength: 1, maxLength: 4 }),
});

const LOG: SystemEvent[] = legacyActivityLog({ seed: 11, days: 28, skipRate: 0.1 });
const BASELINE = buildProjectionsV2(LOG, fuzzDeps, [genesis()]);

describe('multi-version projections (loop 5.4)', () => {
  it('with only the implicit legacy version nothing changes: still deep-equal to the legacy engine and unstamped', () => {
    const legacy = buildProjections(LOG, DEFAULT_CONFIG, fuzzDeps);
    expect(json(BASELINE)).toEqual(json(legacy));
    expect(stampsVersions([genesis()])).toBe(false);
    expect(BASELINE.ledger.every((row) => row.blueprint_version === undefined)).toBe(true);
  });

  it('H2: activating a version never changes a day before it starts (1,000 random histories)', () => {
    fc.assert(fc.property(historyArb, ({ days, mutations }) => {
      const versions = history(days, mutations);
      const full = buildProjectionsV2(LOG, fuzzDeps, versions);
      for (let i = 0; i < versions.length - 1; i++) {
        const cut = versions[i + 1]!.activeFrom;
        const earlier = buildProjectionsV2(LOG, fuzzDeps, versions.slice(0, i + 1));
        const before = (rows: XpLedgerRow[]) => json(unstamped(rows.filter((row) => row.local_date < cut)));
        expect(before(full.ledger)).toEqual(before(earlier.ledger));
        const rollupsBefore = (rollups: typeof full.dayRollups) => json(rollups.filter((row) => row.local_date < cut).map(withoutStamp));
        expect(rollupsBefore(full.dayRollups)).toEqual(rollupsBefore(earlier.dayRollups));
        const completedBefore = (instances: typeof full.instances) => json(instances.filter((row) => row.local_date < cut));
        expect(completedBefore(full.instances)).toEqual(completedBefore(earlier.instances));
      }
    }), { numRuns: 1000 });
  });

  it('H3: a continuing quest keeps its instance ids; a retired quest stops generating them on its retirement date', () => {
    fc.assert(fc.property(historyArb, ({ days, mutations }) => {
      const versions = history(days, mutations);
      const built = buildProjectionsV2(LOG, fuzzDeps, versions);
      const openDates = [...new Set(built.instances.map((instance) => instance.local_date))];
      for (const date of openDates) {
        const version = versionFor(versions, date)!;
        const expected = version.quests.filter((q) => q.type === 'core').map((q) => `${LEGACY_ARC_ID}::${q.id}::${date}`).sort();
        const actual = built.instances.filter((instance) => instance.local_date === date).map((instance) => instance.id).sort();
        expect(actual, date).toEqual(expected);
      }
      const retired = built.templates.filter((template) => template.active_to !== null);
      for (const template of retired) {
        expect(built.instances.some((instance) => instance.template_id === template.id && instance.local_date >= template.active_to!)).toBe(false);
        expect(built.instances.some((instance) => instance.template_id === template.id && instance.local_date < template.active_to!)).toBe(openDates.some((d) => d < template.active_to!));
      }
    }), { numRuns: 1000 });
  });

  it('H6: every ledger row names the version that priced it, and any day rebuilds identically in isolation', () => {
    fc.assert(fc.property(historyArb, fc.integer({ min: 0, max: 27 }), ({ days, mutations }, probe) => {
      const versions = history(days, mutations);
      const built = buildProjectionsV2(LOG, fuzzDeps, versions);
      const stamped = stampsVersions(versions);
      expect(stamped).toBe(versions.length > 1);
      for (const row of built.ledger) expect(row.blueprint_version, row.id).toBe(stamped ? versionFor(versions, row.local_date)!.version : undefined);
      for (const rollup of built.dayRollups) expect(rollup.blueprint_version).toBe(stamped ? versionFor(versions, rollup.local_date)!.version : undefined);
      const date = dateAt(probe);
      const alone = buildProjectionsV2(prefixOf(LOG, date), fuzzDeps, versions);
      expect(json(alone.ledger.filter((row) => row.local_date === date))).toEqual(json(built.ledger.filter((row) => row.local_date === date)));
    }), { numRuns: 400 });
  });

  it('a version that changes XP re-prices only the days from its start', () => {
    const richer = structuredClone(genesis());
    richer.version = 2;
    richer.activeFrom = dateAt(14);
    richer.quests.find((q) => q.id === 'dsa')!.xp = 70;
    richer.quests.find((q) => q.id === 'build')!.xp = 130;
    const built = buildProjectionsV2(LOG, fuzzDeps, [genesis(), richer]);
    const dsaRows = built.ledger.filter((row) => row.reason === 'core:dsa');
    expect(new Set(dsaRows.filter((row) => row.local_date < dateAt(14)).map((row) => row.amount))).toEqual(new Set([100]));
    expect(new Set(dsaRows.filter((row) => row.local_date >= dateAt(14)).map((row) => row.amount))).toEqual(new Set([70]));
    expect(dsaRows.filter((row) => row.local_date >= dateAt(14)).every((row) => row.blueprint_version === 2)).toBe(true);
  });
});
