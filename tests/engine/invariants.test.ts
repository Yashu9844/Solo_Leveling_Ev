// Loop 9.5: the invariants of platform/04 §31.2 that are properties of GENERATED Systems and their logs. (I3, I4, I7, I8, I13,
// I16 and I18 live in integrity-invariants.test.ts, I11 in generator-blueprint, I17 in generator-presets, I19 in
// time-correctness; the registry at the bottom proves each is still where support/invariants.ts says it is.)
//
//   INVARIANT_RUNS=12   (default, pull requests)      INVARIANT_RUNS=300   (nightly)
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { evaluateAttributes } from '../../src/blueprint/evaluate/attribute';
import { evaluateBosses } from '../../src/blueprint/evaluate/boss';
import { evaluateGate } from '../../src/blueprint/evaluate/gate';
import { readModelEnv } from '../../src/blueprint/evaluate/readModel';
import { hashesFor } from '../../src/blueprint/hash';
import { resolveBlueprints, versionFor } from '../../src/blueprint/resolve';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { buildProjections } from '../../src/db/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { levelFor } from '../../src/engine/level';
import { engineConfigFromBlueprint } from '../../src/blueprint/engineConfig';
import { VOICE_PACK } from '../../src/engine/voicePack';
import { INVARIANT_COVERAGE, INVARIANT_RUNS, randomSystem } from './support/invariants';
import { personaEventLog, type PersonaProfileKind } from './support/personaEventLog';
import { fuzzDeps, mulberry32, randomEventLog } from './support/randomEventLog';

const deps = { now: () => '2027-12-31T00:00:00.000Z', newId: () => 'persona-id' };
const PROFILES: PersonaProfileKind[] = ['steady', 'lapsing', 'burst', 'adversarial'];
const seeds = (count = INVARIANT_RUNS, from = 1): number[] => Array.from({ length: count }, (_, i) => from + i);
const profileFor = (seed: number): PersonaProfileKind => PROFILES[seed % PROFILES.length]!;

/** Changes every word, glyph and colour a person can see and nothing a rule can read. */
function relabel(blueprint: SystemBlueprint): SystemBlueprint {
  const copy = structuredClone(blueprint);
  copy.identity.displayName = 'RENAMED';
  copy.domains.forEach((domain, i) => {
    domain.name = `Renamed ${i}`;
    domain.designation = `NEW NAME ${i}`;
    domain.description = 'Reworded.';
    domain.presentation = { icon: 'Star', hue: 'coral' };
  });
  for (const quest of copy.quests) { quest.designation = `QUEST ${quest.id.length}`; quest.realityLabel = 'reworded'; quest.objective = 'Reworded.'; }
  for (const instrument of copy.instruments) { instrument.label = `Label ${instrument.id.length}`; instrument.logVerb = 'Log Something'; }
  for (const group of copy.attributes.groups) { group.heading = 'RENAMED'; group.tagline = 'REWORDED'; }
  for (const definition of copy.attributes.defs) { definition.name = `ATTR ${definition.id.length}`; definition.description = 'Reworded.'; }
  for (const boss of copy.bosses) boss.title = `RENAMED ${boss.id}`;
  return copy;
}

const gateMet = (blueprint: SystemBlueprint, env: ReturnType<typeof readModelEnv>) => blueprint.gates.map((gate) => evaluateGate(gate, 'E', env).conditions.map((condition) => condition.met));

describe('I1 - renaming a domain or designation never changes XP', () => {
  for (const seed of seeds()) {
    it(`seed ${seed}`, () => {
      const { blueprint } = randomSystem(seed);
      const profile = { kind: profileFor(seed), days: 40 };
      const before = buildProjectionsV2(personaEventLog(blueprint, seed, profile), deps);
      const after = buildProjectionsV2(personaEventLog(relabel(blueprint), seed, profile), deps);
      expect(after.ledger).toEqual(before.ledger);
      expect(after.playerState).toEqual(before.playerState);
    });
  }
});

describe('I2 - changing an icon, hue or designation never changes evidence, gates, attributes or bosses', () => {
  for (const seed of seeds()) {
    it(`seed ${seed}`, () => {
      const { blueprint } = randomSystem(seed);
      const renamed = relabel(blueprint);
      const profile = { kind: profileFor(seed), days: 50 };
      const asOf = '2026-10-20';
      const read = (system: SystemBlueprint) => {
        const events = personaEventLog(system, seed, profile).filter((event) => event.local_date <= asOf);
        const env = readModelEnv({ blueprint: system, events, checkpoints: [], asOf });
        return {
          attributes: evaluateAttributes(system, env).map(({ attribute, value, components }) => ({ attribute, value, components })),
          gates: gateMet(system, env),
          bosses: evaluateBosses(system.bosses, env, events).map((status) => status.conditions.map((condition) => condition.met)),
        };
      };
      expect(read(renamed)).toEqual(read(blueprint));
    });
  }
});

