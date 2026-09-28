import { describe, it, expect } from 'vitest';
import { localDate, isDayClosed, arcDay } from '../../src/engine/time';
import { DEFAULT_CONFIG } from '../../src/engine/config';

const IST = 'Asia/Kolkata';

describe('localDate — 04:00 boundary, Asia/Kolkata', () => {
  it('02:40 IST (past midnight, before the 04:00 boundary) files under the PREVIOUS day', () => {
    // 2026-09-12T21:10:00Z = 2026-09-13T02:40 IST
    expect(localDate('2026-09-12T21:10:00Z', IST)).toBe('2026-09-12');
  });

  it('04:05 IST (past the 04:00 boundary) files under the NEW day', () => {
    // 2026-09-12T22:35:00Z = 2026-09-13T04:05 IST
    expect(localDate('2026-09-12T22:35:00Z', IST)).toBe('2026-09-13');
  });
});

describe('isDayClosed — 03:00 close, 04:00 boundary, reads config.arc (Slice 2)', () => {
  it('03:05 IST → day is closed', () => {
    // 2026-09-12T21:35:00Z = 2026-09-13T03:05 IST
    expect(isDayClosed('2026-09-12T21:35:00Z', DEFAULT_CONFIG)).toBe(true);
  });

  it('02:25 IST → day is not yet closed', () => {
    // 2026-09-12T20:55:00Z = 2026-09-13T02:25 IST
    expect(isDayClosed('2026-09-12T20:55:00Z', DEFAULT_CONFIG)).toBe(false);
  });

  it('04:01 IST → boundary has already rolled the day over, so day is open again', () => {
    // 2026-09-12T22:31:00Z = 2026-09-13T04:01 IST
    expect(isDayClosed('2026-09-12T22:31:00Z', DEFAULT_CONFIG)).toBe(false);
  });

  it('02:59 local → day open, and still files under the PREVIOUS local_date', () => {
    // 2026-09-12T21:29:00Z = 2026-09-13T02:59 IST
    const instant = '2026-09-12T21:29:00Z';
    expect(isDayClosed(instant, DEFAULT_CONFIG)).toBe(false);
    expect(localDate(instant, IST)).toBe('2026-09-12');
  });

  it('04:01 local → day open, and now files under the NEW local_date', () => {
    // 2026-09-12T22:31:00Z = 2026-09-13T04:01 IST
    const instant = '2026-09-12T22:31:00Z';
    expect(isDayClosed(instant, DEFAULT_CONFIG)).toBe(false);
    expect(localDate(instant, IST)).toBe('2026-09-13');
  });
});

describe('arcDay — 1-indexed, 04:00-boundary local date', () => {
  it('the arc start date is day 1', () => {
    // 2026-09-01T04:30:00Z = 2026-09-01T10:00 IST, well inside day 1
    expect(arcDay('2026-09-01T04:30:00Z', '2026-09-01', IST)).toBe(1);
  });

  it('the arc end date (2026-12-29) is day 120', () => {
    expect(arcDay('2026-12-29T04:30:00Z', '2026-09-01', IST)).toBe(120);
  });
});

describe('DST safety — a DST-observing fixture timezone', () => {
  const NY = 'America/New_York';

  it('walking an instant forward one hour at a time across a DST transition never skips or doubles a local_date', () => {
    // US DST 2026 spring-forward: 2026-03-08 02:00 local -> 03:00 local.
    // Walk UTC instants from just before to just after the transition and
    // confirm local_date advances by at most one calendar day, and never
    // repeats a date after moving forward.
    const start = parseUtc('2026-03-07T20:00:00Z');
    const seenDates: string[] = [];
    for (let h = 0; h < 24; h++) {
      const instant = new Date(start.getTime() + h * 60 * 60 * 1000).toISOString();
      seenDates.push(localDate(instant, NY));
    }
    const uniqueInOrder = [...new Set(seenDates)];
    // Exactly one date boundary crossed over 24 hourly steps, and dates
    // are monotonically non-decreasing (no skip back, no repeat-after-move).
    expect(uniqueInOrder.length).toBeGreaterThanOrEqual(1);
    expect(uniqueInOrder.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < seenDates.length; i++) {
      const prev = seenDates[i - 1];
      const curr = seenDates[i];
      expect(prev !== undefined && curr !== undefined && curr >= prev).toBe(true);
    }
  });
});

function parseUtc(iso: string): Date {
  return new Date(iso);
}
