import type { CSSProperties, ReactNode } from 'react';

export type SystemWindowTone = 'accent' | 'dawn' | 'boss' | 'recover';

const TONE: Record<SystemWindowTone, { line: string; glow: string; wash: string }> = {
  accent: {
    line: 'var(--accent)',
    glow: '0 0 22px rgba(77, 163, 255, 0.22)',
    wash: 'rgba(77, 163, 255, 0.05)',
  },
  dawn: {
    line: 'var(--dawn)',
    glow: '0 0 22px rgba(232, 161, 60, 0.22)',
    wash: 'rgba(232, 161, 60, 0.05)',
  },
  boss: {
    line: 'var(--boss)',
    glow: '0 0 22px rgba(255, 77, 109, 0.22)',
    wash: 'rgba(255, 77, 109, 0.05)',
  },
  recover: {
    line: 'var(--state-recover)',
    glow: '0 0 22px rgba(224, 163, 62, 0.20)',
    wash: 'rgba(224, 163, 62, 0.05)',
  },
};

const CORNERS = [
  'left-0 top-0 border-l-2 border-t-2',
  'right-0 top-0 border-r-2 border-t-2',
  'left-0 bottom-0 border-b-2 border-l-2',
  'right-0 bottom-0 border-b-2 border-r-2',
] as const;

interface SystemWindowProps {
  children: ReactNode;
  /** The small tracked line above the content — the System identifying
   * itself. Rendered inside the frame, in the tone's colour. */
  label?: string;
  tone?: SystemWindowTone;
  /** Bracket arm length in px. */
  bracket?: number;
  /** Plays the arrival. Off for a window that was always on the screen,
   * on for one that just appeared in response to something. */
  arrive?: boolean;
  /** Staggers the arrival, for a group of windows landing in sequence. */
  delayMs?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

/**
 * The System speaking.
 *
 * A bordered pane with corner brackets that *materialises*: the frame
 * snaps in, a scan line sweeps it once, then the content rises. That
 * arrival is the whole point — `Panel` and `FramedPanel` are surfaces
 * that were always there, and this is an utterance that just landed.
 *
 * The distinction matters for the product, not just the look. Solo
 * Leveling's System is a character that addresses you, and a character
 * has to *arrive* to be one. A pane that is simply present is furniture.
 *
 * Every part of the animation is CSS. design/00 §5.1, learned three
 * separate times: anything whose final state matters must not depend on
 * JavaScript reaching the last frame, because a starved rAF leaves the
 * element stranded — visible to a test, invisible to a person. The
 * reduced-motion rules in index.css collapse all of it to nothing and
 * the window simply exists, fully formed.
 */
export function SystemWindow({
  children,
  label,
  tone = 'accent',
  bracket = 14,
  arrive = false,
  delayMs = 0,
  className = '',
  style,
  testId,
}: SystemWindowProps) {
  const t = TONE[tone];

  return (
    <div
      data-testid={testId}
      className={['relative overflow-hidden', className].join(' ')}
      style={{
        border: `1px solid ${t.line}`,
        background: `linear-gradient(180deg, ${t.wash} 0%, transparent 55%), linear-gradient(180deg, var(--panel-top) 0%, var(--surface) 100%)`,
        boxShadow: t.glow,
        transformOrigin: 'top center',
        animation: arrive
          ? `system-frame-in 260ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both`
          : undefined,
        ...style,
      }}
    >
      {CORNERS.map((c, i) => (
        <span
          key={c}
          aria-hidden
          className={`pointer-events-none absolute ${c}`}
          style={{
            width: bracket,
            height: bracket,
            borderColor: t.line,
            animation: arrive
              ? `system-bracket-in 220ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs + 140 + i * 30}ms both`
              : undefined,
          }}
        />
      ))}

      {/* One pass of the scan line, then gone. Purely decorative, so it
          is aria-hidden and never affects layout. */}
      {arrive && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-8"
          style={{
            background: `linear-gradient(180deg, transparent, ${t.line}, transparent)`,
            opacity: 0,
            animation: `system-scan 620ms ease-out ${delayMs + 120}ms both`,
          }}
        />
      )}

      <div
        className="relative"
        style={{
          animation: arrive
            ? `system-content-in 240ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs + 160}ms both`
            : undefined,
        }}
      >
        {label && (
          <div
            className="mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
            style={{ color: t.line }}
          >
            ⟨ {label} ⟩
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
