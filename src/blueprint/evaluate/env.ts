// Builds the SignalEnv the evaluators read from an event log: legacy events
// become instrument records through the upcasters (platform/02 §21.2), grouped
// by the instrument that owns them. Generic INSTRUMENT_RECORDED events join
// here in Phase 5.
import type { SystemEvent } from '../../engine/types';
import type { InstrumentRecord } from '../../instruments/framework';
import { upcastLegacyEvents } from '../../instruments/legacy/upcasters';
import type { SystemBlueprint } from '../schema';
import type { SignalEnv, SignalFacts } from './signals';

export function groupRecords(records: readonly InstrumentRecord[]): Map<string, InstrumentRecord[]> {
  const grouped = new Map<string, InstrumentRecord[]>();
  for (const record of records) {
    const list = grouped.get(record.instrumentId) ?? [];
    list.push(record);
    grouped.set(record.instrumentId, list);
  }
  return grouped;
}

/** Every instrument record the log holds, grouped by instrument, in log order. */
export function recordsFromEvents(events: readonly SystemEvent[]): Map<string, InstrumentRecord[]> {
  return groupRecords(upcastLegacyEvents(events));
}

export interface EnvOptions {
  eligibleDates?: ReadonlySet<string>;
  facts?: SignalFacts;
}

export function signalEnv(
  blueprint: SystemBlueprint,
  recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>,
  asOf: string,
  options: EnvOptions = {}
): SignalEnv {
  return { blueprint, asOf, arcStartDate: blueprint.arc.startDate, recordsByInstrument, ...options };
}
