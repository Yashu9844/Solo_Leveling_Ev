// The XP economy, driven by a Blueprint (platform/02 §9.4): grant intents are
// collected from quest completions, instrument records and arc-wide events,
// then trimmed by each channel's cap and the daily cap in chronological order.
// For LEGACY_BLUEPRINT_V1 this reproduces engine/xp.ts's computeDayLedger row
// for row (amount, category, reason, capped_from); it is the V2 half of the
// E1 equivalence (platform/02 §22.2).
//
// Versioned (platform/02 §19, H2): every intent is priced by the Blueprint
// version in force on the DAY it lands, so activating a new version can never
// re-price a day that has already happened.
import type { XpLedgerRow } from '../../db/schema';
import type { DayLedgerEntry } from '../../engine/xp';
import type { QuestCompletionRecord, SystemEvent } from '../../engine/types';
import type { InstrumentRecord } from '../../instruments/framework';
import { versionFor } from '../resolve';
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
  'STEPS_LOGGED', 'MAINTENANCE_LOGGED', 'BOSS_CLEARED', 'WEEKLY_QUEST_COMPLETED', 'INSTRUMENT_RECORDED',
]);

export interface DayGrants { localDate: string; intents: GrantIntentV2[] }

type Versions = SystemBlueprint | readonly SystemBlueprint[];
const asList = (versions: Versions): readonly SystemBlueprint[] => (Array.isArray(versions) ? (versions as readonly SystemBlueprint[]) : [versions as SystemBlueprint]);

/**
 * Every day that has an XP-bearing event, in the order the legacy rebuild
 * visits them (completions first, then the other events in log order), each
 * with its intents in that same order. Order matters: caps trim whichever
 * grant arrives second.
 */
export function collectGrantIntents(
  versions: Versions,
  events: readonly SystemEvent[],
  completions: Readonly<Record<string, QuestCompletionRecord>>,
  recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>
): DayGrants[] {
  const list = asList(versions);
  const at = (localDate: string): SystemBlueprint | undefined => versionFor(list, localDate) ?? list[0];
  const days = new Map<string, GrantIntentV2[]>();
  const add = (localDate: string, intent?: GrantIntentV2) => {
    const bucket = days.get(localDate) ?? [];
    if (intent) bucket.push(intent);
    days.set(localDate, bucket);
  };

  for (const completion of Object.values(completions)) {
    const blueprint = at(completion.local_date);
    const quest = blueprint?.quests.find((candidate) => candidate.id === completion.quest_key);
    const domain = quest && blueprint?.domains.find((candidate) => candidate.id === quest.domainId);
    add(completion.local_date, quest && domain ? {
      eventId: completion.event_id, instanceId: completion.instance_id, occurredAt: completion.completed_at, localDate: completion.local_date,
      channel: domain.channel.id, amount: quest.xp, reason: `core:${quest.id}`,
    } : undefined);
  }

  // Index every record by its event; the instrument's CONFIG is looked up per day, under the version in force.
  const recordsByEvent = new Map<string, InstrumentRecord[]>();
  for (const records of recordsByInstrument.values()) {
    for (const record of records) {
      const bucket = recordsByEvent.get(record.eventId) ?? [];
      bucket.push(record);
      recordsByEvent.set(record.eventId, bucket);
    }
  }

  for (const event of events) {
    if (!LEDGER_EVENT_TYPES.has(event.type)) continue;
    const blueprint = at(event.local_date);
    if (!blueprint) { add(event.local_date); continue; }
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
        for (const record of recordsByEvent.get(event.id) ?? []) {
          const instrument = blueprint.instruments.find((candidate) => candidate.id === record.instrumentId);
          if (!instrument) continue; // the instrument was retired before this day: it earns nothing under that version
          const grant = grantForRecord(instrument, record);
          const channel = blueprint.domains.find((domain) => domain.id === instrument.domainId)?.channel.id;
          if (grant && channel) add(event.local_date, intent(channel, grant.amount, grant.reason));
        }
      }
    }
  }
  return [...days].map(([localDate, intents]) => ({ localDate, intents }));
}

/**
 * Pure. One day's ledger: intents in chronological order, each trimmed first
 * by its channel's remaining headroom and then by the daily cap. BONUS/BOSS
 * grants are exempt and never accumulate (final/01 §2.1.1).
 */
export function computeDayLedgerV2(blueprint: SystemBlueprint, intents: readonly GrantIntentV2[]): DayLedgerEntry[] {
  const caps = new Map(blueprint.domains.map((domain) => [domain.channel.id, domain.channel.cap]));
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

/**
 * The xp_ledger rows for a whole log - the V2 counterpart of buildProjections'
 * ledger step. With `stamp`, each row records the Blueprint version that
 * priced it (H6: every XP grant is explainable); the owner's implicit legacy
 * rows are never stamped, so they stay byte-identical to the legacy engine's.
 */
export function ledgerRowsV2(
  versions: Versions,
  events: readonly SystemEvent[],
  completions: Readonly<Record<string, QuestCompletionRecord>>,
  recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>,
  stamp = false
): XpLedgerRow[] {
  const list = asList(versions);
  const rows: XpLedgerRow[] = [];
  for (const { localDate, intents } of collectGrantIntents(list, events, completions, recordsByInstrument)) {
    const blueprint = versionFor(list, localDate) ?? list[0];
    if (!blueprint) continue;
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
        ...(stamp ? { blueprint_version: blueprint.version } : {}),
      });
    }
  }
  return rows;
}
