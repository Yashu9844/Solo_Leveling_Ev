// Loop 7.1 - presentDomain, the curated token sets and the SystemProvider's store.
// The acceptance line: "legacy hues = the current DOMAIN_THEME" (platform/05).
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';
import { LEGACY_BLUEPRINT_V1, legacyBlueprintFor } from '../../src/blueprint/legacy/legacyV1';
import { FALLBACK_HUE, HUE_TOKENS, isHueToken } from '../../src/library/hues';
import { FALLBACK_ICON, ICON_TOKENS, isIconToken } from '../../src/library/icons';
import { db } from '../../src/db/db';
import { getBlueprintVersionsSnapshot, refreshBlueprintVersions, resetBlueprintVersions } from '../../src/store/systemBlueprint';
import { hueTheme, presentDomain, presentDomains } from '../../src/ui/presentation/domain';
import { ICONS, iconFor } from '../../src/ui/presentation/icons';
import {
  Barbell, Briefcase, Code, Cpu, Eye, MoonStars, Target,
} from '@phosphor-icons/react';

const TOKENS_CSS = readFileSync(fileURLToPath(new URL('../../src/ui/tokens.css', import.meta.url)), 'utf-8');

/** The literals src/ui/today/QuestRow.tsx has always drawn (DOMAIN_THEME) - copied here on purpose, as a golden. */
const VIOLET = { bg: 'rgba(55, 20, 85, 0.65)', border: 'rgba(192, 132, 252, 0.45)', color: '#c084fc', glow: '0 0 10px rgba(192, 132, 252, 0.35)' };
const BLUE = { bg: 'rgba(15, 45, 85, 0.65)', border: 'rgba(77, 163, 255, 0.45)', color: '#5fb2ff', glow: '0 0 10px rgba(77, 163, 255, 0.35)' };
const LEGACY_DOMAIN_THEME = { attention: BLUE, build: BLUE, career: VIOLET, dsa: VIOLET, sleep: VIOLET, training: VIOLET };
const LEGACY_QUEST_ICON = { career: Briefcase, dsa: Code, build: Cpu, training: Barbell, sleep: MoonStars, attention: Eye };

/** What a CSS variable reference resolves to on the default (dark) themes. */
function resolveVar(reference: string): string {
  const name = /^var\((--[a-z-]+)\)$/.exec(reference)![1]!;
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(TOKENS_CSS.slice(TOKENS_CSS.indexOf('1b. DOMAIN HUES')));
  return m![1]!.trim();
}

afterEach(() => resetBlueprintVersions());

describe('presentDomain (loop 7.1)', () => {
  for (const [key, expected] of Object.entries(LEGACY_DOMAIN_THEME)) {
    it(`the legacy ${key} domain draws exactly what the Today row draws now`, () => {
      const presentation = presentDomain(LEGACY_BLUEPRINT_V1, key)!;
      expect(presentation).toBeDefined();
      expect({
        bg: resolveVar(presentation.theme.bg), border: resolveVar(presentation.theme.border),
        color: resolveVar(presentation.theme.color), glow: resolveVar(presentation.theme.glow),
      }).toEqual(expected);
      expect(presentation.Glyph).toBe(LEGACY_QUEST_ICON[key as keyof typeof LEGACY_QUEST_ICON]);
    });
  }

  it('carries the designation, reality label and log verb the screens use', () => {
    const dsa = presentDomain(LEGACY_BLUEPRINT_V1, 'dsa')!;
    expect(dsa.designation).toBe('LOGIC TRIAL');
    expect(dsa.realityLabel).toBe('1 logic problem / 25m');
    expect(dsa.logVerb).toBe('Record Logic Trial');
    // A support domain has no core quest: its own designation and name stand in.
    const maintenance = presentDomain(LEGACY_BLUEPRINT_V1, 'maintenance')!;
    expect(maintenance.designation).toBe('MAINTENANCE');
    expect(maintenance.realityLabel).toBe('Maintenance');
  });

  it('returns undefined for a domain the Blueprint does not have, and orders domains by priority', () => {
    expect(presentDomain(LEGACY_BLUEPRINT_V1, 'astrology')).toBeUndefined();
    expect(presentDomains(LEGACY_BLUEPRINT_V1).map((domain) => domain.id)).toEqual(['career', 'dsa', 'build', 'training', 'sleep', 'attention', 'foundations', 'maintenance']);
  });

  it('renders an unknown icon or hue as the neutral fallback instead of failing', () => {
    const blueprint = legacyBlueprintFor();
    blueprint.domains[0]!.presentation = { icon: 'NotAnIcon', hue: 'chartreuse' };
    const presentation = presentDomain(blueprint, blueprint.domains[0]!.id)!;
    expect(presentation.Glyph).toBe(Target);
    expect(presentation.hue).toBe(FALLBACK_HUE);
    expect(iconFor(undefined)).toBe(ICONS[FALLBACK_ICON]);
    expect(hueTheme(undefined).theme.color).toBe(`var(--hue-${FALLBACK_HUE}-color)`);
  });

  it('never puts a raw colour from data into the output - only variable references', () => {
    for (const hue of HUE_TOKENS) {
      for (const value of Object.values(hueTheme(hue).theme)) expect(value).toMatch(/^var\(--hue-[a-z]+-(bg|border|color|glow)\)$/);
    }
    expect(Object.values(hueTheme('#ff0000').theme).every((value) => value.startsWith('var(--hue-slate-'))).toBe(true);
  });
});

describe('the curated token sets', () => {
  it('has 48 icons, each with a component, and nothing else in the map', () => {
    expect(ICON_TOKENS).toHaveLength(48);
    expect(new Set(ICON_TOKENS).size).toBe(48);
    expect(Object.keys(ICONS).sort()).toEqual([...ICON_TOKENS].sort());
    for (const token of ICON_TOKENS) expect(ICONS[token], token).toBeTruthy();
  });

  it('has 8 hues', () => {
    expect(HUE_TOKENS).toHaveLength(8);
    expect(isHueToken('violet')).toBe(true);
    expect(isHueToken('chartreuse')).toBe(false);
    expect(isIconToken('Cpu')).toBe(true);
    expect(isIconToken('cpu')).toBe(false);
  });

  it('covers every icon and hue the owner\'s System uses', () => {
    for (const domain of LEGACY_BLUEPRINT_V1.domains) {
      expect(isIconToken(domain.presentation.icon), `${domain.id} icon`).toBe(true);
      expect(isHueToken(domain.presentation.hue), `${domain.id} hue`).toBe(true);
    }
    for (const group of LEGACY_BLUEPRINT_V1.attributes.groups) expect(isIconToken(group.icon), `${group.id} icon`).toBe(true);
  });
});

describe('the Blueprint versions store (what SystemProvider serves)', () => {
  it('falls back to the owner\'s System with no arc, and reads the resolved versions once there is one', async () => {
    resetBlueprintVersions();
    await db.open();
    await refreshBlueprintVersions();
    expect(getBlueprintVersionsSnapshot()).toHaveLength(1);
    expect(getBlueprintVersionsSnapshot()[0]).toBe(LEGACY_BLUEPRINT_V1);

    const log = legacyActivityLog({ seed: 3, days: 5 });
    await loadLegacyDb(prefixOf(log, dateAt(4)), dateAt(4));
    await refreshBlueprintVersions();
    const versions = getBlueprintVersionsSnapshot();
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);
    expect(versions[0]!.arcId).toBe(LEGACY_ARC_ID);
  });
});
