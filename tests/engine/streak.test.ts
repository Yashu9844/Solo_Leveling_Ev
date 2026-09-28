import { describe, it, expect } from 'vitest';
import { streakFrom, type DayOutcome } from '../../src/engine/streak';
import { DEFAULT_CONFIG } from '../../src/engine/config';

const STREAK_CONFIG = DEFAULT_CONFIG.streak; // graceDaysPer28: 4, reducedModeTriggerMisses: 2, reducedModeExitDays: 2

function day(local_date: string, mvd_met: boolean, paused = false): DayOutcome {
  return { local_date, mvd_met, paused };
}

function dateSeq(start: string, count: number): string[] {
  const [y, m, d] = start.split('-').map(Number);
  const base = Date.UTC(y!, m! - 1, d!);
  return Array.from({ length: count }, (_, i) => {
    const dt = new Date(base + i * 86_400_000);
    return dt.toISOString().slice(0, 10);
  });
}

describe('streakFrom — basic counting', () => {
  it('consecutive hits increment the streak', () => {
    const dates = dateSeq('2026-09-01', 5);
    const days = dates.map((d) => day(d, true));
    const result = streakFrom(days, STREAK_CONFIG);
    expect(result.arc_streak).toBe(5);
    expect(result.history.map((h) => h.streak_after)).toEqual([1, 2, 3, 4, 5]);
  });

  it('a miss with no grace remaining resets the streak to 0', () => {
    const dates = dateSeq('2026-09-01', 3);
    const days = [day(dates[0]!, true), day(dates[1]!, true), day(dates[2]!, false)];
    const noGrace = { ...STREAK_CONFIG, graceDaysPer28: 0 };
    const result = streakFrom(days, noGrace);
    expect(result.arc_streak).toBe(0);
    expect(result.history[2]?.grace_applied).toBe(false);
  });
});

describe('streakFrom — grace', () => {
  it('a grace-covered miss preserves the streak (does not increment, does not reset)', () => {
    const dates = dateSeq('2026-09-01', 4);
    const days = [day(dates[0]!, true), day(dates[1]!, true), day(dates[2]!, false), day(dates[3]!, true)];
    const result = streakFrom(days, STREAK_CONFIG);
    // hit, hit(streak=2), grace-miss(streak stays 2), hit(streak=3)
    expect(result.history.map((h) => h.streak_after)).toEqual([1, 2, 2, 3]);
    expect(result.history[2]?.grace_applied).toBe(true);
    expect(result.arc_streak).toBe(3);
  });

  it('the 5th miss within a rolling 28-day window exhausts grace and breaks the streak', () => {
    const dates = dateSeq('2026-09-01', 10);
    // hit, then 5 misses in a row, all within the same 28-day window.
    const days = [day(dates[0]!, true), ...dates.slice(1, 6).map((d) => day(d, false))];
    const result = streakFrom(days, STREAK_CONFIG);
    const graceFlags = result.history.slice(1).map((h) => h.grace_applied);
    expect(graceFlags).toEqual([true, true, true, true, false]);
    expect(result.arc_streak).toBe(0); // the 5th miss breaks it
  });

  it('grace usage ages out after 28 days — a 5th miss outside the window is still covered', () => {
    const early = dateSeq('2026-09-01', 4); // 4 misses, using all 4 grace days
    const later = dateSeq('2026-10-15', 1); // well over 28 days later
    const days = [...early.map((d) => day(d, false)), day(later[0]!, false)];
    const result = streakFrom(days, STREAK_CONFIG);
    expect(result.history[4]?.grace_applied).toBe(true); // a fresh window, fresh budget
  });
});

describe('streakFrom — Arc Pause', () => {
  it('a paused day is neutral: no grace consumed, streak unchanged', () => {
    const dates = dateSeq('2026-09-01', 3);
    const days = [day(dates[0]!, true), day(dates[1]!, false, true), day(dates[2]!, true)];
    const result = streakFrom(days, STREAK_CONFIG);
    expect(result.history[1]?.grace_applied).toBe(false);
    expect(result.history.map((h) => h.streak_after)).toEqual([1, 1, 2]);
    expect(result.grace_used_this_cycle).toBe(0);
  });
});

describe('streakFrom — Reduced Mode', () => {
  it('two consecutive misses trigger Reduced Mode', () => {
    const dates = dateSeq('2026-09-01', 3);
    const days = [day(dates[0]!, true), day(dates[1]!, false), day(dates[2]!, false)];
    const result = streakFrom(days, STREAK_CONFIG);
    expect(result.history[1]?.reduced_mode).toBe(false);
    expect(result.history[2]?.reduced_mode).toBe(true);
    expect(result.reduced_mode).toBe(true);
  });

  it('a single miss does not trigger Reduced Mode', () => {
    const dates = dateSeq('2026-09-01', 3);
    const days = [day(dates[0]!, true), day(dates[1]!, false), day(dates[2]!, true)];
    const result = streakFrom(days, STREAK_CONFIG);
    expect(result.reduced_mode).toBe(false);
  });

  it('exits after two consecutive MVD-met days', () => {
    const dates = dateSeq('2026-09-01', 5);
    const days = [
      day(dates[0]!, false),
      day(dates[1]!, false), // Reduced Mode triggers
      day(dates[2]!, true),
      day(dates[3]!, true), // exits here
      day(dates[4]!, false),
    ];
    const result = streakFrom(days, STREAK_CONFIG);
    expect(result.history[1]?.reduced_mode).toBe(true);
    expect(result.history[2]?.reduced_mode).toBe(true); // still active on the first hit
    expect(result.history[3]?.reduced_mode).toBe(false); // exits on the second consecutive hit
    expect(result.history[4]?.reduced_mode).toBe(false); // a lone subsequent miss doesn't re-trigger it
  });
});

describe('streakFrom — grace_remaining', () => {
  it('reflects the current trailing-28 window at the end of the log', () => {
    const dates = dateSeq('2026-09-01', 3);
    const days = [day(dates[0]!, false), day(dates[1]!, false), day(dates[2]!, true)];
    const result = streakFrom(days, STREAK_CONFIG);
    expect(result.grace_used_this_cycle).toBe(2);
    expect(result.grace_remaining).toBe(2);
  });
});
