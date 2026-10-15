import type { ArchetypeDef } from './types';

/** Time spent building, and what it ships. */
export const deepBuild: ArchetypeDef = {
  id: 'deep-build', area: 'craft', label: 'Deep build', version: 1,
  role: 'engine', weight: 1, headroom: 'practice_or_artifact',
  designations: ['FORGE', 'CONSTRUCT', 'ANVIL'],
  name: 'Building', description: 'Construct sessions and shipped work.', channel: 'CRAFT',
  instruments: [
    { key: 'main', type: 'duration', label: 'Build sessions', logVerb: 'Forge Construct', params: { modes: ['LEARN', 'SHIP'], defaultMinutes: 45 } },
    {
      key: 'artifacts', type: 'artifact', label: 'Shipped units', logVerb: 'Forge Artifact',
      params: { kinds: ['feature', 'eval', 'project', 'deployment', 'writeup', 'resume', 'portfolio'], bonusXp: 50, grant: { amount: 50, reason: 'ship' } },
    },
  ],
  quest: {
    objective: '{target}+ minutes of focused building.',
    realityLabel: '{target}m build session',
    criterion: { kind: 'signal', instrument: 'main', signal: 'minutes', comparator: '>=', target: 45, answer: 'goodDay', min: 10 },
    floor: 'same',
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: false,
  },
  presentation: { icon: 'Cpu', hue: 'blue' },
  evidenceSurface: 'portfolio',

  metrics: [
    { key: 'build-minutes', label: 'Build minutes', unit: 'min', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'minutes', aggregate: 'total' } },
    { key: 'units-shipped', label: 'Units shipped', unit: 'units', kind: 'effort', direction: 'higher', source: { instrument: 'artifacts', signal: 'count', aggregate: 'total' } },
    { key: 'public-projects', label: 'Public projects', unit: 'projects', kind: 'effort', direction: 'higher', source: { instrument: 'artifacts', signal: 'projects_with', aggregate: 'total', filter: { kind: 'project' } } },
  ],
  ladder: {
    key: 'shipped', label: 'Units shipped', noun: 'units shipped', success: 8, verifiability: 'count',
    signal: { instrument: 'artifacts', signal: 'count', aggregate: 'total' },
  },
  conditions: [
    {
      id: 'public-feature', label: 'A feature in a public repo', verifiability: 'public_url', comparator: '>=',
      signal: { instrument: 'artifacts', signal: 'count', aggregate: 'total', filter: { kind: 'feature', hasUrl: 'true' } }, at: { C: 1 },
    },
    {
      id: 'project-with-eval', label: 'A public project with its README and eval suite', verifiability: 'public_url', comparator: '>=',
      signal: { instrument: 'artifacts', signal: 'projects_with_all_kinds', aggregate: 'total', filter: { kinds: 'project,eval' } }, at: { B: 1, S: 3 },
    },
    {
      id: 'deployed', label: 'A project deployed and reachable', verifiability: 'public_url', comparator: '>=',
      signal: { instrument: 'artifacts', signal: 'count', aggregate: 'total', filter: { kind: 'deployment' } }, at: { A: 1, S: 1 },
    },
    {
      id: 'writeup', label: 'A published technical write-up', verifiability: 'public_url', comparator: '>=',
      signal: { instrument: 'artifacts', signal: 'count', aggregate: 'total', filter: { kind: 'writeup' } }, at: { A: 1, S: 1 },
    },
  ],
  attribute: {
    id: 'ENGINEERING', name: 'ENGINEERING', group: 'craft', combine: 'sum', description: 'Units shipped, how much of it is eval-grade, and the hours behind it.',
    terms: [
      { id: 'shipped_units', label: 'Units shipped', weight: 0.4, signal: { instrument: 'artifacts', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 6 } },
      { id: 'eval_coverage', label: 'Eval coverage', weight: 0.25, signal: { instrument: 'artifacts', signal: 'count', aggregate: 'eligible_28', filter: { kind: 'eval' } }, ratioOf: { instrument: 'artifacts', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'rate' } },
      { id: 'build_minutes', label: 'Mean daily build minutes', weight: 0.35, signal: { instrument: 'main', signal: 'minutes', aggregate: 'eligible_28' }, ratioOf: 'window_days', transform: { kind: 'ratio', denominator: 90 } },
    ],
  },
  bossAnchor: {
    id: 'first-release', title: 'FIRST PUBLIC RELEASE', milestone: 'A project anyone can open',
    uses: { ladder: true, conditions: ['public-feature', 'project-with-eval'] }, verifiability: 'public_url',
  },
};
