import type { ArchetypeDef } from './types';

/** Drills and immersion toward speaking a language. */
export const languageLearning: ArchetypeDef = {
  id: 'language-learning', area: 'knowledge', label: 'Language learning', version: 1,
  role: 'engine', weight: 1, headroom: 'practice_or_artifact',
  designations: ['TONGUE TRIAL', 'LEXICON', 'BABEL'],
  name: 'Language', description: 'Drills, listening and speaking, in the language you are learning.', channel: 'TONGUE',
  instruments: [
    {
      key: 'main', type: 'practice_item', label: 'Drills', logVerb: 'Log Drill',
      params: {
        topics: ['Vocabulary', 'Grammar', 'Listening', 'Speaking'], difficultyScale: ['E', 'M', 'H'], outcomes: ['first_attempt', 'hint', 'editorial', 'unsolved'],
        revisitGrant: { amount: 20, reason: 'revisit' }, maxRevisitsPerDay: 3,
      },
    },
    { key: 'immersion', type: 'duration', label: 'Immersion', logVerb: 'Log Immersion', params: { modes: ['listening', 'speaking', 'reading'], defaultMinutes: 20, minBlockMinutes: 5 } },
  ],
  quest: {
    objective: '{target} drills logged, or 20 minutes of immersion.',
    realityLabel: '{target} drills / 20m immersion',
    criterion: {
      kind: 'any',
      of: [
        { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 20, filter: { isRevisit: 'false' }, answer: 'goodDay', min: 1 },
        { kind: 'signal', instrument: 'immersion', signal: 'minutes', comparator: '>=', target: 20, min: 5 },
      ],
    },
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Translate', hue: 'teal' },
  intention: true,

  metrics: [
    { key: 'drills', label: 'Drills done', unit: 'drills', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } } },
    { key: 'accuracy', label: 'First-attempt accuracy', unit: '%', kind: 'performance', direction: 'higher', source: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'total', filter: { isRevisit: 'false' } } },
    { key: 'speaking', label: 'Speaking sessions', unit: 'sessions', kind: 'effort', direction: 'higher', source: { instrument: 'immersion', signal: 'mode_counts', aggregate: 'total', filter: { mode: 'speaking' } } },
  ],
  ladder: { key: 'drills', label: 'Drills done', noun: 'drills done', success: 1500, verifiability: 'count', signal: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } } },
  conditions: [
    {
      id: 'accuracy', short: 'First-attempt accuracy', label: 'First-attempt accuracy {0} (need {t0})', verifiability: 'count', comparator: '>=', format: 'percent',
      signal: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'window_28', filter: { isRevisit: 'false' } }, at: { B: 0.6, A: 0.7, S: 0.75 },
    },
    {
      id: 'speaking', short: 'Speaking sessions', label: '{0} speaking sessions recorded (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'immersion', signal: 'mode_counts', aggregate: 'total', filter: { mode: 'speaking' } }, at: { C: 1, B: 8, A: 16, S: 24 },
    },
  ],
  skillTree: { instrument: 'main', name: 'Language skills', designation: 'SKILLS', nodes: 'topics', policy: { kind: 'practice_rate', appliedAt: 3, fluent: { minAttempts: 5, minRate: 0.6, minAboveEasiest: 2 }, retainedGapDays: 21, allowRegression: true } },
  attribute: {
    id: 'FLUENCY', name: 'FLUENCY', group: 'mind', combine: 'sum', description: 'Drills done, accuracy on the first attempt, and time spent in the language.',
    terms: [
      { id: 'volume', label: 'Weighted drills', weight: 0.4, signal: { instrument: 'main', signal: 'weighted_volume', aggregate: 'eligible_28', filter: { isRevisit: 'false' } }, transform: { kind: 'ratio', denominator: 110 } },
      { id: 'accuracy', label: 'First-attempt accuracy', weight: 0.35, signal: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'eligible_28', filter: { isRevisit: 'false' } }, transform: { kind: 'rate' } },
      { id: 'immersion', label: 'Mean daily immersion', weight: 0.25, signal: { instrument: 'immersion', signal: 'minutes', aggregate: 'eligible_28' }, ratioOf: 'window_days', transform: { kind: 'ratio', denominator: 20 } },
    ],
  },
  bossAnchor: { id: 'conversation', title: 'CONVERSATION READY', milestone: 'Speaking sessions recorded, at volume', uses: { ladder: true, conditions: ['speaking', 'accuracy'] }, verifiability: 'recorded' },
  checkpoint: { selfEfficacy: 'Hold a five-minute conversation in the language without switching out of it?', enjoyment: 'The language' },
  reviewPrompt: { prompt: 'Where did the language fail you today?', options: ['A word I lacked', 'Following speech', 'Forming a sentence', 'Nowhere'] },
  reflectionThemes: ['language', 'patience'],
  achievements: [{ id: 'first-hundred', label: 'First Hundred Drills', verifiability: 'count', clauses: [{ signal: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } }, comparator: '>=', threshold: 100 }] }],
};
