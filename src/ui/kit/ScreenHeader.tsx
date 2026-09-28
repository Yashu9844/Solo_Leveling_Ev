import { CaretLeft } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  /**
   * The screen's name. Rendered as the page's `h1`.
   *
   * For the four tabs this string is frozen by the test contract
   * (design/00-DESIGN-SYSTEM.md §10): smoke.spec.ts asserts a heading
   * named TODAY / PROGRESS / SKILLS / PROFILE matching each nav link.
   */
  title: string;
  /** Optional trailing control — an icon button, a segmented switch. */
  right?: ReactNode;
  /** Renders a leading back button. Child routes (Settings and its
   * pickers) need a visible way up that is not the system gesture —
   * design/02 §5 keeps back working, but a route the user pushed by
   * tapping should also be leavable by tapping. */
  onBack?: () => void;
  /** Hide the title visually but keep it for assistive tech and tests.
   * For screens where art carries the name (Splash, Start, Moments). */
  visuallyHidden?: boolean;
  className?: string;
}

/**
 * Every screen's top bar: the name in accent, an optional control, and a
 * rule that fades to transparent at both ends.
 *
 * That fading rule is doing real work — a full-width 1px line would box
 * the content in and fight the full-bleed art behind it. Fading at the
 * ends lets the header sit *on* the screen rather than on a strip.
 */
export function ScreenHeader({
  title,
  right,
  onBack,
  visuallyHidden = false,
  className = '',
}: ScreenHeaderProps) {
  // A hidden title with nothing beside it means the screen has no header
  // chrome at all — rendering the padding and rule anyway would cost
  // vertical space for an invisible element. Today depends on this:
  // final/06 §5.2 requires all six core quests above the fold on a 6"
  // Android screen, and that is the constraint capping the core set at
  // six. Its identity line (DAY n · LEVEL n · RANK X) is the header.
  if (visuallyHidden && !right && !onBack) {
    return <h1 className="sr-only">{title}</h1>;
  }

  return (
    <div className={['relative shrink-0', className].join(' ')}>
      <div className="flex items-center gap-2 px-gutter pt-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 flex min-h-tap min-w-[44px] items-center justify-center text-ink-500"
          >
            <CaretLeft size={18} aria-hidden />
          </button>
        )}
        <h1 className={visuallyHidden ? 'sr-only' : 'min-w-0 flex-1 truncate text-h1 text-accent-mid'}>
          {title}
        </h1>
        {right}
      </div>
      <div className="hairline mx-gutter mt-3" aria-hidden />
    </div>
  );
}

interface ScreenTitleProps {
  /** Frozen for the four tabs by design/00 §10 — TODAY / PROGRESS /
   * SKILLS / PROFILE, each matching its nav link. */
  title: string;
  /**
   * One live value, right-aligned. The *only* other thing allowed on
   * this row, and it must be real: a count that changes, a day that
   * advances. Not a tagline, not a hardcoded rank, not a slogan.
   */
  meta?: ReactNode;
  /** Today only. final/06 §5.2 requires all six core quests above the
   * fold on a 6" Android screen, so its title runs a step smaller. */
  compact?: boolean;
  className?: string;
}

/**
 * The header every tab screen wears.
 *
 * Three rules, and they are the whole design:
 *
 * 1. **One line.** Each screen had grown an eyebrow, a title and a
 *    tagline that all said the same thing — `SYSTEM HUD // PLAYER
 *    RECORD` over `PROFILE` over `PLAYER IDENTITY & SYSTEM RECORD`.
 *    Three labels is not three times the information, it is a third of
 *    the confidence. The name of the screen is the name of the screen.
 *
 * 2. **The title does not glow.** Glow is how this app marks something
 *    that just *happened* — a level gained, a day cleared. Chrome that
 *    glows permanently spends that signal on furniture and leaves
 *    nothing for the moments. The accent tick carries the light here;
 *    the word stays plain ink.
 *
 * 3. **The right side is earned.** A hardcoded `S-RANK PLAYER` badge is
 *    a lie told to a user on day one, and the System's whole authority
 *    rests on it never flattering anybody.
 *
 * The fading rule is load-bearing: a full-width line would box the
 * header into a strip and fight the full-bleed art behind it. Seeded in
 * accent at the title and fading out, it reads as a system trace.
 */
export function ScreenTitle({ title, meta, compact = false, className = '' }: ScreenTitleProps) {
  return (
    <div className={['flex items-center gap-3', className].join(' ')}>
      <span
        aria-hidden
        className={[
          'shrink-0 bg-accent-mid',
          compact ? 'h-[15px] w-[2px]' : 'h-[19px] w-[2px]',
        ].join(' ')}
        style={{ boxShadow: '0 0 7px var(--accent-mid)' }}
      />
      <h1
        className={[
          'shrink-0 font-display leading-none tracking-[0.18em] text-ink-100',
          compact ? 'text-lg' : 'text-2xl',
        ].join(' ')}
      >
        {title}
      </h1>
      {/* min-w-0 so the rule yields before anything with words in it. */}
      <span
        aria-hidden
        className="h-px min-w-0 flex-1 bg-gradient-to-r from-accent-mid/40 via-hair to-transparent"
      />
      {meta && <span className="shrink-0 leading-none">{meta}</span>}
    </div>
  );
}

/** The `DAY 07 / 120` counter that three screens carry. Renders nothing
 * until the real day is known — the placeholder `07` these screens used
 * to print while loading was indistinguishable from a true day 7. */
export function DayMeta({ day, of }: { day: number | null; of: number }) {
  if (day == null) return null;
  return (
    <span className="font-mono text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-ink-700">
      DAY <span className="text-accent-mid">{String(day).padStart(2, '0')}</span> / {of}
    </span>
  );
}

interface SectionLabelProps {
  children: ReactNode;
  /** Extends a hairline from the label to the right edge. */
  rule?: boolean;
  className?: string;
}

/**
 * The uppercase, wide-tracked label that opens a block — TODAY'S QUESTS,
 * MIND, THIS WEEK. Tracking is the signature of this design; at 0.16em
 * these read as system labels rather than as headings.
 */
export function SectionLabel({ children, rule = false, className = '' }: SectionLabelProps) {
  return (
    <div className={['flex items-center gap-3', className].join(' ')}>
      {/* min-w-0, not shrink-0. A label that cannot shrink also cannot
          wrap, and "INTERVIEW-READINESS BENCHMARK" in tracked uppercase
          is wider than a 320px screen at text scale XL — it pushed the
          whole Skills column 16px past the viewport. It wraps now, and
          the rule takes whatever is left beside the last line. */}
      <span className="min-w-0 text-xxs uppercase text-ink-700">{children}</span>
      {rule && <span className="hairline min-w-0 flex-1" aria-hidden />}
    </div>
  );
}
