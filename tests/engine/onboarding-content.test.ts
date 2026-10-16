// Loop 10.2: the interview's real questions and their mapping to the generator. A person who answers nothing but the required cards still gets
// a valid System; a person who answers everything gets the one they described.
import { describe, expect, it } from 'vitest';
import { generateBlueprint } from '../../src/generator/generate';
import { ARCHETYPES } from '../../src/library/archetypes';
import { CUSTOM_TYPES, customArchetype } from '../../src/library/archetypes/custom';
import { QUESTIONS, RESOLUTIONS } from '../../src/onboarding/content';
import { applyAnswer, activeAnswers, echoFor, expand, isComplete, livePlan, newDraft, nextQuestion, optionsFor, validateAnswer, withDefaults } from '../../src/onboarding/engine';
import { interviewToDraft, questIntentions } from '../../src/onboarding/mapping';
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
    const writes = QUESTIONS.map((question) => `${question.writes}|${question.archetypeId ?? ''}|${question.each ?? ''}`);
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
    for (const question of QUESTIONS.filter((candidate) => candidate.archetypeId)) expect(ARCHETYPES[question.archetypeId!] ?? customArchetype(question.archetypeId!), question.id).toBeDefined();
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
    expect(draft.arc.lengthDays).toBe(95);
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
    expect(blueprint.arc.lengthDays).toBe(95);
    expect(blueprint.arc.endDate).toBe('2026-12-04');
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
      // Guided walks sometimes add things of their own, each an action the person picked, held or pushed.
      const own: Record<string, unknown> = {};
      if (tier === 'guided' && random() < 0.5) {
        const names = ['Piano', 'Chess', 'Sugar', 'Journal'].slice(0, 1 + Math.floor(random() * Math.min(3, 6 - areas.length)));
        own.customs = names.join(', ');
        names.forEach((_, index) => {
          const type = CUSTOM_TYPES.filter((candidate) => candidate !== 'study_block')[Math.floor(random() * 8)]!;
          own[`area.custom${index + 1}.resolution`] = `custom:${type}`;
          if (random() < 0.5) own[`area.custom${index + 1}.holds`] = 'hold';
        });
      }
      // ...and sometimes something added to an area, within the six domains the System can price.
      const kept = areas.slice(0, 6 - (own.customs ? 3 : 0));
      let room = 6 - kept.length - (own.customs ? String(own.customs).split(',').length : 0);
      if (tier === 'guided') {
        for (const area of kept) {
          const others = RESOLUTIONS[area]!.filter((option) => option.value !== resolutions[`area.${area}.resolution`]);
          if (room > 0 && others.length > 0 && random() < 0.4) { own[`area.${area}.also`] = [others[0]!.value]; room--; }
        }
      }
      const draft = run(tier, { 'identity.displayName': 'Ada', areas: kept, ...resolutions, ...own });
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

describe('the System’s replies (Guided)', () => {
  const rich = { areas: ['knowledge', 'body'], 'area.knowledge.resolution': 'exam-prep', 'area.knowledge.examDate': '2026-12-04', 'arc.alignToExam': 'yes' };
  const draft = run('guided', { 'identity.displayName': 'Ada', ...rich });
  const plan = livePlan(draft, QUESTIONS);

  it('counts the days to an exam date and says the arc will end on it', () => {
    const exam = plan.find((instance) => instance.key === 'examDate@knowledge')!;
    expect(echoFor(exam, draft.answers, QUESTIONS, ctx)).toBe('KNOWLEDGE: EXAM REGISTERED. 94 DAYS TO THE EXAM DATE.');
    const align = plan.find((instance) => instance.key === 'alignExam')!;
    expect(echoFor(align, draft.answers, QUESTIONS, ctx)).toBe('THE ARC WILL END ON THE EXAM DATE.');
    expect(echoFor(align, { ...draft.answers, 'arc.alignToExam': 'no' }, QUESTIONS, ctx)).toBe('THE ARC KEEPS THE LENGTH YOU CHOSE.');
  });

  it('says plainly when the date is not ahead, and never prints a negative count', () => {
    const exam = plan.find((instance) => instance.key === 'examDate@knowledge')!;
    for (const date of ['2026-09-01', '2026-01-01']) expect(echoFor(exam, { ...draft.answers, 'area.knowledge.examDate': date }, QUESTIONS, ctx)).toBe('THAT DATE IS TODAY OR HAS PASSED.');
    expect(echoFor(exam, draft.answers, QUESTIONS)).toBe('THAT DATE IS TODAY OR HAS PASSED.'); // no clock, no count
  });

  it('every echo follows the voice rules', () => {
    for (const instance of plan) {
      const line = echoFor(instance, draft.answers, QUESTIONS, ctx);
      if (line === null) continue;
      expect(line, instance.key).toBe(line.toUpperCase());
      expect(line, instance.key).not.toMatch(/!|\bwill (improve|succeed|achieve)\b/i);
    }
  });
});

