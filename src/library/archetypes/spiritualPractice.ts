import type { ArchetypeDef } from './types';

/** A sitting practice at an hour kept. */
export const spiritualPractice: ArchetypeDef = {
  id: 'spiritual-practice', area: 'discipline', label: 'Spiritual practice', version: 1,
  role: 'engine', weight: 1, headroom: 'session_threshold',
  designations: ['STILLNESS', 'VIGIL', 'SANCTUM'],
  name: 'Practice', description: 'A sitting practice, and the hour you keep for it.', channel: 'STILL',
  instruments: [
    { key: 'main', type: 'duration', label: 'Sittings', logVerb: 'Log Sitting', params: { defaultMinutes: 20, minBlockMinutes: 5 } },
    { key: 'hour', type: 'time_window', label: 'Hour kept', logVerb: 'Log Hour', params: { targetTime: '06:30', toleranceMinutes: 45 } },
  ],
  quest: {
    objective: '{target}+ minutes of practice.',
    realityLabel: '{target}m sitting',
    criterion: { kind: 'signal', instrument: 'main', signal: 'minutes', comparator: '>=', target: 20, answer: 'goodDay', min: 5 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Sun', hue: 'amber' },
  intention: true,

  metrics: [
    { key: 'sittings', label: 'Sittings', unit: 'sittings', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'records', aggregate: 'total' } },
    { key: 'minutes', label: 'Minutes sat', unit: 'min', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'minutes', aggregate: 'total' } },
  ],
  ladder: { key: 'sittings', label: 'Sittings', noun: 'sittings', success: 90, verifiability: 'count', signal: { instrument: 'main', signal: 'records', aggregate: 'total' } },
  conditions: [{
    id: 'hour-kept', short: 'Hour kept', label: '{0} days the hour was kept (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
    signal: { instrument: 'hour', signal: 'hit_days', aggregate: 'total' }, at: { C: 1, B: 8, A: 30, S: 60 },
  }],
  attribute: {
    id: 'CALM', name: 'CALM', group: 'mind', combine: 'sum', description: 'Time sat, and the hour kept.',
    terms: [
      { id: 'minutes', label: 'Mean daily minutes', weight: 0.6, signal: { instrument: 'main', signal: 'minutes', aggregate: 'eligible_28' }, ratioOf: 'window_days', transform: { kind: 'ratio', denominator: 20 } },
      { id: 'hour', label: 'Hour kept', weight: 0.4, signal: { instrument: 'hour', signal: 'hit_days', aggregate: 'eligible_28' }, ratioOf: 'window_days', transform: { kind: 'rate' } },
    ],
  },
  bossAnchor: { id: 'long-vigil', title: 'THE LONG VIGIL', milestone: 'The hour kept for weeks on end', uses: { ladder: true, conditions: ['hour-kept'] }, verifiability: 'recorded' },
  checkpoint: { selfEfficacy: 'Sit for the full time on a day when the mind will not settle?', enjoyment: 'The practice' },
  reviewPrompt: { prompt: 'How was the sitting?', options: ['Still', 'Restless', 'Dull', 'Did not sit'] },
  reflectionThemes: ['stillness', 'return'],
};
