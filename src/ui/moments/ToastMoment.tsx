import type { ReactNode } from 'react';
import { Portal } from '../kit';

interface ToastMomentProps {
  label: string;
  onDismiss: () => void;
  visible: boolean;
  /** Suppresses the slide, for the reduced-motion path. */
  still: boolean;
  /** The small tracked word on the left. */
  kicker: string;
  children: ReactNode;
  tone?: 'accent' | 'dawn';
}

/**
 * The quiet half of the Moment vocabulary.
 *
 * MASTERY and EVIDENCE ACCEPTED are not ceremonies. Both fire mid-
 * session, right after logging something, and final/05 §2.1 gives them
 * a 600ms card rather than a full screen precisely so they do not stop
 * what you were doing. This is that card, shared by both, so the two
 * cannot drift apart.
 *
 * Portalled, like everything else that has to escape a screen: both are
 * triggered from inside a log sheet, and that sheet is portalled too —
 * left in place the celebration would render underneath the form that
 * fired it.
 *
 * It sits above the bottom nav rather than over the sheet's content,
 * because the thing it is reporting on is still on screen behind it and
 * covering that would defeat the point.
 */
export function ToastMoment({
  label,
  onDismiss,
  visible,
  still,
  kicker,
  children,
  tone = 'accent',
}: ToastMomentProps) {
  const line = tone === 'dawn' ? 'var(--dawn)' : 'var(--accent)';

  return (
    <Portal>
      <div
        className="fixed inset-x-0 bottom-20 z-[60] flex justify-center px-gutter"
        onClick={onDismiss}
        role="button"
        tabIndex={0}
        aria-label={label}
      >
        <div
          className={[
            'cut-sm flex w-full sm:max-w-shell items-center gap-3 px-4 py-3 transition-all',
            still ? '' : 'duration-300 ease-out',
            visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          ].join(' ')}
          style={{
            border: `1px solid ${line}`,
            background: 'var(--surface)',
            boxShadow: 'var(--glow-md)',
          }}
        >
          <span className="shrink-0 text-xxs uppercase tracking-wide text-ink-700">{kicker}</span>
          <span className="min-w-0 font-mono text-sm text-ink-100">{children}</span>
        </div>
      </div>
    </Portal>
  );
}
