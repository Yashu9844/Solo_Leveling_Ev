import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeXp, emptyDayState, computeDayLedger } from '../../src/engine/xp';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { CoreQuestKey, DayState, EngineConfig, SystemEvent } from '../../src/engine/types';

const CORE_KEYS: CoreQuestKey[] = ['career', 'dsa', 'build', 'training', 'sleep', 'attention'];

function questCompletedEvent(questKey: CoreQuestKey, overrides: Partial<SystemEvent> = {}): SystemEvent {
  return {
    id: `evt-${questKey}`,
    type: 'QUEST_COMPLETED',
    occurred_at: '2026-09-05T10:00:00Z',
    local_date: '2026-09-05',
    arc_id: 'arc-1',
    payload: { instanceId: `inst-${questKey}`, templateId: `tpl-${questKey}`, questKey, localDate: '2026-09-05' },
    source: 'user',
    idem_key: `quest-complete:inst-${questKey}:0`,
    schema_v: 1,
    ...overrides,
  };
}

function otherEvent(type: SystemEvent['type'], payload: Record<string, unknown> = {}): SystemEvent {
  return {
    id: `evt-${type}`,
    type,
    occurred_at: '2026-09-05T10:00:00Z',
    local_date: '2026-09-05',
    arc_id: 'arc-1',
    payload,
    source: 'user',
    idem_key: `${type}:1`,
    schema_v: 1,
  };
}

describe('computeXp — base grants', () => {
  it('each core quest yields exactly 100/100/100/100/60/40', () => {
    const expected = { career: 100, dsa: 100, build: 100, training: 100, sleep: 60, attention: 40 };
    for (const key of CORE_KEYS) {
      const grants = computeXp(questCompletedEvent(key), emptyDayState('2026-09-05'), DEFAULT_CONFIG);
      expect(grants).toHaveLength(1);
      expect(grants[0]?.amount).toBe(expected[key]);
      expect(grants[0]?.category).toBe(DEFAULT_CONFIG.coreQuests[key].category);
    }
  });

  it('six core completions in a day sum to exactly 500', () => {
    let dayState = emptyDayState('2026-09-05');
    let total = 0;
    for (const key of CORE_KEYS) {
      const grants = computeXp(questCompletedEvent(key), dayState, DEFAULT_CONFIG);
      for (const grant of grants) {
        total += grant.amount;
        dayState = {
          ...dayState,
          category_totals: {
            ...dayState.category_totals,
            [grant.category as keyof DayState['category_totals']]:
              (dayState.category_totals[grant.category as keyof DayState['category_totals']] ?? 0) +
              grant.amount,
          },
          daily_total: dayState.daily_total + grant.amount,
        };
      }
    }
    expect(total).toBe(500);
  });
});

describe('computeXp — caps', () => {
  it('the category cap trims and records capped_from', () => {
    const dayState: DayState = { ...emptyDayState('2026-09-05'), category_totals: { ...emptyDayState('2026-09-05').category_totals, CAREER: 60 } };
    // CAREER cap is 140; 60 already used + a fresh 100-XP career grant would be 160.
    const grants = computeXp(questCompletedEvent('career'), dayState, DEFAULT_CONFIG);
    expect(grants[0]?.amount).toBe(80);
    expect(grants[0]?.capped_from).toBe(100);
  });

  it('the daily cap (700) binds before the 885 category-cap sum', () => {
    const dayState: DayState = { ...emptyDayState('2026-09-05'), daily_total: 690 };
    // MIND cap (200) has plenty of headroom; the daily cap does not.
    const grants = computeXp(questCompletedEvent('dsa'), dayState, DEFAULT_CONFIG);
    expect(grants[0]?.amount).toBe(10);
    expect(grants[0]?.capped_from).toBe(100);
  });

  it('BONUS and BOSS grants bypass both caps', () => {
    const bonusConfig: EngineConfig = {
      ...DEFAULT_CONFIG,
      coreQuests: { ...DEFAULT_CONFIG.coreQuests, career: { xp: 999, category: 'BONUS' } },
    };
    const dayState: DayState = { ...emptyDayState('2026-09-05'), daily_total: 690 };
    const grants = computeXp(questCompletedEvent('career'), dayState, bonusConfig);
    expect(grants[0]?.amount).toBe(999);
    expect(grants[0]?.capped_from).toBeUndefined();

    const bossConfig: EngineConfig = {
      ...DEFAULT_CONFIG,
      coreQuests: { ...DEFAULT_CONFIG.coreQuests, career: { xp: 999, category: 'BOSS' } },
    };
    const bossGrants = computeXp(questCompletedEvent('career'), dayState, bossConfig);
    expect(bossGrants[0]?.amount).toBe(999);
    expect(bossGrants[0]?.capped_from).toBeUndefined();
  });
});

