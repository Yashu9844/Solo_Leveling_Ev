// The device's timezone, for a NEW arc (platform/05 loop 1.5). Reads the
// ambient environment, so it lives here rather than in engine/. An
// existing arc never re-detects: its timezone is fixed at creation and
// read from the arc row (store/engineConfig.ts).
import { canonicalTimeZone, isValidTimeZone } from '../../engine/time';

/** The device's IANA zone, canonicalised; `fallback` if the runtime
 * reports nothing usable. */
export function detectTimeZone(fallback: string): string {
  let detected: string | undefined;
  try {
    detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    detected = undefined;
  }
  if (detected && isValidTimeZone(detected)) return canonicalTimeZone(detected);
  return fallback;
}
