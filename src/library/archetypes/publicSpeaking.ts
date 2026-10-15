import type { ArchetypeDef } from './types';

/** Rehearsals, recordings and talks given. */
export const publicSpeaking: ArchetypeDef = {
  id: 'public-speaking', area: 'creativity', label: 'Public speaking', version: 1,
  role: 'engine', weight: 1, headroom: 'practice_or_artifact',
  designations: ['ORATION', 'LECTERN', 'VOICE TRIAL'],
  name: 'Speaking', description: 'Rehearsals, recordings and talks given.', channel: 'VOICE',
  instruments: [
    { key: 'main', type: 'session', label: 'Talks', logVerb: 'Log Talk', params: { sessionTypes: ['Rehearsal', 'Recorded talk', 'Live talk'], defaultMinutes: 20, defaultRpe: 5 } },
    { key: 'recordings', type: 'artifact', label: 'Recordings', logVerb: 'Log Recording', params: { kinds: ['script', 'recording', 'talk'], bonusXp: 40, grant: { amount: 40, reason: 'recording' } } },
  ],
  quest: {
    objective: 'A talk or rehearsal logged ({target}).',
    realityLabel: '{target} talk or rehearsal',
    criterion: { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 1, answer: 'goodDay', min: 1 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Microphone', hue: 'coral' },
  intention: true,

  metrics: [
    { key: 'talks', label: 'Talks and rehearsals', unit: 'sessions', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'count', aggregate: 'total' } },
    { key: 'recordings', label: 'Recordings kept', unit: 'recordings', kind: 'effort', direction: 'higher', source: { instrument: 'recordings', signal: 'count', aggregate: 'total' } },
  ],
  ladder: { key: 'talks', label: 'Talks and rehearsals', noun: 'talks and rehearsals', success: 48, verifiability: 'count', signal: { instrument: 'main', signal: 'count', aggregate: 'total' } },
  conditions: [
    {
      id: 'recording-on-file', short: 'Recordings on file', label: '{0} recordings on file (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'recordings', signal: 'count', aggregate: 'total', filter: { kind: 'recording' } }, at: { C: 1, B: 3 },
    },
    {
      id: 'talk-shared', short: 'Talks shared publicly', label: '{0} talks shared publicly (need {t0})', verifiability: 'public_url', comparator: '>=', format: 'int',
      signal: { instrument: 'recordings', signal: 'count', aggregate: 'total', filter: { kind: 'talk', hasUrl: 'true' } }, at: { B: 1, A: 3, S: 5 },
    },
  ],
  attribute: {
    id: 'PRESENCE', name: 'PRESENCE', group: 'mind', combine: 'sum', description: 'Talks given and rehearsed, and what is kept of them.',
    terms: [
      { id: 'talks', label: 'Talks and rehearsals', weight: 0.6, signal: { instrument: 'main', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 14 } },
      { id: 'recordings', label: 'Recordings', weight: 0.4, signal: { instrument: 'recordings', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 4 } },
    ],
  },
  bossAnchor: { id: 'first-full-talk', title: 'FIRST FULL TALK', milestone: 'A full talk given and shared where anyone can watch it', uses: { ladder: true, conditions: ['talk-shared'] }, verifiability: 'public_url' },
  checkpoint: { selfEfficacy: 'Give a five-minute talk to people you do not know?', enjoyment: 'Speaking' },
  reviewPrompt: { prompt: 'What did the talk need most?', options: ['A clearer start', 'A stronger end', 'A steadier voice', 'Nothing'] },
  reflectionThemes: ['voice', 'courage'],
};