describe('triggers become intentions on the System’s own quests', () => {
  it('only a domain that allows one keeps it, once per quest', () => {
    const { draft: input, intentions } = interviewToDraft(run('guided', {
      'identity.displayName': 'Ada', areas: ['career', 'financial', 'body'], 'area.career.triggerTime': '08:00', 'area.career.triggerPlace': 'the desk', 'area.career.triggerAction': 'open the tracker',
      'area.financial.triggerTime': '09:00', 'area.financial.triggerPlace': 'the kitchen', 'area.financial.triggerAction': 'log the spend',
    }), QUESTIONS, mapping);
    expect(intentions.map((intention) => intention.archetypeId)).toEqual(['career-pipeline']);
    const { blueprint } = generateBlueprint(input);
    const resolved = questIntentions(blueprint, [...intentions, ...intentions, { archetypeId: 'finance-control', time: '09:00', place: 'x', action: 'y' }]);
    expect(resolved).toHaveLength(1);
    expect(blueprint.quests.find((quest) => quest.id === resolved[0]!.questId)?.type).toBe('core');
    expect(resolved[0]).toMatchObject({ time: '08:00', place: 'the desk', first_action: 'open the tracker' });
  });
});

describe('things of their own (Guided, 03 §26)', () => {
  const customs = 'Piano, Gallery outreach, Cold shower, Evening shutdown, Pushups';
  const answers = {
    'identity.displayName': 'Quinn', areas: ['body'], customs,
    'area.custom1.resolution': 'custom:practice_item', 'area.custom1.topics': 'Scales, Arpeggios, Pieces', 'area.custom1.goodDay': 3,
    'area.custom2.resolution': 'custom:pipeline',
    'area.custom3.resolution': 'custom:time_window', 'area.custom3.time': '06:15',
    'area.custom4.resolution': 'custom:checklist', 'area.custom4.items': 'Plan tomorrow, Clear desk, Charge devices',
    'area.custom5.resolution': 'custom:threshold', 'area.custom5.goodDay': 40,
  };
  const interview = run('guided', answers);

  it('five of their own plus an area is a valid System, each under the name they gave it', () => {
    const { draft } = interviewToDraft(interview, QUESTIONS, mapping);
    expect(draft.domains.slice(0, 6).map((choice) => choice.archetypeId)).toEqual(['strength-movement', 'custom:practice_item', 'custom:pipeline', 'custom:time_window', 'custom:checklist', 'custom:threshold']);
    expect(draft.domains[1]!.answers).toMatchObject({ topic: 'Piano', topics: ['Scales', 'Arpeggios', 'Pieces'], goodDay: 3 });
    expect(draft.domains[3]!.answers).toMatchObject({ topic: 'Cold shower', time: '06:15' });
    expect(draft.domains[4]!.answers?.items).toEqual(['Plan tomorrow', 'Clear desk', 'Charge devices']);
    const { blueprint, issues } = generateBlueprint(draft);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(blueprint.domains.filter((domain) => domain.role === 'engine')).toHaveLength(6);
    expect(blueprint.domains.map((domain) => domain.name)).toEqual(expect.arrayContaining(['Piano', 'Gallery outreach', 'Cold shower', 'Evening shutdown', 'Pushups']));
  });

  it('holding a custom threshold makes it a guardrail with the limit given', () => {
    const held = run('guided', { ...answers, 'area.custom1.holds': 'hold', 'area.custom1.limit': 30, customs: 'Sugar', 'area.custom1.resolution': 'custom:threshold' });
    const { draft } = interviewToDraft(held, QUESTIONS, mapping);
    const sugar = draft.domains.find((choice) => choice.answers?.topic === 'Sugar')!;
    expect(sugar.answers).toMatchObject({ guardrail: true, limit: 30 });
    const { blueprint, issues } = generateBlueprint(draft);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(blueprint.domains.find((domain) => domain.name === 'Sugar')?.role).toBe('guardrail');
  });

  it('the ranking offers them by name, and the budget is six domains in all', () => {
    const rank = livePlan(interview, QUESTIONS).find((instance) => instance.def.kind === 'rank')!;
    expect(optionsFor(rank, interview.answers).map((option) => option.label)).toEqual(expect.arrayContaining(['Piano', 'Pushups']));
    expect(interview.answers.priorities).toEqual(['body', 'custom1', 'custom2', 'custom3', 'custom4', 'custom5']);
    const customsQuestion = livePlan(interview, QUESTIONS).find((instance) => instance.key === 'customs')!;
    expect(validateAnswer(customsQuestion, { areas: ['body', 'career'] }, 'a, b, c, d, e').ok).toBe(false); // 2 + 5 > 6
    expect(validateAnswer(customsQuestion, { areas: ['body', 'career'] }, 'a, b, c, d')).toEqual({ ok: true, value: 'a, b, c, d' });
    expect(validateAnswer(customsQuestion, { areas: ['body'] }, 'Piano, piano, ,  Chess ')).toEqual({ ok: true, value: 'Piano, Chess' });
    expect(validateAnswer(customsQuestion, { areas: ['body'] }, '__skipped__')).toEqual({ ok: true, value: '__skipped__' });
  });

  it('their questions come after the area’s own, asked under the name given and never counted against the budget', () => {
    const plan = livePlan(interview, QUESTIONS);
    const keys = plan.map((instance) => instance.key);
    expect(keys.indexOf('customAction@custom1')).toBeGreaterThan(keys.indexOf('resolution@body'));
    expect(plan.find((instance) => instance.key === 'customAction@custom1')!.heading).toBe('PIANO — WHAT ACTION PROVES PROGRESS?');
    // A thing of their own never takes the question budget of a standard area.
    expect(plan.filter((instance) => instance.area === 'body' && instance.def.budgeted !== false).length).toBeLessThanOrEqual(AREA_BUDGET.guided);
  });

  it('a custom draft is saved and resumed like any other', () => {
    const half = withDefaults({ tier: 'guided', answers: { 'identity.displayName': 'Quinn', areas: ['body'], customs: 'Piano' } }, QUESTIONS, ctx);
    expect(JSON.parse(JSON.stringify(half))).toEqual(half);
    expect(isComplete(half, QUESTIONS)).toBe(true);
    const { draft } = interviewToDraft(half, QUESTIONS, mapping);
    expect(generateBlueprint(draft).issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });
});

describe('more than one thing in an area', () => {
  const answers = {
    'identity.displayName': 'Maya', areas: ['creativity', 'body', 'career'],
    'area.creativity.resolution': 'creative-practice', 'area.creativity.also': ['writing', 'public-speaking'],
    'area.body.resolution': 'strength-movement', 'area.body.also': ['endurance'],
  };
  const interview = run('guided', answers);
  const plan = livePlan(interview, QUESTIONS);

  it('offers "anything else" only where there is something else, and never the thing already chosen', () => {
    const keys = plan.map((instance) => instance.key);
    expect(keys).toContain('also@creativity');
    expect(keys).toContain('also@body');
    expect(keys).not.toContain('also@career'); // one thing it can be
    expect(keys).not.toContain('also@body~endurance'); // an added thing has no "anything else" of its own
    const body = plan.find((instance) => instance.key === 'also@body')!;
    expect(optionsFor(body, interview.answers).map((option) => option.value)).toEqual(['endurance']);
    const creativity = plan.find((instance) => instance.key === 'also@creativity')!;
    expect(optionsFor(creativity, interview.answers).map((option) => option.value)).toEqual(['writing', 'public-speaking']);
  });

  it('each thing added is a domain of its own with its own measure, ranked beside its area', () => {
    const keys = plan.map((instance) => instance.key);
    for (const key of ['goodDay.endurance@body~endurance', 'goodDay.writing@creativity~writing', 'goodDay.public-speaking@creativity~public-speaking']) expect(keys, key).toContain(key);
    expect(interview.answers.priorities).toEqual(['creativity', 'creativity~writing', 'creativity~public-speaking', 'body', 'body~endurance', 'career']);
    const { draft } = interviewToDraft(interview, QUESTIONS, mapping);
    expect(draft.domains.slice(0, 6).map((choice) => choice.archetypeId)).toEqual(['creative-practice', 'writing', 'public-speaking', 'strength-movement', 'endurance', 'career-pipeline']);
    const { blueprint, issues } = generateBlueprint(draft);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(blueprint.domains.filter((domain) => domain.role === 'engine')).toHaveLength(6);
  });

  it('changing the area’s own resolution never leaves the same thing twice', () => {
    const swapped = run('guided', { ...answers, 'area.body.resolution': 'endurance' }); // endurance is now both the resolution and an "also"
    const { draft } = interviewToDraft(swapped, QUESTIONS, mapping);
    expect(draft.domains.filter((choice) => choice.archetypeId === 'endurance')).toHaveLength(1);
  });

  it('choosing nothing is not an answer; a skippable card is skipped instead', () => {
    const body = plan.find((instance) => instance.key === 'also@body')!;
    expect(validateAnswer(body, interview.answers, []).ok).toBe(false);
    expect(validateAnswer(body, interview.answers, '__skipped__')).toEqual({ ok: true, value: '__skipped__' });
    const skipped = run('guided', { ...answers, 'area.body.also': '__skipped__' });
    expect(chosenAreasOf(skipped)).not.toContain('body~endurance');
  });
});

function chosenAreasOf(draft: ReturnType<typeof run>): string[] {
  return livePlan(draft, QUESTIONS).filter((instance) => instance.area).map((instance) => instance.area!);
}

describe('the System is never given more domains than it can price', () => {
  it('six in all across areas, what is added to them and their own things; eight with the guardrails', () => {
    const base = { 'identity.displayName': 'Ada', areas: ['career', 'body', 'knowledge', 'creativity'], 'area.body.resolution': 'strength-movement', 'area.creativity.resolution': 'creative-practice' };
    const draft = run('guided', base);
    const plan = livePlan(draft, QUESTIONS);
    const also = plan.find((instance) => instance.key === 'also@body')!;
    expect(validateAnswer(also, draft.answers, ['endurance']).ok).toBe(true);
    // 4 areas + 2 customs would be 6; a third cannot be added
    const customs = plan.find((instance) => instance.key === 'customs')!;
    expect(validateAnswer(customs, draft.answers, 'a, b').ok).toBe(true);
    expect(validateAnswer(customs, draft.answers, 'a, b, c').ok).toBe(false);
    // 4 areas, and two more taken by "anything else": no room for a fifth or sixth area
    const crowded = run('guided', { ...base, 'area.body.also': ['endurance'], 'area.creativity.also': ['writing'] });
    const areasQuestion = livePlan(crowded, QUESTIONS).find((instance) => instance.key === 'areas')!;
    expect(validateAnswer(areasQuestion, crowded.answers, ['career', 'body', 'knowledge', 'creativity']).ok).toBe(true);
    expect(validateAnswer(areasQuestion, crowded.answers, ['career', 'body', 'knowledge', 'creativity', 'health']).ok).toBe(false);
    const guardrails = livePlan(crowded, QUESTIONS).find((instance) => instance.key === 'guardrails')!;
    expect(validateAnswer(guardrails, crowded.answers, ['sleep-regularity', 'attention-control']).ok).toBe(true);
    expect(validateAnswer(guardrails, crowded.answers, ['sleep-regularity', 'attention-control', 'health-routine']).ok).toBe(false); // 6 + 3 > 8
    const { draft: input } = interviewToDraft(crowded, QUESTIONS, mapping);
    expect(generateBlueprint(input).blueprint.domains.length).toBeLessThanOrEqual(8);
  });
});
