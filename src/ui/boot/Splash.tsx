import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArtLayer, ScreenShell } from '../kit';

/**
 * How long the boot screen stays up at minimum.
 * Set to 3500ms (3.5s) for a dramatic Solo Leveling system boot experience.
 */
export const SPLASH_MIN_MS = 3500;

/** True once `ms` has passed since mount. */
export function useMinimumElapsed(ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return elapsed;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The boot screen.
 *
 * Replaces the blank div App.tsx used to render while the arc status
 * resolved. A four-beat reveal — plate, wordmark, rule, creed — each
 * beat overlapping the last so it reads as one movement rather than a
 * list of things appearing.
 */
export function Splash() {
  return (
    <ScreenShell>
      <div
        data-testid="splash"
        className="relative flex flex-1 flex-col items-center justify-center overflow-hidden"
      >
        <ArtLayer slot="boot" scrim="moment" priority />

        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease: EASE }}
          className="relative flex flex-col items-center"
        >
          <h1
            className="glow-text pl-[0.34em] font-display text-display tracking-wordmark text-ink-100"
            style={{ fontWeight: 300 }}
          >
            SYSTEM
          </h1>
        </motion.div>

        <motion.div
          aria-hidden
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 220, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.7, ease: EASE }}
          className="relative my-6 h-px"
          style={{
            background:
              'linear-gradient(to right, transparent, var(--accent), transparent)',
          }}
        />

        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.7 }}
          className="relative text-xxs font-mono uppercase tracking-[0.24em] text-accent-mid font-bold glow-text"
        >
          Discipline creates freedom
        </motion.p>
      </div>
    </ScreenShell>
  );
}
