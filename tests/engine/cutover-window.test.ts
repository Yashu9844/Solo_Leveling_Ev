// platform/05 loop 6.4 (preparation) - the calendar guard of the owner's cutover.
import { describe, expect, it } from 'vitest';
import { CUTOVER_BUFFER_DAYS, cutoverWindow } from '../../src/blueprint/cutover';

const START = '2026-09-01'; // arc day 1
const CHECKPOINTS = [14, 30, 60, 90, 120];
const onArcDay = (day: number) => cutoverWindow(START, new Date(Date.UTC(2026, 8, day)).toISOString().slice(0, 10), CHECKPOINTS);

describe('cutover window (loop 6.4)', () => {
  it('forbids the checkpoint day and the three days either side, and allows the day beyond', () => {
    for (const checkpoint of CHECKPOINTS) {
      for (let offset = -CUTOVER_BUFFER_DAYS; offset <= CUTOVER_BUFFER_DAYS; offset++) {
        expect(onArcDay(checkpoint + offset).allowed, `day ${checkpoint + offset}`).toBe(false);
      }
    }
    expect(onArcDay(18).allowed).toBe(true); // 4 days after Day 14, 12 before Day 30
    expect(onArcDay(10).allowed).toBe(true); // 4 days before Day 14
    expect(onArcDay(45).allowed).toBe(true);
  });

  it('names the nearest checkpoint, the arc day and the earliest safe date', () => {
    const verdict = cutoverWindow(START, '2026-09-28', CHECKPOINTS); // arc day 28, 2 before Day 30
    expect(verdict).toMatchObject({ arcDay: 28, allowed: false, nearest: { day: 30, daysAway: 2 }, earliestAllowed: '2026-10-04' }); // arc day 34
    expect(verdict.reason).toContain('Day 30');
    expect(cutoverWindow(START, verdict.earliestAllowed, CHECKPOINTS).allowed).toBe(true);
  });

  it('the earliest allowed date is itself allowed, for every start day', () => {
    for (let day = 1; day <= 125; day++) {
      const verdict = onArcDay(day);
      if (!verdict.allowed) expect(cutoverWindow(START, verdict.earliestAllowed, CHECKPOINTS).allowed, `day ${day}`).toBe(true);
    }
  });

  it('a custom buffer and an empty schedule behave', () => {
    expect(cutoverWindow(START, '2026-09-14', CHECKPOINTS, 0).allowed).toBe(false);
    expect(cutoverWindow(START, '2026-09-15', CHECKPOINTS, 0).allowed).toBe(true);
    expect(cutoverWindow(START, '2026-09-15', []).allowed).toBe(true);
  });
});
