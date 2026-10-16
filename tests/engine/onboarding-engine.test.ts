// Loop 10.1: the pure question engine. Its content here is a small stand-in; the real questions are loop 10.2.
import { describe, expect, it } from 'vitest';
import {
  activeAnswers, applyAnswer, clearAnswer, defaultFor, echoFor, evaluate, expand, isComplete, livePlan, newDraft, nextQuestion, rankedAreas, setTier,
  stageStatuses, validateAnswer, withDefaults,
} from '../../src/onboarding/engine';
import { AREA_BUDGET, type InterviewDraft, type QuestionDef } from '../../src/onboarding/types';
import { mulberry32 } from './support/randomEventLog';

const AREAS = [
  { value: 'career', label: 'Career' }, { value: 'knowledge', label: 'Knowledge' }, { value: 'body', label: 'Body' }, { value: 'creativity', label: 'Creativity' },
];
const ONCE = { always: true } as const;

const QUESTIONS: QuestionDef[] = [
  { id: 'name', stage: 'DESIGNATION', tier: 'quick', heading: 'WHAT SHOULD THE SYSTEM CALL YOU?', kind: 'text_short', eligibility: ONCE, writes: 'identity.displayName', bounds: { maxLength: 24 }, echo: 'REGISTERED. {answer}.' },
  { id: 'areas', stage: 'INTENT', tier: 'quick', heading: 'WHAT ARE YOU HERE TO CHANGE?', kind: 'multi_card', options: AREAS, eligibility: ONCE, writes: 'areas', count: { min: 2, max: 4 }, default: { firstOption: true, count: 3 }, echo: 'AREAS REGISTERED: {answer}.' },
  { id: 'priorities', stage: 'HIERARCHY', tier: 'quick', heading: 'WHAT MATTERS MOST?', kind: 'rank', rankFrom: 'areas', eligibility: { has: 'areas' }, writes: 'priorities', default: { copy: 'areas' } },
  {
    id: 'resolution', stage: 'RESOLUTION', tier: 'quick', heading: '{area} — FOR WHAT?', kind: 'single_card', each: 'area', eligibility: { has: 'areas', value: '{area}' }, writes: 'area.{area}.resolution',
    options: { from: '{area}', map: { knowledge: [{ value: 'exam', label: 'An exam' }, { value: 'language', label: 'A language' }], career: [{ value: 'jobs', label: 'Jobs' }], body: [{ value: 'strength', label: 'Strength' }], creativity: [{ value: 'making', label: 'Making' }] } },
    default: { firstOption: true }, echo: '{area} REGISTERED AS {answer}.',
  },
  { id: 'examDate', stage: 'RESOLUTION', tier: 'guided', heading: '{area} — WHEN IS THE EXAM?', kind: 'date', each: 'area', eligibility: { has: 'area.{area}.resolution', value: 'exam' }, writes: 'area.{area}.examDate', default: { today: true, days: 94 } },
  { id: 'goodDay', stage: 'MEASURE', tier: 'guided', heading: '{area} — ON A GOOD DAY?', kind: 'number', each: 'area', eligibility: { has: 'areas', value: '{area}' }, writes: 'area.{area}.goodDay', bounds: { min: 1, max: 500, step: 1 }, default: { const: 30 } },
  { id: 'hardDay', stage: 'MEASURE', tier: 'guided', heading: '{area} — ON A HARD DAY?', kind: 'number', each: 'area', eligibility: { has: 'area.{area}.goodDay' }, writes: 'area.{area}.hardDay', bounds: { min: 1, max: 500, step: 1 }, default: { scale: { from: 'area.{area}.goodDay', factor: 1 / 3, min: 1 } } },
  { id: 'evidence', stage: 'MEASURE', tier: 'guided', heading: '{area} — WHAT WOULD CONVINCE YOU?', kind: 'single_card', each: 'area', eligibility: { has: 'area.{area}.hardDay' }, writes: 'area.{area}.evidence', options: [{ value: 'link', label: 'A link' }, { value: 'count', label: 'A count' }], default: { firstOption: true } },
  { id: 'extra1', stage: 'MEASURE', tier: 'guided', heading: '{area} — ONE MORE?', kind: 'number', each: 'area', eligibility: { has: 'area.{area}.evidence' }, writes: 'area.{area}.extra1', default: { const: 1 } },
  { id: 'extra2', stage: 'MEASURE', tier: 'guided', heading: '{area} — AND ANOTHER?', kind: 'number', each: 'area', eligibility: { has: 'area.{area}.extra1' }, writes: 'area.{area}.extra2', default: { const: 1 } },
  { id: 'wake', stage: 'RHYTHM', tier: 'quick', heading: 'WHEN DOES YOUR DAY BEGIN?', kind: 'dial', eligibility: ONCE, writes: 'rhythm.wakeTime', default: { const: '07:00' } },
  { id: 'sleep', stage: 'RHYTHM', tier: 'quick', heading: 'WHEN DOES IT END?', kind: 'dial', eligibility: ONCE, writes: 'rhythm.sleepTime', default: { const: '23:00' } },
  { id: 'length', stage: 'ARC', tier: 'quick', heading: 'HOW LONG IS THIS ARC?', kind: 'single_card', options: [{ value: '60', label: '60 days' }, { value: '120', label: '120 days' }], eligibility: ONCE, writes: 'arc.lengthDays', default: { const: '120' } },
  { id: 'place', stage: 'TRIGGERS', tier: 'guided', heading: 'WHERE?', kind: 'text_short', eligibility: ONCE, writes: 'intentions.place' },
];

