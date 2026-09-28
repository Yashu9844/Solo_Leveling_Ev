/**
 * The System's voice — the engine half.
 *
 * design/04-SYSTEM-MESSAGE-ENGINE.md. Pure: no clock, no Dexie, no
 * randomness. Everything here is a function of the context the store
 * layer hands it, which is itself derived entirely from state the
 * existing engines already produce (day_rollup, player_state, streak,
 * recovery, the event log). Nothing in this file re-derives a domain
 * fact — if it looks like business logic, it is a read.
 *
 * This is deliberately a *different register* from engine/messages.ts
 * and engine/reflections.ts, not a replacement for either:
 *
 *   engine/messages.ts    evidence with numbers, drawn from your own data
 *   engine/reflections.ts a library of things worth thinking about
 *   this file             the System stating your current condition
 *
 * The first two speak in sentences. This one does not: it reports, in
 * capitals, in one clause, and then stops. See §25 of the design doc for
 * the voice rules and what they exist to prevent.
 */
import type { EventType, Rank } from './types';

/* ══════════════════════════════════════════════════════════════════════
 * Taxonomy
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Where the IST wall clock is in the day.
 *
 * MORNING starts at the arc's own 04:00 boundary rather than at some
 * separate "morning" constant, so the first minute of a new day is read
 * as a new day. CLOSED is not a clock window at all — isDayClosed() owns
 * it (engine/time.ts), so there is exactly one definition of a closed
 * day in the codebase.
 */
export type DayPhase = 'MORNING' | 'MIDDAY' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'CLOSED';

/** How far into the day's requirement the Player is. See bandFor(). */
export type ProgressBand =
  | 'ZERO'
  | 'STARTED'
  | 'BUILDING'
  | 'HALFWAY'
  | 'ADVANCING'
  | 'NEAR_CLEAR'
  | 'CLEARED';

/** Resolution order, highest first. First non-empty tier wins. */
export type MessageTier =
  | 'EXCEPTION'
  | 'EVENT'
  | 'RECOVERY'
  | 'CLEARED'
  | 'MILESTONE'
  | 'PROGRESS'
  | 'DEFAULT';

/**
 * Drives the surface's colour, which is a meaning decision rather than a
 * decorative one: design/00 §2 reserves gold for evidence and red for
 * BOSS, so `verdict` and `threat` are the only tones that may leave the
 * blue mood.
 */
export type MessageTone =
  | 'awakening'
  | 'neutral'
  | 'pressure'
  | 'momentum'
  | 'closing'
  | 'verdict'
  | 'threat'
  | 'restraint';

export const TIER_ORDER: readonly MessageTier[] = [
  'EXCEPTION',
  'EVENT',
  'RECOVERY',
  'CLEARED',
  'MILESTONE',
  'PROGRESS',
  'DEFAULT',
];

/* ══════════════════════════════════════════════════════════════════════
 * The message
 * ════════════════════════════════════════════════════════════════════ */

export interface SystemMessage {
  /** Stable across releases — it is the key of the show-state row. */
  id: string;
  /** The line. Capitals, one or two clauses, always ends in a full stop. */
  text: string;
  tier: MessageTier;
  /** The ⟨ … ⟩ label above the line. The System naming what it is reporting on. */
  label: string;
  tone: MessageTone;
  /** Omitted = eligible in every phase. */
  phases?: DayPhase[];
  /** Omitted = eligible in every band. */
  bands?: ProgressBand[];
  /** Extra guard, for tiers whose trigger is a fact rather than a cell. */
  when?: (ctx: SystemMessageContext) => boolean;
  minStreak?: number;
  minArcDay?: number;
  /** Days before this line may be shown again. Default DEFAULT_COOLDOWN. */
  cooldownDays?: number;
  /** Authoring preference only — never a measured score. Default 1. */
  weight?: number;
}

export const DEFAULT_COOLDOWN = 9;

/* ══════════════════════════════════════════════════════════════════════
 * Context
 * ════════════════════════════════════════════════════════════════════ */

export interface SystemMessageContext {
  /** The 04:00-boundary local date. Never the raw calendar date. */
  localDate: string;
  arcDay: number;
  /** IST wall clock as minutes since midnight, 0–1439. */
  minutesOfDay: number;
  phase: DayPhase;
  dayClosed: boolean;
  arcState: 'before' | 'active' | 'after';

  xpEarned: number;
  /** Σ config.coreQuests[*].xp — derived, never hard-coded. */
  xpTarget: number;
  /** 0–100, clamped. */
  progressPct: number;
  band: ProgressBand;
  coreCompleted: number;
  coreTotal: number;
  /** Exactly one core quest cleared — the day's first real action. */
  firstActionOfDay: boolean;

  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  rank: Rank;
  streak: number;
  consistency7: number;

