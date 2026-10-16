import type { Persona } from './types';

/** P7 - fully custom: five custom domains and one custom guardrail, every instrument type through the custom flow, 365 days. */
export const p7: Persona = {
  id: 'P7', label: 'Fully custom', seed: 707, profile: { kind: 'steady', days: 90 },
  draft: {
    lineageId: 'persona-p7', today: '2026-09-01',
    identity: { displayName: 'QUINN', primaryObjective: 'Rebuild my days around five things I chose myself.' },
    domains: [
      { archetypeId: 'custom:practice_item', answers: { topic: 'Piano', topics: ['Scales', 'Arpeggios', 'Pieces', 'Sight reading'], goodDay: 3 } },
      { archetypeId: 'custom:pipeline', answers: { topic: 'Gallery outreach' } },
      { archetypeId: 'custom:time_window', answers: { topic: 'Cold shower', time: '06:15' } },
      { archetypeId: 'custom:checklist', answers: { topic: 'Evening shutdown', items: ['Plan tomorrow', 'Clear desk', 'Charge devices'] } },
      { archetypeId: 'custom:threshold', answers: { topic: 'Pushups', goodDay: 40 } },
      { archetypeId: 'custom:threshold', answers: { topic: 'Sugar', guardrail: true, limit: 30 } },
    ],
    priorityMode: 'ranked', rhythm: { wakeTime: '06:00', sleepTime: '22:30' },
    arc: { startDate: '2026-09-01', lengthDays: 365, timezone: 'Asia/Kolkata' },
  },
  expect: {
    arcLength: 365,
    domains: [
      'engine:DRILL',
      'engine:REACH',
      'engine:HOUR',
      'engine:ROUTINE',
      'engine:MEASURE',
      'guardrail:LIMIT'
    ],
    coreXp: [
      100,
      90,
      80,
      70,
      60,
      100
    ],
    caps: [
      160,
      126,
      80,
      70,
      90,
      100
    ],
    checkpointDays: [
      14,
      90,
      180,
      270,
      365
    ],
    bossTitles: [
      'FIRST MILESTONE',
      'FIRST MILESTONE II',
      'FIRST MILESTONE III',
      'FIRST MILESTONE IV'
    ],
    skillTreeSizes: [
      4
    ],
    attributes: [
      'DISCIPLINE',
      'DRILL',
      'REACH',
      'HOUR',
      'ROUTINE',
      'MEASURE'
    ],
    unscoredMetrics: [],
    firstWeekXp: 3250
  },
};
