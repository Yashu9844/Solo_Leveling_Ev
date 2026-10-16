// Loop 9.3: persona suites P4-P7 (platform/04 §32). The shared assertions run for each; what is particular to each persona is below.
import { describe, expect, it } from 'vitest';
import { generateBlueprint } from '../../src/generator';
import { namesExternalOutcome } from '../../src/library/lexicon';
import { p4 } from '../fixtures/personas/p4';
import { p5 } from '../fixtures/personas/p5';
import { p6 } from '../fixtures/personas/p6';
import { p7 } from '../fixtures/personas/p7';
import { personaEventLog } from './support/personaEventLog';
import { describePersona } from './support/personaSuite';

for (const persona of [p4, p5, p6, p7]) describePersona(persona);

const bp = (persona: typeof p4) => generateBlueprint(persona.draft).blueprint;

describe('P4 - entrepreneur', () => {
  it('revenue and customers are recorded beside the System as outside outcomes, never scored; the boss is the controlled counterpart (B5)', () => {
    const blueprint = bp(p4);
    const external = blueprint.metrics.filter((metric) => metric.kind === 'external').map((metric) => metric.id);
    expect(external).toEqual(expect.arrayContaining(['customers', 'revenue']));
    expect(blueprint.bosses[0]!.title).toBe('THE OFFER STANDS');
    expect(namesExternalOutcome('FIRST CUSTOMER')).toBe(true);
    expect(blueprint.bosses.map((boss) => boss.title).some((title) => namesExternalOutcome(title))).toBe(false);
  });

  it('pipeline outreach drives the domain: qualified outreaches are what its quest asks for', () => {
    const blueprint = bp(p4);
    const quest = blueprint.quests[0]!;
    expect(JSON.stringify(quest.criterion)).toContain('quality_count');
    const events = personaEventLog(blueprint, p4.seed, { kind: 'steady', days: 30 });
    expect(events.some((event) => event.type === 'INSTRUMENT_RECORDED' && event.payload.instrumentType === 'pipeline')).toBe(true);
  });
});

describe('P5 - competitive-exam student', () => {
  it('two domains of one archetype coexist: V-DOM-03 does not fire because their topics differ', () => {
    const { blueprint, issues } = generateBlueprint(p5.draft);
    expect(issues.map((issue) => issue.code)).not.toContain('V-DOM-03');
    const exams = blueprint.domains.filter((domain) => domain.archetypeId === 'exam-prep');
    expect(exams.map((domain) => domain.name)).toEqual(['Exam preparation: Physics', 'Exam preparation: Mathematics']);
    expect(new Set(exams.map((domain) => domain.id)).size).toBe(2);
    expect(blueprint.skills.map((tree) => tree.nodes.map((node) => node.name))).toEqual([
      ['Mechanics', 'Waves', 'Optics', 'Thermodynamics', 'Electromagnetism'], ['Algebra', 'Calculus', 'Geometry', 'Probability'],
    ]);
  });

  it('the same subject twice with the same topics WOULD collide, which is why the interview asks for different ones', () => {
    const twin = generateBlueprint({ ...p5.draft, domains: [{ archetypeId: 'exam-prep' }, { archetypeId: 'exam-prep' }, ...p5.draft.domains.slice(2)] });
    expect(twin.issues.map((issue) => issue.code)).toContain('V-DOM-03');
  });

  it('180 days is an anchor: checkpoints 14/45/90/135/180, and the coefficient is the 180-day one', () => {
    expect(bp(p5).progression.checkpointDays).toEqual([14, 45, 90, 135, 180]);
    expect(bp(p5).progression.level.coefficient).toBe(85);
  });
});

describe('P6 - creative', () => {
  it('its gates carry public-URL evidence (a piece shown, a piece published, a talk shared), not just counts', () => {
    const blueprint = bp(p6);
    const publicConditions = blueprint.gates.flatMap((gate) => gate.conditions).filter((condition) => condition.verifiability === 'public_url');
    expect(publicConditions.length).toBeGreaterThanOrEqual(3);
    const ranks = blueprint.gates.filter((gate) => gate.conditions.some((condition) => condition.verifiability === 'public_url')).map((gate) => gate.rank);
    expect(ranks).toEqual(expect.arrayContaining(['B', 'A', 'S']));
  });

  it('studying and making are balanced by an input/output ratio rule', () => {
    const rule = bp(p6).rules.find((candidate) => candidate.kind === 'MODE_RATIO');
    expect(rule).toMatchObject({ enabled: true, params: { inputMode: 'STUDY', outputMode: 'MAKE', ratio: 3, windowDays: 14 } });
  });
});

