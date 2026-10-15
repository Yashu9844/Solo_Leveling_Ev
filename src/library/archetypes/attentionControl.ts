import type { ArchetypeDef } from './types';

/** Staying under a limit on the thing that eats the day. The limit is the person's. */
export const attentionControl: ArchetypeDef = {
  id: 'attention-control', area: 'discipline', label: 'Attention control', version: 1,
  role: 'guardrail', weight: 1, headroom: 'guardrail',
  designations: ['WILL TRIAL', 'FOCUS WARD', 'STILL MIND'],
  name: 'Attention', description: 'Screen time under the limit.', channel: 'ATTENTION',
  instruments: [{
    key: 'main', type: 'threshold', label: 'Screen time', logVerb: 'Log Friction Control',
    // target is replaced with the person's limit when the domain is built.
    params: { unit: 'min', comparator: '<=', target: 60, entryLabel: 'Minutes', hint: 'Minutes from Digital Wellbeing, named apps.', defaultValue: 45 },
  }],
  quest: {
    objective: '{target} minutes or under screen time.',
    realityLabel: 'friction control ≤ {target}m',
    criterion: { kind: 'signal', instrument: 'main', signal: 'hit', comparator: '>=', target: 1, min: 1 },
    floor: 'same',
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: false,
  },
  presentation: { icon: 'Eye', hue: 'blue' },
};
