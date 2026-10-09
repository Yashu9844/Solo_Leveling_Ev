import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { FOUNDATION_TOPICS, foundationMasteryFor, foundationMasteryPoints } from '../../src/engine/foundations';
import { isLaundryDue, maintenanceAllDone } from '../../src/engine/maintenance';
import { isKnownInstrumentSignal } from '../../src/instruments/catalog';
import { checklistSignals, validateChecklistRecord, type ChecklistRecord } from '../../src/instruments/types/checklist';
import { studyBlockMastery, studyBlockSignals, validateStudyBlockRecord, type StudyBlockRecord } from '../../src/instruments/types/studyBlock';
import type { InstrumentRecord } from '../../src/instruments/framework';

function record<T extends Record<string, unknown>>(instrumentType: InstrumentRecord<T>['instrumentType'], localDate: string, value: T, id: number): InstrumentRecord<T> {
  return { id: `${instrumentType}-${id}`, eventId: `event-${id}`, instrumentId: `test.${instrumentType}`, instrumentType, domainId: 'test', blueprintVersion: 1, localDate, record: value };
}
const dateArb = fc.integer({ min: 0, max: 120 }).map((offset) => new Date(Date.UTC(2026, 8, 1 + offset)).toISOString().slice(0, 10));

describe('study_block instrument (loop 3.6)', () => {
  it('validates topic, minutes and mode', () => {
    const params = { topics: ['Networking'] };
    expect(validateStudyBlockRecord({ topic: 'Networking', minutes: 30 }, params)).toEqual([]);
    expect(validateStudyBlockRecord({ topic: 'Poetry', minutes: 30 }, params)).toHaveLength(1);
    expect(validateStudyBlockRecord({ topic: 'Networking', minutes: -1, mode: 3 }, params)).toHaveLength(2);
  });

  it('matches foundationMasteryFor and foundationMasteryPoints over 10,000 corpora', () => {
    const blockArb = fc.record({ topic: fc.constantFrom(...FOUNDATION_TOPICS.slice(0, 3)), localDate: dateArb, minutes: fc.integer({ min: 0, max: 180 }) });
    fc.assert(fc.property(fc.array(blockArb, { maxLength: 40 }), (blocks) => {
      const records = blocks.map((b, id) => record<StudyBlockRecord>('study_block', b.localDate, { topic: b.topic, minutes: b.minutes }, id));
      const legacy = blocks.map((b) => ({ topic: b.topic, local_date: b.localDate }));
      for (const topic of FOUNDATION_TOPICS.slice(0, 4)) expect(studyBlockMastery(topic, records)).toBe(foundationMasteryFor(topic, legacy)); // 3 used topics + 1 never logged
      const signals = studyBlockSignals(records, { topics: FOUNDATION_TOPICS });
      expect(signals.mastery_points).toBe(foundationMasteryPoints(legacy));
      expect(signals.blocks).toBe(blocks.length);
      expect(signals.minutes).toBe(blocks.reduce((sum, b) => sum + b.minutes, 0));
    }), { numRuns: 10_000 });
  });

  it('honours a custom block_count policy and counts modes', () => {
    const records = ['2026-09-01', '2026-09-02', '2026-09-03'].map((d, id) => record<StudyBlockRecord>('study_block', d, { topic: 'Law', minutes: 25, mode: id === 0 ? 'read' : 'recall' }, id));
    const params = { topics: ['Law'], mastery: { introducedAt: 1, appliedAt: 2, fluentAt: 3, retainedGapDays: 7 } };
    expect(studyBlockMastery('Law', records, params.mastery)).toBe('fluent');
    expect(studyBlockSignals(records, params).topic_mastery).toBe(1);
    expect(studyBlockSignals(records, params, { localDate: '2026-09-03', from: '2026-09-01', to: '2026-09-03', filter: { mode: 'recall' } }).mode_counts).toBe(2);
  });
});

describe('checklist instrument (loop 3.6)', () => {
  const items = (everyDays: number) => [{ id: 'bath' }, { id: 'fuel' }, { id: 'laundry', everyNDays: everyDays }];

  it('validates the done list against configured items', () => {
    expect(validateChecklistRecord({ done: ['bath'] }, { items: items(3) })).toEqual([]);
    expect(validateChecklistRecord({ done: 'bath' }, { items: items(3) })).toHaveLength(1);
    expect(validateChecklistRecord({ done: ['nap'] }, { items: items(3) })).toHaveLength(1);
  });

  it('matches isLaundryDue and maintenanceAllDone over 10,000 corpora', () => {
    const dayArb = fc.record({ localDate: dateArb, bath: fc.boolean(), fuel: fc.boolean(), laundry: fc.boolean() });
    fc.assert(fc.property(fc.array(dayArb, { maxLength: 30 }), fc.integer({ min: 1, max: 7 }), dateArb, (days, everyDays, arcStartDate) => {
      const records = days.map((d, id) => record<ChecklistRecord>('checklist', d.localDate, { done: [d.bath && 'bath', d.fuel && 'fuel', d.laundry && 'laundry'].filter((x): x is string => !!x) }, id));
      // Legacy keeps one row per date (put overwrites), so the last entry for a date wins.
      const lastByDate = new Map(days.map((d) => [d.localDate, d]));
      const legacy = [...lastByDate.values()].filter((d) => maintenanceAllDone(d.bath, d.fuel, isLaundryDue(d.localDate, arcStartDate, everyDays), d.laundry)).length;
      expect(checklistSignals(records, { items: items(everyDays) }, { localDate: arcStartDate, from: arcStartDate, to: '2027-01-01', arcStartDate }).all_done_days).toBe(legacy);
    }), { numRuns: 10_000 });
  });

  it('exposes every signal it computes in the catalogue', () => {
    expect(isKnownInstrumentSignal('study_block', 'mastery_points')).toBe(true);
    expect(isKnownInstrumentSignal('checklist', 'all_done_days')).toBe(true);
  });
});
