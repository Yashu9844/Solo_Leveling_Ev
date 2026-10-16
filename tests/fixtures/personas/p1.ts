import type { Persona } from './types';

/** P1 - a software engineer who is not the owner: the nearest generated analogue of the legacy System. */
export const p1: Persona = {
  id: 'P1', label: 'Software engineer', seed: 101, profile: { kind: 'steady', days: 60 },
  draft: {
    lineageId: 'persona-p1', today: '2026-09-01',
    identity: { displayName: 'ADA', primaryObjective: 'Ship a working agent and land an offer.' },
    domains: [{ archetypeId: 'software-practice' }, { archetypeId: 'deep-build' }, { archetypeId: 'career-pipeline' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
    priorityMode: 'ranked', rhythm: { wakeTime: '07:00', sleepTime: '23:30' },
    arc: { startDate: '2026-09-01', lengthDays: 120, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 120,
    domains: [
      'engine:LOGIC TRIAL',
      'engine:FORGE',
      'engine:ASCENSION',
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
      140,
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
      'LOGIC GAUNTLET',
      'FIRST PUBLIC RELEASE',
      'INTERVIEW READY',
      'STEADY STRENGTH'
    ],
    skillTreeSizes: [
      9
    ],
    attributes: [
      'DISCIPLINE',
      'PROBLEM_SOLVING',
      'ENGINEERING',
      'MOMENTUM',
      'VITALITY'
    ],
    unscoredMetrics: [
      'career-pipeline-0rrq.interview-loops',
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3400
  },
};
