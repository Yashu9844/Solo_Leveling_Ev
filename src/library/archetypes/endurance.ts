import type { ArchetypeDef } from './types';

/** Distance and time on your feet, wheels or in the water. */
export const endurance: ArchetypeDef = {
  id: 'endurance', area: 'body', label: 'Endurance', version: 1,
  role: 'engine', weight: 1, headroom: 'session_threshold',
  designations: ['STAMINA TRIAL', 'LONG ROAD', 'PACE TRIAL'],
  name: 'Endurance', description: 'Sessions and the distance they cover.', channel: 'STAMINA',
  instruments: [
    { key: 'main', type: 'session', label: 'Sessions', logVerb: 'Log Session', params: { sessionTypes: ['Easy', 'Tempo', 'Long', 'Intervals'], defaultMinutes: 40, defaultRpe: 5 } },
    {
      key: 'distance', type: 'threshold', label: 'Distance', logVerb: 'Log Distance',
      params: { unit: 'km', comparator: '>=', target: 5, entryLabel: 'Kilometres', hint: 'Distance covered today.', defaultValue: 5 },
    },
  ],
  quest: {
    objective: 'A session logged, or {target}+ km covered.',
    realityLabel: 'a session or {target} km',
    criterion: {
      kind: 'any',
      of: [
        { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 1, min: 1 },
        { kind: 'signal', instrument: 'distance', signal: 'total_value', comparator: '>=', target: 5, answer: 'goodDay', min: 1 },
      ],
    },
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'PersonSimpleRun', hue: 'green' },
  intention: true,

  metrics: [
    { key: 'sessions', label: 'Endurance sessions', unit: 'sessions', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'count', aggregate: 'total' } },
    { key: 'distance', label: 'Distance covered', unit: 'km', kind: 'effort', direction: 'higher', source: { instrument: 'distance', signal: 'total_value', aggregate: 'total' } },
  ],
  ladder: { key: 'sessions', label: 'Endurance sessions', noun: 'endurance sessions', success: 48, verifiability: 'recorded', signal: { instrument: 'main', signal: 'count', aggregate: 'total' } },
  conditions: [{
    id: 'distance', short: 'Distance covered', label: '{0} km covered (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
    signal: { instrument: 'distance', signal: 'total_value', aggregate: 'total' }, at: { B: 100, A: 200, S: 300 },
  }],
  attribute: {
    id: 'STAMINA', name: 'STAMINA', group: 'body', combine: 'sum', description: 'Sessions done and the distance behind them.',
    terms: [
      { id: 'sessions', label: 'Sessions', weight: 0.5, signal: { instrument: 'main', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 14 } },
      { id: 'distance', label: 'Distance', weight: 0.5, signal: { instrument: 'distance', signal: 'total_value', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 60 } },
    ],
  },
  bossAnchor: { id: 'long-distance', title: 'LONG DISTANCE', milestone: 'A distance covered that you could not have a month ago', uses: { ladder: true, conditions: ['distance'] }, verifiability: 'recorded' },
  checkpoint: { selfEfficacy: 'Finish your longest planned session at an easy pace?', enjoyment: 'Endurance' },
  reviewPrompt: { prompt: 'How did the legs feel?', options: ['Light', 'Steady', 'Heavy', 'Did not go'] },
  reflectionThemes: ['endurance', 'pace'],
  achievements: [{ id: 'first-hundred-km', label: 'First Hundred Kilometres', verifiability: 'recorded', clauses: [{ signal: { instrument: 'distance', signal: 'total_value', aggregate: 'total' }, comparator: '>=', threshold: 100 }] }],
};
