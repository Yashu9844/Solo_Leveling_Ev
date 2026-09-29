// Every tunable constant in the domain. Nothing may be hard-coded anywhere
// else in the codebase. Transcribed from final/01-quests-xp-level-rank.md.
import type { EngineConfig } from './types';

export const DEFAULT_CONFIG: EngineConfig = {
  arc: {
    timezone: 'Asia/Kolkata',
    dayBoundaryHour: 4,
    dayCloseHour: 3,
    startDate: '2026-09-01',
    endDate: '2026-12-29',
  },
  coreQuests: {
    career: { xp: 100, category: 'CAREER' },
    dsa: { xp: 100, category: 'MIND' },
    build: { xp: 100, category: 'CRAFT' },
    training: { xp: 100, category: 'BODY' },
    sleep: { xp: 60, category: 'SLEEP' },
    attention: { xp: 40, category: 'ATTENTION' },
  }, // sums to 500
  // BONUS and BOSS grants (weekly payout, recovery, boss clears) are
  // deliberately absent from this table — final/01 §2.1.1: they are
  // frequency-limited, not volume-limited, and are exempt from both
  // category caps and the daily cap. See EngineConfig.categoryCaps.
  categoryCaps: {
    CAREER: 140,
    MIND: 200,
    CRAFT: 200,
    BODY: 150,
    SLEEP: 60,
    ATTENTION: 40,
    LEARN: 75,
    MAINT: 20,
  },
  dailyCap: 700,
  mvdXp: 35,
  recoveryXp: 40,
  bossXp: 500,
  weeklyQuestXp: 200,
  revisitXp: 20,
  shipBonusXp: 50,
  learningBlockXp: 25,
  stepsBonusXp: 20,
  maintenanceXp: 20,
  stepsBonusThreshold: 10000,
  wakeTargetTime: '08:30',
  maintenanceLaundryEveryDays: 3,
  // Revised 84 (was 75) — final/01 §3 revision note, 31 Aug 2026. The
  // original 75 was tuned on a simulation that omitted the uncapped
  // BONUS/BOSS grants above; including them adds ~13% to arc totals and
  // pushed the Level-40 terminus to 43. 84 restores it to 40 at 85%.
  level: { base: 200, coefficient: 84, exponent: 0.98, roundTo: 10 },
  streak: { graceDaysPer28: 4, reducedModeTriggerMisses: 2, reducedModeExitDays: 2 },
  attributes: { windowDays: 28 },
  srs: {
    firstAttemptIntervals: [3, 10, 30, 90],
    hint: 3,
    editorial: 2,
    unsolved: 1,
    maxRevisitsPerDay: 3,
    retainedMinGapDays: 21,
  },
};

/** The arc-row fields that vary per arc — a structural subset of
 * db/schema.ts's ArcRow (engine/ may not import from db/). */
export interface ArcConfigSource {
  timezone: string;
  day_boundary_hour: number;
  day_close_hour: number;
  start_date: string;
  end_date: string;
}

/**
 * Pure. The engine config for a specific arc: every gameplay constant
 * from `base`, with the arc section (timezone, day boundary, day close,
 * dates) taken from the arc itself rather than from the owner's
 * hard-coded defaults (platform/05 loop 1.3). For the owner's arc these
 * values are identical to DEFAULT_CONFIG.arc, so nothing changes for
 * them; for anyone else it is the difference between their own day
 * boundaries and Asia/Kolkata's.
 *
 * Deliberately arc fields only. Onboarding's rhythm answers (wake target,
 * screen cap, steps target) stay unwired: the owner's System is the
 * golden master and honouring them is an owner opt-in (platform/02
 * §22.1, §22.4), not a side effect of this seam.
 */
export function engineConfigFor(arc: ArcConfigSource, base: EngineConfig = DEFAULT_CONFIG): EngineConfig {
  return {
    ...base,
    arc: {
      timezone: arc.timezone,
      dayBoundaryHour: arc.day_boundary_hour,
      dayCloseHour: arc.day_close_hour,
      startDate: arc.start_date,
      endDate: arc.end_date,
    },
  };
}
