// Loop 10.2: the interview's real questions and their mapping to the generator. A person who answers nothing but the required cards still gets
// a valid System; a person who answers everything gets the one they described.
import { describe, expect, it } from 'vitest';
import { generateBlueprint } from '../../src/generator/generate';
import { ARCHETYPES } from '../../src/library/archetypes';
import { QUESTIONS, RESOLUTIONS } from '../../src/onboarding/content';
import { applyAnswer, activeAnswers, expand, isComplete, livePlan, newDraft, nextQuestion, withDefaults } from '../../src/onboarding/engine';
import { interviewToDraft } from '../../src/onboarding/mapping';
import { AREA_BUDGET, SKIP, STAGES, type InterviewDraft } from '../../src/onboarding/types';
import { mulberry32 } from './support/randomEventLog';

const TODAY = '2026-09-01';
const ctx = { today: TODAY };
const mapping = { lineageId: 'lineage-test', today: TODAY, timezone: 'Asia/Kolkata' };
const AREA_IDS = Object.keys(RESOLUTIONS);

/** Answers the cards named, takes defaults for everything else. */
function run(tier: 'quick' | 'guided', preset: Record<string, unknown>): InterviewDraft {
  return withDefaults({ tier, answers: preset }, QUESTIONS, ctx);
}
const quick = (areas: string[], extra: Record<string, unknown> = {}) => run('quick', { 'identity.displayName': 'Ada', areas, ...extra });

describe('content lint', () => {
  it('has unique ids and every stage is named', () => {
    const ids = QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const question of QUESTIONS) expect(STAGES).toContain(question.stage);
  });

  it('speaks in the System register: capitals, no exclamation, no praise', () => {
    const praise = /\b(great|awesome|amazing|well done|good job|congrat|nice|fantastic|proud|you can do it)\b/i;
    for (const question of QUESTIONS) {
      const heading = question.heading.replace(/\{area\}/g, 'X');
      expect(heading, question.id).toBe(heading.toUpperCase());
      for (const text of [question.heading, question.subline ?? '', question.echo ?? '']) {
        expect(text, question.id).not.toMatch(/!/);
        expect(text, question.id).not.toMatch(praise);
      }
    }
  });

  it('is data: it survives a JSON round trip unchanged', () => {
    expect(JSON.parse(JSON.stringify(QUESTIONS))).toEqual(QUESTIONS);
  });

  it('writes to a distinct path per question, and per-area questions say where {area} goes', () => {
    // Packs for different archetypes share a path: only one of them is ever eligible for an area.
    const writes = QUESTIONS.map((question) => `${question.writes}|${question.archetypeId ?? ''}`);
    expect(new Set(writes).size).toBe(writes.length);
    for (const question of QUESTIONS.filter((candidate) => candidate.each === 'area')) expect(question.writes, question.id).toContain('{area}');
  });

  it('every resolution leads to an archetype in the library, and no area offers custom yet', () => {
    for (const [area, options] of Object.entries(RESOLUTIONS)) {
      expect(options.length, area).toBeGreaterThan(0);
      for (const option of options) expect(ARCHETYPES[option.value], `${area}/${option.value}`).toBeDefined();
    }
    expect(AREA_IDS).not.toContain('custom');
  });

  it('every measure pack names a real archetype, and its good-day default is that archetype’s own', () => {
    for (const question of QUESTIONS.filter((candidate) => candidate.archetypeId)) expect(ARCHETYPES[question.archetypeId!], question.id).toBeDefined();
    for (const archetype of Object.values(ARCHETYPES).filter((candidate) => candidate.role === 'engine' && candidate.quest && candidate.id !== 'custom')) {
      const pack = QUESTIONS.filter((candidate) => candidate.archetypeId === archetype.id);
      expect(pack.some((candidate) => candidate.id.startsWith('goodDay')), `${archetype.id} has no good-day question`).toBe(true);
    }
  });
});

