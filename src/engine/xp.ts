import type {
  DayState,
  EngineConfig,
  MaintenanceLoggedPayload,
  QuestCompletedPayload,
  StepsLoggedPayload,
  SystemEvent,
  XpCategory,
  XpGrant,
} from './types';

/**
 * Pure. Computes XP grants for an event given the day's state so far.
 * Maps the event to a base grant, then applies the category cap and the
 * daily cap in that order. BONUS and BOSS grants are exempt from both
 * (final/01 §2.1.1) — frequency-limited, not volume-limited. Never
 * returns a negative amount or an amount above remaining headroom.
 */
export function computeXp(event: SystemEvent, dayState: DayState, config: EngineConfig): XpGrant[] {
  return baseGrantsFor(event, config).map((grant) => applyCaps(grant, dayState, config));
}

function baseGrantsFor(event: SystemEvent, config: EngineConfig): XpGrant[] {
  switch (event.type) {
    case 'QUEST_COMPLETED': {
      const payload = event.payload as unknown as QuestCompletedPayload;
      const core = config.coreQuests[payload.questKey];
      if (!core) return [];
      return [{ category: core.category, amount: core.xp, reason: `core:${payload.questKey}` }];
    }
    case 'QUEST_RECOVERED':
      // Flat, frequency-limited (max 1/day, enforced by the idem_key,
      // not here), BONUS-category, exempt from both caps — final/01
      // §2.1.1, §6.3. Worth less than a real completion so recovering is
      // never better than not missing.
      return [{ category: 'BONUS', amount: config.recoveryXp, reason: 'recovery' }];
    case 'PROBLEM_REVISITED':
      // Ordinary MIND-category grant, subject to the normal caps (not a
      // BONUS exemption) — final/03 §2.2: "20 XP each — less than a new
      // problem, deliberately." Max 3/day is enforced by the revisit
      // scheduler (engine/srs.ts + store/dsa.ts), not by XP capping.
      return [{ category: 'MIND', amount: config.revisitXp, reason: 'revisit' }];
    case 'ARTIFACT_SHIPPED':
      // Ordinary CRAFT-category grant, subject to the normal 200 cap —
      // final/03 §4.1: SHIP mode -> artifact row + 50 XP bonus. Not a
      // BONUS-category exemption; final/01 §2.1's CRAFT cap table
      // already prices this in ("BUILD 100 + shipped units" up to 200).
      return [{ category: 'CRAFT', amount: config.shipBonusXp, reason: 'ship' }];
    case 'LEARNING_BLOCK_LOGGED':
      // Not a seventh core quest — LEARN XP comes directly from logging,
      // at any time (final/03 §3). Flat 25 XP per block regardless of
      // the exact minutes entered ("25 XP per 15-minute block" is a
      // quantized unit, not a per-minute rate) — the 75 LEARN cap is
      // exactly 3x this, so it enforces the 3-blocks/day limit itself.
      return [{ category: 'LEARN', amount: config.learningBlockXp, reason: 'learning_block' }];
    case 'SYSTEM_DESIGN_LOGGED':
      // Shares LEARNING_BLOCK_LOGGED's rate and LEARN cap — final/03
      // §3.3: "LEARN category + weekly quest + its own table."
      return [{ category: 'LEARN', amount: config.learningBlockXp, reason: 'system_design' }];
    case 'STEPS_LOGGED': {
      // final/04 §3.1: "Bonus +20 at >= 10,000 steps." The steps count
      // itself never completes TRAINING via this grant — that's a
      // QUEST_COMPLETED the store issues separately at the 8,000
      // threshold (engine/quests.ts's criterion). Below 10,000, no grant.
      const payload = event.payload as unknown as StepsLoggedPayload;
      if (payload.steps < config.stepsBonusThreshold) return [];
      return [{ category: 'BODY', amount: config.stepsBonusXp, reason: 'steps_bonus' }];
    }
    case 'BOSS_CLEARED':
      // Flat, frequency-limited (once per boss, enforced by the idem_key,
      // not here), BOSS-category, exempt from both caps — final/01
      // §2.1.1, §7.
      return [{ category: 'BOSS', amount: config.bossXp, reason: 'boss' }];
    case 'WEEKLY_QUEST_COMPLETED':
      // Flat, frequency-limited (once per accepted weekly quest,
      // enforced by the idem_key), BONUS-category, exempt from both
      // caps — final/00 §C8, final/01 §2.1.1's "weekly quest payout"
      // row.
      return [{ category: 'BONUS', amount: config.weeklyQuestXp, reason: 'weekly_quest' }];
    case 'MAINTENANCE_LOGGED': {
      // final/04 §6: one flat 20 XP grant, only when every one of today's
      // applicable items is ticked — "zero pressure," no partial credit.
      const payload = event.payload as unknown as MaintenanceLoggedPayload;
      if (!payload.allDone) return [];
      return [{ category: 'MAINT', amount: config.maintenanceXp, reason: 'maintenance' }];
    }
    // Every other event type — including body METRIC_RECORDED, external
    // CAREER_EVENT_LOGGED, APP_OPENED, REVIEW_COMPLETED, and
    // CHECKPOINT_SEALED — yields no XP. final/01 §2.3.
    default:
      return [];
  }
}

