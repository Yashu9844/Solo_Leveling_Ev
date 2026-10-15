// How a domain looks (platform/03 §27.2). Screens ask for this instead of keeping
// their own per-domain tables: Blueprint values reach the DOM only as tokens, so
// the colour is a set of CSS variables defined in ui/tokens.css, never a literal
// that came from data.
import type { Icon } from '@phosphor-icons/react';
import { FALLBACK_HUE, isHueToken, type HueToken } from '../../library/hues';
import type { SystemBlueprint } from '../../blueprint/schema';
import { iconFor } from './icons';

/** The four CSS values a domain tile is drawn with. */
export interface DomainTheme {
  bg: string;
  border: string;
  color: string;
  glow: string;
}

export interface DomainPresentation {
  Glyph: Icon;
  theme: DomainTheme;
  hue: HueToken;
  /** The System's name for the domain's core quest, in capitals (falls back to the domain's own designation). */
  designation: string;
  /** The plain-language name used on REALITY surfaces. */
  realityLabel: string;
  /** The verb on the primary log action ("Record Logic Trial"); empty when the domain has no instrument. */
  logVerb: string;
}

export function hueTheme(hue: string | undefined): { hue: HueToken; theme: DomainTheme } {
  const token = isHueToken(hue) ? hue : FALLBACK_HUE;
  return {
    hue: token,
    theme: {
      bg: `var(--hue-${token}-bg)`,
      border: `var(--hue-${token}-border)`,
      color: `var(--hue-${token}-color)`,
      glow: `var(--hue-${token}-glow)`,
    },
  };
}

/**
 * Presentation for one domain of a Blueprint, or undefined when the Blueprint has
 * no such domain. Never throws on an unknown icon or hue token: it falls back to
 * the generic glyph and the neutral hue, so a document from a newer build still renders.
 */
export function presentDomain(blueprint: SystemBlueprint, domainId: string): DomainPresentation | undefined {
  const domain = blueprint.domains.find((candidate) => candidate.id === domainId);
  if (!domain) return undefined;
  const quest = blueprint.quests.find((candidate) => candidate.domainId === domain.id && candidate.type === 'core');
  const firstInstrument = domain.instrumentIds.map((id) => blueprint.instruments.find((instrument) => instrument.id === id)).find(Boolean);
  const { hue, theme } = hueTheme(domain.presentation.hue);
  return {
    Glyph: iconFor(domain.presentation.icon),
    theme,
    hue,
    designation: quest?.designation ?? domain.designation,
    realityLabel: quest?.realityLabel ?? domain.name,
    logVerb: firstInstrument?.logVerb ?? '',
  };
}

/** Every domain of a Blueprint, in priority order. */
export function presentDomains(blueprint: SystemBlueprint): { id: string; role: SystemBlueprint['domains'][number]['role']; presentation: DomainPresentation }[] {
  return [...blueprint.domains]
    .sort((a, b) => a.priority - b.priority)
    .map((domain) => ({ id: domain.id, role: domain.role, presentation: presentDomain(blueprint, domain.id)! }));
}
