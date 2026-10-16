import type { Persona } from './types';

/** P6 - a creative: public-URL evidence for the gates, and an input/output ratio between studying and making. */
export const p6: Persona = {
  id: 'P6', label: 'Creative', seed: 606, profile: { kind: 'steady', days: 60 },
  draft: {
    lineageId: 'persona-p6', today: '2026-09-01',
    identity: { displayName: 'MAYA', primaryObjective: 'Finish and show one piece every month.' },
    domains: [{ archetypeId: 'creative-practice' }, { archetypeId: 'writing' }, { archetypeId: 'public-speaking' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
    priorityMode: 'ranked', rhythm: { wakeTime: '08:00', sleepTime: '00:30' },
    arc: { startDate: '2026-09-01', lengthDays: 90, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 90,
    domains: [
      'engine:CRAFT',
      'engine:SCRIPTORIUM',
      'engine:ORATION',
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
      200,
      190,
      190,
      135,
      60,
      40
    ],
    checkpointDays: [
      14,
      30,
      50,
      70,
      90
    ],
    bossTitles: [
      'THE FIRST SHOWING',
      'FIRST PUBLICATION',
      'FIRST FULL TALK'
    ],
    skillTreeSizes: [],
    attributes: [
      'DISCIPLINE',
      'CRAFTSMANSHIP',
      'VOICE',
      'PRESENCE',
      'VITALITY'
    ],
    unscoredMetrics: [
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3340
  },
};
