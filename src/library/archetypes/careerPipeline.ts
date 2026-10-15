import type { ArchetypeDef } from './types';

/** Applications sent, and the work that stands in for them on a day they cannot be. */
export const careerPipeline: ArchetypeDef = {
  id: 'career-pipeline', area: 'career', label: 'Career pipeline', version: 1,
  role: 'engine', weight: 1, headroom: 'pipeline',
  designations: ['ASCENSION', 'DESPATCH', 'CAMPAIGN'],
  name: 'Job search', description: 'Applications and the work that substitutes for them.', channel: 'CAREER',
  instruments: [
    {
      key: 'main', type: 'pipeline', label: 'Applications', logVerb: 'Despatch Ascension',
      params: { stages: ['applied', 'responded', 'call', 'interview', 'onsite', 'offer'], qualityGate: 'legacy', followupAfterDays: 10 },
    },
    { key: 'substitute', type: 'duration', label: 'Substitute work', logVerb: 'Log Focus', params: { minBlockMinutes: 10 } },
    { key: 'resumes', type: 'artifact', label: 'Resume versions', logVerb: 'Record Resume', params: { kinds: ['resume'] } },
  ],
  quest: {
    objective: '{target} verified despatches, or 25 minutes of substitute work.',
    realityLabel: '{target} despatches / 25m focus',
    criterion: {
      kind: 'any',
      of: [
        { kind: 'signal', instrument: 'main', signal: 'quality_count', comparator: '>=', target: 3, answer: 'goodDay', min: 1 },
        { kind: 'signal', instrument: 'substitute', signal: 'minutes', comparator: '>=', target: 25, min: 10 },
      ],
    },
    floor: 'same',
    schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Briefcase', hue: 'violet' },
  intention: true, evidenceSurface: 'resume',
};
