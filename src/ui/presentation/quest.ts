// How a quest looks (platform/03 §27.3, Today): the glyph and tile colours of its
// domain, the one-line summary under its title and the sentence that says what
// counts. A quest row is keyed by the quest's id; for the owner's System that is
// the same word as its domain, for a generated System it is not, so the domain is
// found through the Blueprint rather than assumed.
import type { Icon } from '@phosphor-icons/react';
import type { SystemBlueprint } from '../../blueprint/schema';
import { hueTheme, presentDomain, type DomainTheme } from './domain';
import { iconFor } from './icons';

export interface QuestPresentation {
  domainId: string | undefined;
  Glyph: Icon;
  theme: DomainTheme;
  designation: string;
  /** The short line under the title ("1 logic problem / 25m"). */
  summary: string;
  /** What counts, in plain words (the quest detail sheet). */
  objective: string;
}

export function presentQuest(blueprint: SystemBlueprint, questId: string): QuestPresentation {
  const quest = blueprint.quests.find((candidate) => candidate.id === questId);
  const domain = quest ? presentDomain(blueprint, quest.domainId) : undefined;
  return {
    domainId: quest?.domainId,
    Glyph: domain?.Glyph ?? iconFor(undefined),
    theme: domain?.theme ?? hueTheme(undefined).theme,
    designation: quest?.designation ?? questId.toUpperCase(),
    summary: quest?.realityLabel ?? quest?.designation ?? '',
    objective: quest?.objective ?? '',
  };
}

/** The core quests in the order the priority line walks them: by their domain's priority. */
export function coreQuestOrder(blueprint: SystemBlueprint): string[] {
  const priority = new Map(blueprint.domains.map((domain) => [domain.id, domain.priority]));
  return blueprint.quests
    .filter((quest) => quest.type === 'core')
    .sort((a, b) => (priority.get(a.domainId) ?? 99) - (priority.get(b.domainId) ?? 99))
    .map((quest) => quest.id);
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/** "Six" for 6 (a count that reads as a word up to twelve, digits beyond). */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}
