import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into <body>.
 *
 * Anything full-screen has to escape the screen that opened it. Route
 * content sits under a wrapper with a CSS animation, which creates a
 * stacking context that `position: fixed` cannot break out of — so an
 * overlay left in place paints inside the screen's layer and loses to
 * anything painted later, including the bottom nav and any portalled
 * sheet above it.
 *
 * A Moment triggered from inside a log sheet is the case that proved it:
 * the sheet portals to <body>, the Moment did not, and the sheet ended
 * up on top of the celebration it had just fired.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
