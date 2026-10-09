// The XP economy, driven by a Blueprint (platform/02 §9.4): grant intents are
// collected from quest completions, instrument records and arc-wide events,
// then trimmed by each channel's cap and the daily cap in chronological order.
// For LEGACY_BLUEPRINT_V1 this reproduces engine/xp.ts's computeDayLedger row
// for row (amount, category, reason, capped_from); it is the V2 half of the
// E1 equivalence (platform/02 §22.2).
import type { DayLedgerEntry } from '../../engine/xp';
import type { QuestCompletionRecord, SystemEvent } from '../../engine/types';
import type { XpLedgerRow } from '../../db/schema';
import type { InstrumentRecord } from '../../instruments/framework';
import type { InstrumentConfig, SystemBlueprint } from '../schema';

/** XP that is frequency-limited rather than volume-limited, so it bypasses every cap (final/01 §2.1.1). */
export const UNCAPPED_CHANNELS: ReadonlySet<string> = new Set(['BONUS', 'BOSS']);

export interface GrantIntentV2 {
  eventId: string;
  /** Only quest completions carry an instance id; it also names the ledger row. */
  instanceId?: string;
  occurredAt: string;
  localDate: string;
  channel: string;
  amount: number;
  reason: string;
}

interface GrantParam { amount: number; reason: string }

function grantParam(value: unknown): GrantParam | undefined {
  return value && typeof value === 'object' && typeof (value as GrantParam).amount === 'number' && typeof (value as GrantParam).reason === 'string' ? (value as GrantParam) : undefined;
}

/** What one instrument record earns, by the instrument's own parameters. Null when it earns nothing. */
export function grantForRecord(instrument: InstrumentConfig, record: InstrumentRecord): GrantParam | null {
  const params = instrument.params;
  const value = record.record;
  switch (instrument.type) {
    case 'practice_item': return value.isRevisit === true ? grantParam(params.revisitGrant) ?? null : null;
    case 'threshold': {
      const bonusAt = params.bonusAt;
      return typeof bonusAt === 'number' && typeof value.value === 'number' && value.value >= bonusAt ? grantParam(params.grant) ?? null : null;
    }
    case 'checklist': return value.allDone === true ? grantParam(params.grant) ?? null : null;
    default: return grantParam(params.grant) ?? null;
  }
}

/** Events that can carry XP other than a quest completion. Mirrors db/projections.ts's NON_COMPLETION_XP_EVENT_TYPES. */
const LEDGER_EVENT_TYPES: ReadonlySet<SystemEvent['type']> = new Set([
  'QUEST_RECOVERED', 'PROBLEM_REVISITED', 'ARTIFACT_SHIPPED', 'LEARNING_BLOCK_LOGGED', 'SYSTEM_DESIGN_LOGGED',
  'STEPS_LOGGED', 'MAINTENANCE_LOGGED', 'BOSS_CLEARED', 'WEEKLY_QUEST_COMPLETED',
]);

export interface DayGrants { localDate: string; intents: GrantIntentV2[] }

/**
 * Every day that has an XP-bearing event, in the order the legacy rebuild
 * visits them (completions first, then the other events in log order), each
 * with its intents in that same order. Order matters: caps trim whichever
 * grant arrives second.
 */
