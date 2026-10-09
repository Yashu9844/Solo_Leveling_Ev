import { isLaundryDue } from '../../engine/maintenance';
import { defineInstrument, type InstrumentEvaluationContext, type InstrumentIssue, type InstrumentRecord } from '../framework';

export interface ChecklistItem {
  id: string;
  label?: string;
  /** Due on the arc's first day and every Nth day after it. Omitted = due every day. */
  everyNDays?: number;
}

/** One day's checklist state: the ids of the items marked done. */
export type ChecklistRecord = Record<string, unknown> & { done: readonly string[] };

export type ChecklistParams = Record<string, unknown> & { items: readonly ChecklistItem[] };

export function validateChecklistRecord(record: unknown, params: ChecklistParams): InstrumentIssue[] {
  const done = record && typeof record === 'object' ? (record as Partial<ChecklistRecord>).done : undefined;
  if (!Array.isArray(done)) return [{ code: 'I-CHK-01', path: 'record.done', message: 'Done items must be a list.' }];
  const known = new Set(params.items.map((item) => item.id));
  if (done.some((id) => typeof id !== 'string' || !known.has(id))) return [{ code: 'I-CHK-02', path: 'record.done', message: 'Choose configured checklist items.' }];
  return [];
}

export function checklistItemDue(item: ChecklistItem, localDate: string, arcStartDate: string): boolean {
  return item.everyNDays === undefined ? true : isLaundryDue(localDate, arcStartDate, item.everyNDays);
}

/** "All done" ignores items that are not due that day, as the legacy Maintenance row does. */
export function checklistAllDone(done: readonly string[], items: readonly ChecklistItem[], localDate: string, arcStartDate: string): boolean {
  return items.every((item) => !checklistItemDue(item, localDate, arcStartDate) || done.includes(item.id));
}

/**
 * One state per day: when a date has several records the last one wins,
 * matching the legacy Maintenance row's upsert. `arcStartDate` defaults to the
 * start of the read range.
 */
export function checklistSignals(
  records: readonly InstrumentRecord<ChecklistRecord>[],
  params: ChecklistParams,
  context?: InstrumentEvaluationContext
): Readonly<Record<string, number>> {
  const arcStartDate = context?.arcStartDate ?? context?.from ?? '';
  const latestByDate = new Map<string, readonly string[]>();
  for (const record of records) latestByDate.set(record.localDate, record.record.done);
  let allDoneDays = 0;
  for (const [localDate, done] of latestByDate) {
    if (checklistAllDone(done, params.items, localDate, arcStartDate)) allDoneDays++;
  }
  return { all_done_days: allDoneDays };
}

export const checklistInstrument = defineInstrument<ChecklistParams, ChecklistRecord>({
  type: 'checklist',
  validateRecord: validateChecklistRecord,
  signals: checklistSignals,
});
