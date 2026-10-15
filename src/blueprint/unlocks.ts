// Level unlocks (final/01 §3, platform/03 §27.3): progressive disclosure, not rewards. A generated System names the
// level at which each part of the app appears, so a person's first week shows the loop and nothing else; the owner's
// System names none, which means everything is open from the start, as it always has been (the unlocks it displays are
// not enforced - deviation list in legacy/deviations.md).
import type { ProgressionSection } from './schema';

export type FeatureId = 'weekly_quests' | 'attributes' | 'skills' | 'weekly_review' | 'bosses' | 'projection';

export const FEATURE_IDS: readonly FeatureId[] = ['weekly_quests', 'attributes', 'skills', 'weekly_review', 'bosses', 'projection'];

/** What each feature is called when something says it is locked. */
export const FEATURE_LABELS: Readonly<Record<FeatureId, string>> = {
  weekly_quests: 'WEEKLY QUESTS', attributes: 'ATTRIBUTES', skills: 'SKILLS', weekly_review: 'WEEKLY REVIEW', bosses: 'BOSSES', projection: 'ARC PROJECTION',
};

/** The level at which a feature opens, or undefined if this System gates nothing. */
export function unlockLevel(progression: Pick<ProgressionSection, 'unlocks'>, feature: FeatureId): number | undefined {
  return progression.unlocks?.[feature];
}

/** Whether `feature` is open at `level`. A System with no unlock table is open everywhere. */
export function featureUnlocked(progression: Pick<ProgressionSection, 'unlocks'>, feature: FeatureId, level: number): boolean {
  const at = unlockLevel(progression, feature);
  return at === undefined || level >= at;
}
