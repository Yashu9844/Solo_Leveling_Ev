import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

interface Entry {
  id: string;
  close: () => void;
}

interface OverlayStackValue {
  push: (entry: Entry) => void;
  remove: (id: string) => void;
}

const OverlayStackContext = createContext<OverlayStackValue | null>(null);

/**
 * One owner for the back gesture's relationship to overlays.
 *
 * In an installed PWA back is the primary way out of anything, and the
 * default is wrong: with a sheet open, back leaves the screen entirely
 * and the sheet is still there when you return. design/02-NAVIGATION-FLOW.md
 * §5 makes fixing that explicit.
 *
 * ── Why this never calls history.back() ──────────────────────────────
 *
 * The obvious implementation pops the entry when an overlay closes by
 * button or scrim, to keep the stack balanced. That is wrong, and it
 * failed destructively.
 *
 * `history.back()` is asynchronous; `pushState` is synchronous. Opening
 * a log sheet from the quest detail sheet closes one overlay and opens
 * another in the same React commit, so the push for the new sheet lands
 * *before* the queued pop for the old one — and the pop then consumes
 * the new sheet's entry instead. After two such rounds the stack is one
 * entry short of the truth and the next close unwinds past the app's own
 * first entry, landing the user on about:blank with a white screen.
 *
 * So: entries are only ever pushed, never popped by us. A programmatic
 * close leaves its history entry behind and marks it spent; the next
 * back press consumes a spent entry silently instead of closing
 * anything. The cost is one absorbed back press after a sheet is closed
 * by tapping X — a minor annoyance in a tab-based app where back rarely
 * exits anyway. The benefit is that this can never navigate away from
 * the app, because it never navigates at all.
 */
export function OverlayStackProvider({ children }: { children: ReactNode }) {
  const stack = useRef<Entry[]>([]);
  /** History entries whose overlay is already gone. */
  const spent = useRef(0);

  useEffect(() => {
    function onPop() {
      if (spent.current > 0) {
        spent.current -= 1;
        return;
      }
      const top = stack.current.pop();
      top?.close();
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const push = useCallback((entry: Entry) => {
    stack.current.push(entry);
    // The current state is copied rather than replaced: React Router
    // keeps its own bookkeeping in there, and discarding it would
    // desynchronise the router's index from the browser's.
    window.history.pushState({ ...window.history.state }, '');
  }, []);

  const remove = useCallback((id: string) => {
    const index = stack.current.findIndex((e) => e.id === id);
    // Absent means back already popped it — its entry is gone too, so
    // there is nothing to mark.
    if (index === -1) return;
    stack.current.splice(index, 1);
    spent.current += 1;
  }, []);

  const value = useMemo<OverlayStackValue>(() => ({ push, remove }), [push, remove]);

  return <OverlayStackContext.Provider value={value}>{children}</OverlayStackContext.Provider>;
}

/**
 * Makes the back gesture close this overlay.
 *
 * Safe to call outside the provider — it simply does nothing, so a
 * component can be rendered in isolation without a router.
 */
export function useBackDismiss(open: boolean, onClose: () => void): void {
  const ctx = useContext(OverlayStackContext);
  const id = useId();

  // Kept in a ref so a caller passing an inline arrow does not
  // re-register the overlay on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !ctx) return;
    ctx.push({ id, close: () => onCloseRef.current() });
    return () => ctx.remove(id);
  }, [open, ctx, id]);
}
