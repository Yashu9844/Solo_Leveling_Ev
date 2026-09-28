// final/00 §C8 / final/03 §4.4 — "the system proposes, you dispose; you
// never author quests from scratch weekly" (final/05 §6). This is the
// proposal generator: given last week's real DSA data, either targets
// the weakest topic by first-attempt rate, or — with no DSA data yet —
// falls back to a ship-focused quest, since a brand-new arc has nothing
// to compute a "weakest topic" from.
export interface DsaTopicRate {
  topic: string;
  attempts: number;
  firstAttemptRate: number; // 0-1
}

export interface WeeklyQuestProposal {
  kind: 'dsa_topic_volume' | 'ship_project';
  description: string;
  target: number;
  topic?: string;
}

const MIN_TARGET = 10;
const STRETCH_FACTOR = 1.5;

/**
 * Pure. Picks the topic with the lowest first-attempt rate among those
 * with at least one attempt last week (ties resolved by topic name for
 * determinism), and proposes a volume target: a stretch above last
 * week's own volume for that topic (final/05 §6's example — "18
 * problems" against a lower prior week's count), floored at
 * MIN_TARGET so a topic touched only once doesn't propose "2 problems."
 */
export function proposeWeeklyQuest(dsaTopicRates: DsaTopicRate[]): WeeklyQuestProposal {
  const withData = dsaTopicRates.filter((t) => t.attempts > 0);
  if (withData.length === 0) {
    return {
      kind: 'ship_project',
      description: 'Ship one real unit of progress this week',
      target: 1,
    };
  }

  const weakest = withData.reduce((worst, t) => {
    if (t.firstAttemptRate < worst.firstAttemptRate) return t;
    if (t.firstAttemptRate === worst.firstAttemptRate && t.topic < worst.topic) return t;
    return worst;
  });

  const target = Math.max(MIN_TARGET, Math.round(weakest.attempts * STRETCH_FACTOR));
  const ratePct = Math.round(weakest.firstAttemptRate * 100);

  return {
    kind: 'dsa_topic_volume',
    description: `${target} problems, ${weakest.topic} focus (${ratePct}% first-attempt, weakest)`,
    target,
    topic: weakest.topic,
  };
}
