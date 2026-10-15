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

  metrics: [
    { key: 'applications', label: 'Applications', unit: 'applications', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'submitted', aggregate: 'total' } },
    { key: 'quality-rate', label: 'Quality rate', unit: '%', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'quality_rate', aggregate: 'total' } },
    { key: 'interview-loops', label: 'Interview loops reached', unit: 'loops', kind: 'external', direction: 'neutral', source: { instrument: 'main', signal: 'stage_counts', aggregate: 'total', filter: { stage: 'loops' } } },
    { key: 'benchmark', label: 'Interview-readiness benchmark', unit: 'pass', kind: 'performance', direction: 'higher', source: { manual: true, cadence: 'any' } },
  ],
  ladder: {
    key: 'applications', label: 'Quality applications', noun: 'quality applications', success: 280, verifiability: 'count',
    signal: { instrument: 'main', signal: 'quality_count', aggregate: 'total' },
  },
  conditions: [
    {
      id: 'resume-on-file', short: 'Resume versions', label: 'Resume versions on file {0} (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'resumes', signal: 'count', aggregate: 'total' }, at: { C: 1, B: 2 },
    },
    {
      id: 'resume-reviewed', short: 'Reviewed resumes', label: 'Resumes reviewed by someone else {0} (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'resumes', signal: 'count', aggregate: 'total', filter: { externalReview: 'true' } }, at: { B: 1, A: 1, S: 1 },
    },
    {
      id: 'follow-through', short: 'Follow-through', label: 'Follow-through {0} (need {t0})', verifiability: 'count', comparator: '>=', format: 'percent',
      signal: { instrument: 'main', signal: 'followthrough_rate', aggregate: 'total' }, at: { A: 0.7, S: 0.7 },
    },
    {
      id: 'mocks', short: 'Recorded mocks', label: '{0} recorded mocks (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'substitute', signal: 'mode_counts', aggregate: 'total', filter: { mode: 'mock' } }, at: { A: 2, S: 4 },
    },
  ],
  attribute: {
    id: 'MOMENTUM', name: 'MOMENTUM', group: 'craft', combine: 'sum', description: 'Applications sent, their quality, and following through.',
    terms: [
      { id: 'applications', label: 'Applications', weight: 0.4, signal: { instrument: 'main', signal: 'submitted', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 70 } },
      { id: 'quality', label: 'Quality rate', weight: 0.35, signal: { instrument: 'main', signal: 'quality_rate', aggregate: 'eligible_28' }, transform: { kind: 'rate' } },
      { id: 'follow_through', label: 'Follow-through', weight: 0.25, signal: { instrument: 'main', signal: 'followthrough_rate', aggregate: 'eligible_28' }, transform: { kind: 'rate' } },
    ],
  },
  // "First interview" depends on other people, so the boss is its controlled counterpart and the outcome is recorded, never gating (B5).
  bossAnchor: {
    id: 'interview-ready', title: 'INTERVIEW READY', milestone: 'Mocks recorded and materials reviewed',
    uses: { ladder: true, conditions: ['mocks', 'resume-reviewed'] }, verifiability: 'recorded',
    external: { key: 'interview-loops', label: 'Interview loops reached', source: { instrument: 'main', signal: 'stage_counts', aggregate: 'total', filter: { stage: 'loops' } } },
  },

  checkpoint: { selfEfficacy: 'Apply to 5 roles above your current level this week?', enjoyment: 'The job search' },
  reviewPrompt: { prompt: 'What got in the way of the search today?', options: ['No fitting roles', 'The application itself', 'Waiting on replies', 'Nothing in the way'] },
  reflectionThemes: ['persistence', 'rejection'],
  achievements: [
    { id: 'despatcher', label: 'Despatcher', verifiability: 'count', clauses: [{ signal: { instrument: 'main', signal: 'quality_count', aggregate: 'total' }, comparator: '>=', threshold: 50 }] },
  ],
};
