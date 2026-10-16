// I19 (platform/04 §31.2): time correctness across the zones that break naive date math - New York (DST, with the
// boundary falling inside the change), Lord Howe (a 30-minute DST step), Kathmandu (+5:45), Kiritimati (+14) -
// and a night-shift boundary at 10:00. The oracle is independent of the implementation: a day is the half-open interval
// from one wall-clock `boundaryHour:00` in the zone to the next, and an instant belongs to the day whose interval holds it.
import { addDays, format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { arcDay, isDayClosed, localDate } from '../../src/engine/time';
import type { EngineConfig } from '../../src/engine/types';
import { mulberry32 } from './support/randomEventLog';

const ZONES = ['America/New_York', 'Australia/Lord_Howe', 'Asia/Kathmandu', 'Pacific/Kiritimati', 'Asia/Kolkata', 'Europe/London', 'Pacific/Auckland'];
const BOUNDARIES = [4, 10, 0, 6];

/** The instant a day begins: wall-clock `hour:00` on `date` in `tz`. */
const boundaryInstant = (date: string, tz: string, hour: number): number => fromZonedTime(`${date}T${String(hour).padStart(2, '0')}:00:00`, tz).getTime();

/** The oracle: the date D with boundary(D) <= instant < boundary(D + 1), found among the days around the instant. */
function oracleDate(instant: number, tz: string, hour: number): string {
  const around = format(new Date(instant), 'yyyy-MM-dd');
  for (let offset = -2; offset <= 2; offset++) {
    const date = format(addDays(parseISO(around), offset), 'yyyy-MM-dd');
    const next = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
    if (boundaryInstant(date, tz, hour) <= instant && instant < boundaryInstant(next, tz, hour)) return date;
  }
  throw new Error(`no day holds ${new Date(instant).toISOString()} in ${tz}`);
}

describe('I19: localDate', () => {
  it('matches the independent oracle on random instants in every zone, at every boundary', () => {
    const random = mulberry32(19);
    let checked = 0;
    for (const tz of ZONES) {
      for (const hour of BOUNDARIES) {
        for (let n = 0; n < 150; n++) {
          // Spread over two years so every zone's DST changes are inside the range.
          const instant = Date.UTC(2026, 0, 1) + Math.floor(random() * 730 * 86_400_000);
          expect(localDate(new Date(instant).toISOString(), tz, hour), `${tz} boundary ${hour} at ${new Date(instant).toISOString()}`).toBe(oracleDate(instant, tz, hour));
          checked++;
        }
      }
    }
    expect(checked).toBe(ZONES.length * BOUNDARIES.length * 150);
  });

  it('is right on the minute around each zone\'s DST changes, where an absolute-hours shift goes wrong', () => {
    const changes: [tz: string, from: string][] = [
      ['America/New_York', '2026-03-08'], ['America/New_York', '2026-11-01'], ['Australia/Lord_Howe', '2026-04-05'], ['Australia/Lord_Howe', '2026-10-04'],
      ['Europe/London', '2026-03-29'], ['Europe/London', '2026-10-25'], ['Pacific/Auckland', '2026-04-05'], ['Pacific/Auckland', '2026-09-27'],
    ];
    for (const [tz, date] of changes) {
      for (const hour of [4, 10]) {
        const start = boundaryInstant(date, tz, hour) - 3 * 3_600_000;
        for (let minute = 0; minute <= 6 * 60; minute += 5) {
          const instant = start + minute * 60_000;
          expect(localDate(new Date(instant).toISOString(), tz, hour), `${tz} ${date} boundary ${hour} +${minute}m`).toBe(oracleDate(instant, tz, hour));
        }
      }
    }
  });

  it('puts the two instants either side of a boundary on adjacent days, in every zone', () => {
    for (const tz of ZONES) {
      for (const hour of BOUNDARIES) {
        const at = boundaryInstant('2026-06-15', tz, hour);
        expect(localDate(new Date(at - 1000).toISOString(), tz, hour), `${tz} ${hour} just before`).toBe('2026-06-14');
        expect(localDate(new Date(at).toISOString(), tz, hour), `${tz} ${hour} on it`).toBe('2026-06-15');
      }
    }
  });
});

describe('I19: isDayClosed and arcDay', () => {
  const config = (timezone: string, dayBoundaryHour: number, dayCloseHour: number): EngineConfig => ({ ...DEFAULT_CONFIG, arc: { ...DEFAULT_CONFIG.arc, timezone, dayBoundaryHour, dayCloseHour } });

  it('the day is closed exactly from the close hour to the boundary, by the wall clock, in every zone', () => {
    const random = mulberry32(20);
    for (const tz of ZONES) {
      for (const [boundary, close] of [[4, 3], [10, 9], [1, 0], [6, 4]] as const) {
        const cfg = config(tz, boundary, close);
        for (let n = 0; n < 80; n++) {
          const instant = Date.UTC(2026, 0, 1) + Math.floor(random() * 730 * 86_400_000);
          const wall = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant)).split(':').map(Number);
          const minutes = wall[0]! * 60 + wall[1]!;
          const expected = close * 60 < boundary * 60 ? minutes >= close * 60 && minutes < boundary * 60 : minutes >= close * 60 || minutes < boundary * 60;
          expect(isDayClosed(new Date(instant).toISOString(), cfg), `${tz} ${close}-${boundary} at ${wall.join(':')}`).toBe(expected);
        }
      }
    }
  });

  it('counts arc days by the local date, so a DST change inside the arc never skips or repeats a day', () => {
    const tz = 'America/New_York';
    let previous = 0;
    // Hourly from 2026-10-30 to 2026-11-04 (the fall-back weekend): the day number only ever steps by 0 or 1.
    for (let t = Date.UTC(2026, 9, 30); t < Date.UTC(2026, 10, 4); t += 3_600_000) {
      const day = arcDay(new Date(t).toISOString(), '2026-10-01', tz, 4);
      if (previous !== 0) expect(day - previous === 0 || day - previous === 1, `${new Date(t).toISOString()}: ${previous} -> ${day}`).toBe(true);
      previous = day;
    }
  });

  it('a night-shift day (boundary 10:00, closing 09:00) puts 08:30 on the previous day and closes at 09:00', () => {
    const tz = 'Asia/Kolkata';
    const morning = fromZonedTime('2026-09-10T08:30:00', tz).toISOString();
    const afterBoundary = fromZonedTime('2026-09-10T10:30:00', tz).toISOString();
    expect(localDate(morning, tz, 10)).toBe('2026-09-09');
    expect(localDate(afterBoundary, tz, 10)).toBe('2026-09-10');
    expect(isDayClosed(morning, config(tz, 10, 9))).toBe(false);
    expect(isDayClosed(fromZonedTime('2026-09-10T09:30:00', tz).toISOString(), config(tz, 10, 9))).toBe(true);
    expect(isDayClosed(afterBoundary, config(tz, 10, 9))).toBe(false);
  });
});
