import { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageTransition, SafeTop, ScreenShell } from './kit';
import { MonarchRail } from './nav/MonarchRail';
import { useTransitionEdge } from './routing/useTransitionEdge';

export function AppShell() {
  const { pathname } = useLocation();
  const edge = useTransitionEdge();
  const scroller = useRef<HTMLElement>(null);

  // Each tab keeps its own scroll position. Without this, switching from
  // a scrolled Profile to Today would land mid-page on a screen the user
  // has not scrolled — the container persists across route changes, so
  // its scrollTop has to be managed explicitly.
  const positions = useRef<Record<string, number>>({});
  const currentPath = useRef(pathname);
  /** Suppresses saving while we are the ones moving the scroller. */
  const restoring = useRef(false);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const target = positions.current[pathname] ?? 0;
    currentPath.current = pathname;
    restoring.current = true;
    el.scrollTop = target;

    if (target === 0 || el.scrollTop === target) {
      restoring.current = false;
      return;
    }

    // Every screen here loads from IndexedDB, so on mount it is short and
    // a restore clamps to 0 — the position is only reachable once the
    // content has arrived. Re-apply as the screen grows, and give up
    // after a second rather than fighting a page that never gets tall
    // enough (which is the correct outcome when data has shrunk).
    const observed = el.firstElementChild ?? el;
    const settle = new ResizeObserver(() => {
      el.scrollTop = target;
      if (el.scrollTop === target) {
        restoring.current = false;
        settle.disconnect();
      }
    });
    settle.observe(observed);

    const giveUp = setTimeout(() => {
      restoring.current = false;
      settle.disconnect();
    }, 1000);

    return () => {
      clearTimeout(giveUp);
      settle.disconnect();
      restoring.current = false;
    };
  }, [pathname]);

  function rememberScroll() {
    if (restoring.current) return;
    const el = scroller.current;
    if (el) positions.current[currentPath.current] = el.scrollTop;
  }

  /** Tapping the tab you are already on returns you to the top — the
   * convention every phone app shares, and the fastest way back to the
   * quest list from the bottom of Today. */
  function handleTabClick(to: string) {
    if (to !== pathname) return;
    positions.current[to] = 0;
    scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <ScreenShell>
      {/* Outside <main> so it never scrolls away — a notch does not
          move when the content does. */}
      <SafeTop />

      {/*
        `relative z-10` on main and `z-0` on the nav is what keeps a
        full-screen overlay — a log sheet, the evening review, a Moment —
        above the bottom navigation.
      */}
      <main
        ref={scroller}
        onScroll={rememberScroll}
        className="no-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto"
      >
        <PageTransition key={pathname} edge={edge}>
          <Outlet />
        </PageTransition>
      </main>

      <MonarchRail pathname={pathname} onTabClick={handleTabClick} />
    </ScreenShell>
  );
}
