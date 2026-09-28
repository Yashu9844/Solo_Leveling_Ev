import type { TransitionEdge } from '../kit';

/** The four peers. Moving between these is lateral, never hierarchical. */
export const TAB_PATHS = ['/today', '/progress', '/skills', '/profile'] as const;

export type TabPath = (typeof TAB_PATHS)[number];

export function isTabPath(pathname: string): pathname is TabPath {
  return (TAB_PATHS as readonly string[]).includes(pathname);
}

/**
 * How deep in the navigation graph a path sits
 * (design/02-NAVIGATION-FLOW.md §1–§3).
 *
 *   0  the boot path — /start, /onboarding
 *   1  a tab root
 *   2+ a child of a tab, e.g. /profile/settings
 */
export function depthOf(pathname: string): number {
  if (pathname === '/start' || pathname.startsWith('/onboarding')) return 0;
  if (isTabPath(pathname)) return 1;
  // '/profile/settings' -> 2, '/profile/settings/theme' -> 3
  const segments = pathname.split('/').filter(Boolean);
  return Math.max(1, segments.length);
}

/**
 * The rule the whole grammar exists to enforce: lateral moves never
 * travel horizontally, hierarchical moves always do. Direction is what
 * tells the user where they are without reading.
 */
export function edgeFor(from: string | null, to: string): TransitionEdge {
  if (from === null) return 'boot';
  if (from === to) return 'lateral';

  const a = depthOf(from);
  const b = depthOf(to);

  // Leaving the boot path for the app proper is the one arrival moment.
  if (a === 0 && b >= 1) return 'boot';
  if (isTabPath(from) && isTabPath(to)) return 'lateral';
  if (b > a) return 'forward';
  if (b < a) return 'back';
  return 'lateral';
}
