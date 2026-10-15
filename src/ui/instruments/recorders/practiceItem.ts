// Writing a practice_item record (platform/03 §27.2). One entry point for the
// sheet; which store function runs depends on how the instrument is bound.
import type { InstrumentConfig } from '../../../blueprint/schema';
import { db } from '../../../db/db';
import { practiceItemMastery, type PracticeItemRecord } from '../../../instruments/types/practiceItem';
import type { InstrumentRecord } from '../../../instruments/framework';
import { realDeps } from '../../../store/deps';
import { recordInstrument } from '../../../store/instruments';
import { legacyRecordPractice } from '../legacy/practiceItem';
import { isLegacyBound } from '../types';
import { masteryAdvanced, slugOf, type PracticeResult, type PracticeValues } from './practiceShared';

export { masteryAdvanced, slugOf, type PracticeResult, type PracticeValues } from './practiceShared';

async function practiceRecords(instrumentId: string): Promise<InstrumentRecord<PracticeItemRecord>[]> {
  const rows = await db.instrument_record.where('instrument_id').equals(instrumentId).toArray();
  return rows.map((row) => ({
    id: row.id, instrumentId: row.instrument_id, instrumentType: 'practice_item', domainId: row.domain_id, localDate: row.local_date,
    eventId: row.event_id, blueprintVersion: row.blueprint_version, record: row.record as PracticeItemRecord,
  }));
}

export async function recordPractice(instrument: InstrumentConfig, values: PracticeValues, ctx: { today: string; arcId: string }): Promise<PracticeResult> {
  if (isLegacyBound(instrument)) return legacyRecordPractice(instrument.id, values, ctx);
  const before = practiceItemMastery(values.topic, await practiceRecords(instrument.id));
  const problemId = slugOf(values.title);
  const isRevisit = (await practiceRecords(instrument.id)).some((record) => record.record.problemId === problemId);
  await recordInstrument(instrument.id, {
    problemId, title: values.title.trim(), topic: values.topic, difficulty: values.difficulty, outcome: values.outcome,
    minutes: values.minutes, isRevisit, ...(values.insight ? { insight: values.insight } : {}),
  }, ctx.today, realDeps);
  const after = practiceItemMastery(values.topic, await practiceRecords(instrument.id));
  return masteryAdvanced(before, after) ? { masteryAdvance: { topic: values.topic, state: after } } : {};
}
