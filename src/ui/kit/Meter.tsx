import type { Icon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface MeterBarProps {
  /** 0–100. Clamped, so a caller's rounding can never overflow the track. */
  pct: number;
  height?: number;
  /** Lands on the fill element — `xp-bar-fill` is frozen by the test
   * contract (design/00-DESIGN-SYSTEM.md §10). */
  testId?: string;
  label?: string;
  tone?: 'accent' | 'dawn';
  className?: string;
}

/**
 * The XP / progress bar.
 *
 * Animated with a CSS transition rather than framer-motion, deliberately.
 * The e2e suite reads this element's inline `style` and parses
 * `width: N%` out of it, so the width has to be a plain percentage
 * present from first paint. A JS animation would interpolate through
 * pixel values and intermittently publish a style the assertion cannot
 * parse. A width transition is also simply the right tool: no JS, no
 * frame cost, and `prefers-reduced-motion` already neutralises it
 * through index.css.
 */
export function MeterBar({
  pct,
  height = 7,
  testId,
  label,
  tone = 'accent',
  className = '',
}: MeterBarProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const from = tone === 'dawn' ? 'var(--dawn-deep)' : 'var(--accent-deep)';
  const to = tone === 'dawn' ? 'var(--dawn-bright)' : 'var(--accent-soft)';

  return (
    <div
      className={['w-full overflow-hidden rounded-pill', className].join(' ')}
      style={{ height, background: 'var(--fill-faint)' }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        data-testid={testId}
        className="h-full rounded-pill transition-[width] duration-500 ease-out"
        style={{
          width: `${clamped}%`,
          background: `linear-gradient(90deg, ${from}, ${to})`,
          boxShadow: 'var(--glow-sm)',
        }}
      />
    </div>
  );
}

/** The five mastery states, in order. `final/03` §1: a 5-segment bar,
 * never a percentage — mastery is ordinal, and a percentage would imply
 * a precision the underlying model does not have. */
export const MASTERY_SEGMENTS = 5;

interface SegmentBarProps {
  /** How many segments are filled, 0–5. */
  filled: number;
  total?: number;
  /** The state's name, e.g. "fluent" — this is what a screen reader
   * announces, since the segments carry no text. */
  label: string;
  className?: string;
}

export function SegmentBar({
  filled,
  total = MASTERY_SEGMENTS,
  label,
  className = '',
}: SegmentBarProps) {
  return (
    <div className={['flex gap-1', className].join(' ')} role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-1.5 w-4 rounded-pill transition-colors duration-300"
          style={{
            background: i < filled ? 'var(--accent)' : 'var(--surface-2)',
            boxShadow: i < filled ? 'var(--glow-sm)' : 'none',
          }}
        />
      ))}
    </div>
  );
}

interface StatTileProps {
  icon?: Icon;
  value: ReactNode;
  label: string;
  className?: string;
}

/** A single number worth looking at: glyph, mono value, quiet label. */
export function StatTile({ icon: Glyph, value, label, className = '' }: StatTileProps) {
  return (
    <div
      className={['cut-sm flex flex-col gap-2 px-4 py-4', className].join(' ')}
      style={{ border: '1px solid var(--hair)', background: 'var(--surface)' }}
    >
      {Glyph && <Glyph size={18} color="var(--accent-bright)" aria-hidden />}
      <div className="font-mono text-xl tabular-nums text-ink-100">{value}</div>
      <div className="text-xs text-ink-900">{label}</div>
    </div>
  );
}
