import type { ReactNode } from 'react';

interface QuoteCardProps {
  children: ReactNode;
  /** Shows the "— SYSTEM" attribution beneath the line. */
  attributed?: boolean;
  className?: string;
}

/**
 * A line the app says to you, set in the display serif.
 *
 * Content comes from the existing `engine/messages.ts` and
 * `engine/reflections.ts` pools — never a new hardcoded list. The app
 * already has a curated voice and this is a frame for it, not a source.
 *
 * Where it may NOT appear (design/00-DESIGN-SYSTEM.md §7): the quest
 * sheet, and any failure or recovery surface. `final/06` §5.3 is
 * explicit that competence evidence outperforms encouragement at the
 * point of action, and a quote on a missed day reads as a taunt.
 */
export function QuoteCard({ children, attributed = false, className = '' }: QuoteCardProps) {
  return (
    <div
      className={['cut-sm px-5 py-4 text-center', className].join(' ')}
      style={{
        border: '1px solid var(--hair)',
        background: 'color-mix(in srgb, var(--surface) 70%, transparent)',
      }}
    >
      <p className="font-display text-[calc(15px*var(--type-scale))] leading-[1.55] text-ink-700">
        {children}
      </p>
      {attributed && (
        <p className="mt-3 text-micro uppercase text-faint">&mdash; SYSTEM</p>
      )}
    </div>
  );
}
