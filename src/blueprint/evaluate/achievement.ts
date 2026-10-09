// Achievements and identities (platform/02 §15.4): statements of accumulated
// fact, never "unlocked" by an event — each is its condition evaluated live
// against the same evidence the rank gates read. A Blueprint lists both in
// one array, told apart by `kind`; the result keeps the legacy order
// (achievements, then identities) and the legacy {id, label, earned} shape.
import type { SystemBlueprint } from '../schema';
import { evaluateCondition } from './condition';
import type { SignalEnv } from './signals';

export interface EarnedItem { id: string; label: string; earned: boolean }
export interface AchievementsReport { achievements: EarnedItem[]; identities: EarnedItem[] }

export function evaluateAchievements(blueprint: SystemBlueprint, env: SignalEnv): AchievementsReport {
  const evaluate = (kind: 'achievement' | 'identity'): EarnedItem[] =>
    blueprint.achievements
      .filter((definition) => (definition.kind ?? 'achievement') === kind)
      .map((definition) => ({ id: definition.id, label: definition.label, earned: evaluateCondition(definition.condition, env).met }));
  return { achievements: evaluate('achievement'), identities: evaluate('identity') };
}