const ctx = { today: '2026-09-01' };
const present = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

/** Answers every open question the way the walk wants (valid answers only), returning the order they were asked in. */
function walk(draft: InterviewDraft, pick: (key: string) => unknown, limit = 200): { draft: InterviewDraft; asked: string[] } {
  const asked: string[] = [];
  for (let i = 0; i < limit; i++) {
    const instance = nextQuestion(draft, QUESTIONS);
    if (!instance) return { draft, asked };
    asked.push(instance.key);
    const value = pick(instance.key) ?? defaultFor(instance, draft.answers, ctx) ?? 'somewhere';
    const applied = applyAnswer(draft, instance, value);
    if (applied.error) throw new Error(`${instance.key}: ${applied.error}`);
    draft = applied.draft;
  }
  throw new Error('the interview did not terminate');
}

const guided = () => newDraft('guided');
const answered = (pairs: Record<string, unknown>, tier: 'quick' | 'guided' = 'guided'): InterviewDraft => ({ tier, answers: pairs });

describe('predicates', () => {
  const answers = { areas: ['career', 'body'], n: 5, s: 'x', empty: '' };
  it('evaluates has, eq, gte, and, or, not', () => {
    expect(evaluate({ has: 'areas' }, answers)).toBe(true);
    expect(evaluate({ has: 'areas', value: 'body' }, answers)).toBe(true);
    expect(evaluate({ has: 'areas', value: 'knowledge' }, answers)).toBe(false);
    expect(evaluate({ has: 'empty' }, answers)).toBe(false);
    expect(evaluate({ has: 'missing' }, answers)).toBe(false);
    expect(evaluate({ eq: ['s', 'x'] }, answers)).toBe(true);
    expect(evaluate({ gte: ['n', 5] }, answers)).toBe(true);
    expect(evaluate({ gte: ['n', 6] }, answers)).toBe(false);
    expect(evaluate({ gte: ['s', 1] }, answers)).toBe(false);
    expect(evaluate({ and: [{ has: 'n' }, { not: { has: 'nope' } }] }, answers)).toBe(true);
    expect(evaluate({ or: [{ has: 'nope' }, { eq: ['n', 5] }] }, answers)).toBe(true);
  });

  it('is serialisable: a predicate survives JSON unchanged', () => {
    for (const question of QUESTIONS) expect(JSON.parse(JSON.stringify(question.eligibility))).toEqual(question.eligibility);
    expect(JSON.parse(JSON.stringify(QUESTIONS))).toEqual(QUESTIONS);
  });
});

