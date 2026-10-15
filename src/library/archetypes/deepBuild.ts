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
};
