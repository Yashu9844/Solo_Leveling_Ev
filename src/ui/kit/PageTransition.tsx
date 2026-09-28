import type { ReactNode } from 'react';

/**
 * Which edge of the navigation graph was crossed
 * (design/02-NAVIGATION-FLOW.md §4).
 *
 * The grammar: lateral moves never travel horizontally, hierarchical
 * moves always do. Direction is what tells the user where they are
 * without reading — but it is carried by overlays (sheets springing up,
 * pushed screens sliding in), never by the tab content itself. See the
 * note below.
 */
export type TransitionEdge = 'lateral' | 'forward' | 'back' | 'boot';

/**
 * Route content animates OPACITY ONLY, and with a CSS animation rather
 * than a JavaScript one. Both halves of that were learned from failures.
 *
 * No transform: the first version slid and scaled the entering screen,
 * which cost 597ms against the app's hard 300ms tap-to-XP budget — while
 * a screen is moving its buttons are moving, so the first tap after
 * arriving has to wait out the animation.
 *
 * No JS driver: the second version faded with framer-motion, and a
 * screen entering while requestAnimationFrame is starved stays at
 * opacity 0 indefinitely. That was caught with Playwright's clock
 * frozen, which is not a real user — but it proves the content's
 * visibility depended on an animation running, and `final/06` §4.3 is
 * explicit that nothing functional may depend on animation. A dropped
 * frame budget or a backgrounded tab should never be able to render a
 * screen invisible.
 *
 * A CSS animation cannot fail that way: `animation-fill-mode: both`
 * settles on the final frame, and the reduced-motion rule in index.css
 * collapses the duration to nothing, which resolves it immediately
 * rather than skipping it.
 */
const DURATION: Record<TransitionEdge, string> = {
  lateral: '180ms',
  forward: '220ms',
  back: '180ms',
  // The one arrival moment, and still the slowest.
  boot: '320ms',
};

interface PageTransitionProps {
  children: ReactNode;
  edge?: TransitionEdge;
  className?: string;
}

export function PageTransition({ children, edge = 'lateral', className = '' }: PageTransitionProps) {
  return (
    <div
      className={['flex min-h-0 flex-1 flex-col', className].join(' ')}
      style={{
        animation: `route-in ${DURATION[edge]} cubic-bezier(0.22, 1, 0.36, 1) both`,
      }}
    >
      {children}
    </div>
  );
}
