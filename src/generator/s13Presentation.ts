// S13 presentation: every domain gets an icon and a hue, and none shares one while a free one remains. Deterministic,
// by priority: the first domain keeps its archetype's choice, a later one that collides takes the next free token in
// the curated order (library/hues.ts, library/icons.ts). Past eight hues, repeats are unavoidable and are allowed.
import type { DomainDefinition } from '../blueprint/schema';
import { HUE_TOKENS } from '../library/hues';
import { ICON_TOKENS } from '../library/icons';

export function assignPresentation(domains: DomainDefinition[]): DomainDefinition[] {
  const usedHues = new Set<string>();
  const usedIcons = new Set<string>();
  const nextFree = (wanted: string, order: readonly string[], used: Set<string>): string => {
    if (!used.has(wanted)) return wanted;
    const free = order.find((token) => !used.has(token));
    return free ?? wanted;
  };
  return [...domains].sort((a, b) => a.priority - b.priority).map((domain) => {
    const hue = nextFree(domain.presentation.hue, HUE_TOKENS, usedHues);
    const icon = nextFree(domain.presentation.icon, ICON_TOKENS, usedIcons);
    usedHues.add(hue);
    usedIcons.add(icon);
    return { ...domain, presentation: { ...domain.presentation, hue, icon } };
  }).sort((a, b) => domains.findIndex((d) => d.id === a.id) - domains.findIndex((d) => d.id === b.id));
}
