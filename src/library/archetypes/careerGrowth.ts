import type { ArchetypeDef } from './types';

/**
 * Career as the job you already have: focused time on the work that moves your role, and the wins that come of it - things delivered, an
 * improvement to how the team works, feedback from the people you work with, a skill your role needed. Finding a new job is a different
 * archetype (career-pipeline); a person can hold both.
 */
export const careerGrowth: ArchetypeDef = {
  id: 'career-growth', area: 'career', label: 'Growing at work', version: 1,
  role: 'engine', weight: 1, headroom: 'practice_or_artifact',
  designations: ['MANDATE', 'TENURE', 'VANGUARD'],
  name: 'Work', description: 'Focused time on the work that moves your role, and what it delivers.', channel: 'OFFICE',
  instruments: [
    {
      key: 'main', type: 'duration', label: 'Focused work', logVerb: 'Log Focused Work',
      params: { modes: ['DELIVER', 'IMPROVE', 'LEARN'], defaultMinutes: 60, minBlockMinutes: 15 },
    },
    {
      key: 'wins', type: 'artifact', label: 'Wins at work', logVerb: 'Log a Win',
      params: { kinds: ['delivered', 'improvement', 'feedback', 'skill'], bonusXp: 40, grant: { amount: 40, reason: 'win' } },
    },
  ],
  quest: {
    objective: '{target}+ minutes of focused work on what moves your role.',
    realityLabel: '{target}m focused work',
    criterion: { kind: 'signal', instrument: 'main', signal: 'minutes', comparator: '>=', target: 60, answer: 'goodDay', min: 15 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'ChartLineUp', hue: 'amber' },
  intention: true,
  evidenceSurface: 'brag document',

  metrics: [
    { key: 'focus-minutes', label: 'Focused minutes', unit: 'min', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'minutes', aggregate: 'total' } },
    { key: 'wins', label: 'Wins at work', unit: 'wins', kind: 'effort', direction: 'higher', source: { instrument: 'wins', signal: 'count', aggregate: 'total' } },
    { key: 'improvements', label: 'Improvements made', unit: 'improvements', kind: 'effort', direction: 'higher', source: { instrument: 'wins', signal: 'count', aggregate: 'total', filter: { kind: 'improvement' } } },
  ],
  ladder: { key: 'wins', label: 'Wins at work', noun: 'wins at work', success: 15, verifiability: 'count', signal: { instrument: 'wins', signal: 'count', aggregate: 'total' } },
  conditions: [
    {
      id: 'delivered', short: 'Work delivered', label: '{0} pieces of work delivered (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'wins', signal: 'count', aggregate: 'total', filter: { kind: 'delivered' } }, at: { C: 2, B: 4, A: 8, S: 12 },
    },
    {
      id: 'improvement', short: 'Improvements made', label: '{0} improvements to how the work is done (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'wins', signal: 'count', aggregate: 'total', filter: { kind: 'improvement' } }, at: { B: 1, A: 2, S: 4 },
    },
    {
      id: 'feedback', short: 'Feedback received', label: '{0} pieces of feedback recorded (need {t0})', verifiability: 'recorded', comparator: '>=', format: 'int',
      signal: { instrument: 'wins', signal: 'count', aggregate: 'total', filter: { kind: 'feedback' } }, at: { A: 1, S: 2 },
    },
  ],
  attribute: {
    id: 'IMPACT', name: 'IMPACT', group: 'craft', combine: 'sum', description: 'Focused hours on the work, and what they deliver.',
    terms: [
      { id: 'focus', label: 'Mean daily focused minutes', weight: 0.5, signal: { instrument: 'main', signal: 'minutes', aggregate: 'eligible_28' }, ratioOf: 'window_days', transform: { kind: 'ratio', denominator: 90 } },
      { id: 'wins', label: 'Wins at work', weight: 0.5, signal: { instrument: 'wins', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 6 } },
    ],
  },
  bossAnchor: {
    id: 'improvement-adopted', title: 'THE CHANGE THAT STUCK', milestone: 'An improvement at work that others now use',
    uses: { ladder: true, conditions: ['improvement'] }, verifiability: 'recorded',
  },
  checkpoint: { selfEfficacy: 'Propose an improvement at work and see it adopted?', enjoyment: 'Your work' },
  reviewPrompt: { prompt: 'What got in the way at work today?', options: ['Meetings', 'Unclear priorities', 'Interruptions', 'Nothing in the way'] },
  reflectionThemes: ['craft', 'finishing'],
  achievements: [
    { id: 'improver', label: 'Improver', kind: 'identity', verifiability: 'recorded', clauses: [{ signal: { instrument: 'wins', signal: 'count', aggregate: 'total', filter: { kind: 'improvement' } }, comparator: '>=', threshold: 3 }] },
  ],
};
