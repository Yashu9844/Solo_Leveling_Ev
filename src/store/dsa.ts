// final/03-learning-systems.md §2 — logging a problem (or reaching 25
// minutes) is what completes the DSA core quest, same auto-complete
// pattern as store/career.ts's applications. Revisits are a separate,
// smaller XP source (engine/xp.ts's PROBLEM_REVISITED case) scheduled
// by engine/srs.ts, not tied to DSA quest completion.
import type { AttemptOutcome, ReviewHistoryEntry } from '../engine/srs';
import { nextReview } from '../engine/srs';
import type { EngineConfig, EngineDeps, ProblemLoggedPayload, ProblemRevisitedPayload } from '../engine/types';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { completeQuest } from './quests';
import { rebuildProjections } from '../db/projections';
import type { DsaAttemptRow, DsaProblemRow } from '../db/schema';

const REBUILD_ADJACENT_TABLES = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
  db.dsa_problem,
  db.dsa_attempt,
];

async function maybeCompleteDsaQuest(today: string, arcId: string, config: EngineConfig, deps: EngineDeps): Promise<void> {
  const templates = await db.quest_template.toArray();
  const dsaTemplate = templates.find((t) => t.key === 'dsa' && t.type === 'core');
  if (!dsaTemplate) return;

  const instance = (await db.quest_instance.where('local_date').equals(today).toArray()).find(
    (i) => i.template_id === dsaTemplate.id
  );
  if (!instance || instance.state === 'complete') return;

  const todaysAttempts = (await db.dsa_attempt.where('local_date').equals(today).toArray()).filter(
    (a) => !a.is_revisit
  );
  const problemsToday = todaysAttempts.length;
  const minutesToday = todaysAttempts.reduce((sum, a) => sum + a.minutes, 0);

  if (problemsToday >= 1 || minutesToday >= 25) {
    await completeQuest(instance, 'dsa', arcId, config, deps);
  }
}

export interface LogProblemInput {
  slug: string;
  title: string;
  topic: string;
  difficulty: 'E' | 'M' | 'H';
  outcome: AttemptOutcome;
  minutes: number;
  insight?: string;
}

export async function logProblem(
  today: string,
  arcId: string,
  input: LogProblemInput,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const attemptId = deps.newId();
  // A single clock read for this whole call — reused for the event's
  // occurred_at and (on a new problem) first_logged_at, so
  // db/domainProjections.ts's rebuild fold can reproduce first_logged_at
  // exactly from the earliest PROBLEM_LOGGED event alone, rather than
  // approximating it from a second, slightly later deps.now() call.
  const now = deps.now();

  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    let problem = await db.dsa_problem.where('slug').equals(input.slug).first();
    if (!problem) {
      const problemRow: DsaProblemRow = {
        id: deps.newId(),
        slug: input.slug,
        title: input.title,
        topic: input.topic,
        difficulty: input.difficulty,
        first_logged_at: now,
        insight: input.insight,
      };
      await db.dsa_problem.add(problemRow);
      problem = problemRow;
    }

    const priorAttempts = await db.dsa_attempt.where('problem_id').equals(problem.id).toArray();
    const history: ReviewHistoryEntry[] = [
      ...priorAttempts
        .sort((a, b) => a.local_date.localeCompare(b.local_date))
        .map((a) => ({ local_date: a.local_date, outcome: a.outcome })),
      { local_date: today, outcome: input.outcome },
    ];
    const nextReviewAt = nextReview(input.outcome, history, config.srs);

    const payload: ProblemLoggedPayload = {
      problemId: problem.id,
      slug: input.slug,
      title: input.title,
      topic: input.topic,
      difficulty: input.difficulty,
      outcome: input.outcome,
      minutes: input.minutes,
      insight: input.insight,
    };
    await appendEvent({
      id: attemptId,
      type: 'PROBLEM_LOGGED',
      occurred_at: now,
      local_date: today,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `problem:${attemptId}`,
      schema_v: 1,
    });

    const attemptRow: DsaAttemptRow = {
      id: attemptId,
      problem_id: problem.id,
      event_id: attemptId,
      local_date: today,
      outcome: input.outcome,
      minutes: input.minutes,
      is_revisit: false,
      next_review_at: nextReviewAt,
    };
    await db.dsa_attempt.add(attemptRow);
  });

  // Outside the transaction — see store/career.ts's identical comment on
  // why completeQuest (which opens its own nested transaction) is never
  // called from within an already-open one.
  await maybeCompleteDsaQuest(today, arcId, config, deps);
}

