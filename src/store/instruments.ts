// Recording against a GENERIC instrument (platform/02 §8.2). Legacy
// instruments never come through here: they keep writing their own legacy
// event types so an older build can always read the owner's log.
//
// The record is validated by the instrument TYPE's own contract, against the
// parameters of the Blueprint version in force on the day, before anything is
// written; an invalid record changes nothing.
import { instrumentIdemKey, type InstrumentRecordedPayload } from '../blueprint/events';
import { resolveBlueprints, versionFor } from '../blueprint/resolve';
import { db } from '../db/db';
import { appendEvent, getAllEvents } from '../db/events';
import { instrumentRecordRows } from '../db/instrumentProjection';
import type { EngineDeps, SystemEvent } from '../engine/types';
import { INSTRUMENT_DEFINITIONS } from '../instruments/registry';
import { getActiveArc } from './arc';

export class InstrumentRecordError extends Error {
  readonly codes: string[];
  constructor(message: string, codes: string[] = []) {
    super(message);
    this.name = 'InstrumentRecordError';
    this.codes = codes;
  }
}

/** Appends INSTRUMENT_RECORDED and the cache row. Returns the event id. */
export async function recordInstrument(instrumentId: string, record: Record<string, unknown>, today: string, deps: EngineDeps): Promise<string> {
  const arc = await getActiveArc();
  if (!arc) throw new InstrumentRecordError('There is no active arc to record against.');
  const events = await getAllEvents();
  const version = versionFor(resolveBlueprints(events).versions, today);
  const instrument = version?.instruments.find((candidate) => candidate.id === instrumentId);
  if (!version || !instrument) throw new InstrumentRecordError(`"${instrumentId}" is not an instrument of the System in force today.`);
  if (instrument.eventBinding.kind === 'legacy') throw new InstrumentRecordError(`"${instrumentId}" is a legacy instrument and writes through its own store.`);

  const issues = INSTRUMENT_DEFINITIONS[instrument.type].validateRecord(record, instrument.params);
  if (issues.length > 0) throw new InstrumentRecordError(issues.map((issue) => issue.message).join(' '), issues.map((issue) => issue.code));

  const id = deps.newId();
  const payload: InstrumentRecordedPayload = { instrumentId, instrumentType: instrument.type, domainId: instrument.domainId, blueprintVersion: version.version, record };
  const event: SystemEvent = {
    id, type: 'INSTRUMENT_RECORDED', occurred_at: deps.now(), local_date: today, arc_id: arc.id,
    payload, source: 'user', idem_key: instrumentIdemKey(id), schema_v: 1,
  };
  await db.transaction('rw', [db.event, db.instrument_record], async () => {
    await appendEvent(event);
    const [row] = instrumentRecordRows([event]);
    if (row) await db.instrument_record.put(row);
  });
  return id;
}
