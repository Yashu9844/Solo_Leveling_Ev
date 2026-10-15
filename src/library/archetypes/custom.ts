// A custom domain is `archetype = custom:<instrument type>` (platform/03 §26): the person names what they are trying to
// become better at and picks the ACTION that proves progress - one of the nine instrument types - and everything
// downstream (economy, attributes, gates, bosses, sheets, messages) works unchanged. The flow never says "name your
// task": a quest can only be built from an instrument, a signal and a number (D10).
import type { InstrumentType } from '../../blueprint/schema';
import { CUSTOM_DESIGNATION_STEMS, REALITY_VERBS } from '../lexicon';
import type { ArchetypeDef, Headroom, InstrumentTemplate, LadderTemplate, QuestTemplate } from './types';

export const CUSTOM_TYPES: readonly InstrumentType[] = [
  'practice_item', 'duration', 'session', 'threshold', 'time_window', 'artifact', 'pipeline', 'checklist', 'study_block',
];

export const CUSTOM_PREFIX = 'custom:';

export const isCustomArchetypeId = (id: string): boolean => id.startsWith(CUSTOM_PREFIX) && CUSTOM_TYPES.includes(id.slice(CUSTOM_PREFIX.length) as InstrumentType);

interface CustomKind {
  instrument: InstrumentTemplate;
  headroom: Headroom;
  quest: Pick<QuestTemplate, 'criterion' | 'objective' | 'realityLabel'>;
  ladder: Omit<LadderTemplate, 'key' | 'label'> & { label: string };
  /** The action verb of the sheet ("Log Drill"). */
  verb: string;
}

const KINDS: Record<string, CustomKind> = {
  practice_item: {
    instrument: {
      key: 'main', type: 'practice_item', label: 'Items', logVerb: 'Log Item',
      params: { topics: ['General'], difficultyScale: ['E', 'M', 'H'], outcomes: ['first_attempt', 'hint', 'editorial', 'unsolved'], revisitGrant: { amount: 20, reason: 'revisit' }, maxRevisitsPerDay: 3 },
    },
    headroom: 'practice_or_artifact', verb: 'Log Item',
    quest: {
      objective: '{target} items practised.', realityLabel: '{target} items',
      criterion: { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 1, filter: { isRevisit: 'false' }, answer: 'goodDay', min: 1 },
    },
    ladder: { label: 'Items practised', noun: 'items practised', success: 120, verifiability: 'count', signal: { instrument: 'main', signal: 'count', aggregate: 'total', filter: { isRevisit: 'false' } } },
  },
  duration: {
    instrument: { key: 'main', type: 'duration', label: 'Focused time', logVerb: 'Log Focus', params: { defaultMinutes: 30, minBlockMinutes: 10 } },
    headroom: 'session_threshold', verb: 'Log Focus',
    quest: {
      objective: '{target}+ minutes of focused time.', realityLabel: '{target}m focused',
      criterion: { kind: 'signal', instrument: 'main', signal: 'minutes', comparator: '>=', target: 30, answer: 'goodDay', min: 10 },
    },
    ladder: { label: 'Minutes focused', noun: 'minutes focused', success: 3000, verifiability: 'count', signal: { instrument: 'main', signal: 'minutes', aggregate: 'total' } },
  },
  session: {
    instrument: { key: 'main', type: 'session', label: 'Sessions', logVerb: 'Log Session', params: { sessionTypes: ['Session'], defaultMinutes: 30, defaultRpe: 5 } },
    headroom: 'session_threshold', verb: 'Log Session',
    quest: {
      objective: '{target} session completed.', realityLabel: '{target} session',
      criterion: { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 1, answer: 'goodDay', min: 1 },
    },
    ladder: { label: 'Sessions completed', noun: 'sessions completed', success: 48, verifiability: 'recorded', signal: { instrument: 'main', signal: 'count', aggregate: 'total' } },
  },
  threshold: {
    instrument: { key: 'main', type: 'threshold', label: 'Daily count', logVerb: 'Log Count', params: { unit: 'units', comparator: '>=', target: 1, entryLabel: 'Count', hint: 'The number for today.', defaultValue: 1 } },
    headroom: 'session_threshold', verb: 'Log Count',
    quest: {
      objective: '{target}+ done.', realityLabel: '{target} done',
      criterion: { kind: 'signal', instrument: 'main', signal: 'total_value', comparator: '>=', target: 1, answer: 'goodDay', min: 1 },
    },
    ladder: { label: 'Total counted', noun: 'counted', success: 100, verifiability: 'count', signal: { instrument: 'main', signal: 'total_value', aggregate: 'total' } },
  },
  time_window: {
    instrument: { key: 'main', type: 'time_window', label: 'Time kept', logVerb: 'Log Time', params: { targetTime: '07:00', toleranceMinutes: 30 } },
    headroom: 'guardrail', verb: 'Log Time',
    quest: {
      objective: 'Within {tolerance} minutes of {wake}.', realityLabel: 'window {window}',
      criterion: { kind: 'signal', instrument: 'main', signal: 'hit', comparator: '>=', target: 1, min: 1 },
    },
    ladder: { label: 'Days kept', noun: 'days kept', success: 90, verifiability: 'recorded', signal: { instrument: 'main', signal: 'hit_days', aggregate: 'total' } },
  },
  artifact: {
    instrument: { key: 'main', type: 'artifact', label: 'Things finished', logVerb: 'Log Finished Work', params: { kinds: ['draft', 'finished', 'public'], bonusXp: 40, grant: { amount: 40, reason: 'finished' } } },
    headroom: 'practice_or_artifact', verb: 'Log Finished Work',
    quest: {
      objective: '{target} thing finished.', realityLabel: '{target} finished',
      criterion: { kind: 'signal', instrument: 'main', signal: 'count', comparator: '>=', target: 1, answer: 'goodDay', min: 1 },
    },
    ladder: { label: 'Things finished', noun: 'things finished', success: 12, verifiability: 'recorded', signal: { instrument: 'main', signal: 'count', aggregate: 'total' } },
  },
  pipeline: {
    instrument: { key: 'main', type: 'pipeline', label: 'Reach-outs', logVerb: 'Log Reach-out', params: { stages: ['contacted', 'replied', 'met'], qualityGate: 'legacy', followupAfterDays: 10 } },
    headroom: 'pipeline', verb: 'Log Reach-out',
    quest: {
      objective: '{target} qualified reach-outs.', realityLabel: '{target} reach-outs',
      criterion: { kind: 'signal', instrument: 'main', signal: 'quality_count', comparator: '>=', target: 3, answer: 'goodDay', min: 1 },
    },
    ladder: { label: 'Qualified reach-outs', noun: 'qualified reach-outs', success: 120, verifiability: 'count', signal: { instrument: 'main', signal: 'quality_count', aggregate: 'total' } },
  },
  checklist: {
    instrument: { key: 'main', type: 'checklist', label: 'Routine', logVerb: 'Tick Routine', params: { items: [{ id: 'done', label: 'Done' }] } },
    headroom: 'guardrail', verb: 'Tick Routine',
    quest: {
      objective: 'The whole routine done.', realityLabel: 'routine done',
      criterion: { kind: 'signal', instrument: 'main', signal: 'all_done_days', comparator: '>=', target: 1, min: 1 },
    },
    ladder: { label: 'Days kept', noun: 'days kept', success: 80, verifiability: 'recorded', signal: { instrument: 'main', signal: 'all_done_days', aggregate: 'total' } },
  },
  study_block: {
    instrument: { key: 'main', type: 'study_block', label: 'Study blocks', logVerb: 'Log Block', params: { topics: ['General'], modes: ['studied'], blockXp: 25, grant: { amount: 25, reason: 'study_block' } } },
    headroom: 'practice_or_artifact', verb: 'Log Block',
    quest: {
      objective: '{target}+ minutes of study.', realityLabel: '{target}m study',
      criterion: { kind: 'signal', instrument: 'main', signal: 'minutes', comparator: '>=', target: 30, answer: 'goodDay', min: 10 },
    },
    ladder: { label: 'Study blocks', noun: 'study blocks', success: 60, verifiability: 'recorded', signal: { instrument: 'main', signal: 'blocks', aggregate: 'total' } },
  },
};

