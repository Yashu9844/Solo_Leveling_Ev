import type { ArchetypeDef } from './types';

/** Waking inside a window. The window is the person's own wake time; the quest is the window. */
export const sleepRegularity: ArchetypeDef = {
  id: 'sleep-regularity', area: 'health', label: 'Sleep regularity', version: 1,
  role: 'guardrail', weight: 1.5, headroom: 'guardrail',
  designations: ['RECONSTITUTION', 'DUSK WARD', 'REST WARD'],
  name: 'Sleep', description: 'Waking inside the window.', channel: 'SLEEP',
  instruments: [{
    key: 'main', type: 'time_window', label: 'Wake time', logVerb: 'Log Synchronization',
    // targetTime is replaced with the person's wake time when the domain is built.
    params: { targetTime: '08:30', toleranceMinutes: 30, secondaryLabel: 'Sleep time' },
  }],
  quest: {
    objective: 'Wake within {tolerance} minutes of {wake}.',
    realityLabel: 'wake window {window}',
    criterion: { kind: 'signal', instrument: 'main', signal: 'hit', comparator: '>=', target: 1, min: 1 },
    floor: 'same',
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: false,
  },
  presentation: { icon: 'MoonStars', hue: 'violet' },

  metrics: [
    { key: 'wake-sd', label: 'Wake-time spread', unit: 'min', kind: 'performance', direction: 'lower', source: { instrument: 'main', signal: 'sd_minutes', aggregate: 'window_28' } },
  ],
  // Consistency is the evidence a guardrail has: it is judged from A.
  conditions: [{
    id: 'wake-sd', short: 'Wake SD', label: 'Wake SD {0}min (need < {t0})', verifiability: 'recorded', comparator: '<', format: 'round',
    signal: { instrument: 'main', signal: 'sd_minutes_failsafe', aggregate: 'window_28' }, at: { A: 60, S: 45 },
  }],

  checkpoint: { selfEfficacy: 'Hold your wake time within 30 minutes for the next 14 days?', enjoyment: 'Mornings' },
  reviewPrompt: { prompt: 'What moved your wake time?', options: ['Slept late', 'Woke early', 'Disturbed night', 'Right on time'] },
  reflectionThemes: ['rest', 'rhythm'],
  achievements: [
    { id: 'regular', label: 'Regular', verifiability: 'recorded', clauses: [{ signal: { instrument: 'main', signal: 'sd_minutes_failsafe', aggregate: 'window_28' }, comparator: '<', threshold: 45 }] },
  ],
};
