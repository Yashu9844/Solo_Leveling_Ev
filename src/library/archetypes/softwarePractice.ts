import { DSA_TOPICS } from '../../engine/dsa';
import type { ArchetypeDef } from './types';

const FIRST_ATTEMPT_M = { difficulty: 'M', isRevisit: 'false' };

/** Problems solved, revisited and mastered: the owner's DSA domain, as a template. */
export const softwarePractice: ArchetypeDef = {
  id: 'software-practice', area: 'craft', label: 'Software practice', version: 1,
  role: 'engine', weight: 1, headroom: 'practice_or_artifact',
  designations: ['LOGIC TRIAL', 'ALGORITHM GATE', 'CODE TRIAL'],
  name: 'Practice', description: 'Problems solved, revisited and mastered.', channel: 'MIND',
  instruments: [{
    key: 'main', type: 'practice_item', label: 'Problems', logVerb: 'Record Logic Trial',
    params: {
      topics: [...DSA_TOPICS], difficultyScale: ['E', 'M', 'H'], outcomes: ['first_attempt', 'hint', 'editorial', 'unsolved'],
      revisitGrant: { amount: 20, reason: 'revisit' }, maxRevisitsPerDay: 3,
    },
  }],
  quest: {
    objective: '{target} problem logged, or 25 minutes of analysis.',
    realityLabel: '{target} problem / 25m',
    criterion: {
      kind: 'any',
      of: [
        { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 1, filter: { isRevisit: 'false' }, answer: 'goodDay', min: 1 },
        { kind: 'signal', instrument: 'main', signal: 'minutes', comparator: '>=', target: 25, filter: { isRevisit: 'false' }, min: 10 },
      ],
    },
    floor: 'same',
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Code', hue: 'violet' },
  intention: true,

  metrics: [
    { key: 'problems', label: 'Problems solved', unit: 'problems', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } } },
    { key: 'first-attempt-m', label: 'First-attempt rate (M)', unit: '%', kind: 'performance', direction: 'higher', source: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'total', filter: FIRST_ATTEMPT_M } },
  ],
  ladder: {
    key: 'problems', label: 'Problems solved', noun: 'problems', success: 240, verifiability: 'count',
    signal: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } },
  },
  conditions: [{
    id: 'first-attempt-m', short: 'First-attempt rate (M)', label: 'First-attempt M {0} (need {t0})', verifiability: 'count', comparator: '>=', format: 'percent',
    signal: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'window_28', filter: FIRST_ATTEMPT_M },
    at: { B: 0.5, A: 0.6, S: 0.6 },
  }],
  skillTree: {
    instrument: 'main', name: 'Practice topics', designation: 'PRACTICE', nodes: 'topics',
    policy: { kind: 'practice_rate', appliedAt: 3, fluent: { minAttempts: 5, minRate: 0.6, minAboveEasiest: 2 }, retainedGapDays: 21, allowRegression: true },
  },
  attribute: {
    id: 'PROBLEM_SOLVING', name: 'PROBLEM SOLVING', group: 'mind', combine: 'sum',
    description: 'Volume, first-attempt accuracy on Mediums, and revisit success.',
    terms: [
      { id: 'volume', label: 'Weighted problems', weight: 0.45, signal: { instrument: 'main', signal: 'weighted_volume', aggregate: 'eligible_28', filter: { isRevisit: 'false' } }, transform: { kind: 'ratio', denominator: 110 } },
      { id: 'first_attempt_m', label: 'First-attempt rate (M)', weight: 0.35, signal: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'eligible_28', filter: FIRST_ATTEMPT_M }, transform: { kind: 'rate' } },
      { id: 'revisit_success', label: 'Revisit success', weight: 0.2, signal: { instrument: 'main', signal: 'revisit_success_rate', aggregate: 'eligible_28' }, transform: { kind: 'rate' } },
    ],
  },
  bossAnchor: {
    id: 'gauntlet', title: 'LOGIC GAUNTLET', milestone: 'Mediums solved first try, at volume',
    uses: { ladder: true, conditions: ['first-attempt-m'] }, verifiability: 'count',
  },

  checkpoint: { selfEfficacy: 'Solve an unseen medium problem in 25 minutes, in front of an interviewer?', enjoyment: 'Practice' },
  reviewPrompt: { prompt: 'Where did practice stall today?', options: ['Understanding the problem', 'Finding the approach', 'Writing it correctly', 'Nothing stalled'] },
  reflectionThemes: ['practice', 'patience'],
  achievements: [
    { id: 'century', label: 'Century', verifiability: 'count', clauses: [{ signal: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } }, comparator: '>=', threshold: 100 }] },
    {
      id: 'problem-solver', label: 'Problem Solver', kind: 'identity', verifiability: 'count',
      clauses: [
        { signal: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } }, comparator: '>=', threshold: 100 },
        { signal: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'window_28', filter: { difficulty: 'M', isRevisit: 'false' } }, comparator: '>=', threshold: 0.45 },
      ],
    },
  ],
};
