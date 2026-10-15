// Loop 8.3: generator stages S6-S10 - metrics and milestones, skills, attributes, gates, bosses.
// The validator is the judge: whatever the generator writes, the rules about ladders, evidence, bosses and
// attributes (V-GATE, V-BOSS, V-ATT, V-SKL, V-MET, V-REF) must hold, for every arc length and shape.
import { describe, expect, it } from 'vitest';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { validateBlueprint } from '../../src/blueprint/validate';
import { deriveSections, generateCore } from '../../src/generator';
import type { CoreGeneration, DerivedSections, DraftState } from '../../src/generator/types';
import { bossCountFor, bossGatesRank } from '../../src/generator/s10Bosses';
import { ladderThresholds } from '../../src/generator/derive';
import { ARCHETYPES } from '../../src/library/archetypes';

const BASE: DraftState = {
  lineageId: 'arc-derive', today: '2026-09-01',
  identity: { displayName: 'SYSTEM', primaryObjective: 'Ship a working agent and land an offer.' },
  domains: [
    { archetypeId: 'career-pipeline' }, { archetypeId: 'software-practice' }, { archetypeId: 'deep-build' },
    { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' },
  ],
  priorityMode: 'equal', rhythm: { wakeTime: '08:30', sleepTime: '02:00' },
  arc: { startDate: '2026-09-01', lengthDays: 120, timezone: 'Asia/Kolkata' },
};

/** The generated sections inside a Blueprint skeleton: everything S11-S14 will add is empty, so only S1-S10's rules can fire. */
function skeleton(core: CoreGeneration, sections: DerivedSections): SystemBlueprint {
  return {
    schema: 'system-blueprint/1', lineageId: core.draft.lineageId, version: 1, arcId: core.draft.lineageId, activeFrom: core.draft.arc.startDate, changeClass: 'genesis',
    provenance: { generator: 'test', libraryVersion: '1' }, identity: core.draft.identity, arc: core.draft.arc, progression: core.progression,
    domains: core.domains, instruments: core.instruments, quests: core.quests, metrics: sections.metrics, skills: sections.skills,
    attributes: sections.attributes, milestones: sections.milestones, gates: sections.gates, bosses: sections.bosses,
    checkpoints: { selfEfficacy: [], automaticity: [], enjoyment: [], evidence: [], comparison: [] }, achievements: [],
    reviews: { domainPrompts: [] }, rules: [], messaging: { evidenceTemplates: [] }, vocabulary: {}, reality: [],
  };
}

const generate = (draft: DraftState) => {
  const core = generateCore(draft);
  const sections = deriveSections(core);
  return { core, sections, blueprint: skeleton(core, sections) };
};
const errorsOf = (blueprint: SystemBlueprint) => validateBlueprint(blueprint, { today: '2026-09-01' }).filter((issue) => issue.severity === 'error');

describe('generator S6-S10, legacy-shaped answers', () => {
  const { core, sections, blueprint } = generate(BASE);

  it('writes a System the validator accepts (no error among the rules these stages own)', () => {
    expect(core.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(errorsOf(blueprint).map((issue) => `${issue.code} ${issue.path}`)).toEqual([]);
  });

  it('climbs every ladder: C/B/A/S rise and end on the success target', () => {
    expect(ladderThresholds(240)).toEqual([55, 125, 195, 240]);
    expect(ladderThresholds(280)).toEqual([65, 150, 230, 280]); // the owner's 70/150/230/280, within a step
    expect(ladderThresholds(55)).toEqual([13, 29, 45, 55]);
    expect(ladderThresholds(3)).toEqual([1, 2, 3, 4].slice(0, 3).concat(4)); // tiny targets still rise
    for (const milestone of sections.milestones.filter((candidate) => candidate.ladder)) {
      const thresholds = milestone.ladder!.map((rung) => rung.threshold);
      expect(thresholds, milestone.id).toEqual([...thresholds].sort((a, b) => a - b));
      expect(new Set(thresholds).size, milestone.id).toBe(4);
    }
  });

  it('gates: E and D, then C/B/A/S on the arc\'s checkpoint days, each with something a stranger could check', () => {
    expect(sections.gates.map((gate) => [gate.rank, gate.day])).toEqual([['E', 0], ['D', 14], ['C', 30], ['B', 60], ['A', 90], ['S', 120]]);
    for (const gate of sections.gates.filter((candidate) => 'CBAS'.includes(candidate.rank))) {
      expect(gate.conditions.some((condition) => condition.verifiability === 'public_url' || condition.verifiability === 'recorded'), gate.rank).toBe(true);
    }
    const sGate = sections.gates.find((gate) => gate.rank === 'S')!;
    expect(sGate.conditions.map((condition) => condition.id)).toEqual(expect.arrayContaining(['core-band', 'bosses-all', 'arc-sealed']));
    expect(sections.gates.find((gate) => gate.rank === 'B')!.conditions.map((condition) => condition.id)).toContain('boss-i');
  });

  it('bosses: four on a 120-day arc, anchored, at the owner\'s windows, gating B, A and S', () => {
    expect(sections.bosses.map((boss) => [boss.id, boss.windowStartDay, boss.gatesRank])).toEqual([['I', 25, 'B'], ['II', 50, 'A'], ['III', 75, undefined], ['IV', 100, 'S']]);
    const milestoneIds = new Set(sections.milestones.map((milestone) => milestone.id));
    for (const boss of sections.bosses) {
      expect(milestoneIds.has(boss.anchorMilestoneId), boss.id).toBe(true);
      expect(boss.conditions.length, boss.id).toBeGreaterThan(1);
    }
  });

  it('B5: no title names an outcome other people decide, and the external counterpart gates nothing', () => {
    expect(sections.bosses.map((boss) => boss.title)).toEqual(['INTERVIEW READY', 'LOGIC GAUNTLET', 'FIRST PUBLIC RELEASE', 'STEADY STRENGTH']);
    const external = sections.metrics.filter((metric) => metric.kind === 'external' || metric.kind === 'body');
    expect(external.map((metric) => metric.id).sort()).toEqual(expect.arrayContaining(['bodyfat_pct', 'waist_cm', 'weight_kg']));
    const gateText = JSON.stringify([sections.gates, sections.bosses, sections.attributes]);
    for (const metric of external) expect(gateText).not.toContain(metric.id);
    expect(external.some((metric) => metric.kind === 'external')).toBe(true); // interview loops are recorded, never scored
  });

  it('attributes: DISCIPLINE plus one per engine, balanced, in three groups; DISCIPLINE\'s guardrail weights are the owner\'s 0.40/0.35/0.25', () => {
    const { defs, groups } = sections.attributes;
    expect(defs.map((definition) => definition.id)).toEqual(['DISCIPLINE', 'MOMENTUM', 'PROBLEM_SOLVING', 'ENGINEERING', 'VITALITY']);
    expect(groups.map((group) => group.id)).toEqual(['mind', 'craft', 'body']);
    expect(defs[0]!.terms.map((term) => term.weight)).toEqual([0.4, 0.35, 0.25]);
    for (const definition of defs) expect(definition.terms.reduce((sum, term) => sum + term.weight, 0)).toBeCloseTo(1, 6);
  });

  it('skills: the practice domain gets a tree of its topics; metrics keep their instruments', () => {
    expect(sections.skills).toHaveLength(1);
    expect(sections.skills[0]!.nodes.map((node) => node.name)).toEqual(['Arrays', 'Strings', 'Hashing', 'Two Pointers', 'Sliding Window', 'Stacks', 'Trees', 'Graphs', 'DP']);
    expect(sections.metrics.filter((metric) => 'instrumentId' in metric.source).every((metric) => core.instruments.some((instrument) => 'instrumentId' in metric.source && instrument.id === metric.source.instrumentId))).toBe(true);
  });
});

describe('boss schedule by arc length', () => {
  it('60 days -> 2, 90 -> 3, 120 and longer -> 4, and the gating ranks fit', () => {
    expect([60, 74, 75, 90, 104, 105, 120, 365].map(bossCountFor)).toEqual([2, 2, 3, 3, 3, 4, 4, 4]);
    expect([0, 1, 2, 3].map((index) => bossGatesRank(index, 4))).toEqual(['B', 'A', undefined, 'S']);
    expect([0, 1, 2].map((index) => bossGatesRank(index, 3))).toEqual(['B', 'A', 'S']);
    expect([0, 1].map((index) => bossGatesRank(index, 2))).toEqual(['B', 'A']);
  });
});

describe('every arc length and shape the interview can reach', () => {
  const ENGINES = ['career-pipeline', 'software-practice', 'deep-build', 'strength-movement'];
  const GUARDRAILS = ['sleep-regularity', 'attention-control'];

  it('passes the validator at every length from 60 to 365 (a sample of each decade, plus the anchors)', () => {
    for (const lengthDays of [60, 61, 74, 75, 90, 94, 104, 105, 119, 120, 121, 150, 180, 200, 270, 300, 365]) {
      const { blueprint } = generate({ ...BASE, arc: { ...BASE.arc, lengthDays } });
      expect(errorsOf(blueprint).map((issue) => `${issue.code} ${issue.path}`), `${lengthDays} days`).toEqual([]);
    }
  }, 60_000);

  it('passes for every 2-6 engine / 1-2 guardrail combination, ranked or equal', () => {
    for (const engines of [2, 3, 4, 5, 6]) {
      for (const guardrails of [1, 2]) {
        if (engines + guardrails < 4) continue; // the interview asks for four or more core domains (V-DOM-01)
        for (const priorityMode of ['ranked', 'equal'] as const) {
          const domains = [
            ...Array.from({ length: engines }, (_, i) => ({ archetypeId: ENGINES[i % ENGINES.length]! })),
            ...Array.from({ length: guardrails }, (_, i) => ({ archetypeId: GUARDRAILS[i]! })),
          ];
          const { blueprint } = generate({ ...BASE, domains, priorityMode, arc: { ...BASE.arc, lengthDays: 90 } });
          const errors = errorsOf(blueprint).filter((issue) => !['V-DOM-03'].includes(issue.code)); // two of one kind repeat an instrument shape; the interview prevents it
          expect(errors.map((issue) => `${issue.code} ${issue.path}`), `${engines}+${guardrails} ${priorityMode}`).toEqual([]);
          const { sections } = generate({ ...BASE, domains, priorityMode, arc: { ...BASE.arc, lengthDays: 90 } });
          expect(sections.attributes.defs.length).toBeGreaterThanOrEqual(3);
          expect(sections.attributes.defs.length).toBeLessThanOrEqual(6);
        }
      }
    }
  }, 60_000);

  it('a System whose archetypes bring no checkable evidence still gets one: the top engine\'s dated records', () => {
    const { sections, blueprint } = generate({ ...BASE, domains: [{ archetypeId: 'software-practice' }, { archetypeId: 'software-practice' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }] });
    const c = sections.gates.find((gate) => gate.rank === 'C')!;
    expect(c.conditions.some((condition) => condition.id.endsWith('.records') && condition.verifiability === 'recorded')).toBe(true);
    expect(errorsOf(blueprint).filter((issue) => issue.code === 'V-GATE-01')).toEqual([]);
  });

  it('a System with no engine at all has no bosses and no ladder, and still does not throw', () => {
    const { sections, core } = generate({ ...BASE, domains: [{ archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }] });
    expect(core.quests).toHaveLength(2);
    expect(sections.bosses).toEqual([]);
    expect(sections.gates.map((gate) => gate.rank)).toEqual(['E', 'D', 'C', 'B', 'A', 'S']);
  });

  it('is total and deterministic over random drafts (including nonsense answers)', () => {
    let seed = 7;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const ids = Object.keys(ARCHETYPES).concat(['nope']);
    for (let n = 0; n < 150; n++) {
      const count = Math.floor(random() * 9);
      const draft: DraftState = {
        ...BASE,
        lineageId: `fuzz-${n}`,
        domains: Array.from({ length: count }, () => ({
          archetypeId: ids[Math.floor(random() * ids.length)]!,
          answers: random() < 0.5 ? { goodDay: Math.floor(random() * 500) - 50, hardDay: Math.floor(random() * 500), success: random() < 0.5 ? Math.floor(random() * 2000) - 100 : undefined, limit: random() * 1000 - 100, topics: random() < 0.3 ? ['', 'A', 'A'] : undefined } : undefined,
        })),
        priorityMode: random() < 0.5 ? 'ranked' : 'equal',
        arc: { startDate: random() < 0.2 ? 'not-a-date' : BASE.arc.startDate, lengthDays: Math.floor(random() * 600) - 100, timezone: random() < 0.2 ? 'Nowhere/Land' : 'UTC' },
        rhythm: random() < 0.3 ? { wakeTime: '25:99', sleepTime: 'x' } : BASE.rhythm,
      };
      const first = generate(draft);
      const second = generate(draft);
      expect(second.blueprint, `fuzz ${n}`).toEqual(first.blueprint);
    }
  }, 60_000);
});