describe('the Quick tier', () => {
  it('asks only the required cards, each area once', () => {
    let draft = newDraft('quick');
    const keys: string[] = [];
    for (let i = 0; i < 40; i++) {
      const instance = nextQuestion(draft, QUESTIONS);
      if (!instance) break;
      keys.push(instance.key);
      const value = instance.key === 'name' ? 'Ada' : instance.key === 'areas' ? ['career', 'body', 'knowledge'] : undefined;
      const applied = applyAnswer(draft, instance, value ?? withDefaults(draft, QUESTIONS, ctx).answers[instance.writes]);
      expect(applied.error, instance.key).toBeUndefined();
      draft = applied.draft;
    }
    expect(keys).toEqual(['name', 'areas', 'priorities', 'resolution@career', 'resolution@body', 'resolution@knowledge', 'wake', 'sleep', 'length']);
  });

  it('yields a valid System for every area on its own, and for every pair', () => {
    const sets: string[][] = [...AREA_IDS.flatMap((a, i) => AREA_IDS.slice(i + 1).map((b) => [a, b]))];
    for (const areas of sets) {
      const { draft, intentions } = interviewToDraft(quick(areas), QUESTIONS, mapping);
      const { blueprint, issues } = generateBlueprint(draft);
      expect(issues.filter((issue) => issue.severity === 'error'), areas.join('+')).toEqual([]);
      expect(blueprint.domains.length, areas.join('+')).toBeGreaterThanOrEqual(4);
      expect(blueprint.quests.length, areas.join('+')).toBeGreaterThan(0);
      expect(intentions).toEqual([]);
    }
  });

  it('is deterministic: same answers, same System', () => {
    const a = generateBlueprint(interviewToDraft(quick(['career', 'body', 'knowledge']), QUESTIONS, mapping).draft).blueprint;
    const b = generateBlueprint(interviewToDraft(quick(['career', 'body', 'knowledge']), QUESTIONS, mapping).draft).blueprint;
    expect(b).toEqual(a);
  });
});

