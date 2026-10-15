import { DSA_TOPICS } from '../../engine/dsa';
import type { ArchetypeDef } from './types';

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
};
