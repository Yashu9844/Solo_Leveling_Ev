// final/01-quests-xp-level-rank.md §3 — "progressive disclosure, not
// rewards." Displayed on the LEVEL UP Moment this slice; NOT enforced —
// gating screens by level is Slice 13.
export const LEVEL_UNLOCKS: Record<number, string> = {
  1: 'Six core quests, Today, evening review, Maintenance',
  3: 'Weekly quests',
  5: 'Attributes screen',
  6: 'Career funnel view',
  8: 'DSA spaced revisits',
  10: 'Skills screen',
  12: 'Weekly review',
  15: 'Boss quests',
  20: 'Arc projection',
};

/** The unlock line for reaching `level`, or undefined if it unlocks nothing. */
export function unlockTextFor(level: number): string | undefined {
  return LEVEL_UNLOCKS[level];
}

/** Unlock text for a level-up spanning (fromLevel, toLevel] — a single
 * grant can cross more than one boundary. Joins every unlock in the
 * range; omits the line entirely if none of the crossed levels unlock
 * anything. */
export function unlockTextForRange(fromLevel: number, toLevel: number): string | undefined {
  const texts: string[] = [];
  for (let level = fromLevel + 1; level <= toLevel; level++) {
    const text = LEVEL_UNLOCKS[level];
    if (text) texts.push(text);
  }
  return texts.length > 0 ? texts.join(' · ') : undefined;
}
