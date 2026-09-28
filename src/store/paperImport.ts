// docs/13-day0-baseline.md's paper protocol — importing the daily log
// and DSA log by reusing the exact same write paths a live day would
// use (loadTodayQuests + completeQuest, logMaintenance, logSleep,
// logScreentime, completeEveningReview, logProblem), just called with a
// past `date` instead of "today". Every one of those functions already
// takes the target date as a parameter rather than reading the clock,
// so backfilling is not a special case for them.
//
// Two real caveats, not silently glossed over:
// (1) completeQuest's day-closed check reads deps.now() (the actual
//     current instant), not the historical date being imported — if an
//     import happens to run during the 03:00-04:00 day-close window,
//     every completion in the batch silently no-ops. Narrow (a 1-hour
//     window) and not fixed here; surfaced in the import summary
//     (`skippedDayClosed`) so it's visible rather than silently lossy.
// (2) This is a one-time backfill tool, not a sync mechanism — re-
//     importing the same rows twice creates duplicate attempts/sessions
//     (logProblem, logMaintenance, etc. don't content-dedup the way
//     idem_key dedups a truly identical event). Meant to be run once,
//     matching how the paper log itself is a one-time bridge before the
//     app exists (final/08: "Days 1-14+ come in via the paper CSV
//     importer").
import { isDayClosed } from '../engine/time';
import type { EngineConfig, EngineDeps } from '../engine/types';
import type { DailyLogEntry, DsaLogEntry } from '../engine/paperImport';
import { slugifyProblemTitle } from '../engine/paperImport';
import { loadTodayQuests, completeQuest } from './quests';
import { logMaintenance, logSleep, logScreentime } from './lifestyle';
import { completeEveningReview } from './review';
import { logProblem } from './dsa';

export interface ImportSummary {
  daysImported: number;
  questsCompleted: number;
  problemsImported: number;
  skippedDayClosed: number;
}

const CORE_MARK_KEYS = ['dsa', 'bld', 'trn', 'slp', 'att'] as const;
const MARK_TO_QUEST_KEY = { dsa: 'dsa', bld: 'build', trn: 'training', slp: 'sleep', att: 'attention' } as const;

export async function importDailyLog(
  entries: DailyLogEntry[],
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<ImportSummary> {
  const summary: ImportSummary = { daysImported: 0, questsCompleted: 0, problemsImported: 0, skippedDayClosed: 0 };

  for (const entry of entries) {
    const { instances } = await loadTodayQuests(entry.date, config, deps);

    for (const markKey of CORE_MARK_KEYS) {
      const mark = entry[markKey];
      if (mark === 'none') continue;
      const questKey = MARK_TO_QUEST_KEY[markKey];
      const instance = instances.find((i) => i.template_id.endsWith(`::${questKey}`));
      if (!instance || instance.state === 'complete') continue;
      if (isDayClosed(deps.now(), config)) {
        summary.skippedDayClosed++;
        continue;
      }
      await completeQuest(instance, questKey, arcId, config, deps);
      summary.questsCompleted++;
    }

    if (entry.fue !== 'none') {
      await logMaintenance(entry.date, arcId, { bath: false, fuel: true, laundry: false }, config, deps);
    }
    if (entry.wake) {
      await logSleep(entry.date, arcId, entry.wake, config, deps, entry.sleep);
    }
    if (entry.screenMinutes !== undefined) {
      await logScreentime(entry.date, arcId, entry.screenMinutes, config, deps);
    }
    await completeEveningReview(
      entry.date,
      arcId,
      { energy: entry.energy ?? 3, focus: entry.focus ?? 3, blocker: entry.blocker ?? 'nothing', sleptAt: entry.sleep },
      config,
      deps
    );

    summary.daysImported++;
  }

  return summary;
}

export async function importDsaLog(entries: DsaLogEntry[], arcId: string, config: EngineConfig, deps: EngineDeps): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    await logProblem(
      entry.date,
      arcId,
      {
        slug: slugifyProblemTitle(entry.problem),
        title: entry.problem,
        topic: entry.topic,
        difficulty: entry.difficulty,
        outcome: entry.outcome,
        minutes: entry.minutes,
        insight: entry.insight,
      },
      config,
      deps
    );
    count++;
  }
  return count;
}