/** The archetype for `custom:<type>`, or undefined when the id is not one. */
export function customArchetype(id: string): ArchetypeDef | undefined {
  if (!isCustomArchetypeId(id)) return undefined;
  const type = id.slice(CUSTOM_PREFIX.length) as InstrumentType;
  const kind = KINDS[type]!;
  const stems = CUSTOM_DESIGNATION_STEMS[type] ?? ['TRIAL'];
  return {
    id, area: 'custom', label: `Custom: ${type.replace('_', ' ')}`, version: 1,
    role: 'engine', weight: 1, headroom: kind.headroom,
    designations: [...stems],
    name: 'Custom', description: `Progress measured in ${REALITY_VERBS[type] ?? 'records'}.`, channel: 'CUSTOM',
    instruments: [kind.instrument],
    quest: {
      objective: kind.quest.objective, realityLabel: kind.quest.realityLabel, criterion: kind.quest.criterion, floor: 'same',
      schedule: { kind: 'daily' }, evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: true,
    },
    presentation: { icon: 'Target', hue: 'slate' },
    intention: true,
    metrics: [{ key: 'headline', label: kind.ladder.label, unit: kind.ladder.noun, kind: 'effort', direction: 'higher', source: kind.ladder.signal }],
    ladder: { key: 'headline', ...kind.ladder },
    skillTree: type === 'practice_item' || type === 'study_block'
      ? {
        instrument: 'main', name: 'Parts', designation: 'PARTS', nodes: 'topics',
        policy: type === 'practice_item'
          ? { kind: 'practice_rate', appliedAt: 3, fluent: { minAttempts: 5, minRate: 0.6, minAboveEasiest: 2 }, retainedGapDays: 21, allowRegression: true }
          : { kind: 'block_count', introducedAt: 1, appliedAt: 3, fluentAt: 5, retainedGapDays: 21 },
      }
      : undefined,
    bossAnchor: { id: 'milestone', title: 'FIRST MILESTONE', milestone: 'The first stretch of the ladder climbed', uses: { ladder: true }, verifiability: kind.ladder.verifiability === 'public_url' ? 'public_url' : kind.ladder.verifiability === 'recorded' ? 'recorded' : 'count' },
    checkpoint: { selfEfficacy: 'Do this on a day when you would rather not?', enjoyment: 'This work' },
    reviewPrompt: { prompt: 'What got in the way of this today?', options: ['Time', 'Energy', 'Interruptions', 'Nothing in the way'] },
    reflectionThemes: ['practice', 'return'],
  };
}
