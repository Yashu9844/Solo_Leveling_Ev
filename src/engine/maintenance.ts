// final/04-physical-lifestyle.md §6 — one Maintenance row/day, zero
// pressure. Bath and "ate to plan" are daily; laundry only appears (and
// only counts toward all-done) every `everyDays` days. Not pre-scaffolded
// by Phase 0 — a small new pure module, same precedent as engine/build.ts
// in Slice 8.
import { differenceInCalendarDays, parseISO } from 'date-fns';

/** Pure. Day 0 (the arc's start date) and every `everyDays`th day after it
 * is a laundry day. */
export function isLaundryDue(localDate: string, arcStartDate: string, everyDays: number): boolean {
  const daysSinceStart = differenceInCalendarDays(parseISO(localDate), parseISO(arcStartDate));
  if (daysSinceStart < 0) return false;
  return daysSinceStart % everyDays === 0;
}

/** Pure. "All done" ignores laundry entirely on a day it isn't due — a
 * non-laundry day can still be a 100% day. */
export function maintenanceAllDone(bath: boolean, fuel: boolean, laundryDue: boolean, laundry: boolean): boolean {
  return bath && fuel && (!laundryDue || laundry);
}
