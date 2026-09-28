import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArtLayer, PrimaryButton, SafeBottom, SafeTop, ScreenShell } from '../kit';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The front door, shown once: before an arc exists.
 *
 * A Gold Horizon surface — the promise, not the grind
 * (design/00-DESIGN-SYSTEM.md §2.2). Everything else on the boot path
 * is Blue Arc; this is the one place the app shows what the four months
 * are for rather than what they cost.
 *
 * The plate already carries three lines of its own — DISCIPLINE CREATES
 * FREEDOM, A BETTER YOU AWAITS, SMALL STEPS BIG WORLDS — so this screen
 * adds no tagline of its own. §2.4 rule 4: never overlay copy on art
 * that already speaks. Only the wordmark and the one action.
 */
export function Start() {
  const navigate = useNavigate();

  return (
    <ScreenShell>
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Zoomed past the plate's marginal text. At a phone's aspect
            ratio `cover` slices those lines in half, and half a word
            reads as a rendering bug — so they are pushed out of frame
            entirely and the composition carries the screen instead. */}
        <ArtLayer slot="start-hero" scrim="hero" priority />

        <SafeTop />
        <div className="flex-1" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
          className="relative flex flex-col items-center px-gutter pb-10"
        >
          <h1
            className="glow-text pl-[0.34em] font-display text-display tracking-wordmark text-ink-100"
            style={{ fontWeight: 300 }}
          >
            SYSTEM
          </h1>

          <div
            aria-hidden
            className="my-7 h-px w-[210px]"
            style={{
              background: 'linear-gradient(to right, transparent, var(--dawn), transparent)',
            }}
          />

          <div className="w-full">
            {/* Gold, matching the plate: this button is the promise
                being accepted, and blue would read as effort. */}
            <PrimaryButton tone="dawn" onClick={() => navigate('/onboarding')}>
              Begin your journey
            </PrimaryButton>
          </div>
        </motion.div>

        <SafeBottom min={12} />
      </div>
    </ScreenShell>
  );
}