function applyCaps(grant: XpGrant, dayState: DayState, config: EngineConfig): XpGrant {
  if (grant.category === 'BONUS' || grant.category === 'BOSS') {
    return grant;
  }

  const original = grant.amount;
  let amount = grant.amount;
  let cappedFrom: number | undefined;

  const categoryCap = config.categoryCaps[grant.category];
  const categorySoFar = dayState.category_totals[grant.category] ?? 0;
  const categoryHeadroom = Math.max(0, categoryCap - categorySoFar);
  if (amount > categoryHeadroom) {
    cappedFrom = original;
    amount = categoryHeadroom;
  }

  const dailyHeadroom = Math.max(0, config.dailyCap - dayState.daily_total);
  if (amount > dailyHeadroom) {
    cappedFrom = cappedFrom ?? original;
    amount = dailyHeadroom;
  }

  amount = Math.max(0, amount);
  return cappedFrom !== undefined ? { ...grant, amount, capped_from: cappedFrom } : { ...grant, amount };
}

export function emptyDayState(localDate: string): DayState {
  return {
    local_date: localDate,
    category_totals: {
      CAREER: 0,
      MIND: 0,
      CRAFT: 0,
      BODY: 0,
      SLEEP: 0,
      ATTENTION: 0,
      LEARN: 0,
      MAINT: 0,
    },
    daily_total: 0,
    quests_completed: [],
    mvd_met: false,
    day_closed: false,
  };
}

export interface DayLedgerEntry {
  eventId: string;
  instanceId?: string; // only set for QUEST_COMPLETED-derived entries
  category: XpCategory;
  amount: number;
  reason: string;
  cappedFrom?: number;
}

/**
 * Pure. Derives a full day's XP ledger from its XP-relevant events
 * (QUEST_COMPLETED, QUEST_RECOVERED — anything else computeXp returns []
 * for), applying caps in chronological order. This is the single
 * implementation shared by the live write path (store/quests.ts,
 * store/recovery.ts) and the full rebuild (db/projections.ts) —
 * "recompute, never subtract": there is exactly one way to turn "which
 * events are in effect for this day" into ledger rows, and every caller
 * uses it.
 *
 * `events` must already be filtered to exactly the events that are
 * "in effect" (a QUEST_COMPLETED whose instance was later undone must be
 * excluded by the caller — see db/projections.ts's use of the
 * applyEvents completion overlay, not a raw event scan).
 */
export function computeDayLedger(localDate: string, events: SystemEvent[], config: EngineConfig): DayLedgerEntry[] {
  const sorted = [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  let dayState = emptyDayState(localDate);
  const entries: DayLedgerEntry[] = [];

  for (const event of sorted) {
    const grants = computeXp(event, dayState, config);
    for (const grant of grants) {
      const instanceId =
        event.type === 'QUEST_COMPLETED'
          ? (event.payload as unknown as QuestCompletedPayload).instanceId
          : undefined;
      entries.push({
        eventId: event.id,
        instanceId,
        category: grant.category,
        amount: grant.amount,
        reason: grant.reason,
        cappedFrom: grant.capped_from,
      });
      // BONUS/BOSS are exempt from caps and never accumulate here — same
      // exclusion as DayState.category_totals' type (see types.ts).
      let categoryTotals = dayState.category_totals;
      if (grant.category !== 'BONUS' && grant.category !== 'BOSS') {
        categoryTotals = {
          ...categoryTotals,
          [grant.category]: (categoryTotals[grant.category] ?? 0) + grant.amount,
        };
      }
      dayState = {
        ...dayState,
        category_totals: categoryTotals,
        daily_total: dayState.daily_total + grant.amount,
      };
    }
  }

  return entries;
}
