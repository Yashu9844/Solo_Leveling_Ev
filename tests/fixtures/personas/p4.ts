import type { Persona } from './types';

/** P4 - an entrepreneur: revenue and customers are other people's decisions (external), and the boss is "THE OFFER STANDS", never "first customer" (B5). */
export const p4: Persona = {
  id: 'P4', label: 'Entrepreneur', seed: 404, profile: { kind: 'steady', days: 60 },
  draft: {
    lineageId: 'persona-p4', today: '2026-09-01',
    identity: { displayName: 'SAM', primaryObjective: 'Get the first paying customer by my own effort.' },
    domains: [{ archetypeId: 'business-building' }, { archetypeId: 'deep-build' }, { archetypeId: 'writing' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
    priorityMode: 'ranked', rhythm: { wakeTime: '06:30', sleepTime: '23:00' },
    arc: { startDate: '2026-09-01', lengthDays: 120, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 120,
    domains: [
      'engine:DOMINION',
      'engine:FORGE',
      'engine:SCRIPTORIUM',
      'engine:VITALITY TRIAL',
      'guardrail:RECONSTITUTION',
      'guardrail:WILL TRIAL'
    ],
    coreXp: [
      110,
      100,
      100,
      90,
      60,
      40
    ],
    caps: [
      154,
      190,
      190,
      135,
      60,
      40
    ],
    checkpointDays: [
      14,
      30,
      60,
      90,
      120
    ],
    bossTitles: [
      'THE OFFER STANDS',
      'FIRST PUBLIC RELEASE',
      'FIRST PUBLICATION',
      'STEADY STRENGTH'
    ],
    skillTreeSizes: [],
    attributes: [
      'DISCIPLINE',
      'DRIVE',
      'ENGINEERING',
      'VOICE',
      'VITALITY'
    ],
    unscoredMetrics: [
      'business-building-z69r.replies',
      'customers',
      'revenue',
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3320
  },
};
