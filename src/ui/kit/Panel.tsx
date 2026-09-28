import type { CSSProperties, ReactNode } from 'react';

export type CutSize = 'sm' | 'md' | 'lg' | 'none';

const CUT_CLASS: Record<CutSize, string> = {
  sm: 'cut-sm',
  md: 'cut-md',
  lg: 'cut-lg',
  none: 'rounded-md',
};

interface PanelProps {
  children: ReactNode;
  cut?: CutSize;
  /** Raised fill, for a pressed or emphasised card. */
  raised?: boolean;
  /** Drops the border entirely — for a panel sitting on top of art. */
  borderless?: boolean;
  /**
   * Lands on the OUTER element: margins, width, alignment — anything
   * that positions the card in its parent.
   *
   * This split is not cosmetic. The border is a second element wrapped
   * around the content, so a margin passed to the inner one opens a gap
   * *inside* the card and closes the gap between cards, and a max-width
   * there leaves the border colour showing as a band around the
   * content. Both happened before this was split.
   */
  className?: string;
  /** Lands on the INNER element: padding, flex, text — the card's own
   * contents. */
  bodyClassName?: string;
  style?: CSSProperties;
}

/**
 * The card.
 *
 * A bevel off two opposite corners is the reference's signature shape,
 * and it is drawn with `clip-path` rather than `border-radius` because
 * the cut has to read as machined, not soft.
 *
 * The catch: `clip-path` clips the border too, so a plain
 * `border + clip-path` leaves the two diagonal edges bare — the corners
 * look chewed rather than cut. So the border is drawn as a second layer:
 * an outer element filled with the hairline colour, clipped, with 1px of
 * padding, and an inner element filled with the surface colour, clipped
 * again. The 1px of outer colour showing through IS the border, and it
 * follows the bevel exactly.
 */
export function Panel({
  children,
  cut = 'sm',
  raised = false,
  borderless = false,
  className = '',
  bodyClassName = '',
  style,
}: PanelProps) {
  const shape = CUT_CLASS[cut];
  const fill = raised ? 'var(--surface-2)' : 'var(--surface)';

  if (borderless) {
    return (
      <div
        className={[shape, className, bodyClassName].join(' ')}
        style={{ background: fill, ...style }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={[shape, className].join(' ')}
      style={{ background: 'var(--hair)', padding: 1, ...style }}
    >
      <div className={[shape, 'h-full w-full', bodyClassName].join(' ')} style={{ background: fill }}>
        {children}
      </div>
    </div>
  );
}

const CORNERS = [
  'left-0 top-0 border-l-2 border-t-2',
  'right-0 top-0 border-r-2 border-t-2',
  'left-0 bottom-0 border-b-2 border-l-2',
  'right-0 bottom-0 border-b-2 border-r-2',
] as const;

interface FramedPanelProps {
  children: ReactNode;
  /** Gold for evidence surfaces, boss for BOSS. Default is the accent. */
  tone?: 'accent' | 'dawn' | 'boss';
  /** Corner bracket arm length. */
  bracket?: number;
  className?: string;
}

/**
 * Ceremony only: Moments, the checkpoint report, the quote hero.
 *
 * Square corners with four bracket arms and an inset glow — the
 * "targeting reticle" frame the reference uses for its most important
 * panels. It is deliberately scarce; if every card were framed, a frame
 * would stop meaning anything.
 */
export function FramedPanel({
  children,
  tone = 'accent',
  bracket = 20,
  className = '',
}: FramedPanelProps) {
  const colour =
    tone === 'dawn' ? 'var(--dawn)' : tone === 'boss' ? 'var(--boss)' : 'var(--accent)';
  const soft =
    tone === 'dawn'
      ? 'rgba(232,161,60,0.14)'
      : tone === 'boss'
        ? 'rgba(255,77,109,0.14)'
        : 'rgba(77,163,255,0.14)';

  return (
    <div
      className={['relative', className].join(' ')}
      style={{
        border: `1px solid ${colour}`,
        background: 'linear-gradient(180deg, var(--surface) 0%, var(--panel-bot) 100%)',
        boxShadow: `inset 0 0 40px ${soft}, var(--glow-md)`,
      }}
    >
      {CORNERS.map((c) => (
        <div
          key={c}
          aria-hidden
          className={`pointer-events-none absolute ${c}`}
          style={{ width: bracket, height: bracket, borderColor: colour }}
        />
      ))}
      {children}
    </div>
  );
}
