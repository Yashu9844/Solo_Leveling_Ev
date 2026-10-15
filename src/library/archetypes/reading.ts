import type { ArchetypeDef } from './types';

/** Pages read, and the notes that prove they were read. */
export const reading: ArchetypeDef = {
  id: 'reading', area: 'knowledge', label: 'Reading', version: 1,
  role: 'engine', weight: 1, headroom: 'session_threshold',
  designations: ['ARCHIVE', 'LIBRARY TRIAL', 'CODEX'],
  name: 'Reading', description: 'Pages read, and notes kept on them.', channel: 'READING',
  instruments: [
    {
      key: 'main', type: 'threshold', label: 'Pages read', logVerb: 'Log Pages',
      params: { unit: 'pages', comparator: '>=', target: 20, entryLabel: 'Pages', hint: 'Pages read today, across everything.', defaultValue: 20 },
    },
    {
      key: 'notes', type: 'study_block', label: 'Reading notes', logVerb: 'Log Notes',
      params: { topics: ['Current book'], modes: ['notes', 'review'], blockXp: 25, grant: { amount: 25, reason: 'reading_notes' } },
    },
  ],
  quest: {
    objective: '{target}+ pages read.',
    realityLabel: '{target} pages',
    criterion: { kind: 'signal', instrument: 'main', signal: 'total_value', comparator: '>=', target: 20, answer: 'goodDay', min: 1 },
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'BookOpen', hue: 'green' },
  intention: true,

  metrics: [
    { key: 'pages', label: 'Pages read', unit: 'pages', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'total_value', aggregate: 'total' } },
    { key: 'notes', label: 'Reading notes kept', unit: 'notes', kind: 'effort', direction: 'higher', source: { instrument: 'notes', signal: 'blocks', aggregate: 'total' } },
  ],
  ladder: {
    key: 'pages', label: 'Pages read', noun: 'pages read', success: 1800, verifiability: 'count',
    signal: { instrument: 'main', signal: 'total_value', aggregate: 'total' },
  },
  conditions: [{
    id: 'notes-on-file', short: 'Reading notes', label: '{0} sets of reading notes on file (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
    signal: { instrument: 'notes', signal: 'blocks', aggregate: 'total' }, at: { C: 1, B: 4, A: 8, S: 12 },
  }],
  attribute: {
    id: 'LITERACY', name: 'LITERACY', group: 'mind', combine: 'sum', description: 'How much you read, how steadily, and the notes you keep.',
    terms: [
      { id: 'pages', label: 'Mean daily pages', weight: 0.6, signal: { instrument: 'main', signal: 'total_value', aggregate: 'eligible_28' }, ratioOf: 'window_days', transform: { kind: 'ratio', denominator: 20 } },
      { id: 'notes', label: 'Notes kept', weight: 0.4, signal: { instrument: 'notes', signal: 'blocks', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 8 } },
    ],
  },
  bossAnchor: {
    id: 'first-shelf', title: 'THE FIRST SHELF', milestone: 'Books read through, with notes to show',
    uses: { ladder: true, conditions: ['notes-on-file'] }, verifiability: 'recorded',
  },
  checkpoint: { selfEfficacy: 'Read for thirty minutes with your phone out of the room?', enjoyment: 'Reading' },
  reviewPrompt: { prompt: 'What did you read today that you would repeat to someone?', options: ['An idea', 'A fact', 'A sentence', 'Nothing yet'] },
  reflectionThemes: ['reading', 'attention'],
  achievements: [
    { id: 'thousand-pages', label: 'A Thousand Pages', verifiability: 'count', clauses: [{ signal: { instrument: 'main', signal: 'total_value', aggregate: 'total' }, comparator: '>=', threshold: 1000 }] },
  ],
};
