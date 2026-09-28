import { useEffect, useState } from 'react';
import { realDeps } from '../../store/deps';

export interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  /** Total seconds left, 0 once the window has closed. */
  totalSeconds: number;
  /** `hh:mm:ss`, zero-padded, for the mono readout. */
  formatted: string;
  /** Under three hours — the point at which the day stops being
   * theoretical. Callers use this to shift to amber. */
  urgent: boolean;
  expired: boolean;
}

const URGENT_THRESHOLD_SECONDS = 3 * 60 * 60;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * How long is left in the day, against the arc's own close hour.
 *
 * The app has always known the day ends at `dayCloseHour` — it gates
 * logging on it and renders a banner after the fact — but it never told
 * the user while there was still time to act. That asymmetry is the
 * reason the screen looks identical at 9am and 9pm: nothing on it is
 * ever running out.
 *
 * Counts to the *next* occurrence of the close hour in the arc's own
 * timezone, so it stays correct across midnight and after the 04:00
 * rollover. Ticks once a second, and only while the tab is visible —
 * a countdown in a backgrounded tab is a wakelock nobody asked for, and
 * the value is recomputed from the clock on return rather than
 * accumulated, so it cannot drift.
 */
export function useCountdown(closeHour: number, timezone: string): Countdown {
  // realDeps.now() is an ISO string (EngineDeps.now), not a Date.
  const [now, setNow] = useState<string>(() => realDeps.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    function start() {
      stop();
      setNow(realDeps.now());
      timer = setInterval(() => setNow(realDeps.now()), 1000);
    }
    function stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') start();
      else stop();
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return countdownTo(new Date(now), closeHour, timezone);
}

/**
 * Pure, so the arithmetic is testable without a timer or a DOM.
 *
 * Reads the current wall-clock hour in the arc's timezone rather than
 * the host's — the arc is defined in Asia/Kolkata and a user in another
 * zone must still see that day's remaining time, not their own.
 */
export function countdownTo(now: Date, closeHour: number, timezone: string): Countdown {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // Intl renders midnight as 24 in some engines; normalise it.
  const h = get('hour') % 24;
  const m = get('minute');
  const sec = get('second');

  const secondsNow = h * 3600 + m * 60 + sec;
  const secondsClose = closeHour * 3600;

  let remaining = secondsClose - secondsNow;
  if (remaining <= 0) remaining += 24 * 3600;

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds: remaining,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    urgent: remaining <= URGENT_THRESHOLD_SECONDS,
    expired: remaining === 0,
  };
}
