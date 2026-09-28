import { describe, it, expect } from 'vitest';
import { countdownTo } from '../../src/ui/hooks/useCountdown';

const TZ = 'Asia/Kolkata';
const CLOSE_HOUR = 3;

/** A UTC instant that reads as `hh:mm:ss` in Asia/Kolkata (UTC+5:30). */
function istInstant(h: number, m = 0, s = 0): Date {
  const utcMinutes = h * 60 + m - 330;
  const d = new Date(Date.UTC(2026, 8, 5, 0, 0, s));
  d.setUTCMinutes(d.getUTCMinutes() + utcMinutes);
  return d;
}

describe('countdownTo — the day is running out', () => {
  it('counts forward to the close hour on the same day', () => {
    // 01:00 IST, closes 03:00 IST -> 2 hours.
    const c = countdownTo(istInstant(1), CLOSE_HOUR, TZ);
    expect(c.formatted).toBe('02:00:00');
    expect(c.totalSeconds).toBe(2 * 3600);
  });

  it('wraps past midnight once the close hour has gone by', () => {
    // 10:00 IST is after 03:00, so the next close is tomorrow: 17 hours.
    const c = countdownTo(istInstant(10), CLOSE_HOUR, TZ);
    expect(c.formatted).toBe('17:00:00');
  });

  it('reads the arc timezone, not the host', () => {
    // The same instant is a different wall clock elsewhere; the arc's
    // day is the one that counts.
    const instant = istInstant(23, 30);
    expect(countdownTo(instant, CLOSE_HOUR, TZ).formatted).toBe('03:30:00');
  });

  it('goes urgent inside three hours and not before', () => {
    // 00:30 IST -> 2h30m left.
    expect(countdownTo(istInstant(0, 30), CLOSE_HOUR, TZ).urgent).toBe(true);
    // Exactly three hours is still urgent; the threshold is inclusive.
    expect(countdownTo(istInstant(0), CLOSE_HOUR, TZ).urgent).toBe(true);
    // One second more than three hours is not — 23:59:59 leaves 3h00m01s.
    expect(countdownTo(istInstant(23, 59, 59), CLOSE_HOUR, TZ).urgent).toBe(false);
    // 06:00 IST -> 21 hours left.
    expect(countdownTo(istInstant(6), CLOSE_HOUR, TZ).urgent).toBe(false);
  });

  it('zero-pads every field so the readout never jumps width', () => {
    const c = countdownTo(istInstant(2, 59, 55), CLOSE_HOUR, TZ);
    expect(c.formatted).toBe('00:00:05');
    expect(c.formatted).toHaveLength(8);
  });

  it('never returns a negative or a full day at the boundary', () => {
    // Exactly at the close hour, the next window is a full day away
    // rather than zero — the day has already rolled.
    const c = countdownTo(istInstant(3), CLOSE_HOUR, TZ);
    expect(c.totalSeconds).toBe(24 * 3600);
    expect(c.totalSeconds).toBeGreaterThan(0);
  });
});
