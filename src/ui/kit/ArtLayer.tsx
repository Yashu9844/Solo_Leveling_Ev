import { useState } from 'react';
import { ART, type ArtSlot } from '../../assets/art';

/**
 * How hard the art is pushed behind the content.
 *
 * Every stop is built with `color-mix` against `var(--void)` rather than
 * a literal rgba, so a theme change re-tints the scrim too. A hardcoded
 * near-black scrim would sit as a grey haze over the daylight theme.
 */
export type Scrim = 'hero' | 'band' | 'corner' | 'quiet' | 'moment' | 'none';

const v = (pct: number) => `color-mix(in srgb, var(--void) ${pct}%, transparent)`;

const SCRIMS: Record<Scrim, string> = {
  // Art owns the top, copy owns the bottom. The steep ramp between 35%
  // and 78% is what lets a headline sit on a bright plate.
  hero: `linear-gradient(180deg, ${v(12)} 0%, ${v(8)} 35%, ${v(85)} 58%, var(--void) 78%)`,
  // A mid-screen band that dissolves into the page at both ends.
  band: `linear-gradient(180deg, var(--void) 0%, ${v(35)} 28%, ${v(45)} 62%, var(--void) 100%)`,
  // Top-right corner bleed, e.g. the Today header.
  corner: `linear-gradient(200deg, ${v(10)} 0%, ${v(95)} 70%)`,
  // Barely there — behind a quote card, where the art is atmosphere.
  quiet: `linear-gradient(180deg, ${v(84)} 0%, ${v(92)} 100%)`,
  // Ceremony: the plate stays legible but never fights the numerals.
  moment: `linear-gradient(180deg, ${v(55)} 0%, ${v(28)} 30%, ${v(78)} 72%, var(--void) 100%)`,
  none: 'none',
};

interface ArtLayerProps {
  slot: ArtSlot;
  scrim?: Scrim;
  /** Override the manifest's crop hint. */
  focal?: string;
  /** Load eagerly — for the plate the current screen opens on. */
  priority?: boolean;
  /**
   * Override the plate's own crop scale.
   *
   * Every plate carries a default `zoom` from the manifest, set to push
   * its own marginal lettering out of frame (see ArtAsset.zoom). This is
   * only for a screen that needs a tighter or looser crop than the plate
   * asks for — most callers should leave it alone and inherit.
   */
  zoom?: number;
  className?: string;
}

/**
 * A full-bleed art plate behind content.
 *
 * Always decorative: `aria-hidden` and `pointer-events-none`, because
 * the art never carries information the copy does not. Opacity runs
 * through `--art-opacity`, so the art-intensity setting dims or removes
 * every plate at once without any screen knowing about the setting.
 *
 * An unfilled slot renders a procedural gradient of the same value
 * structure instead of a hole — design system §2.5 requires every screen
 * to look finished with zero art present.
 */
export function ArtLayer({
  slot,
  scrim = 'hero',
  focal,
  priority = false,
  zoom,
  className = '',
}: ArtLayerProps) {
  const art = ART[slot];
  const [loaded, setLoaded] = useState(false);
  const scale = zoom ?? art?.zoom ?? 1;

  return (
    <div aria-hidden className={['art-layer absolute inset-0 overflow-hidden', className].join(' ')}>
      {art ? (
        <>
          {/* The inlined 20px blur paints on the first frame — no request,
              so there is never an empty rectangle while the plate loads. */}
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${1.1 * scale})`,
              backgroundImage: `url(${art.lqip})`,
              backgroundSize: 'cover',
              backgroundPosition: focal ?? art.focal,
              filter: 'blur(12px)',
            }}
          />
          <img
            src={art.src}
            srcSet={art.srcSet}
            sizes="(min-width: 640px) 430px, 100vw"
            alt=""
            width={art.width}
            height={art.height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
            style={{
              objectPosition: focal ?? art.focal,
              opacity: loaded ? 1 : 0,
              ...(scale !== 1 ? { transform: `scale(${scale})` } : {}),
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 18%, var(--panel-top) 0%, var(--void) 70%)',
          }}
        />
      )}

      {scrim !== 'none' && (
        <div className="absolute inset-0" style={{ background: SCRIMS[scrim] }} />
      )}
    </div>
  );
}

/** True when the plate carries its own baked-in tagline, in which case
 * the screen must not overlay a competing one (design system §2.4). */
export function artHasText(slot: ArtSlot): boolean {
  return ART[slot]?.hasText ?? false;
}
