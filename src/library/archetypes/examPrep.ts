import type { ArchetypeDef } from './types';

/**
 * Practice questions, study blocks and mock exams for a test with a date. The syllabus is the person's own:
 * their subjects become the skill tree and the topics both instruments log against.
 */
export const examPrep: ArchetypeDef = {
  id: 'exam-prep', area: 'knowledge', label: 'Exam preparation', version: 1,
  role: 'engine', weight: 1, headroom: 'practice_or_artifact',
  designations: ['ARCANE STUDY', 'KNOWLEDGE TRIAL', 'SCHOLAR TRIAL'],
  name: 'Exam preparation', description: 'Practice questions, study blocks and mock exams, toward the test date.', channel: 'STUDY',
  instruments: [
    {
      key: 'main', type: 'practice_item', label: 'Practice questions', logVerb: 'Log Practice Set',
      params: {
        topics: ['Core concepts', 'Applied problems', 'Past papers'], difficultyScale: ['E', 'M', 'H'], outcomes: ['first_attempt', 'hint', 'editorial', 'unsolved'],
        revisitGrant: { amount: 20, reason: 'revisit' }, maxRevisitsPerDay: 3,
      },
    },
    {
      key: 'study', type: 'study_block', label: 'Study blocks', logVerb: 'Log Study Block',
      params: { topics: ['Core concepts', 'Applied problems', 'Past papers'], modes: ['studied', 'mock'], blockXp: 25, grant: { amount: 25, reason: 'study_block' } },
    },
  ],
  quest: {
    objective: '{target} practice questions logged, or 45 minutes of focused study.',
    realityLabel: '{target} questions / 45m study',
    criterion: {
      kind: 'any',
      of: [
        { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 10, filter: { isRevisit: 'false' }, answer: 'goodDay', min: 1 },
        { kind: 'signal', instrument: 'study', signal: 'minutes', comparator: '>=', target: 45, min: 10 },
      ],
    },
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'GraduationCap', hue: 'amber' },
  intention: true,

  metrics: [
    { key: 'questions', label: 'Questions practised', unit: 'questions', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } } },
    { key: 'accuracy', label: 'First-attempt accuracy', unit: '%', kind: 'performance', direction: 'higher', source: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'total', filter: { isRevisit: 'false' } } },
    { key: 'mocks', label: 'Mock exams recorded', unit: 'mocks', kind: 'effort', direction: 'higher', source: { instrument: 'study', signal: 'mode_counts', aggregate: 'total', filter: { mode: 'mock' } } },
    { key: 'mock-score', label: 'Mock exam score', unit: '%', kind: 'performance', direction: 'higher', source: { manual: true, cadence: 'any' } },
  ],
  ladder: {
    key: 'questions', label: 'Questions practised', noun: 'questions practised', success: 600, verifiability: 'count',
    signal: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } },
  },
  conditions: [
    {
      id: 'accuracy', short: 'First-attempt accuracy', label: 'First-attempt accuracy {0} (need {t0})', verifiability: 'count', comparator: '>=', format: 'percent',
      signal: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'window_28', filter: { isRevisit: 'false' } }, at: { B: 0.55, A: 0.65, S: 0.7 },
    },
    {
      id: 'mock-exams', short: 'Mock exams recorded', label: '{0} mock exams recorded (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'study', signal: 'mode_counts', aggregate: 'total', filter: { mode: 'mock' } }, at: { B: 1, A: 3, S: 5 },
    },
  ],
  skillTree: {
    instrument: 'study', name: 'Syllabus', designation: 'SYLLABUS', nodes: 'topics',
    policy: { kind: 'block_count', introducedAt: 1, appliedAt: 3, fluentAt: 5, retainedGapDays: 21 },
  },
  attribute: {
    id: 'KNOWLEDGE', name: 'KNOWLEDGE', group: 'mind', combine: 'sum', description: 'Volume practised, accuracy on the first attempt, and what stays learned.',
    terms: [
      { id: 'volume', label: 'Weighted questions', weight: 0.4, signal: { instrument: 'main', signal: 'weighted_volume', aggregate: 'eligible_28', filter: { isRevisit: 'false' } }, transform: { kind: 'ratio', denominator: 110 } },
      { id: 'accuracy', label: 'First-attempt accuracy', weight: 0.35, signal: { instrument: 'main', signal: 'first_attempt_rate', aggregate: 'eligible_28', filter: { isRevisit: 'false' } }, transform: { kind: 'rate' } },
      { id: 'retention', label: 'Revisit success', weight: 0.25, signal: { instrument: 'main', signal: 'revisit_success_rate', aggregate: 'eligible_28' }, transform: { kind: 'rate' } },
    ],
  },
  bossAnchor: {
    id: 'first-mock', title: 'FIRST MOCK EXAM', milestone: 'A full mock exam sat and recorded',
    uses: { ladder: true, conditions: ['mock-exams', 'accuracy'] }, verifiability: 'recorded',
  },
  checkpoint: { selfEfficacy: 'Score above the pass mark on a past paper sat under exam conditions?', enjoyment: 'Studying' },
  reviewPrompt: { prompt: 'What did today\'s study leave unclear?', options: ['A concept', 'A method', 'Recall under time', 'Nothing unclear'] },
  reflectionThemes: ['study', 'recall'],
  achievements: [
    { id: 'question-bank', label: 'Question Bank', verifiability: 'count', clauses: [{ signal: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } }, comparator: '>=', threshold: 300 }] },
    { id: 'mock-veteran', label: 'Mock Veteran', kind: 'identity', verifiability: 'recorded', clauses: [{ signal: { instrument: 'study', signal: 'mode_counts', aggregate: 'total', filter: { mode: 'mock' } }, comparator: '>=', threshold: 3 }] },
  ],
};
