// final/01-quests-xp-level-rank.md §8 / docs/02-behavioral-evidence.md —
// "Someone Who Keeps Promises (80% if-then firing rate over 60 days)."
// "Firing" has no formula stated anywhere in final/ or docs/; resolved
// here the same way docs/02's own risk note frames it ("a plan below
// 40% completion gets flagged... checkpoint review of every plan's
// firing rate"): a plan "fires" when its quest completes ON THE DAY the
// cue was meant to trigger it — not via a later recovery claim, since a
// recovered day is explicitly evidence the cue was missed, not honored.
export interface FirableQuestInstanceFixture {
  state: 'available' | 'in_progress' | 'complete' | 'incomplete' | 'recoverable' | 'expired';
  recovered: boolean;
}

/**
 * Pure. The fraction of instances (across every core-quest key carrying
 * an implementation intention, over whatever trailing window the caller
 * already filtered to) that completed on their own day, not via a later
 * recovery claim. 0 on an empty window — no data reads as "not proven,"
 * never as "achieved," matching every other achievement's fail-safe
 * direction (engine/rank.ts's ZERO_EVIDENCE precedent).
 */
export function ifThenFiringRate(instances: FirableQuestInstanceFixture[]): number {
  if (instances.length === 0) return 0;
  const fired = instances.filter((i) => i.state === 'complete' && !i.recovered).length;
  return fired / instances.length;
}
