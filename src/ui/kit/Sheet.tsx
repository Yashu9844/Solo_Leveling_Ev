import { motion, type PanInfo } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBackDismiss } from '../routing/OverlayStack';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Past this much drag, or this fast a flick, the sheet goes. Tuned so a
 * scroll that starts with a small downward wobble does not dismiss. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 520;

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Rendered as the sheet's heading and used as its accessible name. */
  title: string;
  children: ReactNode;
  /** Pinned below the scroll area — the sheet's primary action. */
  footer?: ReactNode;
  testId?: string;
  /** Hide standard header bar for custom hero art headers */
  hideHeader?: boolean;
}

export function Sheet({ open, onClose, title, children, footer, testId, hideHeader = false }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useBackDismiss(open, onClose);

  // Portals need a target, and SSR/first-paint has none. Mounting state
  // keeps the first render null rather than reaching for document.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Scroll lock. The scrim covers the page, but without this the page
  // behind still scrolls under a dragging thumb on iOS.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Focus moves into the sheet on open and returns to wherever it was on
  // close, so a keyboard user is never dropped at the top of the page.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Trap: Tab past the last focusable wraps to the first, and back
      // past the first wraps to the last.
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) onClose();
  }

  if (!mounted) return null;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" onKeyDown={onKeyDown}>
          <div
            aria-hidden
            onClick={onClose}
            className="absolute inset-0"
            style={{
              background: 'var(--scrim)',
              animation: 'scrim-in 200ms ease-out both',
            }}
          />

          <div
            className="relative w-full sm:max-w-shell"
            style={{ animation: 'sheet-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
          >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid={testId}
            tabIndex={-1}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="relative flex max-h-[86dvh] w-full flex-col outline-none cut-md"
            style={{
              background: 'linear-gradient(180deg, rgba(12, 22, 38, 0.96) 0%, rgba(5, 10, 20, 0.98) 100%)',
              borderTop: '1px solid rgba(77, 163, 255, 0.4)',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.8)',
            }}
          >
            {/* Grab handle */}
            <div className="flex shrink-0 justify-center pt-3" aria-hidden>
              <span
                className="h-1 w-10 rounded-pill"
                style={{ background: 'rgba(77, 163, 255, 0.4)' }}
              />
            </div>

            {hideHeader ? (
              <h2 id={titleId} className="sr-only">
                {title}
              </h2>
            ) : (
              <>
                <div className="flex shrink-0 items-start justify-between gap-3 px-gutter pt-3">
                  <h2 id={titleId} className="text-lg font-display tracking-wider text-ink-100">
                    {title}
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-2 -mt-2 flex min-h-tap min-w-[44px] items-center justify-center text-ink-700 hover:text-accent-bright"
                  >
                    <span aria-hidden className="text-lg">
                      ✕
                    </span>
                  </button>
                </div>
                <div className="hairline mx-gutter mt-2 shrink-0" aria-hidden />
              </>
            )}

            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-gutter py-4">
              {children}
            </div>

            {footer && (
              <div
                className="shrink-0 px-gutter pt-2"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
              >
                {footer}
              </div>
            )}
            {!footer && (
              <div
                aria-hidden
                className="shrink-0"
                style={{ height: 'max(env(safe-area-inset-bottom), 8px)' }}
              />
            )}
          </motion.div>
          </div>
    </div>,
    document.body
  );
}
