// Writing a time-window reading and a checklist (platform/03 §27.2).
import type { InstrumentConfig } from '../../../blueprint/schema';
import { db } from '../../../db/db';
import { checklistItemDue, type ChecklistItem } from '../../../instruments/types/checklist';
import { hhmmFromMinutes, minutesSinceMidnight } from '../../../instruments/legacy/ids';
import { realDeps } from '../../../store/deps';
import { recordInstrument } from '../../../store/instruments';
import { legacyChecklistGateway, legacyRecordTimeWindow } from '../legacy/lifestyle';
import { isLegacyBound } from '../types';
import type { RecorderContext } from './duration';

export interface TimeWindowValues {
  /** HH:MM, the reading itself (the time you woke). */
  time: string;
  /** HH:MM, an optional second reading (the time you went to sleep). */
  secondary?: string;
}

export async function recordTimeWindow(instrument: InstrumentConfig, values: TimeWindowValues, ctx: RecorderContext): Promise<void> {
  if (isLegacyBound(instrument)) return legacyRecordTimeWindow(instrument.id, values, ctx);
  await recordInstrument(instrument.id, {
    minutes: minutesSinceMidnight(values.time),
    ...(values.secondary ? { sleepMinutes: minutesSinceMidnight(values.secondary) } : {}),
  }, ctx.today, realDeps);
}

export { hhmmFromMinutes };

/** What the checklist card needs: which items are done today, which are due, and how to save. */
export interface ChecklistGateway {
  load: () => Promise<{ done: string[]; due: string[] }>;
  save: (done: string[]) => Promise<void>;
}

export interface ChecklistContext extends RecorderContext {
  instrument: InstrumentConfig;
  arcStartDate: string;
}

export function checklistGateway(context: ChecklistContext): ChecklistGateway {
  if (isLegacyBound(context.instrument)) return legacyChecklistGateway(context);
  const items = context.instrument.params.items as ChecklistItem[];
  return {
    load: async () => {
      const rows = await db.instrument_record.where('[instrument_id+local_date]').equals([context.instrument.id, context.today]).toArray();
      const last = rows[rows.length - 1];
      return {
        done: ((last?.record.done as string[] | undefined) ?? []),
        due: items.filter((item) => checklistItemDue(item, context.today, context.arcStartDate)).map((item) => item.id),
      };
    },
    save: async (done) => {
      await recordInstrument(context.instrument.id, { done }, context.today, realDeps);
    },
  };
}
