// Writing a study block, or the structured study a design topic asks for (platform/03 §27.2).
import type { InstrumentConfig } from '../../../blueprint/schema';
import { db } from '../../../db/db';
import type { InstrumentRecord } from '../../../instruments/framework';
import { studyBlockMastery, type StudyBlockRecord } from '../../../instruments/types/studyBlock';
import { realDeps } from '../../../store/deps';
import { recordInstrument } from '../../../store/instruments';
import { legacyRecordStudy } from '../legacy/study';
import { masteryAdvanced } from './practiceShared';
import { isLegacyBound } from '../types';
import type { RecorderContext } from './duration';

export interface StudyValues {
  topic: string;
  minutes: number;
  note?: string;
  /** Set when the topic is the design topic: the system studied, how, and an optional link. */
  design?: { system: string; mode: string; artifactUrl?: string };
}

export interface StudyResult {
  masteryAdvance?: { topic: string; state: 'introduced' | 'applied' | 'fluent' | 'retained' };
}

async function blockRecords(instrumentId: string): Promise<InstrumentRecord<StudyBlockRecord>[]> {
  const rows = await db.instrument_record.where('instrument_id').equals(instrumentId).toArray();
  return rows.map((row) => ({
    id: row.id, instrumentId: row.instrument_id, instrumentType: 'study_block', domainId: row.domain_id, localDate: row.local_date,
    eventId: row.event_id, blueprintVersion: row.blueprint_version, record: row.record as StudyBlockRecord,
  }));
}

export async function recordStudy(instrument: InstrumentConfig, designInstrument: InstrumentConfig | undefined, values: StudyValues, ctx: RecorderContext): Promise<StudyResult> {
  if (isLegacyBound(instrument)) return legacyRecordStudy(instrument.id, values, ctx);
  const before = studyBlockMastery(values.topic, await blockRecords(instrument.id));
  if (values.design && designInstrument) {
    await recordInstrument(designInstrument.id, {
      topic: values.topic, system: values.design.system, mode: values.design.mode, minutes: values.minutes,
      ...(values.design.artifactUrl ? { artifactUrl: values.design.artifactUrl } : {}), ...(values.note ? { notes: values.note } : {}),
    }, ctx.today, realDeps);
    return {};
  }
  await recordInstrument(instrument.id, { topic: values.topic, minutes: values.minutes, ...(values.note ? { note: values.note } : {}) }, ctx.today, realDeps);
  const after = studyBlockMastery(values.topic, await blockRecords(instrument.id));
  return masteryAdvanced(before, after) ? { masteryAdvance: { topic: values.topic, state: after } } : {};
}
