// The platform's event payloads (platform/02 §19, §20, §43.2). Everything here
// is additive: an older build reads each of these as an event type it does not
// know (skipped and counted, never thrown) or, for QUEST_COMPLETED schema_v 2,
// as the v1 event it has always understood plus fields it ignores.
import type { QuestCompletedPayload, SystemEvent } from '../engine/types';
import type { InstrumentType, SystemBlueprint } from './schema';

// ── BLUEPRINT_ACTIVATED ─────────────────────────────────────────────────────
// The only way a System Blueprint version enters the log. The payload is the
// full document, so a log alone — an export — reproduces every version a
// person ever lived under, with no side table to lose.
export interface BlueprintActivatedPayload extends Record<string, unknown> {
  blueprint: SystemBlueprint;
}

/** One activation per (lineage, version): replaying or re-sending it is a no-op. */
export function activationIdemKey(blueprint: Pick<SystemBlueprint, 'lineageId' | 'version'>): string {
  return `blueprint:${blueprint.lineageId}:${blueprint.version}`;
}

export function isActivation(event: SystemEvent): event is SystemEvent<BlueprintActivatedPayload> {
  return event.type === 'BLUEPRINT_ACTIVATED';
}

// ── INSTRUMENT_RECORDED ─────────────────────────────────────────────────────
// A record of a GENERIC instrument. Legacy instruments never use it: they keep
// writing their legacy event types (platform/02 §21.2), so an old build can
// always read the owner's log.
export interface InstrumentRecordedPayload extends Record<string, unknown> {
  instrumentId: string;
  instrumentType: InstrumentType;
  domainId: string;
  /** The Blueprint version the record was written under. */
  blueprintVersion: number;
  record: Record<string, unknown>;
}

export function instrumentIdemKey(eventId: string): string {
  return `instrument:${eventId}`;
}

export function isInstrumentRecorded(event: SystemEvent): event is SystemEvent<InstrumentRecordedPayload> {
  return event.type === 'INSTRUMENT_RECORDED';
}

// ── QUEST_COMPLETED schema_v 2 ──────────────────────────────────────────────
export interface QuestCompletionFacts {
  instanceId: string;
  templateId: string;
  /** Legacy key, kept in v2 so every existing reader keeps working. */
  questKey: string;
  localDate: string;
  /** v1 events carry no definition id; for the owner the quest key IS the definition id. */
  questDefId: string;
  /** v1 events carry no domain; the Blueprint in force knows it. */
  domainId: string | undefined;
  /** v1 events predate versions; they were written under the implicit legacy v1. */
  blueprintVersion: number;
}

/** Read-side upcast: a v1 and a v2 completion answer the same question the same way. */
export function questCompletionFacts(event: SystemEvent): QuestCompletionFacts {
  const payload = event.payload as unknown as QuestCompletedPayload;
  return {
    instanceId: payload.instanceId,
    templateId: payload.templateId,
    questKey: payload.questKey,
    localDate: payload.localDate,
    questDefId: payload.questDefId ?? payload.questKey,
    domainId: payload.domainId,
    blueprintVersion: payload.blueprintVersion ?? 1,
  };
}

/** The payload a V2-era writer appends: the v1 fields unchanged, plus what an export needs to explain the day. */
export function questCompletedPayloadV2(base: Pick<QuestCompletedPayload, 'instanceId' | 'templateId' | 'localDate'>, quest: { id: string; domainId: string }, blueprintVersion: number): QuestCompletedPayload {
  return { ...base, questKey: quest.id as QuestCompletedPayload['questKey'], domainId: quest.domainId, questDefId: quest.id, blueprintVersion };
}