describe('I5 - XP only ever comes from valid configured sources', () => {
  for (const seed of seeds()) {
    it(`seed ${seed}`, () => {
      const { blueprint } = randomSystem(seed);
      const events = personaEventLog(blueprint, seed, { kind: profileFor(seed), days: 60 });
      const { versions } = resolveBlueprints(events);
      const built = buildProjectionsV2(events, deps);
      const global = new Set(['recovery', 'boss', 'weekly_quest']);
      for (const row of built.ledger) {
        const version = versionFor(versions, row.local_date)!;
        const grants = new Set(version.instruments.flatMap((instrument) => {
          const grant = (instrument.params as { grant?: { reason?: string } }).grant;
          return grant?.reason ? [grant.reason] : [];
        }));
        const source = row.reason.startsWith('core:') ? version.quests.some((quest) => `core:${quest.id}` === row.reason) : grants.has(row.reason) || global.has(row.reason);
        expect(source, `${row.local_date} ${row.reason}`).toBe(true);
      }
    });
  }
});

describe('I6 - rank stays evidence-driven: external and body measurements never move a gate, an attribute or XP', () => {
  for (const seed of seeds()) {
    it(`seed ${seed}`, () => {
      const { blueprint } = randomSystem(seed);
      const events = personaEventLog(blueprint, seed, { kind: 'steady', days: 50 });
      const random = mulberry32(seed + 1000);
      const scrambled = events.map((event) => (event.type === 'METRIC_RECORDED' ? { ...event, payload: { ...event.payload, value: Math.round(random() * 1000) / 10 } } : event));
      const asOf = '2026-10-20';
      const env = (log: typeof events) => readModelEnv({ blueprint, events: log.filter((event) => event.local_date <= asOf), checkpoints: [], asOf });
      expect(gateMet(blueprint, env(scrambled))).toEqual(gateMet(blueprint, env(events)));
      expect(evaluateAttributes(blueprint, env(scrambled))).toEqual(evaluateAttributes(blueprint, env(events)));
      expect(buildProjectionsV2(scrambled, deps).ledger).toEqual(buildProjectionsV2(events, deps).ledger);
    });
  }
});

describe('I9 - level is a pure function of total XP; total XP never decreases', () => {
  for (const seed of seeds()) {
    it(`seed ${seed}`, () => {
      const { blueprint } = randomSystem(seed);
      const built = buildProjectionsV2(personaEventLog(blueprint, seed, { kind: profileFor(seed), days: 70 }), deps);
      const config = engineConfigFromBlueprint(blueprint);
      expect(built.playerState!.level).toBe(levelFor(built.playerState!.total_xp, config).level);
      let running = 0;
      for (const day of built.dayRollups) {
        expect(day.xp_earned).toBeGreaterThanOrEqual(0);
        const next = running + day.xp_earned;
        expect(next).toBeGreaterThanOrEqual(running);
        running = next;
      }
      expect(running).toBe(built.playerState!.total_xp);
      for (const total of [0, 1, 279, 280, 5000, 70000]) {
        const level = levelFor(total, config).level;
        expect(levelFor(total + 1, config).level).toBeGreaterThanOrEqual(level);
      }
    });
  }
});

describe('I10 - daily XP stays within the cap, and each channel within its own', () => {
  for (const seed of seeds()) {
    it(`seed ${seed}`, () => {
      const { blueprint } = randomSystem(seed);
      const built = buildProjectionsV2(personaEventLog(blueprint, seed, { kind: profileFor(seed) === 'steady' ? 'burst' : profileFor(seed), days: 60 }), deps);
      const caps = new Map(blueprint.domains.map((domain) => [domain.channel.id, domain.channel.cap]));
      const days = new Map<string, { capped: number; byChannel: Map<string, number> }>();
      for (const row of built.ledger) {
        if (row.category === 'BONUS' || row.category === 'BOSS') continue;
        const day = days.get(row.local_date) ?? { capped: 0, byChannel: new Map() };
        day.capped += row.amount;
        day.byChannel.set(row.category, (day.byChannel.get(row.category) ?? 0) + row.amount);
        days.set(row.local_date, day);
      }
      for (const [date, day] of days) {
        expect(day.capped, date).toBeLessThanOrEqual(blueprint.progression.dailyCap);
        for (const [channel, total] of day.byChannel) expect(total, `${date} ${channel}`).toBeLessThanOrEqual(caps.get(channel) ?? Infinity);
      }
    });
  }
});

