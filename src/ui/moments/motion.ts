/**
 * Whether a Moment should play its reveal, for the Moments alone.
 *
 * The app's motion setting is the first authority and the OS is the
 * fallback, matching how index.css resolves the same three states
 * (design/03 §1): `reduced` is always still, `full` animates even when
 * the OS asks for less, and `system` follows `prefers-reduced-motion`.
 *
 * Moments cannot read this from CSS the way everything else does,
 * because what they suppress is not only animation — it is also the
 * haptic pulse and the phased reveal itself, both of which live in
 * JavaScript. So the setting is read from the same root attribute the
 * stylesheet is keyed off, which keeps one mechanism rather than two.
 *
 * Read at mount and not subscribed to: a Moment lasts under two seconds,
 * and changing the setting mid-celebration is not a case worth code.
 */
export function momentMotionReduced(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true;

  const pref = document.documentElement.dataset.motion;
  if (pref === 'reduced') return true;
  if (pref === 'full') return false;

  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
