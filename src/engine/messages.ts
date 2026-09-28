/**
 * The System Message generator — final/05 §1.1: deterministic templates,
 * ranked by specificity, highest applicable wins.
 *
 *   P1  Personal record / first occurrence
 *   P2  Trend with numbers
 *   P3  Correlation from your own data
 *   P4  Consistency fact
 *   P5  Neutral status
 *
 * P1-P3 originally needed domain data this codebase didn't have yet —
 * first-attempt rate, deep-work minutes, sleep-window hits — all Slice
 * 6-9 territory, which didn't exist at Slice 5. It all exists now, so
 * this is the "later slice" that fills them in: one concrete signal per
 * tier (a new personal-record type is easy to add, but three isn't
 * needed to prove the ranking mechanism works) rather than every
 * example in the brief's table. Real evidence beats exhortation
 * whenever evidence exists (final/05 §1.2) — that's the whole point of
 * ranking these above the reflection library (engine/reflections.ts),
 * which selectMessage never touches: the caller (store/messages.ts)
 * only reaches for a reflection when this returns null, which it never
 * does — P5 is always available. See engine/reflections.ts's own
 * selectReflection for the library side.
 *
 * Rules from final/05 §1.1, enforced by construction: one number-heavy
 * sentence at a time · never comment on a body metric's direction ·
 * never compare to another person · never project forward · never
 * mention an external outcome negatively. None of P1-P5 below touch a
 * body-composition metric, another person, a forecast, or an external
 * career outcome — there is nothing here that could violate any of
 * those even by accident.
 */

export interface DayFacts {
  local_date: string;
  core_completed: number;
  core_total: number;
}

export interface MessageContext {
  today: DayFacts;
  /** Chronological, most recent last, NOT including today. */
  trailingDays: DayFacts[];

  /** P1 — today's longest deep-work block (BUILD/learning-block/system-
   * design minutes), only when it exceeds every prior one. */
  newLongestDeepBlockMinutes?: number;
  /** P1 — true the first time ever an H-difficulty DSA problem is
   * solved first-attempt. */
  firstHardProblemFirstAttempt?: boolean;
  /** P1 — true the first time ever an artifact of kind 'deployment' is
   * logged. */
  firstDeploymentReachable?: boolean;

  /** P2 — Medium-difficulty first-attempt rate, this trailing 14-day
   * window vs the 14 days before that (0-1 each). Only supplied when
   * both windows have enough sample to say something real. */
  firstAttemptRateMTrend?: { current: number; previous: number };
  /** P2 — wake-time standard deviation (minutes), current trailing 28
   * days vs the 28 days before that. */
  wakeSdTrend?: { current: number; fourWeeksAgo: number };

  /** P3 — DSA first-attempt rate on days the SLEEP quest was complete
   * vs days it wasn't, over the arc so far. Only supplied when both
   * buckets have enough sample. */
  dsaFirstAttemptBySleep?: { afterHit: number; afterMiss: number };
}

const CONSISTENCY_WINDOW = 14;
const CONSISTENCY_MIN_HISTORY = 7; // "3 of 3 days" reads as noise, not a fact

/** Pure. Selects the best-available System Message for the given
 * context, highest-specificity tier first. P5 is always available, so
 * this never returns null. */
export function selectMessage(context: MessageContext): string {
  return selectSpecificMessage(context) ?? consistencyFact(context) ?? neutralStatus(context);
}

/**
 * Pure. P1-P3 only — real evidence, never the P4 consistency fact or
 * the always-available P5 neutral status. Returns null when none of
 * P1-P3 apply. Exposed separately from selectMessage because
 * engine/reflections.ts's selection rule needs to know specifically
 * whether real evidence exists (final/05 §1.2: "if a P1/P2/P3 System
 * Message is available, show that instead [of a reflection]") — P4/P5
 * do NOT override a reflection the way P1-P3 do, so the combined
 * decision (store/messages.ts) needs this distinction, not just
 * selectMessage's always-non-null result.
 */
export function selectSpecificMessage(context: MessageContext): string | null {
  return personalRecord(context) ?? trendWithNumbers(context) ?? correlation(context);
}

function personalRecord(context: MessageContext): string | null {
  if (context.firstHardProblemFirstAttempt) return 'First hard problem first-attempt.';
  if (context.newLongestDeepBlockMinutes !== undefined && context.newLongestDeepBlockMinutes > 0) {
    return `Longest deep block yet: ${Math.round(context.newLongestDeepBlockMinutes)} minutes.`;
  }
  if (context.firstDeploymentReachable) return 'First deployment reachable from outside your machine.';
  return null;
}

function trendWithNumbers(context: MessageContext): string | null {
  if (context.firstAttemptRateMTrend) {
    const { current, previous } = context.firstAttemptRateMTrend;
    if (current > previous) {
      return `First-attempt on mediums: ${Math.round(current * 100)}% over 14 days, up from ${Math.round(previous * 100)}%.`;
    }
  }
  if (context.wakeSdTrend) {
    const { current, fourWeeksAgo } = context.wakeSdTrend;
    if (current < fourWeeksAgo) {
      return `Wake SD down to ${Math.round(current)} min. Four weeks ago: ${Math.round(fourWeeksAgo)}.`;
    }
  }
  return null;
}

function correlation(context: MessageContext): string | null {
  if (context.dsaFirstAttemptBySleep) {
    const { afterHit, afterMiss } = context.dsaFirstAttemptBySleep;
    return `DSA first-attempt after a hit sleep window: ${Math.round(afterHit * 100)}%. After a miss: ${Math.round(afterMiss * 100)}%.`;
  }
  return null;
}

function consistencyFact(context: MessageContext): string | null {
  const window = context.trailingDays.slice(-CONSISTENCY_WINDOW);
  if (window.length < CONSISTENCY_MIN_HISTORY) return null;

  const fullDays = window.filter((d) => d.core_total > 0 && d.core_completed === d.core_total).length;
  return `${fullDays} of the last ${window.length} days were fully complete.`;
}

function neutralStatus(context: MessageContext): string {
  return `${context.today.core_completed} of ${context.today.core_total} complete.`;
}
