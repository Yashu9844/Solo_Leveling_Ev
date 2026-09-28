// final/04-physical-lifestyle.md §4 — SLEEP completes when the logged
// wake time falls within toleranceMinutes of the target (engine/quests.ts's
// CORE_QUEST_CRITERIA.sleep.toleranceMinutes is 30, config.wakeTargetTime
// is "08:30" -> the 08:00-09:00 window final/06's row summary shows).

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Pure. Symmetric tolerance around targetTime, both "HH:mm". */
export function withinWakeWindow(wakeTime: string, targetTime: string, toleranceMinutes: number): boolean {
  return Math.abs(toMinutes(wakeTime) - toMinutes(targetTime)) <= toleranceMinutes;
}

/** Pure. Same comparison, but for a wake time already in minutes-since-
 * midnight (db.metric_sample's stored `kind: 'wake_time'` unit) rather
 * than an "HH:mm" string — store/weeklyReview.ts's sleep/DSA
 * correlation reads that table directly. */
export function withinWakeWindowMinutes(wakeMinutes: number, targetTime: string, toleranceMinutes: number): boolean {
  return Math.abs(wakeMinutes - toMinutes(targetTime)) <= toleranceMinutes;
}