describe('computeXp — never earns XP', () => {
  it('APP_OPENED / REVIEW_COMPLETED / CHECKPOINT_SEALED yield []', () => {
    for (const type of ['APP_OPENED', 'REVIEW_COMPLETED', 'CHECKPOINT_SEALED'] as const) {
      expect(computeXp(otherEvent(type), emptyDayState('2026-09-05'), DEFAULT_CONFIG)).toEqual([]);
    }
  });

  it('INVARIANT: no body METRIC_RECORDED produces a ledger row', () => {
    for (const kind of ['weight_kg', 'waist_cm', 'bodyfat_pct']) {
      const event = otherEvent('METRIC_RECORDED', { kind, value: 70, unit: 'kg' });
      expect(computeXp(event, emptyDayState('2026-09-05'), DEFAULT_CONFIG)).toEqual([]);
    }
  });

  it('INVARIANT: no body METRIC_RECORDED produces a ledger row, even for steps/screen_time/wake/sleep kinds routed through the same event type', () => {
    // final/04 §1's "no XP for weight, waist, body fat, or any body
    // measurement" only covers body composition — steps/screen-time/sleep
    // are logged via their OWN event types (STEPS_LOGGED etc.), not
    // METRIC_RECORDED, so this just confirms METRIC_RECORDED itself stays
    // XP-inert regardless of what kind string it's ever given.
    for (const kind of ['steps', 'screen_time_min', 'wake_time', 'sleep_time']) {
      const event = otherEvent('METRIC_RECORDED', { kind, value: 1, unit: 'x' });
      expect(computeXp(event, emptyDayState('2026-09-05'), DEFAULT_CONFIG)).toEqual([]);
    }
  });

  it('INVARIANT: no external CAREER_EVENT_LOGGED produces a ledger row', () => {
    for (const kind of ['response', 'call', 'interview', 'onsite', 'offer', 'rejection']) {
      const event = otherEvent('CAREER_EVENT_LOGGED', { kind });
      expect(computeXp(event, emptyDayState('2026-09-05'), DEFAULT_CONFIG)).toEqual([]);
    }
  });
});

