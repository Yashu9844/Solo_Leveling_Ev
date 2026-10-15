import type { ArchetypeDef } from './types';

/** Reaching out to the people who matter, and the rituals that keep the ties. */
export const relationships: ArchetypeDef = {
  id: 'relationships', area: 'relationships', label: 'Relationships', version: 1,
  role: 'engine', weight: 1, headroom: 'session_threshold',
  designations: ['BONDS', 'FELLOWSHIP', 'HEARTH'],
  name: 'Relationships', description: 'People reached on purpose, and the rituals that keep the ties.', channel: 'BONDS',
  instruments: [
    {
      key: 'main', type: 'threshold', label: 'Connections', logVerb: 'Log Connection',
      params: { unit: 'people', comparator: '>=', target: 1, entryLabel: 'People', hint: 'People you reached on purpose today.', defaultValue: 1 },
    },
    { key: 'rituals', type: 'checklist', label: 'Rituals', logVerb: 'Tick Rituals', params: { items: [{ id: 'call', label: 'Called someone close', everyNDays: 7 }, { id: 'meet', label: 'Met someone in person', everyNDays: 14 }] } },
  ],
  quest: {
    objective: '{target}+ people reached on purpose.',
    realityLabel: '{target} person reached',
    criterion: { kind: 'signal', instrument: 'main', signal: 'total_value', comparator: '>=', target: 1, answer: 'goodDay', min: 1 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Users', hue: 'rose' },
  intention: true,

  metrics: [
    { key: 'connections', label: 'Connections made', unit: 'people', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'total_value', aggregate: 'total' } },
    { key: 'rituals', label: 'Ritual days kept', unit: 'days', kind: 'effort', direction: 'higher', source: { instrument: 'rituals', signal: 'all_done_days', aggregate: 'total' } },
  ],
  ladder: { key: 'connections', label: 'Connections made', noun: 'connections made', success: 90, verifiability: 'count', signal: { instrument: 'main', signal: 'total_value', aggregate: 'total' } },
  conditions: [{
    id: 'rituals', short: 'Ritual days kept', label: '{0} ritual days kept (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
    signal: { instrument: 'rituals', signal: 'all_done_days', aggregate: 'total' }, at: { C: 1, B: 4, A: 8, S: 14 },
  }],
  attribute: {
    id: 'WARMTH', name: 'WARMTH', group: 'mind', combine: 'sum', description: 'People reached, and the rituals that keep the ties.',
    terms: [
      { id: 'connections', label: 'Connections', weight: 0.6, signal: { instrument: 'main', signal: 'total_value', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 20 } },
      { id: 'rituals', label: 'Ritual days', weight: 0.4, signal: { instrument: 'rituals', signal: 'all_done_days', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 4 } },
    ],
  },
  bossAnchor: { id: 'standing-table', title: 'A STANDING TABLE', milestone: 'Rituals kept long enough to count on', uses: { ladder: true, conditions: ['rituals'] }, verifiability: 'recorded' },
  checkpoint: { selfEfficacy: 'Reach out to someone first, when you would normally wait to be asked?', enjoyment: 'The people in your life' },
  reviewPrompt: { prompt: 'Who did you reach today?', options: ['Family', 'A friend', 'Someone new', 'No one'] },
  reflectionThemes: ['connection', 'presence'],
  achievements: [{ id: 'host', label: 'Someone Who Shows Up', kind: 'identity', verifiability: 'recorded', clauses: [{ signal: { instrument: 'rituals', signal: 'all_done_days', aggregate: 'total' }, comparator: '>=', threshold: 8 }] }],
};
