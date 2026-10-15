import type { ArchetypeDef } from './types';

/** Time at the work, and the pieces that leave the studio. */
export const creativePractice: ArchetypeDef = {
  id: 'creative-practice', area: 'creativity', label: 'Creative practice', version: 1,
  role: 'engine', weight: 1, headroom: 'practice_or_artifact',
  designations: ['CRAFT', 'OPUS', 'ATELIER'],
  name: 'Creative work', description: 'Time at the work, and the pieces you finish and show.', channel: 'STUDIO',
  instruments: [
    { key: 'main', type: 'duration', label: 'Studio time', logVerb: 'Log Studio Time', params: { modes: ['MAKE', 'STUDY'], defaultMinutes: 30, minBlockMinutes: 10 } },
    { key: 'pieces', type: 'artifact', label: 'Pieces', logVerb: 'Log Piece', params: { kinds: ['draft', 'piece', 'public_release'], bonusXp: 40, grant: { amount: 40, reason: 'piece' } } },
  ],
  quest: {
    objective: '{target}+ minutes at the work.',
    realityLabel: '{target}m at the work',
    criterion: { kind: 'signal', instrument: 'main', signal: 'minutes', comparator: '>=', target: 30, answer: 'goodDay', min: 10 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Palette', hue: 'coral' },
  intention: true,

  metrics: [
    { key: 'minutes', label: 'Studio minutes', unit: 'min', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'minutes', aggregate: 'total' } },
    { key: 'pieces', label: 'Pieces finished', unit: 'pieces', kind: 'effort', direction: 'higher', source: { instrument: 'pieces', signal: 'count', aggregate: 'total' } },
  ],
  ladder: { key: 'pieces', label: 'Pieces finished', noun: 'pieces finished', success: 12, verifiability: 'count', signal: { instrument: 'pieces', signal: 'count', aggregate: 'total' } },
  conditions: [
    {
      id: 'piece-on-file', short: 'Pieces on file', label: '{0} finished pieces on file (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'pieces', signal: 'count', aggregate: 'total', filter: { kind: 'piece' } }, at: { C: 1 },
    },
    {
      id: 'shown', short: 'Public showings', label: '{0} pieces shown publicly (need {t0})', verifiability: 'public_url', comparator: '>=', format: 'int',
      signal: { instrument: 'pieces', signal: 'count', aggregate: 'total', filter: { kind: 'public_release', hasUrl: 'true' } }, at: { B: 1, A: 2, S: 4 },
    },
  ],
  attribute: {
    id: 'CRAFTSMANSHIP', name: 'CRAFTSMANSHIP', group: 'craft', combine: 'sum', description: 'Hours at the work and what comes out of it.',
    terms: [
      { id: 'minutes', label: 'Mean daily studio minutes', weight: 0.5, signal: { instrument: 'main', signal: 'minutes', aggregate: 'eligible_28' }, ratioOf: 'window_days', transform: { kind: 'ratio', denominator: 45 } },
      { id: 'pieces', label: 'Pieces finished', weight: 0.5, signal: { instrument: 'pieces', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 4 } },
    ],
  },
  bossAnchor: { id: 'first-showing', title: 'THE FIRST SHOWING', milestone: 'A piece shown where anyone can see it', uses: { ladder: true, conditions: ['shown'] }, verifiability: 'public_url' },
  checkpoint: { selfEfficacy: 'Finish a piece and show it before it feels ready?', enjoyment: 'The work' },
  reviewPrompt: { prompt: 'What got in the way of the work today?', options: ['No idea', 'No energy', 'Interruptions', 'Nothing in the way'] },
  reflectionThemes: ['craft', 'finishing'],
  achievements: [{ id: 'finisher', label: 'Finisher', kind: 'identity', verifiability: 'count', clauses: [{ signal: { instrument: 'pieces', signal: 'count', aggregate: 'total' }, comparator: '>=', threshold: 6 }] }],
};