export function collectGrantIntents(
  blueprint: SystemBlueprint,
  events: readonly SystemEvent[],
  completions: Readonly<Record<string, QuestCompletionRecord>>,
  recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>
): DayGrants[] {
  const days = new Map<string, GrantIntentV2[]>();
  const add = (localDate: string, intent?: GrantIntentV2) => {
    const list = days.get(localDate) ?? [];
    if (intent) list.push(intent);
    days.set(localDate, list);
  };

  const channelOfQuest = (questId: string) => {
    const quest = blueprint.quests.find((candidate) => candidate.id === questId);
    const domain = quest && blueprint.domains.find((candidate) => candidate.id === quest.domainId);
    return quest && domain ? { quest, channel: domain.channel.id } : undefined;
  };

  for (const completion of Object.values(completions)) {
    const found = channelOfQuest(completion.quest_key);
    add(completion.local_date, found && {
      eventId: completion.event_id, instanceId: completion.instance_id, occurredAt: completion.completed_at, localDate: completion.local_date,
      channel: found.channel, amount: found.quest.xp, reason: `core:${found.quest.id}`,
    });
  }

  const recordsByEvent = new Map<string, { instrument: InstrumentConfig; record: InstrumentRecord }[]>();
  for (const instrument of blueprint.instruments) {
    for (const record of recordsByInstrument.get(instrument.id) ?? []) {
      const list = recordsByEvent.get(record.eventId) ?? [];
      list.push({ instrument, record });
      recordsByEvent.set(record.eventId, list);
    }
  }
  const channelOfInstrument = (instrument: InstrumentConfig) => blueprint.domains.find((domain) => domain.id === instrument.domainId)?.channel.id;

  for (const event of events) {
    if (!LEDGER_EVENT_TYPES.has(event.type)) continue;
    const intent = (channel: string, amount: number, reason: string): GrantIntentV2 => ({
      eventId: event.id, occurredAt: event.occurred_at, localDate: event.local_date, channel, amount, reason,
    });
    switch (event.type) {
      case 'QUEST_RECOVERED': add(event.local_date, intent('BONUS', blueprint.progression.recoveryXp, 'recovery')); break;
      case 'BOSS_CLEARED': add(event.local_date, intent('BOSS', blueprint.progression.bossXp, 'boss')); break;
      case 'WEEKLY_QUEST_COMPLETED': add(event.local_date, intent('BONUS', blueprint.progression.weeklyQuestXp, 'weekly_quest')); break;
      default: {
        // An instrument-recorded event: it may earn nothing (steps under the
        // bonus line, an unfinished maintenance row) but its day is still visited.
        add(event.local_date);
        for (const { instrument, record } of recordsByEvent.get(event.id) ?? []) {
          const grant = grantForRecord(instrument, record);
          const channel = channelOfInstrument(instrument);
          if (grant && channel) add(event.local_date, intent(channel, grant.amount, grant.reason));
        }
      }
    }
  }
  return [...days].map(([localDate, intents]) => ({ localDate, intents }));
}

/** A channel's cap: undefined means the channel is uncapped. */
function capsOf(blueprint: SystemBlueprint): Map<string, number> {
  return new Map(blueprint.domains.map((domain) => [domain.channel.id, domain.channel.cap]));
}

/**
 * Pure. One day's ledger: intents in chronological order, each trimmed first
 * by its channel's remaining headroom and then by the daily cap. BONUS/BOSS
 * grants are exempt and never accumulate (final/01 §2.1.1).
 */
export function computeDayLedgerV2(blueprint: SystemBlueprint, intents: readonly GrantIntentV2[]): DayLedgerEntry[] {
  const caps = capsOf(blueprint);
  const dailyCap = blueprint.progression.dailyCap;
  const sorted = [...intents].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const channelTotals = new Map<string, number>();
  let dailyTotal = 0;
  const entries: DayLedgerEntry[] = [];

  for (const intent of sorted) {
    let amount = intent.amount;
    let cappedFrom: number | undefined;
    if (!UNCAPPED_CHANNELS.has(intent.channel)) {
      const headroom = Math.max(0, (caps.get(intent.channel) ?? Infinity) - (channelTotals.get(intent.channel) ?? 0));
      if (amount > headroom) { cappedFrom = intent.amount; amount = headroom; }
      const dailyHeadroom = Math.max(0, dailyCap - dailyTotal);
      if (amount > dailyHeadroom) { cappedFrom = cappedFrom ?? intent.amount; amount = dailyHeadroom; }
      amount = Math.max(0, amount);
      channelTotals.set(intent.channel, (channelTotals.get(intent.channel) ?? 0) + amount);
      dailyTotal += amount;
    } else {
      dailyTotal += amount; // uncapped, but legacy still adds it to the running daily total
    }
    entries.push({ eventId: intent.eventId, instanceId: intent.instanceId, category: intent.channel as DayLedgerEntry['category'], amount, reason: intent.reason, cappedFrom });
  }
  return entries;
}

/** The xp_ledger rows for a whole log — the V2 counterpart of buildProjections' ledger step. */
export function ledgerRowsV2(
  blueprint: SystemBlueprint,
  events: readonly SystemEvent[],
  completions: Readonly<Record<string, QuestCompletionRecord>>,
  recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>
): XpLedgerRow[] {
  const rows: XpLedgerRow[] = [];
  for (const { localDate, intents } of collectGrantIntents(blueprint, events, completions, recordsByInstrument)) {
    for (const entry of computeDayLedgerV2(blueprint, intents)) {
      rows.push({
        id: entry.instanceId ? `${entry.instanceId}::xp` : `${entry.eventId}::xp`,
        event_id: entry.eventId,
        instance_id: entry.instanceId,
        local_date: localDate,
        amount: entry.amount,
        category: entry.category,
        reason: entry.reason,
        capped_from: entry.cappedFrom,
      });
    }
  }
  return rows;
}
