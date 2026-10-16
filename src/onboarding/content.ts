// The interview's questions (platform/03 §23.3), as data. Stages 1-10 here; the synthesis, reveal and activation are not questions
// (loops 10.4 and 11.x). The measure questions come in packs, one per archetype, because "how much on a good day?" is a different question for
// problems, minutes, steps and pages - and a different bound and a different default. Their defaults are taken from the archetype itself, so
// what the interview offers and what the library does cannot drift apart.
//
// Voice (design/04 §25): System register in capitals for headings and echoes; plain language beneath. No praise, no exclamation, no prediction.
import { ARCHETYPES } from '../library/archetypes';
import type { ArchetypeDef, CriterionTemplate } from '../library/archetypes/types';
import { AREAS } from '../library/presets';
import { SKIP, type OptionDef, type Predicate, type QuestionDef } from './types';

// ── Areas and what each can resolve to ──────────────────────────────────────

const AREA_OPTIONS: Record<string, OptionDef> = {
  career: { value: 'career', label: 'Career', hint: 'Finding work, or the next step in it' },
  knowledge: { value: 'knowledge', label: 'Knowledge', hint: 'An exam, a language, a subject, books' },
  body: { value: 'body', label: 'Body', hint: 'Strength, endurance, moving every day' },
  discipline: { value: 'discipline', label: 'Discipline', hint: 'A practice you hold to' },
  business: { value: 'business', label: 'Business', hint: 'Something you are building to sell' },
  health: { value: 'health', label: 'Health', hint: 'Water, meals, a routine that holds' },
  creativity: { value: 'creativity', label: 'Creativity', hint: 'Making, writing, speaking' },
  relationships: { value: 'relationships', label: 'Relationships', hint: 'The people you want to stay close to' },
  financial: { value: 'financial', label: 'Financial stability', hint: 'Spending kept under a limit' },
  craft: { value: 'craft', label: 'Craft', hint: 'Building and practising a skill' },
};

/** What "FOR WHAT?" offers in each area. The value is the archetype it resolves to; the first is the Quick default. */
export const RESOLUTIONS: Record<string, OptionDef[]> = {
  career: [{ value: 'career-pipeline', label: 'Finding a job', hint: 'Applications, and the work that stands in for them' }],
  knowledge: [
    { value: 'reading', label: 'Reading', hint: 'Pages read, and notes kept' },
    { value: 'exam-prep', label: 'An exam', hint: 'Practice questions, study blocks and mock papers, toward a date' },
    { value: 'language-learning', label: 'A language', hint: 'Drills, listening and speaking' },
  ],
  body: [
    { value: 'strength-movement', label: 'Strength', hint: 'Conditioning sessions and daily steps' },
    { value: 'endurance', label: 'Endurance', hint: 'Sessions and the distance they cover' },
  ],
  discipline: [{ value: 'spiritual-practice', label: 'A sitting practice', hint: 'Minutes sat, at an hour kept' }],
  business: [{ value: 'business-building', label: 'A business', hint: 'Outreach made and work shipped' }],
  health: [{ value: 'health-routine', label: 'A daily routine', hint: 'Water, meals, movement, time outside' }],
  creativity: [
    { value: 'creative-practice', label: 'Making things', hint: 'Time at the work, and pieces finished' },
    { value: 'writing', label: 'Writing', hint: 'Words written, and pieces published' },
    { value: 'public-speaking', label: 'Speaking', hint: 'Rehearsals, recordings and talks' },
  ],
  relationships: [{ value: 'relationships', label: 'The people close to you', hint: 'People reached on purpose, and the rituals that keep the ties' }],
  financial: [{ value: 'finance-control', label: 'Spending kept under a limit', hint: 'A daily limit, and the accounts looked at' }],
  craft: [
    { value: 'deep-build', label: 'Building something', hint: 'Focused sessions, and what they ship' },
    { value: 'software-practice', label: 'Coding practice', hint: 'Problems solved, revisited and mastered' },
  ],
};

// ── Measure packs: the unit, its bounds, and the archetype's own defaults ───

interface Unit { noun: string; min: number; max: number; step: number }

