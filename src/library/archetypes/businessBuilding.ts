import type { ArchetypeDef } from './types';

/**
 * Outreach and shipping toward a business. Revenue and customers are other people's decisions, so they are recorded
 * beside the System (external, never scored); what the System judges is what the person did.
 */
export const businessBuilding: ArchetypeDef = {
  id: 'business-building', area: 'business', label: 'Business building', version: 1,
  role: 'engine', weight: 1, headroom: 'pipeline',
  designations: ['DOMINION', 'VENTURE', 'COUNTING HOUSE'],
  name: 'Business', description: 'Outreach made and work shipped toward a business.', channel: 'VENTURE',
  instruments: [
    {
      key: 'main', type: 'pipeline', label: 'Outreach', logVerb: 'Log Outreach',
      params: { stages: ['contacted', 'replied', 'demo', 'trial', 'paying'], qualityGate: 'legacy', followupAfterDays: 7 },
    },
    { key: 'shipped', type: 'artifact', label: 'Shipped work', logVerb: 'Log Shipment', params: { kinds: ['page', 'pricing', 'feature', 'launch'], bonusXp: 40, grant: { amount: 40, reason: 'ship' } } },
  ],
  quest: {
    objective: '{target} qualified outreaches made.',
    realityLabel: '{target} outreaches',
    criterion: { kind: 'signal', instrument: 'main', signal: 'quality_count', comparator: '>=', target: 5, answer: 'goodDay', min: 1 },
    floor: 'same', schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
  },
  presentation: { icon: 'Rocket', hue: 'amber' },
  intention: true, evidenceSurface: 'portfolio',

  metrics: [
    { key: 'outreach', label: 'Qualified outreaches', unit: 'outreaches', kind: 'effort', direction: 'higher', source: { instrument: 'main', signal: 'quality_count', aggregate: 'total' } },
    { key: 'shipped', label: 'Units shipped', unit: 'units', kind: 'effort', direction: 'higher', source: { instrument: 'shipped', signal: 'count', aggregate: 'total' } },
    { key: 'replies', label: 'Replies received', unit: 'replies', kind: 'external', direction: 'neutral', source: { instrument: 'main', signal: 'stage_counts', aggregate: 'total', filter: { stage: 'responses' } } },
    { key: 'customers', label: 'Paying customers', unit: 'customers', kind: 'external', direction: 'neutral', source: { manual: true, cadence: 'any' } },
    { key: 'revenue', label: 'Revenue', unit: 'currency', kind: 'external', direction: 'neutral', source: { manual: true, cadence: 'any' } },
  ],
  ladder: { key: 'outreach', label: 'Qualified outreaches', noun: 'qualified outreaches', success: 280, verifiability: 'count', signal: { instrument: 'main', signal: 'quality_count', aggregate: 'total' } },
  conditions: [
    {
      id: 'offer-live', short: 'Offer live', label: 'A pricing page live at a public address', verifiability: 'public_url', comparator: '>=',
      signal: { instrument: 'shipped', signal: 'count', aggregate: 'total', filter: { kind: 'pricing', hasUrl: 'true' } }, at: { C: 1 },
    },
    {
      id: 'launched', short: 'Launches', label: 'A launch with a public address', verifiability: 'public_url', comparator: '>=',
      signal: { instrument: 'shipped', signal: 'count', aggregate: 'total', filter: { kind: 'launch', hasUrl: 'true' } }, at: { A: 1, S: 1 },
    },
    {
      id: 'follow-through', short: 'Follow-through', label: 'Follow-through {0} (need {t0})', verifiability: 'count', comparator: '>=', format: 'percent',
      signal: { instrument: 'main', signal: 'followthrough_rate', aggregate: 'total' }, at: { A: 0.6, S: 0.7 },
    },
  ],
  attribute: {
    id: 'DRIVE', name: 'DRIVE', group: 'craft', combine: 'sum', description: 'Outreach made, how well it was made, and work shipped.',
    terms: [
      { id: 'outreach', label: 'Qualified outreaches', weight: 0.45, signal: { instrument: 'main', signal: 'quality_count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 70 } },
      { id: 'follow_through', label: 'Follow-through', weight: 0.25, signal: { instrument: 'main', signal: 'followthrough_rate', aggregate: 'eligible_28' }, transform: { kind: 'rate' } },
      { id: 'shipped', label: 'Units shipped', weight: 0.3, signal: { instrument: 'shipped', signal: 'count', aggregate: 'eligible_28' }, transform: { kind: 'ratio', denominator: 4 } },
    ],
  },
  // "First customer" is the market's verdict; the boss is its controlled counterpart (B5).
  bossAnchor: {
    id: 'offer-stands', title: 'THE OFFER STANDS', milestone: 'An offer live at a public address, with the outreach behind it',
    uses: { ladder: true, conditions: ['offer-live'] }, verifiability: 'public_url',
    external: { key: 'customers', label: 'Paying customers', source: { instrument: 'main', signal: 'stage_counts', aggregate: 'total', filter: { stage: 'offers' } } },
  },
  checkpoint: { selfEfficacy: 'Send an outreach message to a stranger before you feel ready?', enjoyment: 'The business' },
  reviewPrompt: { prompt: 'What slowed the business today?', options: ['No leads', 'Unclear offer', 'Waiting on replies', 'Nothing slowed it'] },
  reflectionThemes: ['venture', 'persistence'],
  achievements: [{ id: 'hundred-outreaches', label: 'A Hundred Doors', verifiability: 'count', clauses: [{ signal: { instrument: 'main', signal: 'quality_count', aggregate: 'total' }, comparator: '>=', threshold: 100 }] }],
};