describe('I12 - legacy equivalence (the owner\'s engine and the Blueprint engine agree)', () => {
  it(`E1 over ${INVARIANT_RUNS * 2} random raw-event logs: the five cache tables are deep-equal`, () => {
    for (const seed of seeds(INVARIANT_RUNS * 2, 5000)) {
      const events = randomEventLog(seed);
      expect(buildProjectionsV2(events, fuzzDeps), `seed ${seed}`).toEqual(buildProjections(events, DEFAULT_CONFIG, fuzzDeps));
    }
  }, 120_000);
  // The full corpus - golden-120, 100+ activity seeds, 1,000 fuzz logs and the E2 read models - is `npm run shadow` (nightly).
});

describe('I14 - generated core XP sums to 500', () => {
  for (const seed of seeds(INVARIANT_RUNS * 3, 100)) {
    it(`seed ${seed}`, () => {
      const { blueprint, issues } = randomSystem(seed);
      expect(issues.filter((issue) => issue.severity === 'error' && issue.code !== 'V-DOM-03')).toEqual([]);
      expect(blueprint.quests.filter((quest) => quest.type === 'core').reduce((sum, quest) => sum + quest.xp, 0)).toBe(500);
    });
  }
});

describe('I15 - first-unit dominance: showing up across all domains beats grinding one', () => {
  for (const seed of seeds(INVARIANT_RUNS * 3, 200)) {
    it(`seed ${seed}`, () => {
      const { blueprint } = randomSystem(seed);
      const xp = new Map(blueprint.quests.map((quest) => [quest.domainId, quest.xp]));
      const engines = blueprint.domains.filter((domain) => domain.role === 'engine' && xp.has(domain.id));
      for (const a of engines) {
        const headroom = a.channel.cap - xp.get(a.id)!;
        for (const b of engines) if (a !== b) expect(xp.get(b.id)!, `${b.designation} core vs ${a.designation} headroom`).toBeGreaterThanOrEqual(headroom);
      }
    });
  }
});

describe('I13 - the hashes agree with cosmetic changes (spot check beside integrity-invariants)', () => {
  for (const seed of seeds(Math.min(INVARIANT_RUNS, 6), 300)) {
    it(`seed ${seed}`, async () => {
      const { blueprint } = randomSystem(seed);
      const before = await hashesFor(blueprint);
      const after = await hashesFor(relabel(blueprint));
      expect(after.computationalHash).toBe(before.computationalHash);
      expect(after.presentationHash).not.toBe(before.presentationHash);
    });
  }
});

describe('I20 - messages never mention a domain absent from the Blueprint', () => {
  it('a generated System\'s own templates and labels name only its own domains', () => {
    const owner = ['DSA', 'ASCENSION', 'LOGIC TRIAL', 'FORGE', 'RECONSTITUTION', 'WILL TRIAL', 'VITALITY TRIAL'];
    for (const seed of seeds(INVARIANT_RUNS, 400)) {
      const { blueprint } = randomSystem(seed);
      const own = new Set(blueprint.domains.map((domain) => domain.designation));
      const text = JSON.stringify([blueprint.messaging, blueprint.reviews, blueprint.checkpoints.comparison]).toUpperCase();
      for (const word of owner) if (!own.has(word)) expect(text, `${word} in seed ${seed}`).not.toContain(word);
    }
  });

  it('the voice pack\'s only owner-specific line is the one Phase 12 retires', () => {
    const owner = ['ASCENSION', 'LOGIC TRIAL', 'FORGE', 'RECONSTITUTION', 'WILL TRIAL', 'VITALITY TRIAL'];
    expect(VOICE_PACK.filter((message) => owner.some((word) => message.text.toUpperCase().includes(word))).map((message) => message.id)).toEqual(['morning-zero-004']);
  });
});

describe('the registry: every invariant of 04 §31.2 is checked somewhere, and where the registry says', () => {
  it('I1 to I20 are all present', () => {
    expect(Object.keys(INVARIANT_COVERAGE)).toEqual(Array.from({ length: 20 }, (_, i) => `I${i + 1}`));
  });

  for (const [id, where] of Object.entries(INVARIANT_COVERAGE)) {
    it(`${id} is in ${where.file}`, () => {
      const path = fileURLToPath(new URL(`./${where.file}`, import.meta.url));
      expect(existsSync(path), where.file).toBe(true);
      expect(readFileSync(path, 'utf-8')).toMatch(new RegExp(`\\b${where.mention}\\b`));
    });
  }
});
