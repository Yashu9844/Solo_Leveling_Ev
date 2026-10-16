import type { Persona } from './types';

/** P5 - a competitive-exam student: two domains of one archetype (V-DOM-03 must not fire - their topics differ), 180 days. */
export const p5: Persona = {
  id: 'P5', label: 'Competitive-exam student', seed: 505, profile: { kind: 'steady', days: 60 },
  draft: {
    lineageId: 'persona-p5', today: '2026-09-01',
    identity: { displayName: 'ISHA', primaryObjective: 'Rank in the top hundred.' },
    domains: [
      { archetypeId: 'exam-prep', answers: { topic: 'Physics', topics: ['Mechanics', 'Waves', 'Optics', 'Thermodynamics', 'Electromagnetism'] } },
      { archetypeId: 'exam-prep', answers: { topic: 'Mathematics', topics: ['Algebra', 'Calculus', 'Geometry', 'Probability'] } },
      { archetypeId: 'reading' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' },
    ],
    priorityMode: 'ranked', rhythm: { wakeTime: '05:30', sleepTime: '22:00' },
    arc: { startDate: '2026-09-01', lengthDays: 180, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 180,
    domains: [
      'engine:ARCANE STUDY',
      'engine:KNOWLEDGE TRIAL',
      'engine:ARCHIVE',
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
      150,
      135,
      60,
      40
    ],
    checkpointDays: [
      14,
      45,
      90,
      135,
      180
    ],
    bossTitles: [
      'FIRST MOCK EXAM',
      'FIRST MOCK EXAM II',
      'THE FIRST SHELF',
      'STEADY STRENGTH'
    ],
    skillTreeSizes: [
      5,
      4
    ],
    attributes: [
      'DISCIPLINE',
      'KNOWLEDGE',
      'KNOWLEDGE_TRIAL',
      'LITERACY',
      'VITALITY'
    ],
    unscoredMetrics: [
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3645
  },
};
