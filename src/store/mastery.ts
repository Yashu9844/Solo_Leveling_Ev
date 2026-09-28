// final/05-motivation-moments-notifications.md §2.1's MASTERY Moment —
// "A topic advances state." Reads the same live tables engine/dsa.ts's
// masteryFor and engine/foundations.ts's foundationMasteryFor already
// consume; a caller (a Log*Sheet) takes a snapshot before logging and
// compares it to a snapshot after, showing the Moment only on a real
// transition — this module doesn't detect the transition itself, since
// "before" has to be captured before the write happens.
import { masteryFor, type DsaAttemptFixture } from '../engine/dsa';
import { foundationMasteryFor } from '../engine/foundations';
import type { MasteryState } from '../engine/types';
import { db } from '../db/db';

export async function getDsaTopicMastery(topic: string): Promise<MasteryState> {
  const [attempts, problems] = await Promise.all([db.dsa_attempt.toArray(), db.dsa_problem.toArray()]);
  const problemById = new Map(problems.map((p) => [p.id, p]));
  const fixtures: DsaAttemptFixture[] = attempts.map((a) => {
    const problem = problemById.get(a.problem_id);
    return {
      problem_id: a.problem_id,
      topic: problem?.topic ?? '',
      difficulty: problem?.difficulty ?? 'E',
      local_date: a.local_date,
      outcome: a.outcome,
      is_revisit: a.is_revisit,
    };
  });
  return masteryFor(topic, fixtures);
}

export async function getFoundationTopicMastery(topic: string): Promise<MasteryState> {
  const blocks = await db.learning_block.toArray();
  return foundationMasteryFor(
    topic,
    blocks.map((b) => ({ topic: b.topic, local_date: b.local_date }))
  );
}
