// The eight domain hues (platform/03 §27.1.3). A Blueprint names a hue; it never
// carries a colour. The colours live in ui/tokens.css (`--hue-<name>-{bg,border,color,glow}`)
// where theme-contrast.test.ts measures every hue against every theme.
//
// Pure data: the generator (Phase 8) picks from this list, the validator checks
// membership, and the UI maps a name to CSS variables (ui/presentation/domain.ts).

export const HUE_TOKENS = ['violet', 'blue', 'rose', 'amber', 'green', 'teal', 'coral', 'slate'] as const;
export type HueToken = (typeof HUE_TOKENS)[number];

/** What an unknown or missing hue renders as: neutral, never an error. */
export const FALLBACK_HUE: HueToken = 'slate';

export function isHueToken(value: unknown): value is HueToken {
  return typeof value === 'string' && (HUE_TOKENS as readonly string[]).includes(value);
}
