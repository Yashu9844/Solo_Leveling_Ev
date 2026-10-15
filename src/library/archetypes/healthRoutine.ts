import type { ArchetypeDef } from './types';

/** A few small things done daily to keep the body running. A guardrail: it holds the floor, it does not chase a peak. */
export const healthRoutine: ArchetypeDef = {
  id: 'health-routine', area: 'health', label: 'Health routine', version: 1,
  role: 'guardrail', weight: 1, headroom: 'guardrail',
  designations: ['SUSTENANCE', 'UPKEEP', 'HEARTH WARD'],
  name: 'Health', description: 'Water, meals and movement, kept to a routine.', channel: 'SUSTAIN',
  instruments: [
    {
      key: 'main', type: 'threshold', label: 'Water', logVerb: 'Log Water',
      params: { unit: 'glasses', comparator: '>=', target: 6, entryLabel: 'Glasses', hint: 'Glasses of water today.', defaultValue: 6 },
    },
    {
      key: 'routine', type: 'checklist', label: 'Routine',  logVerb: 'Tick Routine',
      params: { items: [{ id: 'meals', label: 'Ate to plan' }, { id: 'move', label: 'Moved' }, { id: 'outside', label: 'Went outside' }] },
    },
  ],
  quest: {
    objective: '{target}+ glasses of water.',
    realityLabel: '{target} glasses',
    criterion: { kind: 'signal', instrument: 'main', signal: 'hit', comparator: '>=', target: 1, min: 1 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: false,
  },
  presentation: { icon: 'Leaf', hue: 'teal' },

  metrics: [
    { key: 'water', label: 'Water', unit: 'glasses/day', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'mean_value', aggregate: 'window_28' } },
    { key: 'routine', label: 'Routine days kept', unit: 'days', kind: 'effort', direction: 'higher', source: { instrument: 'routine', signal: 'all_done_days', aggregate: 'total' } },
  ],
  conditions: [{
    id: 'routine', short: 'Routine days kept', label: '{0} routine days kept (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
    signal: { instrument: 'routine', signal: 'all_done_days', aggregate: 'total' }, at: { A: 40, S: 70 },
  }],
  checkpoint: { selfEfficacy: 'Keep the routine through a week that is not going to plan?', enjoyment: 'Looking after yourself' },
  reviewPrompt: { prompt: 'What did your body need today?', options: ['Food', 'Movement', 'Rest', 'Nothing in particular'] },
  reflectionThemes: ['health', 'routine'],
};
