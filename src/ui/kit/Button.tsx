import { motion } from 'framer-motion';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/** framer-motion defines its own versions of these, so the DOM ones are
 * dropped rather than fought with. Nothing in this app uses them. */
type NativeButtonProps = Omit<
  ComponentPropsWithoutRef<'button'>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'ref'
>;

export type ButtonTone = 'accent' | 'dawn' | 'boss';

const TONE: Record<ButtonTone, { line: string; glow: string; from: string; to: string }> = {
  accent: {
    line: 'var(--accent)',
    glow: 'var(--glow-md)',
    from: 'rgba(77,163,255,0.16)',
    to: 'rgba(77,163,255,0.05)',
  },
  dawn: {
    line: 'var(--dawn)',
    glow: '0 0 26px rgba(232,161,60,0.28)',
    from: 'rgba(232,161,60,0.16)',
    to: 'rgba(232,161,60,0.05)',
  },
  boss: {
    line: 'var(--boss)',
    glow: '0 0 26px rgba(255,77,109,0.28)',
    from: 'rgba(255,77,109,0.16)',
    to: 'rgba(255,77,109,0.05)',
  },
};

const TAP = { scale: 0.97 } as const;
const SPRING = { type: 'spring', stiffness: 400, damping: 24 } as const;

interface PrimaryButtonProps extends NativeButtonProps {
  children: ReactNode;
  tone?: ButtonTone;
  /** `lg` is the screen's single committing action; `md` is everything
   * else that still deserves a filled button. */
  size?: 'lg' | 'md';
  fullWidth?: boolean;
}

/**
 * The committing action. One per screen, ideally.
 *
 * Sized by `min-height`, never by padding alone: with the text-scale
 * setting at XS the type shrinks to 0.88x, and a padding-derived button
 * would quietly fall under the 44px touch target that `final/06` §7
 * requires. The floor is explicit so no combination of scale and density
 * can breach it.
 *
 * Border uses the same two-layer bevel as Panel — clip-path would
 * otherwise clip the border off the diagonals.
 */
export function PrimaryButton({
  children,
  tone = 'accent',
  size = 'lg',
  fullWidth = true,
  className = '',
  disabled,
  ...rest
}: PrimaryButtonProps) {
  const t = TONE[tone];
  const cut = size === 'lg' ? 'cut-lg' : 'cut-md';
  const minH = size === 'lg' ? 52 : 46;

  return (
    <motion.button
      whileTap={disabled ? undefined : TAP}
      transition={SPRING}
      disabled={disabled}
      className={[cut, fullWidth ? 'w-full' : '', disabled ? 'opacity-40' : '', className].join(' ')}
      style={{ background: t.line, padding: 1 }}
      {...rest}
    >
      <span
        className={[
          cut,
          'flex w-full items-center justify-center px-4 text-center',
          'text-xs font-medium uppercase tracking-button text-ink-100',
        ].join(' ')}
        style={{
          minHeight: minH,
          // The tint is translucent by design, so it needs an opaque
          // layer beneath it. Without one the border layer's solid
          // colour shows straight through the 1px inset and the button
          // renders as a solid slab instead of a lit outline.
          background: `linear-gradient(180deg, ${t.from} 0%, ${t.to} 100%), var(--void)`,
          boxShadow: disabled ? 'none' : t.glow,
        }}
      >
        {children}
      </span>
    </motion.button>
  );
}

interface SecondaryButtonProps extends NativeButtonProps {
  children: ReactNode;
  fullWidth?: boolean;
}

/** Same geometry as PrimaryButton, no fill and no glow — so the two can
 * sit side by side and the eye still knows which one commits. */
export function SecondaryButton({
  children,
  fullWidth = true,
  className = '',
  disabled,
  ...rest
}: SecondaryButtonProps) {
  return (
    <motion.button
      whileTap={disabled ? undefined : TAP}
      transition={SPRING}
      disabled={disabled}
      className={['cut-md', fullWidth ? 'w-full' : '', disabled ? 'opacity-40' : '', className].join(
        ' '
      )}
      style={{ background: 'var(--hair)', padding: 1 }}
      {...rest}
    >
      <span
        className="cut-md flex w-full items-center justify-center px-4 text-center text-xs font-medium uppercase tracking-button text-ink-500"
        style={{ minHeight: 46, background: 'var(--surface)' }}
      >
        {children}
      </span>
    </motion.button>
  );
}

interface QuietButtonProps extends NativeButtonProps {
  children: ReactNode;
}

/** Text only. Still a full 44px target — the tap area is invisible, not
 * absent, which is the difference between restrained and unusable. */
export function QuietButton({ children, className = '', disabled, ...rest }: QuietButtonProps) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={SPRING}
      disabled={disabled}
      className={[
        'inline-flex min-h-tap items-center justify-center px-2 text-sm text-accent',
        disabled ? 'opacity-40' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
