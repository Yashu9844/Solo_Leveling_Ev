import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { useSettings } from '../store/SettingsContext';

/**
 * One place where the motion preference reaches framer-motion.
 *
 * The CSS side of this lives in index.css and covers transitions and
 * keyframes; this covers JS-driven animation. Both read the same three
 * states so they can never disagree:
 *
 *   reduced → 'always'  — still, whatever the OS says
 *   full    → 'never'   — animated, whatever the OS says
 *   system  → 'user'    — follow prefers-reduced-motion (the default)
 *
 * Moments keep their own hand-rolled reduced-motion check because they
 * also fire haptics, which MotionConfig does not govern.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const reducedMotion =
    settings.motion === 'reduced' ? 'always' : settings.motion === 'full' ? 'never' : 'user';

  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
}
