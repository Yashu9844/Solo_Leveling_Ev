import type { Persona } from './types';

/** P2 - a medical student: a non-anchor arc length aligned to an exam date, practice questions as multiple choice, a mock score. */
export const p2: Persona = {
  id: 'P2', label: 'Medical student', seed: 202, profile: { kind: 'steady', days: 60 },
  draft: {
    lineageId: 'persona-p2', today: '2026-09-01',
    identity: { displayName: 'NOOR', primaryObjective: 'Pass the licensing exam on the day.' },
    domains: [
      { archetypeId: 'exam-prep', answers: { topic: 'Medicine', topics: ['Anatomy', 'Physiology', 'Pathology', 'Pharmacology', 'Microbiology'], success: 1200 } },
      { archetypeId: 'reading' }, { archetypeId: 'strength-movement' }, { archetypeId: 'relationships' },
      { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control', answers: { limit: 90 } },
    ],
    priorityMode: 'ranked', rhythm: { wakeTime: '06:30', sleepTime: '23:00' },
    arc: { startDate: '2026-09-01', lengthDays: 150, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 150,
    domains: [
      'engine:ARCANE STUDY',
      'engine:ARCHIVE',
      'engine:VITALITY TRIAL',
      'engine:BONDS',
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
      150,
      150,
      135,
      60,
      40
    ],
    checkpointDays: [
      14,
      38,
      75,
      113,
      150
    ],
    bossTitles: [
      'FIRST MOCK EXAM',
      'THE FIRST SHELF',
      'STEADY STRENGTH',
      'A STANDING TABLE'
    ],
    skillTreeSizes: [
      5
    ],
    attributes: [
      'DISCIPLINE',
      'KNOWLEDGE',
      'LITERACY',
      'VITALITY',
      'WARMTH'
    ],
    unscoredMetrics: [
      'weight_kg',
      'waist_cm',
      'bodyfat_pct'
    ],
    firstWeekXp: 3125
  },
};
