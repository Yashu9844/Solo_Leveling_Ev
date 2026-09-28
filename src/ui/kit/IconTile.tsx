import type { Icon } from '@phosphor-icons/react';

interface IconTileProps {
  icon: Icon;
  size?: number;
  /** Filled treatment — used when the thing it labels is complete. */
  active?: boolean;
  tone?: 'accent' | 'dawn' | 'boss';
  className?: string;
}

/**
 * The small bordered square that leads a row.
 *
 * Purely decorative: it always sits beside a text label that carries the
 * meaning, so it is `aria-hidden` and never the only way to identify a
 * row. `final/06` §7 requires every state to have a shape as well as a
 * colour, and an icon nobody can read is neither.
 */
export function IconTile({
  icon: Glyph,
  size = 32,
  active = false,
  tone = 'accent',
  className = '',
}: IconTileProps) {
  const line =
    tone === 'dawn' ? 'var(--dawn)' : tone === 'boss' ? 'var(--boss)' : 'var(--accent)';

  return (
    <div
      aria-hidden
      className={['flex shrink-0 items-center justify-center rounded-[7px]', className].join(' ')}
      style={{
        width: size,
        height: size,
        border: `1px solid ${active ? line : 'var(--hair-strong)'}`,
        background: active ? 'color-mix(in srgb, ' + line + ' 18%, transparent)' : 'var(--fill-faint)',
        boxShadow: active ? 'var(--glow-sm)' : 'none',
      }}
    >
      <Glyph
        size={Math.round(size * 0.5)}
        weight={active ? 'fill' : 'regular'}
        color={active ? line : 'var(--accent-bright)'}
      />
    </div>
  );
}
