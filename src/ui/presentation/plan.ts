// Which domains a person plans around, and what each is called where a short name is wanted (platform/03 §27.3).
import type { SystemBlueprint } from '../../blueprint/schema';
import { LEGACY_REMINDER_LABELS, LEGACY_REVIEW_LABELS } from '../instruments/legacy/copy';

export interface PlanOption {
  /** The core quest id (the key the stores use for an intention or a priority). */
  questId: string;
  label: string;
}

const coreQuestOf = (blueprint: SystemBlueprint, domainId: string) => blueprint.quests.find((quest) => quest.domainId === domainId && quest.type === 'core');

/** Tomorrow's priority on the evening review: the engine domains, by priority. */
export function priorityOptions(blueprint: SystemBlueprint): PlanOption[] {
  return [...blueprint.domains]
    .filter((domain) => domain.role === 'engine')
    .sort((a, b) => a.priority - b.priority)
    .flatMap((domain) => {
      const quest = coreQuestOf(blueprint, domain.id);
      return quest ? [{ questId: quest.id, label: (blueprint.origin === 'legacy' ? LEGACY_REVIEW_LABELS[domain.id] : undefined) ?? domain.name }] : [];
    });
}

/** The reminders (implementation intentions) on offer: the domains that allow one, by priority. */
export function reminderOptions(blueprint: SystemBlueprint): PlanOption[] {
  return [...blueprint.domains]
    .filter((domain) => domain.intention?.allowed)
    .sort((a, b) => a.priority - b.priority)
    .flatMap((domain) => {
      const quest = coreQuestOf(blueprint, domain.id);
      return quest ? [{ questId: quest.id, label: (blueprint.origin === 'legacy' ? LEGACY_REMINDER_LABELS[domain.id] : undefined) ?? domain.name }] : [];
    });
}
