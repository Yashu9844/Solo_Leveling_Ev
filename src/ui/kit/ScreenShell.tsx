import type { CSSProperties, ReactNode } from 'react';

interface ScreenShellProps {
  children: ReactNode;
  /** Extra classes for the inner column (the "device"). */
  className?: string;
}

/**
 * The frame every screen sits in.
 *
 * On a phone it is simply the viewport: a full-bleed column on the app's
 * own ground. From 640px up it becomes a centred 430px device — which is
 * the entire desktop adaptation (design/00-DESIGN-SYSTEM.md §8 rule 8).
 * `final/06` §6 originally called for a left rail at ≥1024px; that is
 * dropped, because a phone-shaped app stretched across a desktop reads
 * as broken, whereas a framed device reads as deliberate.
 *
 * Uses `dvh`, never `vh` — on mobile `100vh` is taller than the visible
 * viewport while the URL bar is showing, which pushes the bottom nav
 * off-screen exactly when a thumb reaches for it.
 */
export function ScreenShell({ children, className = '' }: ScreenShellProps) {
  // The page ground behind the device. Theme-driven, so it follows the
  // accent rather than being a fixed blue.
  const pageGround: CSSProperties = {
    background: `radial-gradient(1200px 700px at 20% -10%, var(--panel-top) 0%, var(--deep) 60%)`,
  };

  return (
    <div className="flex min-h-dvh w-full justify-center sm:py-8" style={pageGround}>
      <div
        className={[
          // `h-dvh`, not `min-h-dvh`. The column has to be height-bound or
          // a `flex-1 overflow-y-auto` child never gets a scrollable box:
          // the document scrolls instead, and the bottom nav — which is a
          // sibling, not a fixed element — scrolls away with the content.
          'relative flex h-dvh w-full sm:max-w-shell flex-col overflow-hidden bg-void',
          // The device frame — only from 640px up.
          'sm:h-[min(880px,92dvh)] sm:min-h-0 sm:rounded-[40px] sm:border sm:border-hair',
          'sm:shadow-[0_24px_70px_rgba(0,0,0,0.6)]',
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Top spacing that clears a notch or punch-hole.
 *
 * The reference mock draws a fake iOS status bar here (a hardcoded
 * "9:41" with signal and battery glyphs). That is a mockup artefact and
 * must never ship: in an installed PWA the real status bar sits above
 * this, so a painted one would render twice, and on Android it would be
 * wrong in every particular.
 *
 * `min` keeps a little breathing room on devices reporting no inset at
 * all, so the header never sits flush against the top edge.
 */
export function SafeTop({ min = 10 }: { min?: number }) {
  return (
    <div
      aria-hidden
      className="shrink-0"
      style={{ height: `max(env(safe-area-inset-top), ${min}px)` }}
    />
  );
}

/** Bottom spacing that clears a home indicator or gesture bar. */
export function SafeBottom({ min = 0 }: { min?: number }) {
  return (
    <div
      aria-hidden
      className="shrink-0"
      style={{ height: `max(env(safe-area-inset-bottom), ${min}px)` }}
    />
  );
}