describe('order', () => {
  it('asks by stage; within a stage the once-only questions first, then each area in turn in the order the person ranked them', () => {
    const { asked } = walk(guided(), (key) => ({
      name: 'Ada', areas: ['career', 'knowledge', 'body'], priorities: ['knowledge', 'body', 'career'],
    } as Record<string, unknown>)[key]);
    expect(asked.slice(0, 3)).toEqual(['name', 'areas', 'priorities']);
    expect(asked.slice(3, 6)).toEqual(['resolution@knowledge', 'examDate@knowledge', 'resolution@body']);
    // MEASURE: one area at a time, in rank order (knowledge, body, career), a question at a time - within each area's budget of four
    // (knowledge spends two on RESOLUTION, so only goodDay and hardDay fit; body spends one, so evidence fits too).
    const measure = asked.filter((key) => /^(goodDay|hardDay|evidence)@/.test(key));
    expect(measure.slice(0, 2)).toEqual(['goodDay@knowledge', 'hardDay@knowledge']);
    expect(measure.slice(2, 5)).toEqual(['goodDay@body', 'hardDay@body', 'evidence@body']);
    expect(asked.at(-1)).toBe('place');
    const stages = asked.map((key) => QUESTIONS.find((question) => question.id === key.split('@')[0])!.stage);
    expect([...stages].sort((a, b) => ['DESIGNATION', 'INTENT', 'HIERARCHY', 'RESOLUTION', 'MEASURE', 'GUARDRAILS', 'RHYTHM', 'ARC', 'TRIGGERS', 'BASELINE'].indexOf(a) - ['DESIGNATION', 'INTENT', 'HIERARCHY', 'RESOLUTION', 'MEASURE', 'GUARDRAILS', 'RHYTHM', 'ARC', 'TRIGGERS', 'BASELINE'].indexOf(b))).toEqual(stages);
  });

  it('areas not yet ranked follow the ranked ones in the order chosen', () => {
    expect(rankedAreas({ areas: ['career', 'body', 'knowledge'], priorities: ['knowledge'] })).toEqual(['knowledge', 'career', 'body']);
    expect(rankedAreas({ areas: ['career'], priorities: ['gone', 'career'] })).toEqual(['career']);
    expect(rankedAreas({})).toEqual([]);
  });
});

describe('tiers and the question budget', () => {
  it('Quick asks only the quick questions and at most one per area', () => {
    const { asked } = walk(newDraft('quick'), (key) => ({ name: 'Ada', areas: ['career', 'knowledge'], priorities: ['career', 'knowledge'] } as Record<string, unknown>)[key]);
    expect(asked).toEqual(['name', 'areas', 'priorities', 'resolution@career', 'resolution@knowledge', 'wake', 'sleep', 'length']);
  });

  it('Guided asks at most four per area, however many the content offers', () => {
    const { asked } = walk(guided(), (key) => ({ name: 'Ada', areas: ['knowledge', 'body'], priorities: ['knowledge', 'body'], 'resolution@knowledge': 'exam' } as Record<string, unknown>)[key]);
    const perArea = asked.filter((key) => key.endsWith('@knowledge'));
    expect(perArea).toHaveLength(AREA_BUDGET.guided);
    expect(perArea).toEqual(['resolution@knowledge', 'examDate@knowledge', 'goodDay@knowledge', 'hardDay@knowledge']);
    expect(asked).not.toContain('evidence@knowledge');
  });

  it('a draft can be moved from Quick to Guided and asks the rest', () => {
    const quickDone = withDefaults(newDraft('quick'), QUESTIONS, ctx);
    // Quick cannot be completed without a name and areas (no defaults for a name), so give them first.
    const named = applyAnswer(applyAnswer(newDraft('quick'), nextQuestion(newDraft('quick'), QUESTIONS)!, 'Ada').draft, { key: 'areas', def: QUESTIONS[1]!, writes: 'areas', heading: '' }, ['career', 'body']).draft;
    const done = withDefaults(named, QUESTIONS, ctx);
    expect(isComplete(done, QUESTIONS)).toBe(true);
    expect(nextQuestion(setTier(done, 'guided'), QUESTIONS)).not.toBeNull();
    void quickDone;
  });
});