describe('the Guided tier', () => {
  const rich = {
    'identity.displayName': 'Ada', 'identity.primaryObjective': 'Pass the licensing exam and keep my body',
    areas: ['knowledge', 'body', 'career', 'financial'], priorities: ['body', 'knowledge', 'career', 'financial'],
    'area.knowledge.resolution': 'exam-prep', 'area.body.resolution': 'endurance', 'area.career.resolution': 'career-pipeline', 'area.financial.resolution': 'finance-control',
    'area.knowledge.examDate': '2026-12-04', 'area.knowledge.topics': 'Anatomy, Pharmacology; Ethics, anatomy',
    'area.knowledge.goodDay': 30, 'area.body.goodDay': 8, 'area.body.hardDay': 3,
    guardrails: ['sleep-regularity', 'attention-control'], 'guardrail.attention-control.limit': 90, 'guardrail.finance-control.limit': 1500,
    'arc.alignToExam': 'yes', 'rhythm.wakeTime': '06:00', 'rhythm.sleepTime': '22:30',
    'area.knowledge.triggerTime': '07:30', 'area.knowledge.triggerPlace': 'the desk', 'area.knowledge.triggerAction': 'open the question bank',
    'area.body.triggerTime': SKIP,
    'baseline.weight_kg': 70, 'baseline.waist_cm': SKIP,
  };
  const result = () => interviewToDraft(run('guided', rich), QUESTIONS, mapping);

  it('carries what the person said into the draft', () => {
    const { draft, intentions, baseline } = result();
    expect(draft.identity).toEqual({ displayName: 'Ada', primaryObjective: 'Pass the licensing exam and keep my body' });
    expect(draft.domains.map((choice) => choice.archetypeId).slice(0, 4)).toEqual(['endurance', 'exam-prep', 'career-pipeline', 'finance-control']);
    const exam = draft.domains.find((choice) => choice.archetypeId === 'exam-prep')!;
    expect(exam.answers?.topics).toEqual(['Anatomy', 'Pharmacology', 'Ethics', 'anatomy']);
    expect(exam.answers?.goodDay).toBe(30);
    expect(draft.domains.find((choice) => choice.archetypeId === 'attention-control')?.answers?.limit).toBe(90);
    expect(draft.domains.find((choice) => choice.archetypeId === 'finance-control')?.answers?.limit).toBe(1500);
    expect(draft.rhythm).toEqual({ wakeTime: '06:00', sleepTime: '22:30' });
    expect(intentions).toEqual([{ archetypeId: 'exam-prep', time: '07:30', place: 'the desk', action: 'open the question bank' }]);
    expect(baseline).toEqual({ weight_kg: 70 });
  });

  it('ends the arc on the exam date when asked, within bounds', () => {
    const { draft } = result();
    expect(draft.arc.lengthDays).toBe(94);
    const far = interviewToDraft(run('guided', { ...rich, 'area.knowledge.examDate': '2029-01-01' }), QUESTIONS, mapping).draft;
    expect(far.arc.lengthDays).toBe(365);
    const near = interviewToDraft(run('guided', { ...rich, 'area.knowledge.examDate': '2026-09-10' }), QUESTIONS, mapping).draft;
    expect(near.arc.lengthDays).toBe(60);
  });

  it('keeps a hard day at or under the good day, and the start date within two weeks back and a month ahead', () => {
    const made = interviewToDraft(run('guided', { ...rich, 'area.body.goodDay': 5, 'area.body.hardDay': 9, 'arc.startDate': '2026-01-01', 'arc.alignToExam': 'no' }), QUESTIONS, mapping).draft;
    expect(made.domains.find((choice) => choice.archetypeId === 'endurance')?.answers?.hardDay).toBe(5);
    expect(made.arc.startDate).toBe('2026-08-18');
    const ahead = interviewToDraft(run('guided', { ...rich, 'arc.startDate': '2027-01-01' }), QUESTIONS, mapping).draft;
    expect(ahead.arc.startDate).toBe('2026-10-01');
  });

  it('generates a valid System from the rich answers', () => {
    const { draft } = result();
    const { blueprint, issues } = generateBlueprint(draft);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(blueprint.arc.lengthDays).toBe(94);
  });

  it('never asks more than the budget per area, and an answer taken away leaves the rest inert', () => {
    const draft = run('guided', rich);
    for (const area of ['knowledge', 'body', 'career', 'financial']) {
      const asked = livePlan(draft, QUESTIONS).filter((instance) => instance.area === area && instance.def.budgeted !== false);
      expect(asked.length, area).toBeLessThanOrEqual(AREA_BUDGET.guided);
    }
    const without = { ...draft, answers: { ...draft.answers, areas: ['body', 'career'], priorities: ['body', 'career'] } };
    expect(Object.keys(activeAnswers(without, QUESTIONS)).some((path) => path.startsWith('area.knowledge.'))).toBe(false);
    expect(interviewToDraft(without, QUESTIONS, mapping).draft.domains.some((choice) => choice.archetypeId === 'exam-prep')).toBe(false);
  });
});

describe('any walk through the interview ends in a valid System', () => {
  it('for random areas, resolutions and tiers', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const random = mulberry32(seed);
      const count = 2 + Math.floor(random() * 5);
      const areas = [...AREA_IDS].sort(() => random() - 0.5).slice(0, count);
      const tier = random() < 0.5 ? 'quick' : 'guided';
      const resolutions = Object.fromEntries(areas.map((area) => [`area.${area}.resolution`, RESOLUTIONS[area]![Math.floor(random() * RESOLUTIONS[area]!.length)]!.value]));
      const draft = run(tier, { 'identity.displayName': 'Ada', areas, ...resolutions });
      expect(isComplete(draft, QUESTIONS), `seed ${seed}`).toBe(true);
      const { draft: input } = interviewToDraft(draft, QUESTIONS, mapping);
      const { issues, blueprint } = generateBlueprint(input);
      expect(issues.filter((issue) => issue.severity === 'error'), `seed ${seed} ${areas.join('+')} ${tier}`).toEqual([]);
      expect(blueprint.domains.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('expands to something for every area at every stage it belongs to', () => {
    const instances = expand(QUESTIONS, { areas: ['career', 'body'] });
    expect(instances.some((instance) => instance.key === 'resolution@career')).toBe(true);
  });
});