/** What "a good day" is counted in, per archetype. The three the System shapes itself (sleep, attention) have no good day to ask about. */
const UNITS: Record<string, Unit> = {
  'software-practice': { noun: 'PROBLEMS', min: 1, max: 15, step: 1 },
  'career-pipeline': { noun: 'QUALIFIED APPLICATIONS', min: 1, max: 15, step: 1 },
  'deep-build': { noun: 'MINUTES OF BUILDING', min: 15, max: 240, step: 5 },
  'strength-movement': { noun: 'STEPS', min: 2000, max: 30000, step: 500 },
  'exam-prep': { noun: 'PRACTICE QUESTIONS', min: 1, max: 80, step: 1 },
  reading: { noun: 'PAGES', min: 1, max: 200, step: 1 },
  'language-learning': { noun: 'DRILLS', min: 1, max: 100, step: 1 },
  endurance: { noun: 'KILOMETRES', min: 1, max: 60, step: 1 },
  'creative-practice': { noun: 'MINUTES AT THE WORK', min: 10, max: 300, step: 5 },
  writing: { noun: 'WORDS', min: 50, max: 5000, step: 50 },
  'public-speaking': { noun: 'TALKS OR REHEARSALS', min: 1, max: 5, step: 1 },
  relationships: { noun: 'PEOPLE REACHED', min: 1, max: 10, step: 1 },
  'spiritual-practice': { noun: 'MINUTES OF PRACTICE', min: 5, max: 180, step: 5 },
  'business-building': { noun: 'QUALIFIED OUTREACHES', min: 1, max: 30, step: 1 },
};

const leavesOf = (criterion: CriterionTemplate): Extract<CriterionTemplate, { kind: 'signal' }>[] => (criterion.kind === 'signal' ? [criterion] : criterion.of.flatMap(leavesOf));

/** The target the archetype itself gives a good day: the leaf that takes the person's number. */
function goodDayDefault(archetype: ArchetypeDef): number {
  const leaf = leavesOf(archetype.quest!.criterion).find((candidate) => candidate.answer === 'goodDay') ?? leavesOf(archetype.quest!.criterion)[0]!;
  return leaf.target;
}

const resolvedTo = (archetypeId: string): Predicate => ({ eq: ['area.{area}.resolution', archetypeId] });

function measurePack(archetypeId: string, unit: Unit): QuestionDef[] {
  const archetype = ARCHETYPES[archetypeId]!;
  const good = goodDayDefault(archetype);
  return [
    {
      id: `goodDay.${archetypeId}`, stage: 'MEASURE', tier: 'guided', archetypeId, each: 'area', budgeted: true,
      heading: `{area} — HOW MANY ${unit.noun} ON A GOOD DAY?`, subline: `Your usual good day, in ${unit.noun.toLowerCase()}. This is what completes the quest.`,
      kind: 'number', unit: unit.noun, eligibility: resolvedTo(archetypeId), writes: 'area.{area}.goodDay', bounds: { min: unit.min, max: unit.max, step: unit.step },
      default: { const: good }, echo: '{area}: A GOOD DAY IS {n}.',
    },
    {
      id: `hardDay.${archetypeId}`, stage: 'MEASURE', tier: 'guided', archetypeId, each: 'area', budgeted: true,
      heading: `{area} — AND ON A HARD DAY?`, subline: 'The least that still counts. The System lowers the bar to it after two missed days.',
      kind: 'number', unit: unit.noun, eligibility: { and: [resolvedTo(archetypeId), { has: 'area.{area}.goodDay' }] }, writes: 'area.{area}.hardDay', bounds: { min: 1, max: unit.max, step: Math.min(unit.step, 1) },
      default: { scale: { from: 'area.{area}.goodDay', factor: 1 / 3, min: 1 } }, echo: '{area}: A HARD DAY IS {n}.',
    },
    ...(archetype.ladder ? [{
      id: `success.${archetypeId}`, stage: 'MEASURE' as const, tier: 'guided' as const, archetypeId, each: 'area' as const, budgeted: true,
      heading: `{area} — HOW MANY ${archetype.ladder.noun.toUpperCase()} WOULD CONVINCE YOU THAT YOU IMPROVED?`,
      subline: 'By the end of the arc. The checkpoints on the way are set from it.',
      kind: 'number' as const, unit: archetype.ladder.noun.toUpperCase(), eligibility: { and: [resolvedTo(archetypeId), { has: 'area.{area}.hardDay' }] }, writes: 'area.{area}.success',
      bounds: { min: 1, max: archetype.ladder.success * 10, step: 1 }, default: { const: archetype.ladder.success }, echo: '{area}: TARGET {n} BY THE END OF THE ARC.',
    }] : []),
  ];
}

