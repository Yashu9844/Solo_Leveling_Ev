// The curated icon set (platform/03 §27.1.3): the only glyph names a Blueprint may
// use. Each is a Phosphor icon of the same name; ui/presentation/icons.ts maps the
// token to the component, and a test keeps the two lists in step.
//
// Pure data, so the generator and validator can use it without importing React.

export const ICON_TOKENS = [
  // The owner's System
  'Briefcase', 'Code', 'Cpu', 'Barbell', 'MoonStars', 'Eye', 'BookOpen', 'Broom', 'Brain',
  // Knowledge and craft
  'Books', 'GraduationCap', 'Translate', 'PencilLine', 'Palette', 'MusicNotes', 'Camera', 'Microphone', 'Notebook',
  'Hammer', 'Wrench', 'Lightbulb', 'PuzzlePiece',
  // Body and health
  'Heart', 'Heartbeat', 'PersonSimpleRun', 'Bicycle', 'PersonSimpleTaiChi', 'Sun', 'Coffee', 'Leaf', 'Plant',
  // Time, drive and direction
  'Timer', 'Hourglass', 'Target', 'Flag', 'Rocket', 'Lightning', 'Flame', 'Mountains', 'Compass', 'Star',
  // Money and people
  'Wallet', 'Coins', 'ChartLineUp', 'Users', 'ChatCircle', 'Handshake', 'Envelope',
] as const;
export type IconTokenName = (typeof ICON_TOKENS)[number];

/** What an unknown or missing icon renders as. */
export const FALLBACK_ICON: IconTokenName = 'Target';

export function isIconToken(value: unknown): value is IconTokenName {
  return typeof value === 'string' && (ICON_TOKENS as readonly string[]).includes(value);
}