describe('computeXp — properties', () => {
  const questKeyArb = fc.constantFrom(...CORE_KEYS);

  it('property: for any sequence of core completions in a day, 0 <= daily capped XP <= 700', () => {
    fc.assert(
      fc.property(fc.array(questKeyArb, { minLength: 0, maxLength: 40 }), (keys) => {
        let dayState = emptyDayState('2026-09-05');
        for (const key of keys) {
          const grants = computeXp(questCompletedEvent(key), dayState, DEFAULT_CONFIG);
          for (const grant of grants) {
            let categoryTotals = dayState.category_totals;
            if (grant.category !== 'BONUS' && grant.category !== 'BOSS') {
              categoryTotals = {
                ...categoryTotals,
                [grant.category]: (categoryTotals[grant.category] ?? 0) + grant.amount,
              };
            }
            dayState = { ...dayState, category_totals: categoryTotals, daily_total: dayState.daily_total + grant.amount };
          }
        }
        expect(dayState.daily_total).toBeGreaterThanOrEqual(0);
        expect(dayState.daily_total).toBeLessThanOrEqual(DEFAULT_CONFIG.dailyCap);
      })
    );
  });

  it('property: every grant amount is >= 0', () => {
    fc.assert(
      fc.property(fc.array(questKeyArb, { minLength: 0, maxLength: 40 }), (keys) => {
        let dayState = emptyDayState('2026-09-05');
        for (const key of keys) {
          const grants = computeXp(questCompletedEvent(key), dayState, DEFAULT_CONFIG);
          for (const grant of grants) {
            expect(grant.amount).toBeGreaterThanOrEqual(0);
            let categoryTotals = dayState.category_totals;
            if (grant.category !== 'BONUS' && grant.category !== 'BOSS') {
              categoryTotals = {
                ...categoryTotals,
                [grant.category]: (categoryTotals[grant.category] ?? 0) + grant.amount,
              };
            }
            dayState = { ...dayState, category_totals: categoryTotals, daily_total: dayState.daily_total + grant.amount };
          }
        }
      })
    );
  });

  it('property: total_xp === SUM(ledger.amount) for any set of completions in a day', () => {
    fc.assert(
      fc.property(fc.uniqueArray(questKeyArb, { minLength: 0, maxLength: 6 }), (keys) => {
        const dayEvents = keys.map((key, idx) =>
          questCompletedEvent(key, { id: `evt-${key}`, occurred_at: `2026-09-05T10:0${idx}:00Z` })
        );
        const entries = computeDayLedger('2026-09-05', dayEvents, DEFAULT_CONFIG);
        const sum = entries.reduce((acc, e) => acc + e.amount, 0);
        expect(sum).toBeGreaterThanOrEqual(0);
        expect(sum).toBeLessThanOrEqual(DEFAULT_CONFIG.dailyCap);
        // Every completion produces exactly one ledger entry this slice
        // (one core quest -> one grant; no zero-grant paths for core keys).
        expect(entries).toHaveLength(dayEvents.length);
      })
    );
  });

  it('STEPS_LOGGED yields no grant below the bonus threshold, and stepsBonusXp at/above it (Slice 9)', () => {
    const below = otherEvent('STEPS_LOGGED', { localDate: '2026-09-05', steps: 9999 });
    expect(computeXp(below, emptyDayState('2026-09-05'), DEFAULT_CONFIG)).toEqual([]);

    const at = otherEvent('STEPS_LOGGED', { localDate: '2026-09-05', steps: 10000 });
    const grants = computeXp(at, emptyDayState('2026-09-05'), DEFAULT_CONFIG);
    expect(grants).toHaveLength(1);
    expect(grants[0]?.amount).toBe(DEFAULT_CONFIG.stepsBonusXp);
    expect(grants[0]?.category).toBe('BODY');
  });

  it('MAINTENANCE_LOGGED yields no grant unless allDone, then a flat maintenanceXp (Slice 9)', () => {
    const partial = otherEvent('MAINTENANCE_LOGGED', {
      localDate: '2026-09-05',
      bath: true,
      fuel: false,
      laundry: true,
      allDone: false,
    });
    expect(computeXp(partial, emptyDayState('2026-09-05'), DEFAULT_CONFIG)).toEqual([]);

    const complete = otherEvent('MAINTENANCE_LOGGED', {
      localDate: '2026-09-05',
      bath: true,
      fuel: true,
      laundry: true,
      allDone: true,
    });
    const grants = computeXp(complete, emptyDayState('2026-09-05'), DEFAULT_CONFIG);
    expect(grants).toHaveLength(1);
    expect(grants[0]?.amount).toBe(DEFAULT_CONFIG.maintenanceXp);
    expect(grants[0]?.category).toBe('MAINT');
  });

  it('TRAINING_SESSION_LOGGED / SLEEP_LOGGED / SCREENTIME_LOGGED yield no XP of their own (Slice 9)', () => {
    for (const type of ['TRAINING_SESSION_LOGGED', 'SLEEP_LOGGED', 'SCREENTIME_LOGGED'] as const) {
      expect(computeXp(otherEvent(type), emptyDayState('2026-09-05'), DEFAULT_CONFIG)).toEqual([]);
    }
  });

  it('BOSS_CLEARED yields a flat BOSS grant equal to config.bossXp, uncapped (Slice 13)', () => {
    const dayEvents = [questCompletedEvent('career'), otherEvent('BOSS_CLEARED', { bossId: 'I' })];
    const entries = computeDayLedger('2026-09-05', dayEvents, DEFAULT_CONFIG);
    const bossEntry = entries.find((e) => e.reason === 'boss');
    expect(bossEntry?.amount).toBe(DEFAULT_CONFIG.bossXp);
    expect(bossEntry?.category).toBe('BOSS');
    expect(bossEntry?.cappedFrom).toBeUndefined();
  });

  it('QUEST_RECOVERED yields a flat BONUS grant equal to config.recoveryXp, uncapped', () => {
    const dayEvents = [questCompletedEvent('career'), otherEvent('QUEST_RECOVERED', { localDate: '2026-09-04' })];
    const entries = computeDayLedger('2026-09-05', dayEvents, DEFAULT_CONFIG);
    const recoveryEntry = entries.find((e) => e.reason === 'recovery');
    expect(recoveryEntry?.amount).toBe(DEFAULT_CONFIG.recoveryXp);
    expect(recoveryEntry?.category).toBe('BONUS');
    expect(recoveryEntry?.cappedFrom).toBeUndefined();
  });

  it('WEEKLY_QUEST_COMPLETED yields a flat BONUS grant equal to config.weeklyQuestXp, uncapped (Slice 14)', () => {
    const dayEvents = [questCompletedEvent('career'), otherEvent('WEEKLY_QUEST_COMPLETED', { weeklyQuestId: 'wq-1' })];
    const entries = computeDayLedger('2026-09-05', dayEvents, DEFAULT_CONFIG);
    const weeklyEntry = entries.find((e) => e.reason === 'weekly_quest');
    expect(weeklyEntry?.amount).toBe(DEFAULT_CONFIG.weeklyQuestXp);
    expect(weeklyEntry?.category).toBe('BONUS');
    expect(weeklyEntry?.cappedFrom).toBeUndefined();
  });
});