// ── Predicates over every area ──────────────────────────────────────────────

const AREA_IDS = Object.keys(AREA_OPTIONS);
/** For a per-area question: this area resolved to one of these. */
const areaResolvedToAny = (archetypeIds: readonly string[]): Predicate => ({ or: archetypeIds.map(resolvedTo) });
const anyAreaResolvedTo = (archetypeIds: readonly string[]): Predicate => ({
  or: AREA_IDS.flatMap((area) => archetypeIds.map((id): Predicate => ({ and: [{ has: 'areas', value: area }, { eq: [`area.${area}.resolution`, id] }] }))),
});
/** Answered, and not declined: a skipped time skips the rest of its trigger. */
const answeredForReal = (path: string): Predicate => ({ and: [{ has: path }, { not: { eq: [path, SKIP] } }] });
/** Archetypes that can carry an if-then trigger. */
const INTENTION_ARCHETYPES = Object.values(ARCHETYPES).filter((archetype) => archetype.intention).map((archetype) => archetype.id);

// ── The questions ───────────────────────────────────────────────────────────

export const QUESTIONS: QuestionDef[] = [
  // 1 · DESIGNATION
  {
    id: 'name', stage: 'DESIGNATION', tier: 'quick', heading: 'WHAT SHOULD THE SYSTEM CALL YOU?', subline: 'A name or a handle. It stays on this device.',
    kind: 'text_short', eligibility: { always: true }, writes: 'identity.displayName', bounds: { maxLength: 24 }, echo: 'REGISTERED. {answer}.',
  },

  // 2 · INTENT
  {
    id: 'areas', stage: 'INTENT', tier: 'quick', heading: 'WHAT ARE YOU HERE TO CHANGE?', subline: 'Choose two to six. The System builds one domain for each, and adds the guardrails that protect your capacity.',
    kind: 'multi_card', options: AREAS.filter((area) => area.id in AREA_OPTIONS).map((area) => AREA_OPTIONS[area.id]!), count: { min: 2, max: 6 },
    eligibility: { always: true }, writes: 'areas', noPrefill: true, default: { firstOption: true, count: 3 }, echo: 'AREAS REGISTERED: {answer}.',
  },

  // 3 · HIERARCHY
  {
    id: 'priorities', stage: 'HIERARCHY', tier: 'quick', heading: 'WHAT MATTERS MOST?', subline: 'Tap them in order. The first earns the most XP and gets the first boss.',
    kind: 'rank', rankFrom: 'areas', options: Object.values(AREA_OPTIONS), eligibility: { has: 'areas' }, writes: 'priorities', default: { copy: 'areas' }, echo: 'PRIORITY ORDER: {answer}.',
  },

  // 4 · RESOLUTION
  {
    id: 'resolution', stage: 'RESOLUTION', tier: 'quick', heading: '{area} — FOR WHAT?', subline: 'The System picks the instruments and the quest from this.',
    kind: 'single_card', each: 'area', budgeted: true, options: { from: '{area}', map: RESOLUTIONS }, eligibility: { has: 'areas', value: '{area}' },
    writes: 'area.{area}.resolution', default: { firstOption: true }, echo: '{area}: {answer}.',
  },
  {
    id: 'examDate', stage: 'RESOLUTION', tier: 'guided', heading: '{area} — WHEN IS THE EXAM?', subline: 'The arc can end on it.', kind: 'date', each: 'area', budgeted: true,
    eligibility: resolvedTo('exam-prep'), writes: 'area.{area}.examDate', default: { today: true, days: 94 }, echo: '{area}: EXAM REGISTERED. {days} DAYS TO THE EXAM DATE.', archetypeId: 'exam-prep',
  },
  {
    id: 'subjects', stage: 'RESOLUTION', tier: 'guided', heading: '{area} — WHAT ARE THE SUBJECTS?', subline: 'Up to twelve, separated by commas. Each becomes a topic you practise and a node in the skill tree.',
    kind: 'text_short', each: 'area', budgeted: true, eligibility: resolvedTo('exam-prep'), writes: 'area.{area}.topics', bounds: { maxLength: 200 },
    default: { const: 'Core concepts, Applied problems, Past papers' }, archetypeId: 'exam-prep',
  },

  // 5 · MEASURE (one pack per archetype)
  ...Object.entries(UNITS).flatMap(([id, unit]) => measurePack(id, unit)),

  // 6 · GUARDRAILS
  {
    id: 'guardrails', stage: 'GUARDRAILS', tier: 'guided', heading: 'WHAT PROTECTS YOUR CAPACITY?', subline: 'Held, not pushed: they earn little, and the System reads them from the second checkpoint.',
    kind: 'multi_card', count: { min: 1, max: 3 }, eligibility: { has: 'areas' }, writes: 'guardrails', default: { firstOption: true, count: 2 },
    options: [
      { value: 'sleep-regularity', label: 'Sleep window', hint: 'Waking inside a window' },
      { value: 'attention-control', label: 'Attention', hint: 'Screen time under a limit' },
      { value: 'health-routine', label: 'A daily routine', hint: 'Water, meals, movement' },
      { value: 'finance-control', label: 'Spending', hint: 'Under a daily limit' },
    ],
    echo: 'GUARDRAILS: {answer}.',
  },
  {
    id: 'attentionLimit', stage: 'GUARDRAILS', tier: 'guided', heading: 'HOW MANY MINUTES OF SCREEN TIME ARE ENOUGH?', subline: 'A day at or under it counts. Minutes from your phone’s own report.',
    kind: 'number', unit: 'MINUTES', eligibility: { has: 'guardrails', value: 'attention-control' }, writes: 'guardrail.attention-control.limit', bounds: { min: 15, max: 600, step: 5 }, default: { const: 60 }, echo: 'SCREEN TIME LIMIT: {n} MINUTES.',
  },
  {
    id: 'spendLimit', stage: 'GUARDRAILS', tier: 'guided', heading: 'WHAT IS THE MOST YOU WILL SPEND IN A DAY?', subline: 'In your own currency. A day at or under it counts.',
    kind: 'number', unit: 'PER DAY', eligibility: { or: [{ has: 'guardrails', value: 'finance-control' }, anyAreaResolvedTo(['finance-control'])] }, writes: 'guardrail.finance-control.limit', bounds: { min: 1, max: 1000000, step: 1 }, default: { const: 1000 }, echo: 'DAILY LIMIT: {n}.',
  },
  {
    id: 'waterTarget', stage: 'GUARDRAILS', tier: 'guided', heading: 'HOW MANY GLASSES OF WATER A DAY?', kind: 'number', unit: 'GLASSES',
    eligibility: { or: [{ has: 'guardrails', value: 'health-routine' }, anyAreaResolvedTo(['health-routine'])] }, writes: 'guardrail.health-routine.limit', bounds: { min: 1, max: 20, step: 1 }, default: { const: 6 }, echo: 'WATER: {n} GLASSES.',
  },

  // 7 · RHYTHM
  {
    id: 'wake', stage: 'RHYTHM', tier: 'quick', heading: 'WHEN DOES YOUR DAY BEGIN?', subline: 'Your usual wake time. The wake-window quest is built around it.',
    kind: 'dial', eligibility: { always: true }, writes: 'rhythm.wakeTime', default: { const: '07:00' }, echo: 'DAY BEGINS AT {answer}.',
  },
  {
    id: 'sleep', stage: 'RHYTHM', tier: 'quick', heading: 'AND WHEN DOES IT END?', subline: 'Your usual bedtime. The day turns over two hours after it.',
    kind: 'dial', eligibility: { always: true }, writes: 'rhythm.sleepTime', default: { const: '23:00' }, echo: 'DAY ENDS AT {answer}.',
  },

  // 8 · ARC
  {
    id: 'length', stage: 'ARC', tier: 'quick', heading: 'HOW LONG IS THIS ARC?', subline: 'Checkpoints, the level curve and the bosses are set from it.',
    kind: 'single_card', eligibility: { always: true }, writes: 'arc.lengthDays', default: { const: '120' }, echo: 'ARC LENGTH: {answer}.',
    options: [{ value: '60', label: '60 days' }, { value: '90', label: '90 days' }, { value: '120', label: '120 days' }, { value: '180', label: '180 days' }, { value: '365', label: '365 days' }],
  },
  {
    id: 'alignExam', stage: 'ARC', tier: 'guided', heading: 'END THE ARC ON THE EXAM DATE?', subline: 'The arc then runs from its start to that day.', kind: 'single_card',
    eligibility: anyAreaResolvedTo(['exam-prep']), writes: 'arc.alignToExam', default: { const: 'yes' }, echo: 'ARC LENGTH UNCHANGED.',
    options: [{ value: 'yes', label: 'End it on the exam date', echo: 'THE ARC WILL END ON THE EXAM DATE.' }, { value: 'no', label: 'Keep the length I chose', echo: 'THE ARC KEEPS THE LENGTH YOU CHOSE.' }],
  },
  {
    id: 'startDate', stage: 'ARC', tier: 'guided', heading: 'WHEN DOES THE ARC BEGIN?', subline: 'Today is the usual answer. Up to two weeks back or a month ahead.',
    kind: 'date', eligibility: { always: true }, writes: 'arc.startDate', default: { today: true }, echo: 'ARC BEGINS {answer}.',
  },
  {
    id: 'objective', stage: 'ARC', tier: 'guided', heading: 'STATE THE MAIN QUEST.', subline: 'One sentence. It is the only thing the arc is judged against.',
    kind: 'text_short', eligibility: { always: true }, writes: 'identity.primaryObjective', bounds: { maxLength: 160 }, default: { const: 'Become the person this System describes.' }, echo: 'MAIN QUEST REGISTERED.',
  },

  // 9 · TRIGGERS (the top three areas that can carry one)
  {
    id: 'triggerTime', stage: 'TRIGGERS', tier: 'guided', heading: '{area} — WHEN?', subline: 'The time you will start. A sentence you wrote yourself is the one you keep.',
    kind: 'time', each: 'area', topN: 3, budgeted: false, eligibility: areaResolvedToAny(INTENTION_ARCHETYPES), writes: 'area.{area}.triggerTime', default: { const: SKIP }, skippable: true,
  },
  {
    id: 'triggerPlace', stage: 'TRIGGERS', tier: 'guided', heading: '{area} — WHERE?', kind: 'text_short', each: 'area', topN: 3, budgeted: false,
    eligibility: answeredForReal('area.{area}.triggerTime'), writes: 'area.{area}.triggerPlace', bounds: { maxLength: 60 }, default: { const: SKIP }, skippable: true,
  },
  {
    id: 'triggerAction', stage: 'TRIGGERS', tier: 'guided', heading: '{area} — AND THE FIRST THING YOU WILL DO?', kind: 'text_short', each: 'area', topN: 3, budgeted: false,
    eligibility: answeredForReal('area.{area}.triggerPlace'), writes: 'area.{area}.triggerAction', bounds: { maxLength: 80 }, default: { const: SKIP }, skippable: true, echo: '{area}: TRIGGER REGISTERED.',
  },

  // 10 · BASELINE (only what the Blueprint will track)
  ...(['weight_kg', 'waist_cm', 'bodyfat_pct'] as const).map((metric): QuestionDef => ({
    id: `baseline.${metric}`, stage: 'BASELINE', tier: 'guided', kind: 'number', unit: { weight_kg: 'KG', waist_cm: 'CM', bodyfat_pct: '%' }[metric], skippable: true, eligibility: anyAreaResolvedTo(['strength-movement', 'endurance']),
    heading: { weight_kg: 'WHAT DO YOU WEIGH TODAY, IN KILOGRAMS?', waist_cm: 'WHAT IS YOUR WAIST TODAY, IN CENTIMETRES?', bodyfat_pct: 'WHAT IS YOUR BODY FAT TODAY, AS A PERCENTAGE?' }[metric],
    subline: 'Recorded as your starting point. It never scores anything, and you can skip it.',
    writes: `baseline.${metric}`, default: { const: SKIP }, bounds: { min: { weight_kg: 20, waist_cm: 40, bodyfat_pct: 3 }[metric], max: { weight_kg: 300, waist_cm: 200, bodyfat_pct: 60 }[metric], step: 0.5 },
  })),
];
