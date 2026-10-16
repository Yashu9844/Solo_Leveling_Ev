import type { Persona } from './types';

const BASE = { today: '2026-09-01', priorityMode: 'ranked' as const };

/** X1 - the minimum System: four core domains, one guardrail, 60 days: every lower bound at once. */
export const x1: Persona = {
  id: 'X1', label: 'Minimum System', seed: 801, profile: { kind: 'steady', days: 60 },
  draft: {
    ...BASE, lineageId: 'persona-x1', identity: { displayName: 'MIN', primaryObjective: 'Do the least that counts.' },
    domains: [{ archetypeId: 'reading' }, { archetypeId: 'strength-movement' }, { archetypeId: 'writing' }, { archetypeId: 'sleep-regularity' }],
    rhythm: { wakeTime: '07:00', sleepTime: '23:00' }, arc: { startDate: '2026-09-01', lengthDays: 60, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 60,
    domains: [
      'engine:ARCHIVE',
      'engine:VITALITY TRIAL',
      'engine:SCRIPTORIUM',
      'guardrail:RECONSTITUTION'
    ],
    coreXp: [
      150,
      130,
      120,
      100
    ],
    caps: [
      225,
      195,
      240,
      100
    ],
    checkpointDays: [
      14,
      25,
      40,
      50,
      60
    ],
    bossTitles: [
      'THE FIRST SHELF',
      'STEADY STRENGTH'
    ],
    skillTreeSizes: [],
    attributes: [
      'DISCIPLINE',
      'LITERACY',
      'VITALITY',
      'VOICE'
    ],
    unscoredMetrics: [
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3420
  },
};

/** X2 - the maximum System: eight core domains and three support domains, two guardrails, 120 days: every upper bound at once. */
export const x2: Persona = {
  id: 'X2', label: 'Maximum System', seed: 802, profile: { kind: 'steady', days: 120 },
  draft: {
    ...BASE, lineageId: 'persona-x2', identity: { displayName: 'MAX', primaryObjective: 'Carry everything at once.' },
    domains: [
      { archetypeId: 'software-practice' }, { archetypeId: 'deep-build' }, { archetypeId: 'career-pipeline' }, { archetypeId: 'strength-movement' },
      { archetypeId: 'writing' }, { archetypeId: 'language-learning' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' },
      { archetypeId: 'reading', answers: { support: true } }, { archetypeId: 'relationships', answers: { support: true } }, { archetypeId: 'health-routine', answers: { support: true } },
    ],
    rhythm: { wakeTime: '06:30', sleepTime: '23:00' }, arc: { startDate: '2026-09-01', lengthDays: 120, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 120,
    domains: [
      'engine:LOGIC TRIAL',
      'engine:FORGE',
      'engine:ASCENSION',
      'engine:VITALITY TRIAL',
      'engine:SCRIPTORIUM',
      'engine:TONGUE TRIAL',
      'guardrail:RECONSTITUTION',
      'guardrail:WILL TRIAL',
      'support:ARCHIVE',
      'support:BONDS',
      'support:SUSTENANCE'
    ],
    coreXp: [
      80,
      80,
      70,
      60,
      60,
      50,
      60,
      40
    ],
    caps: [
      130,
      130,
      98,
      90,
      110,
      100,
      60,
      40,
      50,
      20,
      20
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
      9,
      4
    ],
    attributes: [
      'DISCIPLINE',
      'PROBLEM_SOLVING',
      'ENGINEERING',
      'MOMENTUM',
      'VITALITY',
      'VOICE'
    ],
    unscoredMetrics: [
      'career-pipeline-rhtv.interview-loops',
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3520
  },
};

/** X3 - a night shift: P1's domains, asleep from 08:00, so the day turns over at 10:00 (I19). */
export const x3: Persona = {
  id: 'X3', label: 'Night shift', seed: 803, profile: { kind: 'steady', days: 60 },
  draft: {
    ...BASE, lineageId: 'persona-x3', identity: { displayName: 'NOX', primaryObjective: 'Ship while the city sleeps.' },
    domains: [{ archetypeId: 'software-practice' }, { archetypeId: 'deep-build' }, { archetypeId: 'career-pipeline' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }],
    rhythm: { wakeTime: '16:00', sleepTime: '08:00' }, arc: { startDate: '2026-09-01', lengthDays: 90, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 90,
    domains: [
      'engine:LOGIC TRIAL',
      'engine:FORGE',
      'engine:ASCENSION',
      'engine:VITALITY TRIAL',
      'guardrail:RECONSTITUTION'
    ],
    coreXp: [
      110,
      100,
      100,
      90,
      100
    ],
    caps: [
      200,
      190,
      140,
      135,
      100
    ],
    checkpointDays: [
      14,
      30,
      50,
      70,
      90
    ],
    bossTitles: [
      'LOGIC GAUNTLET',
      'FIRST PUBLIC RELEASE',
      'INTERVIEW READY'
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
      'career-pipeline-cpm8.interview-loops',
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3240
  },
};

/** X4 - a DST traveller: P3's domains in New York, across the November change (it falls on day 43 of the arc). */
export const x4: Persona = {
  id: 'X4', label: 'DST traveller', seed: 804, profile: { kind: 'steady', days: 90 },
  draft: {
    ...BASE, today: '2026-09-20', lineageId: 'persona-x4', identity: { displayName: 'DST', primaryObjective: 'Keep the days straight when the clocks move.' },
    domains: [{ archetypeId: 'strength-movement' }, { archetypeId: 'endurance' }, { archetypeId: 'reading' }, { archetypeId: 'sleep-regularity' }],
    rhythm: { wakeTime: '06:30', sleepTime: '22:30' }, arc: { startDate: '2026-09-20', lengthDays: 90, timezone: 'America/New_York' },
  },
  expect: {
    arcLength: 90,
    domains: [
      'engine:VITALITY TRIAL',
      'engine:STAMINA TRIAL',
      'engine:ARCHIVE',
      'guardrail:RECONSTITUTION'
    ],
    coreXp: [
      150,
      130,
      120,
      100
    ],
    caps: [
      225,
      195,
      180,
      100
    ],
    checkpointDays: [
      14,
      30,
      50,
      70,
      90
    ],
    bossTitles: [
      'STEADY STRENGTH',
      'LONG DISTANCE',
      'THE FIRST SHELF'
    ],
    skillTreeSizes: [],
    attributes: [
      'DISCIPLINE',
      'VITALITY',
      'STAMINA',
      'LITERACY'
    ],
    unscoredMetrics: [
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3420
  },
};
