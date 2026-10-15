import type { ArchetypeDef } from './types';

/** Words written, and the pieces that are published. */
export const writing: ArchetypeDef = {
  id: 'writing', area: 'creativity', label: 'Writing', version: 1,
  role: 'engine', weight: 1, headroom: 'practice_or_artifact',
  designations: ['SCRIPTORIUM', 'INKWELL', 'QUILL TRIAL'],
  name: 'Writing', description: 'Words written, and pieces published.', channel: 'INK',
  instruments: [
    {
      key: 'main', type: 'threshold', label: 'Words written', logVerb: 'Log Words',
      params: { unit: 'words', comparator: '>=', target: 500, entryLabel: 'Words', hint: 'Words written today, in everything.', defaultValue: 500 },
    },
    { key: 'published', type: 'artifact', label: 'Pieces', logVerb: 'Log Piece', params: { kinds: ['draft', 'post', 'chapter'], bonusXp: 40, grant: { amount: 40, reason: 'piece' } } },
  ],
  quest: {
    objective: '{target}+ words written.',
    realityLabel: '{target} words',
    criterion: { kind: 'signal', instrument: 'main', signal: 'total_value', comparator: '>=', target: 500, answer: 'goodDay', min: 50 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'PencilLine', hue: 'green' },
  intention: true,

  metrics: [
    { key: 'words', label: 'Words written', unit: 'words', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'total_value', aggregate: 'total' } },
    { key: 'pieces', label: 'Pieces finished', unit: 'pieces', kind: 'effort', direction: 'higher', source: { instrument: 'published', signal: 'count', aggregate: 'total' } },
  ],
  ladder: { key: 'words', label: 'Words written', noun: 'words written', success: 40000, verifiability: 'count', signal: { instrument: 'main', signal: 'total_value', aggregate: 'total' } },
  conditions: [
    {
      id: 'draft-on-file', short: 'Drafts on file', label: '{0} drafts on file (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'published', signal: 'count', aggregate: 'total', filter: { kind: 'draft' } }, at: { C: 1 },
    },
    {
      id: 'published', short: 'Published pieces', label: '{0} pieces published (need {t0})', verifiability: 'public_url', comparator: '>=', format: 'int',
      signal: { instrument: 'published', signal: 'count', aggregate: 'total', filter: { kind: 'post', hasUrl: 'true' } }, at: { B: 1, A: 3, S: 6 },
    },
  ],
  attribute: {
    id: 'VOICE', name: 'VOICE', group: 'craft', combine: 'sum', description: 'Words on the page and pieces out the door.',
    terms: [
      { id: 'words', label: 'Mean daily words', weight: 0.6, signal: { instrument: 'main', signal: 'total_value', aggregate: 'eligible_28' }, ratioOf: 'window_days', transform: { kind: 'ratio', denominator: 500 } },
      { id: 'pieces', label: 'Pieces finished', weight: 0.4, signal: { instrument: 'published', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 3 } },
    ],
  },
  bossAnchor: { id: 'first-publication', title: 'FIRST PUBLICATION', milestone: 'A piece published at an address anyone can open', uses: { ladder: true, conditions: ['published'] }, verifiability: 'public_url' },
  checkpoint: { selfEfficacy: 'Publish a piece you are not sure about?', enjoyment: 'Writing' },
  reviewPrompt: { prompt: 'What stopped the words today?', options: ['No subject', 'Doubt', 'No time', 'Nothing stopped them'] },
  reflectionThemes: ['writing', 'finishing'],
  achievements: [{ id: 'ten-thousand', label: 'Ten Thousand Words', verifiability: 'count', clauses: [{ signal: { instrument: 'main', signal: 'total_value', aggregate: 'total' }, comparator: '>=', threshold: 10000 }] }],
};
