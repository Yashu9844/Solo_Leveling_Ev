// instrument_record: the cache of INSTRUMENT_RECORDED events (platform/02
// §43.1) - one row per record, keyed by its event id. Legacy instruments keep
// their twelve tables; this holds only generic ones. Rebuildable from the log
// alone, and diffed by verifyIntegrity.
import { genericRecords } from '../instruments/records';
import type { SystemEvent } from '../engine/types';
import { db } from './db';
import type { InstrumentRecordRow } from './schema';

/** The rows the log implies, in log order. */
export function instrumentRecordRows(events: readonly SystemEvent[]): InstrumentRecordRow[] {
  return genericRecords(events).map((record) => ({
    id: record.id, instrument_id: record.instrumentId, domain_id: record.domainId, local_date: record.localDate,
    event_id: record.eventId, blueprint_version: record.blueprintVersion, record: record.record,
  }));
}

/** Replaces the cache with what the log implies. Call inside a transaction that includes db.instrument_record. */
export async function rebuildInstrumentRecords(events: readonly SystemEvent[]): Promise<InstrumentRecordRow[]> {
  const rows = instrumentRecordRows(events);
  await db.instrument_record.clear();
  if (rows.length > 0) await db.instrument_record.bulkAdd(rows);
  return rows;
}