describe('changing an answer re-evaluates downstream; answers that stop applying are kept but inert', () => {
  const base = walk(guided(), (key) => ({ name: 'Ada', areas: ['knowledge', 'body', 'career'], priorities: ['knowledge', 'body', 'career'], 'resolution@knowledge': 'exam', 'examDate@knowledge': '2026-12-04' } as Record<string, unknown>)[key]).draft;

  it('the exam date counts while the area is an exam', () => {
    expect(activeAnswers(base, QUESTIONS)['area.knowledge.examDate']).toBe('2026-12-04');
  });

  it('switching the area to a language makes the exam date inert but does not lose it; switching back restores it', () => {
    const instance = livePlan(base, QUESTIONS).find((candidate) => candidate.key === 'resolution@knowledge')!;
    const language = applyAnswer(base, instance, 'language').draft;
    expect(language.answers['area.knowledge.examDate']).toBe('2026-12-04');
    expect(activeAnswers(language, QUESTIONS)['area.knowledge.examDate']).toBeUndefined();
    expect(livePlan(language, QUESTIONS).some((candidate) => candidate.key === 'examDate@knowledge')).toBe(false);
    const back = applyAnswer(language, instance, 'exam').draft;
    expect(activeAnswers(back, QUESTIONS)['area.knowledge.examDate']).toBe('2026-12-04');
    expect(nextQuestion(back, QUESTIONS)).toBeNull();
  });

  it('dropping an area drops its questions and answers from play; adding it back picks them up where they were', () => {
    const without = applyAnswer(base, { key: 'areas', def: QUESTIONS[1]!, writes: 'areas', heading: '' }, ['knowledge', 'career']).draft;
    expect(livePlan(without, QUESTIONS).some((instance) => instance.area === 'body')).toBe(false);
    expect(Object.keys(activeAnswers(without, QUESTIONS)).some((path) => path.startsWith('area.body.'))).toBe(false);
    expect(without.answers['area.body.resolution']).toBe('strength');
    const withBody = applyAnswer(without, { key: 'areas', def: QUESTIONS[1]!, writes: 'areas', heading: '' }, ['knowledge', 'career', 'body']).draft;
    expect(activeAnswers(withBody, QUESTIONS)['area.body.resolution']).toBe('strength');
    expect(nextQuestion(withBody, QUESTIONS)).toBeNull();
  });

  it('clearing an answer asks it again', () => {
    const cleared = clearAnswer(base, 'rhythm.wakeTime');
    expect(nextQuestion(cleared, QUESTIONS)!.key).toBe('wake');
  });
});