  reducedMode: boolean;
  recoveryAvailable: boolean;
  mvdMet: boolean;

  /** Days until the next checkpoint (14/30/60/90/120), or null past the last. */
  daysToCheckpoint: number | null;
  /** Event types written under today's local_date. */
  eventsToday: EventType[];
  /** Whether a level boundary was crossed by today's XP. */
  leveledUpToday: boolean;
  yesterdayCleared: boolean | null;
  /** Gap since the previous APP_OPENED, or null on the first ever open. */
  daysSinceLastOpen: number | null;
}

export interface ShowState {
  times_shown: number;
  last_shown_date?: string;
}

export interface Selection {
  message: SystemMessage;
  tier: MessageTier;
  fingerprint: string;
}

/* ══════════════════════════════════════════════════════════════════════
 * Derivations
 * ════════════════════════════════════════════════════════════════════ */

/** Minute-of-day boundaries. CLOSED is decided by the caller, not here. */
const PHASE_BOUNDS: { phase: DayPhase; from: number; to: number }[] = [
  { phase: 'MORNING', from: 4 * 60, to: 11 * 60 },
  { phase: 'MIDDAY', from: 11 * 60, to: 14 * 60 },
  { phase: 'AFTERNOON', from: 14 * 60, to: 18 * 60 },
  { phase: 'EVENING', from: 18 * 60, to: 22 * 60 },
];

/**
 * The phase for an IST minute-of-day.
 *
 * `dayClosed` wins outright: between dayCloseHour and the next boundary
 * nothing can be logged, so no amount of clock-reading should produce an
 * urgency message. Everything outside the four windows above is NIGHT —
 * which is 22:00 through the close hour, and (on a config whose close
 * hour is earlier than 04:00) the small hours before the boundary too.
 */
export function phaseFor(minutesOfDay: number, dayClosed: boolean): DayPhase {
  if (dayClosed) return 'CLOSED';
  const hit = PHASE_BOUNDS.find((b) => minutesOfDay >= b.from && minutesOfDay < b.to);
  return hit ? hit.phase : 'NIGHT';
}

/**
 * The band for a percentage.
 *
 * CLEARED is quest truth, not XP truth: bonus grants can carry a day past
 * its 500 without every core quest being cleared, and the System must
 * never announce a clear the quest engine has not granted.
 */
export function bandFor(progressPct: number, coreCompleted: number, coreTotal: number): ProgressBand {
  if (coreTotal > 0 && coreCompleted >= coreTotal) return 'CLEARED';
  if (progressPct <= 0) return 'ZERO';
  if (progressPct < 21) return 'STARTED';
  if (progressPct < 50) return 'BUILDING';
  if (progressPct < 65) return 'HALFWAY';
  if (progressPct < 80) return 'ADVANCING';
  return 'NEAR_CLEAR';
}

/** The streak bucket the fingerprint uses — milestones, not raw counts. */
export function streakBucket(streak: number): string {
  if (streak >= 30) return '30+';
  if (streak >= 14) return '14+';
  if (streak >= 7) return '7+';
  if (streak >= 3) return '3+';
  return String(streak);
}

/**
 * The identity of a *state*, not of a moment.
 *
 * Two opens that produce the same fingerprint get the same message — that
 * is what makes a refresh, a re-render and a round trip through another
 * tab leave the decree untouched. Crossing a band, a phase or a flag
 * produces a new fingerprint, and the System speaks again.
 */
export function fingerprintFor(ctx: SystemMessageContext, tier: MessageTier): string {
  const flags = [
    ctx.reducedMode ? 'R' : '',
    ctx.recoveryAvailable ? 'V' : '',
    ctx.leveledUpToday ? 'L' : '',
    ctx.firstActionOfDay ? 'F' : '',
    ctx.dayClosed ? 'C' : '',
  ].join('');
  return [tier, ctx.phase, ctx.band, streakBucket(ctx.streak), flags || '-', ctx.arcState].join('|');
}

/* ══════════════════════════════════════════════════════════════════════
 * Tier resolution
 * ════════════════════════════════════════════════════════════════════ */

/** Event types that mean something irreversible happened today. */
const IRREVERSIBLE: readonly EventType[] = [
  'BOSS_CLEARED',
  'CHECKPOINT_SEALED',
  'WEEKLY_QUEST_COMPLETED',
];

