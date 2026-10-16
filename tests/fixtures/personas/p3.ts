import type { Persona } from './types';

/** P3 - fitness-focused: body measurements are logged and never score; one guardrail; the 90-day calibration. */
export const p3: Persona = {
  id: 'P3', label: 'Fitness-focused', seed: 303, profile: { kind: 'steady', days: 60 },
  draft: {
    lineageId: 'persona-p3', today: '2026-09-01',
    identity: { displayName: 'LEO', primaryObjective: 'Become someone who trains without negotiating.' },
    domains: [{ archetypeId: 'strength-movement' }, { archetypeId: 'endurance' }, { archetypeId: 'reading' }, { archetypeId: 'health-routine' }],
    priorityMode: 'ranked', rhythm: { wakeTime: '06:00', sleepTime: '22:30' },
    arc: { startDate: '2026-09-01', lengthDays: 90, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 90,
    domains: [
      'engine:VITALITY TRIAL',
      'engine:STAMINA TRIAL',
      'engine:ARCHIVE',
      'guardrail:SUSTENANCE'
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
    firstWeekXp: 3290
  },
};