describe('validation', () => {
  const instance = (id: string, area?: string) => expand(QUESTIONS, { areas: ['knowledge', 'career'] }).find((candidate) => candidate.key === (area ? `${id}@${area}` : id))!;
  const answers = { areas: ['knowledge', 'career'] };

  it('cards must be among the options; multi-cards respect their count; ranks must be a permutation', () => {
    expect(validateAnswer(instance('resolution', 'knowledge'), answers, 'exam')).toEqual({ ok: true, value: 'exam' });
    expect(validateAnswer(instance('resolution', 'knowledge'), answers, 'jobs').ok).toBe(false); // that is a career option
    expect(validateAnswer(instance('areas'), answers, ['career']).ok).toBe(false); // min 2
    expect(validateAnswer(instance('areas'), answers, ['career', 'body', 'knowledge', 'creativity', 'career']).ok).toBe(true); // de-duplicated to 4
    expect(validateAnswer(instance('areas'), answers, ['a', 'b']).ok).toBe(false);
    expect(validateAnswer(instance('priorities'), answers, ['career', 'knowledge'])).toEqual({ ok: true, value: ['career', 'knowledge'] });
    expect(validateAnswer(instance('priorities'), answers, ['career']).ok).toBe(false);
    expect(validateAnswer(instance('priorities'), answers, ['career', 'career']).ok).toBe(false);
  });

  it('numbers are clamped and snapped, times and dates are checked, text is trimmed and cut', () => {
    expect(validateAnswer(instance('goodDay', 'career'), answers, 9999)).toEqual({ ok: true, value: 500 });
    expect(validateAnswer(instance('goodDay', 'career'), answers, '0')).toEqual({ ok: true, value: 1 });
    expect(validateAnswer(instance('goodDay', 'career'), answers, 12.6)).toEqual({ ok: true, value: 13 });
    expect(validateAnswer(instance('goodDay', 'career'), answers, 'many').ok).toBe(false);
    expect(validateAnswer(instance('goodDay', 'career'), answers, Number.NaN).ok).toBe(false);
    expect(validateAnswer(instance('wake'), answers, '07:30').ok).toBe(true);
    expect(validateAnswer(instance('wake'), answers, '25:00').ok).toBe(false);
    expect(validateAnswer(instance('wake'), answers, '7:30').ok).toBe(false);
    expect(validateAnswer(instance('examDate', 'knowledge'), answers, '2026-02-30').ok).toBe(false);
    expect(validateAnswer(instance('examDate', 'knowledge'), answers, '2026-12-04').ok).toBe(true);
    expect(validateAnswer(instance('name'), answers, '   Ada\n\tLovelace   ')).toEqual({ ok: true, value: 'Ada Lovelace' });
    expect(validateAnswer(instance('name'), answers, 'x'.repeat(100))).toMatchObject({ ok: true, value: 'x'.repeat(24) });
    expect(validateAnswer(instance('name'), answers, '   ').ok).toBe(false);
  });

  it('a refused answer leaves the draft exactly as it was', () => {
    const draft = guided();
    const result = applyAnswer(draft, instance('name'), '');
    expect(result.error).toBeDefined();
    expect(result.draft).toBe(draft);
  });
});

describe('defaults and echoes', () => {
  it('a hard day defaults to a third of the good day, never below one', () => {
    const hard = expand(QUESTIONS, { areas: ['career'] }).find((instance) => instance.key === 'hardDay@career')!;
    expect(defaultFor(hard, { areas: ['career'], 'area.career.goodDay': 30 }, ctx)).toBe(10);
    expect(defaultFor(hard, { areas: ['career'], 'area.career.goodDay': 1 }, ctx)).toBe(1);
    expect(defaultFor(hard, { areas: ['career'] }, ctx)).toBeUndefined();
  });

  it('an exam date defaults to 94 days from today, and the first option is the default of a card question', () => {
    const exam = expand(QUESTIONS, { areas: ['knowledge'] }).find((instance) => instance.key === 'examDate@knowledge')!;
    expect(defaultFor(exam, {}, ctx)).toBe('2026-12-04');
    const resolution = expand(QUESTIONS, { areas: ['knowledge'] }).find((instance) => instance.key === 'resolution@knowledge')!;
    expect(defaultFor(resolution, { areas: ['knowledge'] }, ctx)).toBe('exam');
  });

  it('the System replies with one line that reflects the answer back, in capitals, without praise', () => {
    const draft = answered({ areas: ['knowledge'], 'area.knowledge.resolution': 'exam', 'identity.displayName': 'Ada' });
    const plan = expand(QUESTIONS, draft.answers);
    expect(echoFor(plan.find((instance) => instance.key === 'name')!, draft.answers, QUESTIONS)).toBe('REGISTERED. ADA.');
    expect(echoFor(plan.find((instance) => instance.key === 'resolution@knowledge')!, draft.answers, QUESTIONS)).toBe('KNOWLEDGE REGISTERED AS AN EXAM.');
    expect(echoFor(plan.find((instance) => instance.key === 'goodDay@knowledge')!, draft.answers, QUESTIONS)).toBeNull(); // no echo defined
  });
});

