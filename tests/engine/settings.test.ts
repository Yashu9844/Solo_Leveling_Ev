import { describe, it, expect } from 'vitest';
import {
  parseSettings,
  serializeSettings,
  applyToRoot,
  DEFAULT_SETTINGS,
  ACCENTS,
  THEMES,
  SETTINGS_VERSION,
  type Settings,
  type Stampable,
} from '../../src/store/settings';

/** Stands in for documentElement. applyToRoot is typed structurally so
 * the DOM is not needed to test what it writes. */
function fakeRoot(): Stampable & { props: Record<string, string> } {
  const props: Record<string, string> = {};
  return {
    props,
    dataset: {},
    style: {
      setProperty: (k, v) => {
        props[k] = v;
      },
      removeProperty: (k) => {
        delete props[k];
      },
    },
  };
}

describe('parseSettings', () => {
  it('returns the defaults for missing storage', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('')).toEqual(DEFAULT_SETTINGS);
  });

  it('survives corrupt JSON rather than throwing', () => {
    expect(parseSettings('{ not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"a string"')).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a full object', () => {
    const s: Settings = {
      version: SETTINGS_VERSION,
      theme: 'daylight',
      accent: 'violet',
      textScale: 'xl',
      density: 'compact',
      motion: 'reduced',
      art: 'off',
      glow: false,
      voice: false,
    };
    expect(parseSettings(serializeSettings(s))).toEqual(s);
  });

  // The whole point of field-by-field validation: one bad value must not
  // cost the user every other preference they set.
  it('falls back per field, keeping the valid neighbours', () => {
    const result = parseSettings(
      JSON.stringify({ theme: 'chartreuse', textScale: 'l', density: 'compact' })
    );
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(result.textScale).toBe('l');
    expect(result.density).toBe('compact');
  });

  it('rejects values of the wrong type', () => {
    const result = parseSettings(JSON.stringify({ theme: 7, glow: 'yes', motion: null }));
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(result.glow).toBe(DEFAULT_SETTINGS.glow);
    expect(result.motion).toBe(DEFAULT_SETTINGS.motion);
  });

  it('accepts every declared theme', () => {
    for (const theme of THEMES) {
      expect(parseSettings(JSON.stringify({ theme })).theme).toBe(theme);
    }
  });

  it('normalises the version to the current one', () => {
    expect(parseSettings(JSON.stringify({ version: 99 })).version).toBe(SETTINGS_VERSION);
  });
});

describe('applyToRoot', () => {
  it('stamps every attribute tokens.css keys off', () => {
    const root = fakeRoot();
    applyToRoot(root, DEFAULT_SETTINGS);
    expect(root.dataset).toEqual({
      theme: 'arc',
      textScale: 'm',
      density: 'comfortable',
      motion: 'system',
      art: 'full',
      glow: 'on',
      accent: 'theme',
    });
  });

  it('sets no --accent-user for the theme default, so the theme decides', () => {
    const root = fakeRoot();
    applyToRoot(root, DEFAULT_SETTINGS);
    expect(root.props['--accent-user']).toBeUndefined();
  });

  it('sets --accent-user for a chosen accent, and clears it again', () => {
    const root = fakeRoot();
    applyToRoot(root, { ...DEFAULT_SETTINGS, accent: 'violet' });
    expect(root.props['--accent-user']).toBe(ACCENTS.violet.hex);

    applyToRoot(root, { ...DEFAULT_SETTINGS, accent: 'theme' });
    expect(root.props['--accent-user']).toBeUndefined();
  });

  it('maps glow false to the off attribute tokens.css matches', () => {
    const root = fakeRoot();
    applyToRoot(root, { ...DEFAULT_SETTINGS, glow: false });
    expect(root.dataset.glow).toBe('off');
  });
});

describe('accent palette', () => {
  // A completed quest circle fills with the accent and --state-complete
  // is green, so a green accent would make "complete" and "a button"
  // look identical. This asserts the palette keeps that gap.
  it('offers no green accent', () => {
    for (const [key, { hex }] of Object.entries(ACCENTS)) {
      if (!hex) continue;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(g > r + 40 && g > b + 40, `${key} (${hex}) reads as green`).toBe(false);
    }
  });

  it('every accent key has a label', () => {
    for (const [key, { label }] of Object.entries(ACCENTS)) {
      expect(label.length, key).toBeGreaterThan(0);
    }
  });
});
