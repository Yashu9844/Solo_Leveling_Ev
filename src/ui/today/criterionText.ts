import type { CoreQuestKey } from '../../engine/types';

// Presentation copy only — not domain logic. The actual criterion values
// live in engine/quests.ts's CORE_QUEST_CRITERIA; these strings describe
// them in the exact wording of final/01-quests-xp-level-rank.md §1 and
// final/06-ux-screens-design.md §5.2's row summaries.

/** Short row-summary text, e.g. "3 applications". final/06 §5.2. */
export const ROW_SUMMARY: Record<CoreQuestKey, string> = {
  career: '3 despatches / 25m focus',
  dsa: '1 logic problem / 25m',
  build: '45m construct session',
  training: 'conditioning or 8k steps',
  sleep: 'sync window 08:00–09:00',
  attention: 'friction control ≤ 60m',
};

/** The completion criterion, in plain words, for the quest detail sheet. */
export const CRITERION_TEXT: Record<CoreQuestKey, string> = {
  career: '3 verified despatches, or 25 minutes of substitute ascension focus.',
  dsa: '1 logic problem logged, or 25 minutes of algorithm analysis.',
  build: '45+ minutes of construct work, tagged ASSIMILATE or MANIFEST.',
  training: 'A physical conditioning session, or 8,000+ steps registered.',
  sleep: 'Synchronization active: wake within 30 minutes of 08:30 (08:00–09:00).',
  attention: 'Cognitive friction control: 60 minutes or under screen time.',
};
