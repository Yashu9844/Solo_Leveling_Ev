// Loop 11.5: the seven personas as a person answers for them - the interview's answers, not the generator's draft. Each journey is what P1-P7
// would say to the System; the same answers drive the engine tests (the persona suite runs on the System they produce) and the browser
// (tests/e2e/adaptive-journeys.spec.ts replays them tap by tap).
//
// The interview cannot say everything a draft can, and where it cannot the difference is stated here rather than hidden:
//  - P5 is two exam-prep domains (Physics, Mathematics); an area resolves to one exam-prep, so the journey is one with the subjects of both.
//  - P7 is six custom domains; the System prices six domains in all, so the journey is five of their own and one area.
import type { InstrumentType } from '../../../src/blueprint/schema';

export interface Journey {
  id: string;
  label: string;
  /** The persona (tests/fixtures/personas) this is the interview version of. */
  persona: string;
  seed: number;
  /** What the journey cannot say that the persona's draft does. */
  differences: string[];
  /** The answers by draft path, given today's date (an exam date is relative to it). */
  answers: (today: string) => Record<string, unknown>;
}

export const addDays = (iso: string, days: number): string => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const custom = (type: InstrumentType) => `custom:${type}`;

export const JOURNEYS: Journey[] = [
  {
    id: 'J1', label: 'Software engineer', persona: 'P1', seed: 101, differences: [],
    answers: () => ({
      'identity.displayName': 'Ada', 'identity.primaryObjective': 'Ship a working agent and land an offer.',
      areas: ['craft', 'career', 'body'],
      'area.craft.resolution': 'software-practice', 'area.craft.also': ['deep-build'], 'area.career.resolution': 'career-pipeline', 'area.body.resolution': 'strength-movement',
      'rhythm.wakeTime': '07:00', 'rhythm.sleepTime': '23:30', 'arc.lengthDays': '120',
    }),
  },
  {
    id: 'J2', label: 'Medical student', persona: 'P2', seed: 202, differences: ['the arc is the days to the exam date, not a table length'],
    answers: (today) => ({
      'identity.displayName': 'Noor', 'identity.primaryObjective': 'Pass the licensing exam on the day.',
      areas: ['knowledge', 'body', 'relationships'],
      'area.knowledge.resolution': 'exam-prep', 'area.knowledge.also': ['reading'], 'area.knowledge.examDate': addDays(today, 149),
      'area.knowledge.topics': 'Anatomy, Physiology, Pathology, Pharmacology, Microbiology',
      'area.body.resolution': 'strength-movement', 'area.relationships.resolution': 'relationships',
      'guardrail.attention-control.limit': 90, 'arc.alignToExam': 'yes', 'rhythm.wakeTime': '06:30', 'rhythm.sleepTime': '23:00',
    }),
  },
  {
    id: 'J3', label: 'Fitness-focused', persona: 'P3', seed: 303, differences: ['the body measurements are asked once, as a baseline, and not scored'],
    answers: () => ({
      'identity.displayName': 'Leo', 'identity.primaryObjective': 'Become someone who trains without negotiating.',
      areas: ['body', 'knowledge', 'health'],
      'area.body.resolution': 'strength-movement', 'area.body.also': ['endurance'], 'area.knowledge.resolution': 'reading', 'area.health.resolution': 'health-routine',
      guardrails: ['health-routine'], 'baseline.weight_kg': 71.5,
      'rhythm.wakeTime': '06:00', 'rhythm.sleepTime': '22:30', 'arc.lengthDays': '90',
    }),
  },
  {
    id: 'J4', label: 'Entrepreneur', persona: 'P4', seed: 404, differences: [],
    answers: () => ({
      'identity.displayName': 'Sam', 'identity.primaryObjective': 'Get the first paying customer by my own effort.',
      areas: ['business', 'craft', 'creativity', 'body'],
      'area.business.resolution': 'business-building', 'area.craft.resolution': 'deep-build', 'area.creativity.resolution': 'writing', 'area.body.resolution': 'strength-movement',
      'rhythm.wakeTime': '06:30', 'rhythm.sleepTime': '23:00', 'arc.lengthDays': '120',
    }),
  },
  {
    id: 'J5', label: 'Competitive-exam student', persona: 'P5', seed: 505, differences: ['one exam-prep domain carrying the subjects of both Physics and Mathematics, not two domains'],
    answers: (today) => ({
      'identity.displayName': 'Isha', 'identity.primaryObjective': 'Rank in the top hundred.',
      areas: ['knowledge', 'body'],
      'area.knowledge.resolution': 'exam-prep', 'area.knowledge.also': ['reading'], 'area.knowledge.examDate': addDays(today, 200),
      'area.knowledge.topics': 'Mechanics, Waves, Optics, Thermodynamics, Algebra, Calculus, Geometry, Probability',
      'area.body.resolution': 'strength-movement', 'arc.alignToExam': 'no', 'arc.lengthDays': '180', 'rhythm.wakeTime': '05:30', 'rhythm.sleepTime': '22:00',
    }),
  },
  {
    id: 'J6', label: 'Creative', persona: 'P6', seed: 606, differences: [],
    answers: () => ({
      'identity.displayName': 'Maya', 'identity.primaryObjective': 'Finish and show one piece every month.',
      areas: ['creativity', 'body'],
      'area.creativity.resolution': 'creative-practice', 'area.creativity.also': ['writing', 'public-speaking'], 'area.body.resolution': 'strength-movement',
      'rhythm.wakeTime': '08:00', 'rhythm.sleepTime': '00:30', 'arc.lengthDays': '90',
    }),
  },
  {
    id: 'J7', label: 'Fully custom', persona: 'P7', seed: 707, differences: ['five of their own and one area: six domains is what the System prices, the persona held six of their own'],
    answers: () => ({
      'identity.displayName': 'Quinn', 'identity.primaryObjective': 'Rebuild my days around five things I chose myself.',
      areas: ['body'], customs: 'Piano, Gallery outreach, Cold shower, Evening shutdown, Pushups',
      'area.body.resolution': 'strength-movement',
      'area.custom1.resolution': custom('practice_item'), 'area.custom1.topics': 'Scales, Arpeggios, Pieces, Sight reading', 'area.custom1.goodDay': 3,
      'area.custom2.resolution': custom('pipeline'),
      'area.custom3.resolution': custom('time_window'), 'area.custom3.time': '06:15',
      'area.custom4.resolution': custom('checklist'), 'area.custom4.items': 'Plan tomorrow, Clear desk, Charge devices',
      'area.custom5.resolution': custom('threshold'), 'area.custom5.goodDay': 40,
      'rhythm.wakeTime': '06:00', 'rhythm.sleepTime': '22:30', 'arc.lengthDays': '365',
    }),
  },
];