/**
 * Which tier is allowed to speak, given the state.
 *
 * Two rules here are judgement rather than mechanism, and both are in the
 * design doc §9:
 *
 *  - RECOVERY frames an unfinished day. A Reduced Mode day that is
 *    nonetheless cleared gets the clear — CLEARED is tested first.
 *  - MILESTONE never fires at ZERO. "THE NEXT THRESHOLD IS WITHIN REACH"
 *    on an untouched afternoon is the System bragging on the Player's
 *    behalf, and it is the fastest way to make every other line cheap.
 */
export function tierFor(ctx: SystemMessageContext): MessageTier {
  if (ctx.dayClosed || ctx.arcState !== 'active') return 'EXCEPTION';
  if (ctx.leveledUpToday || ctx.eventsToday.some((t) => IRREVERSIBLE.includes(t))) return 'EVENT';
  if (ctx.band === 'CLEARED') return 'CLEARED';
  if (ctx.reducedMode || ctx.recoveryAvailable || (ctx.daysSinceLastOpen ?? 0) >= 2) return 'RECOVERY';
  if (ctx.band !== 'ZERO' && milestoneReached(ctx)) return 'MILESTONE';
  return 'PROGRESS';
}

/** Whether any MILESTONE trigger is live. Mirrors the tier's `when` guards. */
function milestoneReached(ctx: SystemMessageContext): boolean {
  if ([3, 7, 14, 30].includes(ctx.streak)) return true;
  if (ctx.daysToCheckpoint !== null && ctx.daysToCheckpoint <= 2) return true;
  if (ctx.xpForNext - ctx.xpIntoLevel <= 60) return true;
  return false;
}

/* ══════════════════════════════════════════════════════════════════════
 * Selection
 * ════════════════════════════════════════════════════════════════════ */

/** FNV-1a. A hash, not a random number: same inputs, same order, forever. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function daysBetween(fromDate: string | undefined, toDate: string): number {
  if (!fromDate) return Number.POSITIVE_INFINITY;
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.round((to - from) / 86_400_000);
}

function eligible(message: SystemMessage, ctx: SystemMessageContext, tier: MessageTier): boolean {
  if (message.tier !== tier) return false;
  if (message.phases && !message.phases.includes(ctx.phase)) return false;
  if (message.bands && !message.bands.includes(ctx.band)) return false;
  if (message.minStreak !== undefined && ctx.streak < message.minStreak) return false;
  if (message.minArcDay !== undefined && ctx.arcDay < message.minArcDay) return false;
  if (message.when && !message.when(ctx)) return false;
  return true;
}

/**
 * Pick the line.
 *
 * Ranking is least-shown first, then authoring weight, then a day-seeded
 * hash. The hash is the whole anti-repetition trick: it is deterministic
 * (the same day in the same state always yields the same line, so a
 * reload cannot reshuffle the System's mind) while reordering the pool
 * across days, so a fresh install does not walk the library in id order.
 *
 * Cooldown *yields* rather than starves — if every line in a tier is
 * inside its cooldown the full pool comes back, because a slightly early
 * repeat is better than the System saying something untrue about the
 * Player's state. For the same reason this never returns null: the
 * DEFAULT tier is unconditioned and always has candidates.
 */
export function selectSystemMessage(
  library: SystemMessage[],
  ctx: SystemMessageContext,
  history: Map<string, ShowState>
): Selection {
  const startTier = tierFor(ctx);
  const fingerprint = fingerprintFor(ctx, startTier);
  const order = TIER_ORDER.slice(TIER_ORDER.indexOf(startTier));

  for (const tier of order) {
    const pool = library.filter((m) => eligible(m, ctx, tier));
    if (pool.length === 0) continue;

    const fresh = pool.filter(
      (m) =>
        daysBetween(history.get(m.id)?.last_shown_date, ctx.localDate) >=
        (m.cooldownDays ?? DEFAULT_COOLDOWN)
    );
    const candidates = fresh.length > 0 ? fresh : pool;

    const winner = candidates.reduce((best, candidate) => {
      const bestShown = history.get(best.id)?.times_shown ?? 0;
      const candidateShown = history.get(candidate.id)?.times_shown ?? 0;
      if (candidateShown !== bestShown) return candidateShown < bestShown ? candidate : best;

      const bestWeight = best.weight ?? 1;
      const candidateWeight = candidate.weight ?? 1;
      if (candidateWeight !== bestWeight) return candidateWeight > bestWeight ? candidate : best;

      const seed = `${ctx.localDate}|${fingerprint}|`;
      return fnv1a(seed + candidate.id) < fnv1a(seed + best.id) ? candidate : best;
    });

    return { message: winner, tier, fingerprint };
  }

  // Unreachable: the DEFAULT tier carries unconditioned lines. Kept so the
  // function is total rather than relying on the library staying correct.
  throw new Error('voice pack has no DEFAULT-tier message');
}
