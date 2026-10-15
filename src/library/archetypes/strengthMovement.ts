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

  metrics: [
    { key: 'sessions', label: 'Training sessions', unit: 'sessions', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'count', aggregate: 'total' } },
    { key: 'strength-gain', label: 'Estimated strength gain', unit: '%', kind: 'performance', direction: 'higher', source: { instrument: 'main', signal: 'strength_gain_pct', aggregate: 'total' } },
    { key: 'weight_kg', label: 'Weight', unit: 'kg', kind: 'body', direction: 'neutral', source: { manual: true, cadence: 'any' } },
    { key: 'waist_cm', label: 'Waist', unit: 'cm', kind: 'body', direction: 'neutral', source: { manual: true, cadence: 'any' } },
    { key: 'bodyfat_pct', label: 'Body fat', unit: '%', kind: 'body', direction: 'neutral', source: { manual: true, cadence: 'any' } },
  ],
  // A dated session log is the artefact: a stranger could be shown it.
  ladder: {
    key: 'sessions', label: 'Training sessions', noun: 'training sessions', success: 55, verifiability: 'recorded',
    signal: { instrument: 'main', signal: 'count', aggregate: 'total' },
  },
  conditions: [
    {
      id: 'strength-gain', label: 'Estimated strength gain {0} (need +{t0})', verifiability: 'recorded', comparator: '>=', format: 'percent',
      signal: { instrument: 'main', signal: 'strength_gain_pct', aggregate: 'total' }, at: { A: 0.06, S: 0.12 },
    },
    {
      id: 'mean-steps', label: 'Mean steps {0} (need >= {t0})', verifiability: 'recorded', comparator: '>=', format: 'locale',
      signal: { instrument: 'steps', signal: 'mean_value', aggregate: 'window_28' }, at: { S: { param: 'target', instrument: 'steps' } },
    },
  ],
  attribute: {
    id: 'VITALITY', name: 'VITALITY', group: 'body', combine: 'sum', description: 'Training sessions and daily movement.',
    terms: [
      { id: 'sessions', label: 'Training sessions', weight: 0.55, signal: { instrument: 'main', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 16 } },
      { id: 'steps', label: 'Mean steps', weight: 0.45, signal: { instrument: 'steps', signal: 'mean_value', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 8000 } },
    ],
  },
  bossAnchor: {
    id: 'steady-strength', title: 'STEADY STRENGTH', milestone: 'A training habit that has held',
    uses: { ladder: true, conditions: ['mean-steps'] }, verifiability: 'recorded',
  },
};
