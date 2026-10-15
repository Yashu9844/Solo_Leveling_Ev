// The owner's wake time and maintenance row keep writing SLEEP_LOGGED and MAINTENANCE_LOGGED through store/lifestyle.ts.
import { realDeps } from '../../../store/deps';
import { getEngineConfig } from '../../../store/engineConfig';
import { getTodayMaintenance, logMaintenance, logSleep } from '../../../store/lifestyle';
import type { ChecklistContext, ChecklistGateway, TimeWindowValues } from '../recorders/lifestyle';
import type { RecorderContext } from '../recorders/duration';

export async function legacyRecordTimeWindow(instrumentId: string, values: TimeWindowValues, ctx: RecorderContext): Promise<void> {
  if (instrumentId !== 'sleep.wake') throw new Error(`"${instrumentId}" has no legacy time-window writer.`);
  await logSleep(ctx.today, ctx.arcId, values.time, getEngineConfig(), realDeps, values.secondary || undefined);
}

const FIELDS = ['bath', 'fuel', 'laundry'] as const;

export function legacyChecklistGateway({ instrument, today, arcId, arcStartDate }: ChecklistContext): ChecklistGateway {
  if (instrument.id !== 'maintenance.daily') throw new Error(`"${instrument.id}" has no legacy checklist writer.`);
  return {
    load: async () => {
      const { row, laundryDue } = await getTodayMaintenance(today, arcStartDate, getEngineConfig().maintenanceLaundryEveryDays);
      return {
        done: FIELDS.filter((field) => row?.[field]),
        due: FIELDS.filter((field) => field !== 'laundry' || laundryDue),
      };
    },
    save: async (done) => {
      await logMaintenance(today, arcId, { bath: done.includes('bath'), fuel: done.includes('fuel'), laundry: done.includes('laundry') }, getEngineConfig(), realDeps);
    },
  };
}
