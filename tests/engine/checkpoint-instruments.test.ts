// Loop 13.3: the self-report instruments of a checkpoint ask the System's own questions, on fixed scales, and the owner's keep their wording.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { instrumentIds, INSTRUMENT_SCALES, validateInstrumentAnswers } from '../../src/blueprint/evaluate/checkpointInstruments';
import { legacyBlueprintFor } from '../../src/blueprint/legacy/legacyV1';
import { db } from '../../src/db/db';
import { generateBlueprint } from '../../src/generator';
import { getCheckpoint, InstrumentAnswerError, instrumentsComplete, saveCheckpointInstruments, type Automaticity, type Enjoyment, type SelfEfficacy } from '../../src/store/checkpoint';
import { AUTOMATICITY_QUESTIONS, ENJOYMENT_QUESTIONS, SELF_EFFICACY_QUESTIONS } from '../../src/ui/components/InstrumentSliders';
import { p1 } from '../fixtures/personas/p1';
import { p2 } from '../fixtures/personas/p2';
import { p3 } from '../fixtures/personas/p3';
import { p4 } from '../fixtures/personas/p4';
import { p5 } from '../fixtures/personas/p5';
import { p6 } from '../fixtures/personas/p6';
import { p7 } from '../fixtures/personas/p7';

const FOREIGN_TO_OTHERS = /\b(DSA|interviewer|agent|evaluation suite|senior engineer)\b/i;
let counter = 0;
const deps = { newId: () => 'cp-' + counter++ };
const legacy = legacyBlueprintFor();
const answers = (checkpoints: typeof legacy.checkpoints) => ({
  selfEfficacy: checkpoints.selfEfficacy.map(() => 70),
  automaticity: checkpoints.automaticity.map(() => 5),
  enjoyment: checkpoints.enjoyment.map(() => 8),
});

describe('the questions', () => {
  it('the owner\'s are the original six, four and three, in their original words', () => {
    expect(legacy.checkpoints.selfEfficacy.map((item) => item.prompt)).toEqual([...SELF_EFFICACY_QUESTIONS]);
    expect(legacy.checkpoints.automaticity.map((item) => item.prompt)).toEqual([...AUTOMATICITY_QUESTIONS]);
    expect(legacy.checkpoints.enjoyment.map((item) => item.prompt)).toEqual([...ENJOYMENT_QUESTIONS]);
  });

  for (const persona of [p1, p2, p3, p4, p5, p6, p7]) {
    it(`${persona.id}: six self-efficacy, four automaticity, one enjoyment per engine domain (up to four) - about its own domains`, () => {
      const { blueprint } = generateBlueprint(persona.draft);
      const { selfEfficacy, automaticity, enjoyment } = blueprint.checkpoints;
      expect(selfEfficacy).toHaveLength(6);
      expect(automaticity).toHaveLength(4);
      const engines = blueprint.domains.filter((domain) => domain.role === 'engine');
      expect(enjoyment.length).toBe(Math.min(4, engines.length));
      for (const item of enjoyment) expect(engines.some((domain) => domain.id === item.domainId), item.id).toBe(true);
      const hasPractice = blueprint.instruments.some((instrument) => instrument.type === 'practice_item');
      if (!hasPractice) for (const item of [...selfEfficacy, ...enjoyment]) expect(item.prompt, item.id).not.toMatch(FOREIGN_TO_OTHERS);
      expect(new Set([...selfEfficacy, ...automaticity, ...enjoyment].map((item) => item.id)).size).toBe(selfEfficacy.length + automaticity.length + enjoyment.length);
    });
  }
});

describe('what the writer accepts', () => {
  const { blueprint } = generateBlueprint(p3.draft);

  it('exactly the System\'s questions, on their scales', () => {
    expect(validateInstrumentAnswers(blueprint.checkpoints, answers(blueprint.checkpoints))).toEqual([]);
    expect(validateInstrumentAnswers(legacy.checkpoints, answers(legacy.checkpoints))).toEqual([]);
    expect(validateInstrumentAnswers(blueprint.checkpoints, { selfEfficacy: [50] })).toEqual(['selfEfficacy: 1 answers for 6 questions']);
    expect(validateInstrumentAnswers(blueprint.checkpoints, { automaticity: [4, 4, 4, 9] })).toEqual(['automaticity: 9 is outside 1-7']);
    expect(validateInstrumentAnswers(blueprint.checkpoints, { enjoyment: blueprint.checkpoints.enjoyment.map(() => -1) })[0]).toMatch(/outside 0-10/);
    expect(validateInstrumentAnswers(blueprint.checkpoints, { selfEfficacy: [NaN, 1, 2, 3, 4, 5] })[0]).toMatch(/outside 0-100/);
    expect(validateInstrumentAnswers(blueprint.checkpoints, {})).toEqual([]);
  });

  it('the scales are the same for every System', () => {
    expect(INSTRUMENT_SCALES).toEqual({ selfEfficacy: { min: 0, max: 100, step: 10, start: 50 }, automaticity: { min: 1, max: 7, step: 1, start: 4 }, enjoyment: { min: 0, max: 10, step: 1, start: 5 } });
  });
});

describe('stored', () => {
  beforeEach(async () => { await db.checkpoint.clear(); });

  it('a generated System\'s answers record which questions they answer; the owner\'s keep the shape they always had', async () => {
    const { blueprint } = generateBlueprint(p1.draft);
    await saveCheckpointInstruments(30, answers(blueprint.checkpoints), deps, blueprint);
    const row = (await getCheckpoint(30))!;
    expect(instrumentsComplete(row)).toBe(true);
    expect((row.self_efficacy as unknown as SelfEfficacy).ids).toEqual(instrumentIds(blueprint.checkpoints, 'selfEfficacy'));
    expect((row.enjoyment as unknown as Enjoyment).ids).toEqual(blueprint.checkpoints.enjoyment.map((item) => item.id));
    expect((row.automaticity as unknown as Automaticity).items).toEqual([5, 5, 5, 5]);

    await saveCheckpointInstruments(60, answers(legacy.checkpoints), deps, legacy);
    const owner = (await getCheckpoint(60))!;
    expect(owner.self_efficacy).toEqual({ items: [70, 70, 70, 70, 70, 70], mean: 70 });
    expect(owner.enjoyment).toEqual({ items: [8, 8, 8], mean: 8 });
  });

  it('refuses answers that are not the System\'s questions, and writes nothing', async () => {
    const { blueprint } = generateBlueprint(p1.draft);
    await expect(saveCheckpointInstruments(30, { selfEfficacy: [50, 50, 50] }, deps, blueprint)).rejects.toBeInstanceOf(InstrumentAnswerError);
    expect(await getCheckpoint(30)).toBeUndefined();
  });
});
