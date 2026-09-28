// The evening review write path (final/05 §5: 25 seconds, 5 taps, no
// typing) and the daily report it unlocks. XP, core completion and the
// streak are real, computed from the same tables every other screen
// reads. Deep work / applications / problems from the wireframe's report
// are omitted, not faked with zeros — they need domain data (Slices 6-9)
// this app doesn't have yet.
import { addDays, format, parseISO } from 'date-fns';
import type { CoreQuestKey, EngineConfig, EngineDeps, ReviewBlocker, ReviewCompletedPayload } from '../engine/types';
import { applyEvents } from '../engine/reduce';
import { arcDay } from '../engine/time';
import { selectMessage, type DayFacts } from '../engine/messages';
import { streakFrom } from '../engine/streak';
import { db } from '../db/db';
import { appendEvent, getAllEvents } from '../db/events';
import { rebuildProjections, buildDayOutcomes } from '../db/projections';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

const REBUILD_TABLES_FOR_REVIEW = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
];

export async function hasReviewedToday(today: string): Promise<boolean> {
  const existing = await db.event.where('idem_key').equals(`review:${today}`).first();
  return existing != null;
}

export interface ReviewInput {
  energy: number; // 1-5
  focus: number; // 1-5
  blocker: ReviewBlocker;
  tomorrowPriority?: CoreQuestKey;
  sleptAt?: string; // "HH:mm"
}

export async function completeEveningReview(
  today: string,
  arcId: string,
  input: ReviewInput,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  await db.transaction('rw', REBUILD_TABLES_FOR_REVIEW, async () => {
    const payload: ReviewCompletedPayload = { localDate: today, ...input };
    await appendEvent({
      id: deps.newId(),
      type: 'REVIEW_COMPLETED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `review:${today}`,
      schema_v: 1,
    });
    await rebuildProjections(config, deps);
  });
}

export interface DailyReport {
  day: number;
  xp: number;
  coreCompleted: number;
  coreTotal: number;
  arcStreak: number;
  strongest: { key: CoreQuestKey; title: string; streakDays: number } | null;
  weakest: { key: CoreQuestKey; title: string; missesInWindow: number; windowDays: number } | null;
  message: string;
}

const CONSISTENCY_KEY_WINDOW = 7;

/**
 * Built for `today` — the day just reviewed, so (unlike the live TODAY
 * screen's getStreakState) this INCLUDES today: the review only happens
 * once today's activity is done, so today is a finished day by the time
 * this is called.
 */
export async function getDailyReport(today: string, config: EngineConfig): Promise<DailyReport | null> {
  const arc = await db.arc.toCollection().first();
  if (!arc) return null;

  const rollup = await db.day_rollup.get(today);
  const templates = await db.quest_template.toArray();
  const coreTemplates = templates.filter(
    (t) => t.type === 'core' && t.active_from <= today && (t.active_to === null || today < t.active_to)
  );
  const todayInstances = await db.quest_instance.where('local_date').equals(today).toArray();
  const coreCompleted = todayInstances.filter(
    (i) => i.state === 'complete' && coreTemplates.some((t) => t.id === i.template_id)
  ).length;

  const events = await getAllEvents();
  const state = applyEvents(events, config);

  const recentDates = enumerateBack(today, CONSISTENCY_KEY_WINDOW).filter((d) => d >= arc.start_date);
  const perKeyHistory = new Map<CoreQuestKey, boolean[]>(); // chronological, oldest first
  for (const template of coreTemplates) {
    const days: boolean[] = [];
    for (const date of recentDates) {
      const dayInstances = await db.quest_instance.where('local_date').equals(date).toArray();
      const complete = dayInstances.some((i) => i.template_id === template.id && i.state === 'complete');
      days.push(complete);
    }
    perKeyHistory.set(template.key, days);
  }

  const strongest = bestByTrailingStreak(coreTemplates, perKeyHistory);
  const weakest = worstByMisses(coreTemplates, perKeyHistory, recentDates.length);

  const dayFacts: DayFacts = { local_date: today, core_completed: coreCompleted, core_total: coreTemplates.length };
  const trailingDayFacts = await trailingDayFactsFor(today, arc.start_date, templates);
  const message = selectMessage({ today: dayFacts, trailingDays: trailingDayFacts });

  // Unlike the live TODAY screen's getStreakState (which excludes today —
  // the day is still in progress there), the review only runs after
  // today's activity is done, so today IS included as a finished day.
  const dayOutcomes = state.arc
    ? buildDayOutcomes(events, state.quests, state.arc.start_date, state.arc.paused_dates, today)
    : [];
  const arcStreak = dayOutcomes.length > 0 ? streakFrom(dayOutcomes, config.streak).arc_streak : 0;

  return {
    day: arcDay(`${today}T12:00:00Z`, arc.start_date, arc.timezone, arc.day_boundary_hour),
    xp: rollup?.xp_earned ?? 0,
    coreCompleted,
    coreTotal: coreTemplates.length,
    arcStreak,
    strongest,
    weakest,
    message,
  };
}

function enumerateBack(today: string, count: number): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(shiftDate(today, -i));
  }
  return dates;
}

function bestByTrailingStreak(
  templates: { key: CoreQuestKey; title: string }[],
  history: Map<CoreQuestKey, boolean[]>
): DailyReport['strongest'] {
  let best: DailyReport['strongest'] = null;
  for (const template of templates) {
    const days = history.get(template.key) ?? [];
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (!days[i]) break;
      streak += 1;
    }
    if (streak > 0 && (!best || streak > best.streakDays)) {
      best = { key: template.key, title: template.title, streakDays: streak };
    }
  }
  return best;
}

function worstByMisses(
  templates: { key: CoreQuestKey; title: string }[],
  history: Map<CoreQuestKey, boolean[]>,
  windowDays: number
): DailyReport['weakest'] {
  let worst: DailyReport['weakest'] = null;
  for (const template of templates) {
    const days = history.get(template.key) ?? [];
    const misses = days.filter((d) => !d).length;
    if (misses > 0 && (!worst || misses > worst.missesInWindow)) {
      worst = { key: template.key, title: template.title, missesInWindow: misses, windowDays: days.length };
    }
  }
  return worst ? { ...worst, windowDays } : null;
}

async function trailingDayFactsFor(
  today: string,
  arcStartDate: string,
  templates: { type: string; active_from: string; active_to: string | null }[]
): Promise<DayFacts[]> {
  const dates = enumerateBack(shiftDate(today, -1), 14).filter((d) => d >= arcStartDate);
  const facts: DayFacts[] = [];
  for (const date of dates) {
    const opened = await db.event.where('idem_key').equals(`app-opened:${date}`).first();
    if (!opened) continue;
    const coreTotal = templates.filter(
      (t) => t.type === 'core' && t.active_from <= date && (t.active_to === null || date < t.active_to)
    ).length;
    const dayInstances = await db.quest_instance.where('local_date').equals(date).toArray();
    const coreCompleted = dayInstances.filter((i) => i.state === 'complete').length;
    facts.push({ local_date: date, core_completed: coreCompleted, core_total: coreTotal });
  }
  return facts;
}
