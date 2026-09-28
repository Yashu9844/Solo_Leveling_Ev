import type {
  ArtIntensity,
  Density,
  MotionPref,
  TextScale,
  Theme,
} from '../../store/settings';

/**
 * Display names for every settings value.
 *
 * Kept out of store/settings.ts on purpose: that module is pure and
 * tested in a node environment, and it holds the contract (what values
 * exist, how they parse, how they stamp). What a value is *called* is a
 * UI concern and changes independently of it.
 */

export const THEME_LABELS: Record<Theme, string> = {
  arc: 'Arc',
  dawn: 'Dawn',
  abyss: 'Abyss',
  contrast: 'High contrast',
  daylight: 'Daylight',
};

export const THEME_DESCRIPTIONS: Record<Theme, string> = {
  arc: 'The default. Deep blue-black, mana accent.',
  dawn: 'Warm dark. Gold accent, for the evening review.',
  abyss: 'Near-black and desaturated. The quietest one.',
  contrast: 'Maximum separation. Brighter ink, harder edges.',
  daylight: 'The light theme. Opt-in, never automatic.',
};

export const TEXT_SCALE_LABELS: Record<TextScale, string> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
};

export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
};

export const MOTION_LABELS: Record<MotionPref, string> = {
  system: 'System',
  full: 'Full',
  reduced: 'Reduced',
};

export const ART_LABELS: Record<ArtIntensity, string> = {
  full: 'Full',
  dim: 'Dim',
  off: 'Off',
};
