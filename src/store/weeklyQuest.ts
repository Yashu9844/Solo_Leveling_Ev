// final/00 §C8's weekly quest payout — proposal (engine/weeklyQuest.ts),
// acceptance (a direct-write weekly_quest row, same non-event-sourced
// pattern as checkpoint's self_efficacy — see db/schema.ts's
// WeeklyQuestRow doc comment), live progress, and idempotent completion
// (WEEKLY_QUEST_COMPLETED, checked and claimed on every read, same
// pattern as store/boss.ts's clearBoss).
import { addDays, format, parseISO } from 'date-fns';
import { proposeWeeklyQuest, type DsaTopicRate, type WeeklyQuestProposal } from '../engine/weeklyQuest';
import type { EngineConfig, EngineDeps, WeeklyQuestCompletedPayload } from '../engine/types';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { rebuildProjections } from '../db/projections';
import type { WeeklyQuestRow } from '../db/schema';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

const REBUILD_ADJACENT_TABLES = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
  db.weekly_quest,
];

/** Last 7 days ending `today` (inclusive) — same window shape as
 * store/weeklyReview.ts's `weekDates`. */
function trailingWeek(today: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDate(today, -(6 - i)));
}

async function dsaTopicRatesFor(dates: string[]): Promise<DsaTopicRate[]> {
  const dateSet = new Set(dates);
  const [attempts, problems] = await Promise.all([db.dsa_attempt.toArray(), db.dsa_problem.toArray()]);
  const problemById = new Map(problems.map((p) => [p.id, p]));

  const byTopic = new Map<string, { attempts: number; firstAttempts: number }>();
  for (const a of attempts) {
    if (a.is_revisit || !dateSet.has(a.local_date)) continue;
    const topic = problemById.get(a.problem_id)?.topic ?? '';
    if (!topic) continue;
    const bucket = byTopic.get(topic) ?? { attempts: 0, firstAttempts: 0 };
    bucket.attempts += 1;
    if (a.outcome === 'first_attempt') bucket.firstAttempts += 1;
    byTopic.set(topic, bucket);
  }

  return [...byTopic.entries()].map(([topic, b]) => ({
    topic,
    attempts: b.attempts,
    firstAttemptRate: b.firstAttempts / b.attempts,
  }));
}

export async function getWeeklyQuestProposal(today: string): Promise<WeeklyQuestProposal> {
  const rates = await dsaTopicRatesFor(trailingWeek(today));
  return proposeWeeklyQuest(rates);
}

export async function acceptWeeklyQuest(today: string, proposal: WeeklyQuestProposal, deps: { newId(): string }): Promise<WeeklyQuestRow | null> {
  const existing = await getActiveWeeklyQuestRow(today);
  if (existing) return null; // one at a time — see the module doc comment

  const row: WeeklyQuestRow = {
    id: deps.newId(),
    week_start_date: today,
    week_end_date: shiftDate(today, 6),
    kind: proposal.kind,
    description: proposal.description,
    target: proposal.target,
    topic: proposal.topic,
    xp: 0, // set on completion, from config.weeklyQuestXp — see claimIfComplete
  };
  await db.weekly_quest.add(row);
  return row;
}

async function getActiveWeeklyQuestRow(today: string): Promise<WeeklyQuestRow | undefined> {
  const all = await db.weekly_quest.toArray();
  return all.find((q) => q.week_start_date <= today && today <= q.week_end_date && q.completed_at === undefined);
}

async function progressFor(row: WeeklyQuestRow): Promise<number> {
  if (row.kind === 'ship_project') {
    const artifacts = await db.artifact.toArray();
    return artifacts.filter((a) => a.local_date >= row.week_start_date && a.local_date <= row.week_end_date).length;
  }
  // dsa_topic_volume
  const [attempts, problems] = await Promise.all([db.dsa_attempt.toArray(), db.dsa_problem.toArray()]);
  const problemById = new Map(problems.map((p) => [p.id, p]));
  return attempts.filter(
    (a) =>
      !a.is_revisit &&
      a.local_date >= row.week_start_date &&
      a.local_date <= row.week_end_date &&
      problemById.get(a.problem_id)?.topic === row.topic
  ).length;
}

export interface ActiveWeeklyQuest {
  row: WeeklyQuestRow;
  progress: number;
  justCompleted: boolean;
}

/**
 * The current week's accepted quest, if any, with live progress —
 * never cached, same "derived, not stored" principle as Boss status.
 * Claims (appends WEEKLY_QUEST_COMPLETED, grants config.weeklyQuestXp)
 * the moment progress reaches target, exactly once — a second read
 * after completion returns the same row with `completed_at` already
 * set and no further claim attempted.
 */
export async function getActiveWeeklyQuest(today: string, arcId: string, config: EngineConfig, deps: EngineDeps): Promise<ActiveWeeklyQuest | null> {
  const row = await getActiveWeeklyQuestRow(today);
  if (!row) return null;

  const progress = await progressFor(row);
  if (progress < row.target) {
    return { row, progress, justCompleted: false };
  }

  const xp = config.weeklyQuestXp;
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    await appendEvent({
      id: deps.newId(),
      type: 'WEEKLY_QUEST_COMPLETED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: { weeklyQuestId: row.id } satisfies WeeklyQuestCompletedPayload,
      source: 'user',
      idem_key: `weekly-quest:${row.id}`,
      schema_v: 1,
    });
    await db.weekly_quest.update(row.id, { completed_at: deps.now(), xp });
  });
  await rebuildProjections(config, deps);

  const completedRow = await db.weekly_quest.get(row.id);
  return { row: completedRow ?? { ...row, completed_at: deps.now(), xp }, progress, justCompleted: true };
}