export interface RevisitDue {
  problemId: string;
  slug: string;
  title: string;
  topic: string;
  difficulty: 'E' | 'M' | 'H';
  dueSince: string;
}

/** Up to config.srs.maxRevisitsPerDay problems whose most recent attempt
 * is due for review, oldest-due first — final/03 §2.2. */
export async function getRevisitsDue(today: string, config: EngineConfig): Promise<RevisitDue[]> {
  const allAttempts = await db.dsa_attempt.toArray();
  const latestByProblem = new Map<string, DsaAttemptRow>();
  for (const attempt of allAttempts) {
    const existing = latestByProblem.get(attempt.problem_id);
    if (!existing || attempt.local_date > existing.local_date) {
      latestByProblem.set(attempt.problem_id, attempt);
    }
  }

  const due = [...latestByProblem.values()]
    .filter((a) => a.next_review_at !== undefined && a.next_review_at <= today)
    .sort((a, b) => (a.next_review_at ?? '').localeCompare(b.next_review_at ?? ''));

  const problems = await db.dsa_problem.bulkGet(due.map((a) => a.problem_id));
  const result: RevisitDue[] = [];
  for (let i = 0; i < due.length; i++) {
    const problem = problems[i];
    if (!problem) continue;
    result.push({
      problemId: problem.id,
      slug: problem.slug,
      title: problem.title,
      topic: problem.topic,
      difficulty: problem.difficulty,
      dueSince: due[i]!.next_review_at!,
    });
  }
  return result.slice(0, config.srs.maxRevisitsPerDay);
}

export async function logRevisit(
  today: string,
  arcId: string,
  problemId: string,
  outcome: AttemptOutcome,
  minutes: number,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const attemptId = deps.newId();

  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    const priorAttempts = await db.dsa_attempt.where('problem_id').equals(problemId).toArray();
    const history: ReviewHistoryEntry[] = [
      ...priorAttempts
        .sort((a, b) => a.local_date.localeCompare(b.local_date))
        .map((a) => ({ local_date: a.local_date, outcome: a.outcome })),
      { local_date: today, outcome },
    ];
    const nextReviewAt = nextReview(outcome, history, config.srs);

    await appendEvent({
      id: attemptId,
      type: 'PROBLEM_REVISITED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { problemId, outcome, minutes } satisfies ProblemRevisitedPayload,
      source: 'user',
      idem_key: `revisit:${attemptId}`,
      schema_v: 1,
    });

    const attemptRow: DsaAttemptRow = {
      id: attemptId,
      problem_id: problemId,
      event_id: attemptId,
      local_date: today,
      outcome,
      minutes,
      is_revisit: true,
      next_review_at: nextReviewAt,
    };
    await db.dsa_attempt.add(attemptRow);
  });

  // PROBLEM_REVISITED grants XP (engine/xp.ts) — rebuild to reflect it,
  // as a separate top-level call for the same reason as completeQuest
  // above.
  await rebuildProjections(config, deps);
}

export async function getTodayDsaProgress(today: string): Promise<{ problems: number; minutes: number }> {
  const attempts = (await db.dsa_attempt.where('local_date').equals(today).toArray()).filter((a) => !a.is_revisit);
  return { problems: attempts.length, minutes: attempts.reduce((sum, a) => sum + a.minutes, 0) };
}
