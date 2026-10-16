// A support domain (platform/02 §8.1): a part of the System with no quest of its own - a study log, a routine - that earns only
// the grant its instrument pays (a block, a row), capped at that unit, and never gates a rank. Any archetype that keeps a study
// block or a checklist can be held as support; it is how the maximum System has more to track than eight quests can carry.
import type { ArchetypeDef } from './types';

/** Whether an archetype has something a support domain can be built on. */
export function canBeSupport(archetype: ArchetypeDef): boolean {
  return archetype.instruments.some((instrument) => instrument.type === 'study_block' || instrument.type === 'checklist');
}

/** The archetype held as support: no quest, no ladder, no boss, no attribute, no gate condition - its instruments and metrics only. */
export function asSupport(archetype: ArchetypeDef): ArchetypeDef {
  const checklist = archetype.instruments.some((instrument) => instrument.type === 'checklist') && !archetype.instruments.some((instrument) => instrument.type === 'study_block');
  return {
    ...archetype, role: 'support', headroom: checklist ? 'checklist' : 'study', quest: undefined, ladder: undefined, attribute: undefined,
    bossAnchor: undefined, conditions: undefined, skillTree: undefined, intention: false,
  };
}
