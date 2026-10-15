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
};
