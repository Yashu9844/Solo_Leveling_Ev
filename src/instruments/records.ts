// Every instrument record a log holds, legacy and generic alike, as one list:
// legacy events through the upcasters, INSTRUMENT_RECORDED events as they are.
import { isInstrumentRecorded } from '../blueprint/events';
import type { SystemEvent } from '../engine/types';
import type { InstrumentRecord } from './framework';
import { upcastLegacyEvents } from './legacy/upcasters';

export function genericRecords(events: readonly SystemEvent[]): InstrumentRecord[] {
  const seen = new Set<string>();
  const records: InstrumentRecord[] = [];
  for (const event of events) {
    if (!isInstrumentRecorded(event) || seen.has(event.idem_key)) continue;
    seen.add(event.idem_key);
    const { instrumentId, instrumentType, domainId, blueprintVersion, record } = event.payload;
    records.push({ id: event.id, instrumentId, instrumentType, domainId, localDate: event.local_date, eventId: event.id, blueprintVersion, record });
  }
  return records;
}

/** Legacy records first (in log order), then generic ones (in log order). */
export function allRecords(events: readonly SystemEvent[]): InstrumentRecord[] {
  return [...upcastLegacyEvents(events), ...genericRecords(events)];
}
