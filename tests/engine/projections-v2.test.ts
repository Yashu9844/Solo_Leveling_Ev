// platform/05 loop 4.3 — buildProjectionsV2 against buildProjections: all five
// cache tables, deep-equal, on every corpus (E1, platform/02 §22.2). Also the
// Blueprint-as-EngineConfig bridge and the resolver's implicit-legacy rule.
import { describe, expect, it } from 'vitest';
import { engineConfigFromBlueprint } from '../../src/blueprint/engineConfig';
import { buildProjectionsV2, implicitLegacyVersions } from '../../src/blueprint/engine/projections';
import { LEGACY_BLUEPRINT_V1, legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { buildProjections } from '../../src/db/projections';
import { DEFAULT_CONFIG, engineConfigFor } from '../../src/engine/config';
import { generateCoreQuestTemplates } from '../../src/engine/quests';
import type { SystemEvent } from '../../src/engine/types';
import { legacyActivityLog } from './support/legacyActivityLog';
import { fuzzDeps, randomEventLog } from './support/randomEventLog';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

function assertE1(events: SystemEvent[], label: string) {
  const legacy = buildProjections(events, DEFAULT_CONFIG, fuzzDeps);
  const v2 = buildProjectionsV2(events, fuzzDeps);
  expect(json(v2.templates), `${label} templates`).toEqual(json(legacy.templates));
  expect(json(v2.instances), `${label} instances`).toEqual(json(legacy.instances));
  expect(json(v2.ledger), `${label} ledger`).toEqual(json(legacy.ledger));
  expect(json(v2.dayRollups), `${label} dayRollups`).toEqual(json(legacy.dayRollups));
  expect(json(v2.playerState), `${label} playerState`).toEqual(json(legacy.playerState));
  return legacy;
}

describe('buildProjectionsV2 (loop 4.3)', () => {
  it('is deep-equal to buildProjections on the golden 120-day log', () => {
    const legacy = assertE1(legacyActivityLog({ seed: 42, days: 120 }), 'golden');
    // A real arc: templates, instances, ledger, rollups and a player.
    expect(legacy.templates).toHaveLength(6);
    expect(legacy.instances.length).toBeGreaterThan(500);
    expect(legacy.ledger.length).toBeGreaterThan(500);
    expect(legacy.dayRollups.length).toBeGreaterThan(90);
    expect(legacy.playerState!.total_xp).toBeGreaterThan(10_000);
  });

  it('is deep-equal over 100 more activity seeds', () => {
    for (let seed = 1; seed <= 100; seed++) assertE1(legacyActivityLog({ seed, days: 50, skipRate: 0.2 }), `seed ${seed}`);
  });

  it('is deep-equal over 400 raw-event fuzz logs (toggles, undo, recovery, bosses)', () => {
    for (let seed = 1; seed <= 400; seed++) assertE1(randomEventLog(seed), `fuzz ${seed}`);
  });

  it('is deep-equal for an arc that is not the owner default (own start date, timezone, boundary)', () => {
    const events = legacyActivityLog({ seed: 3, days: 30 }).map((e) => e.type === 'ARC_STARTED'
      ? { ...e, payload: { ...e.payload, timezone: 'America/New_York', dayBoundaryHour: 5, dayCloseHour: 4 } }
      : e);
    assertE1(events, 'new-york');
  });

  it('returns nothing for an empty log or a log without an arc', () => {
    expect(buildProjectionsV2([], fuzzDeps)).toEqual({ templates: [], instances: [], ledger: [], dayRollups: [], playerState: null });
    expect(buildProjectionsV2(randomEventLog(1).slice(1), fuzzDeps).templates).toEqual([]);
  });

  it('an arc that was never opened has templates but no instances, rollups or player', () => {
    const events = legacyActivityLog({ seed: 1, days: 5 }).filter((e) => e.type === 'ARC_STARTED');
    const v2 = assertE1(events, 'never-opened');
    expect(v2.templates).toHaveLength(6);
    expect(v2.playerState).toBeNull();
  });

  it('follows the Blueprint: a changed core XP changes the ledger and the level, a rename changes nothing', () => {
    const events = legacyActivityLog({ seed: 42, days: 40 });
    const base = buildProjectionsV2(events, fuzzDeps);
    const renamed = legacyBlueprintFor(OWNER_ARC_DEFAULTS);
    renamed.domains[0]!.designation = 'CLIMB';
    renamed.quests[0]!.designation = 'CLIMB';
    expect(json(buildProjectionsV2(events, fuzzDeps, [renamed]).ledger)).toEqual(json(base.ledger));
    const richer = legacyBlueprintFor(OWNER_ARC_DEFAULTS);
    richer.quests.find((q) => q.id === 'dsa')!.xp = 90;
    richer.quests.find((q) => q.id === 'build')!.xp = 110;
    expect(buildProjectionsV2(events, fuzzDeps, [richer]).playerState!.total_xp).not.toBe(base.playerState!.total_xp);
  });
});

describe('Blueprint as EngineConfig (loop 4.3)', () => {
  it('LEGACY_BLUEPRINT_V1 yields exactly the owner config', () => {
    expect(engineConfigFromBlueprint(LEGACY_BLUEPRINT_V1)).toEqual(DEFAULT_CONFIG);
  });
  it('an arc-specific legacy Blueprint yields engineConfigFor(arc)', () => {
    const arc = { ...OWNER_ARC_DEFAULTS, start_date: '2026-10-05', end_date: '2027-02-01', timezone: 'Europe/Berlin', day_boundary_hour: 5, day_close_hour: 4 };
    expect(engineConfigFromBlueprint(legacyBlueprintFor(arc))).toEqual(engineConfigFor({ ...arc }));
  });
  it('writes the same quest_template rows as engine/quests.ts', () => {
    const legacy = generateCoreQuestTemplates('legacy-arc', {}, DEFAULT_CONFIG, fuzzDeps);
    const v2 = buildProjectionsV2(legacyActivityLog({ seed: 1, days: 3 }), fuzzDeps).templates;
    expect(json(v2)).toEqual(json(legacy.map((t) => ({ ...t, implementation_intention: v2.find((x) => x.key === t.key)!.implementation_intention }))));
  });
});

describe('implicit legacy resolution (loop 4.3, formalised in 5.2)', () => {
  it('a log with an arc resolves to one legacy version for that arc; without an arc, none', () => {
    const versions = implicitLegacyVersions(legacyActivityLog({ seed: 1, days: 3 }));
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, changeClass: 'genesis', provenance: { generator: 'legacy' }, arcId: 'legacy-arc', activeFrom: '2026-09-01' });
    expect(implicitLegacyVersions([])).toEqual([]);
  });
});