describe('the spine', () => {
  it('marks stages done, current, pending, or skipped for the tier', () => {
    const start = stageStatuses(newDraft('quick'), QUESTIONS);
    expect(start.DESIGNATION).toBe('current');
    expect(start.INTENT).toBe('pending');
    expect(start.TRIGGERS).toBe('skipped'); // guided only
    const done = withDefaults(applyAnswer(applyAnswer(newDraft('quick'), expand(QUESTIONS, {}).find((i) => i.key === 'name')!, 'Ada').draft, expand(QUESTIONS, {}).find((i) => i.key === 'areas')!, ['career', 'body']).draft, QUESTIONS, ctx);
    const end = stageStatuses(done, QUESTIONS);
    expect(end.DESIGNATION).toBe('done');
    expect(end.INTENT).toBe('done');
    expect(end.RHYTHM).toBe('done');
  });
});

describe('every path terminates (property)', () => {
  it('random valid walks end, never repeat a question, only ask eligible in-budget ones, and never mutate the draft', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const random = mulberry32(seed);
      let draft: InterviewDraft = newDraft(random() < 0.5 ? 'quick' : 'guided');
      const seen = new Set<string>();
      let steps = 0;
      for (; steps < 400; steps++) {
        const frozen = JSON.stringify(draft);
        const instance = nextQuestion(draft, QUESTIONS);
        expect(JSON.stringify(draft), `seed ${seed}: nextQuestion mutated the draft`).toBe(frozen);
        if (!instance) break;
        expect(livePlan(draft, QUESTIONS).some((candidate) => candidate.key === instance.key), `seed ${seed}: ${instance.key} is not in the live plan`).toBe(true);
        // Sometimes change an earlier answer instead (the person goes back).
        if (steps > 6 && random() < 0.15) {
          const paths = Object.keys(draft.answers);
          const path = paths[Math.floor(random() * paths.length)]!;
          const earlier = expand(QUESTIONS, draft.answers).find((candidate) => candidate.writes === path);
          if (earlier) {
            const options = earlier.def.kind === 'multi_card' ? [AREAS.slice(0, 2 + Math.floor(random() * 3)).map((area) => area.value)] : undefined;
            const redo = applyAnswer(draft, earlier, options ? options[0] : defaultFor(earlier, draft.answers, ctx));
            if (!redo.error) draft = redo.draft;
            continue;
          }
        }
        // A question is asked once: if it is asked again its answer must have been taken away by going back.
        expect(seen.has(instance.key) && present(draft.answers[instance.writes]), `seed ${seed}: ${instance.key} asked twice`).toBe(false);
        seen.add(instance.key);
        const raw = instance.key === 'name' ? 'Ada' : instance.key === 'areas' ? AREAS.slice(0, 2 + Math.floor(random() * 3)).map((area) => area.value) : instance.def.kind === 'rank' ? [...(draft.answers.areas as string[])].sort(() => random() - 0.5) : defaultFor(instance, draft.answers, ctx) ?? 'somewhere';
        const result = applyAnswer(draft, instance, raw);
        expect(result.error, `seed ${seed}: ${instance.key} refused ${JSON.stringify(raw)}`).toBeUndefined();
        draft = result.draft;
      }
      expect(steps, `seed ${seed} did not terminate`).toBeLessThan(400);
      expect(nextQuestion(draft, QUESTIONS)).toBeNull();
      const perArea = new Map<string, number>();
      for (const instance of livePlan(draft, QUESTIONS)) if (instance.area) perArea.set(instance.area, (perArea.get(instance.area) ?? 0) + 1);
      for (const count of perArea.values()) expect(count).toBeLessThanOrEqual(AREA_BUDGET[draft.tier]);
    }
  });
});
