import type { ArchetypeDef } from './types';

/** Conditioning sessions and daily movement. */
export const strengthMovement: ArchetypeDef = {
  id: 'strength-movement', area: 'body', label: 'Strength and movement', version: 1,
  role: 'engine', weight: 1, headroom: 'session_threshold',
  designations: ['VITALITY TRIAL', 'PHYSICAL TRIAL', 'IRON TRIAL'],
  name: 'Training', description: 'Conditioning sessions and daily movement.', channel: 'BODY',
  instruments: [
    {
      key: 'main', type: 'session', label: 'Sessions', logVerb: 'Record Vitality Trial',
      params: { sessionTypes: ['Push', 'Pull', 'Legs', 'Full', 'Conditioning'], estimator: 'epley', defaultMinutes: 45, defaultRpe: 6 },
    },
    {
      key: 'steps', type: 'threshold', label: 'Steps', logVerb: 'Register Steps',
      params: { unit: 'steps', comparator: '>=', target: 8000, bonusAt: 10000, bonusXp: 20, grant: { amount: 20, reason: 'steps_bonus' } },
    },
  ],
  quest: {
    objective: 'A physical conditioning session, or {target}+ steps registered.',
    realityLabel: 'conditioning or {target} steps',
    criterion: {
      kind: 'any',
      of: [
        { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 1, min: 1 },
        { kind: 'signal', instrument: 'steps', signal: 'total_value', comparator: '>=', target: 8000, answer: 'goodDay', min: 1000 },
      ],
    },
    floor: 'same',
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Barbell', hue: 'rose' },
  intention: true,
};
