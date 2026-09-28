/**
 * Device preferences — theme, text size, density, motion, art, voice.
 *
 * These live in localStorage and deliberately NOT in the event log
 * (design/03-SETTINGS-AND-THEMING.md §2). The event log holds evidence
 * about the arc, and db/projections.ts's verifyIntegrity() is only
 * meaningful because of that. A theme choice says nothing about whether
 * four months changed anything, so logging it would weaken the integrity
 * guarantee for no benefit.
 *
 * Everything below the storage wrapper is pure, so the parsing,
 * defaulting and DOM-stamping logic is all testable in a node
 * environment with no localStorage and no document.
 */

export type Theme = 'arc' | 'dawn' | 'abyss' | 'contrast' | 'daylight';
export type TextScale = 'xs' | 's' | 'm' | 'l' | 'xl';
export type Density = 'comfortable' | 'compact';
export type MotionPref = 'system' | 'full' | 'reduced';
export type ArtIntensity = 'full' | 'dim' | 'off';
export type AccentKey = 'theme' | 'mana' | 'violet' | 'frost' | 'ember' | 'gold';

export interface Settings {
  version: number;
  theme: Theme;
  accent: AccentKey;
  textScale: TextScale;
  density: Density;
  motion: MotionPref;
  art: ArtIntensity;
  glow: boolean;
  /**
   * Whether the System says its line out loud when the app opens
   * (design/04 §16.1). A device preference like every other field here:
   * it belongs to this browser, not to the arc, so it never reaches the
   * event log. Unlike the rest it is deliberately NOT stamped on the
   * root element — no CSS keys off it, and applyToRoot's output is part
   * of the theming contract.
   */
  voice: boolean;
}

export const SETTINGS_KEY = 'system.settings.v1';
export const SETTINGS_VERSION = 1;

export const THEMES: Theme[] = ['arc', 'dawn', 'abyss', 'contrast', 'daylight'];
export const TEXT_SCALES: TextScale[] = ['xs', 's', 'm', 'l', 'xl'];
export const DENSITIES: Density[] = ['comfortable', 'compact'];
export const MOTIONS: MotionPref[] = ['system', 'full', 'reduced'];
export const ART_INTENSITIES: ArtIntensity[] = ['full', 'dim', 'off'];

/**
 * `theme` means "use whatever this theme declares" — the common case, and
 * the only value that sets no --accent-user override at all.
 *
 * Every other hue is picked to stay distinguishable from the state
 * colours it will sit beside. Green is deliberately absent: a completed
 * quest circle fills with the accent, and --state-complete is green, so
 * a green accent would make "complete" and "just a button" identical.
 */
export const ACCENTS: Record<AccentKey, { label: string; hex: string | null }> = {
  theme: { label: 'Theme default', hex: null },
  mana: { label: 'Mana blue', hex: '#4da3ff' },
  violet: { label: 'Monarch violet', hex: '#a678ff' },
  frost: { label: 'Frost', hex: '#5fd8e8' },
  ember: { label: 'Ember', hex: '#ff8a5c' },
  gold: { label: 'Gold', hex: '#e8a13c' },
};

/** Warm accents collide with the amber --state-recover, so tokens.css
 * swings that state cool for exactly these. Kept here so the list has
 * one home. */
export const WARM_ACCENTS: AccentKey[] = ['ember', 'gold'];

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  theme: 'arc',
  accent: 'theme',
  textScale: 'm',
  density: 'comfortable',
  motion: 'system',
  art: 'full',
  glow: true,
  voice: true,
};

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Never throws and never returns a partial object. A corrupt blob, a
 * value from a newer build, a hand-edited key — all degrade to the
 * default for that one field rather than losing the whole object.
 */
export function parseSettings(raw: string | null | undefined): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ...DEFAULT_SETTINGS };
  }

  const o = migrate(parsed as Record<string, unknown>);

  return {
    version: SETTINGS_VERSION,
    theme: oneOf(THEMES, o.theme, DEFAULT_SETTINGS.theme),
    accent: oneOf(Object.keys(ACCENTS) as AccentKey[], o.accent, DEFAULT_SETTINGS.accent),
    textScale: oneOf(TEXT_SCALES, o.textScale, DEFAULT_SETTINGS.textScale),
    density: oneOf(DENSITIES, o.density, DEFAULT_SETTINGS.density),
    motion: oneOf(MOTIONS, o.motion, DEFAULT_SETTINGS.motion),
    art: oneOf(ART_INTENSITIES, o.art, DEFAULT_SETTINGS.art),
    glow: typeof o.glow === 'boolean' ? o.glow : DEFAULT_SETTINGS.glow,
    voice: typeof o.voice === 'boolean' ? o.voice : DEFAULT_SETTINGS.voice,
  };
}

/**
 * Forward-migration hook. Nothing to do at v1, but the shape is here so
 * a later version has an obvious place to land instead of a scattering
 * of inline compatibility checks.
 */
function migrate(o: Record<string, unknown>): Record<string, unknown> {
  return o;
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify(s);
}

/**
 * The minimum surface a DOM element needs for stamping. Structural so a
 * plain object stands in for documentElement under test.
 */
export interface Stampable {
  /** Matches the DOM's own `DOMStringMap`, whose values are
   * `string | undefined` — a narrower `Record<string, string>` would not
   * accept `document.documentElement`. */
  dataset: { [key: string]: string | undefined };
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): unknown;
  };
}

/**
 * Writes settings onto the root element. tokens.css keys every theme and
 * modifier off exactly these attributes, so this is the single place
 * preferences become pixels.
 */
export function applyToRoot(root: Stampable, s: Settings): void {
  root.dataset.theme = s.theme;
  root.dataset.textScale = s.textScale;
  root.dataset.density = s.density;
  root.dataset.motion = s.motion;
  root.dataset.art = s.art;
  root.dataset.glow = s.glow ? 'on' : 'off';
  root.dataset.accent = s.accent;

  const hex = ACCENTS[s.accent].hex;
  if (hex) {
    root.style.setProperty('--accent-user', hex);
  } else {
    root.style.removeProperty('--accent-user');
  }
}

/* ── storage ─────────────────────────────────────────────────────────
 * localStorage throws in some privacy modes rather than returning null,
 * so every access is guarded. Losing a preference is survivable; a
 * white screen on boot is not.
 * ─────────────────────────────────────────────────────────────────── */

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, serializeSettings(s));
  } catch {
    // Preferences stay applied for this session; they just won't persist.
  }
}
