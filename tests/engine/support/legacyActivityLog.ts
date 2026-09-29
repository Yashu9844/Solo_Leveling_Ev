// A realistic, deterministic 120-day event log for the owner's System —
// every legacy domain event type with valid payloads, the quest
// completions the store layer's auto-complete paths would write for
// them, lapses, recovery claims and an arc pause.
//
// Why this exists alongside randomEventLog.ts: that generator stresses
// XP/streak arithmetic with raw QUEST_COMPLETED toggles and carries
// almost no domain data, so attributes, rank gates, bosses, reality and
// messages computed from it are nearly all zero. The platform's
// golden-master and equivalence harnesses (platform/05 loops 0.3, 3.x,
// 4.x) need read models that actually move. Payload shapes and idem_key
// formats mirror the store write paths (store/career.ts, store/dsa.ts,
// store/build.ts, store/training.ts, store/lifestyle.ts, store/review.ts,
// store/recovery.ts, store/pause.ts) so the log round-trips through
// importSnapshotJson exactly as a real export would.
//
// Deterministic: same (seed, days) → deep-equal log. Ids are zero-padded
// and occurred_at strictly increases, so id order is chronological — the
// uuidv7 property db/events.ts#getAllEvents relies on.
import { addDays, format, parseISO } from 'date-fns';
import { DEFAULT_CONFIG } from '../../../src/engine/config';
import { passesQualityGate } from '../../../src/engine/career';
import { DSA_TOPICS } from '../../../src/engine/dsa';
import { FOUNDATION_TOPICS } from '../../../src/engine/foundations';
import { estimate1RM } from '../../../src/engine/training';
import { withinWakeWindow } from '../../../src/engine/sleep';
import type { CoreQuestKey, EventType, SystemEvent } from '../../../src/engine/types';
import { mulberry32 } from './randomEventLog';

export const LEGACY_ARC_ID = 'legacy-arc';
export const LEGACY_START = DEFAULT_CONFIG.arc.startDate;

// store/lifestyle.ts's constants (SLEEP_TOLERANCE_MINUTES / the 60-min
// attention limit) and store/training.ts's 8,000-step completion floor.
const SLEEP_TOLERANCE = 30;
const ATTENTION_LIMIT = 60;
const STEPS_FLOOR = 8000;

export function dateAt(offset: number): string {
  return format(addDays(parseISO(LEGACY_START), offset), 'yyyy-MM-dd');
}

export interface LegacyLogOptions {
  seed?: number;
  days?: number;
  /** Probability a day is skipped entirely (app not opened). */
  skipRate?: number;
}

export function legacyActivityLog({ seed = 42, days = 120, skipRate = 0.06 }: LegacyLogOptions = {}): SystemEvent[] {
  const rand = mulberry32(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const chance = (p: number) => rand() < p;
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const events: SystemEvent[] = [];
  let seq = 0;
  let minuteCursor = 0; // monotonic within a day, reset per day

  function push(type: EventType, localDate: string, payload: object, idemKey: string, source: SystemEvent['source'] = 'user'): string {
    const id = `lg-${String(seq++).padStart(7, '0')}`;
    // IST = UTC+05:30 and the day boundary is 04:00 IST, so 03:00Z..20:59Z
    // (08:30..02:29 IST) always lands inside `localDate`.
    const utcMinutes = 3 * 60 + minuteCursor;
    minuteCursor += 3;
    const base = parseISO(`${localDate}T00:00:00Z`).getTime();
    const occurredAt = new Date(base + utcMinutes * 60_000).toISOString();
    events.push({
      id,
      type,
      occurred_at: occurredAt,
      local_date: localDate,
      arc_id: LEGACY_ARC_ID,
      payload: payload as Record<string, unknown>,
      source,
      idem_key: idemKey,
      schema_v: 1,
    });
    return id;
  }

  function complete(key: CoreQuestKey, localDate: string) {
    const templateId = `${LEGACY_ARC_ID}::${key}`;
    const instanceId = `${templateId}::${localDate}`;
    push('QUEST_COMPLETED', localDate, { instanceId, templateId, questKey: key, localDate }, `quest-complete:${instanceId}:0`);
  }

  // ── Arc genesis — mirrors store/onboarding.ts#initialiseArc ────────────
  minuteCursor = 0;
  push(
    'ARC_STARTED',
    LEGACY_START,
    {
      arcId: LEGACY_ARC_ID,
      startDate: LEGACY_START,
      endDate: DEFAULT_CONFIG.arc.endDate,
      timezone: DEFAULT_CONFIG.arc.timezone,
      dayBoundaryHour: DEFAULT_CONFIG.arc.dayBoundaryHour,
      dayCloseHour: DEFAULT_CONFIG.arc.dayCloseHour,
      mainQuestText: 'Ship a working agent and land an offer.',
    },
    `arc-started:${LEGACY_ARC_ID}`
  );
  for (const [questKey, time] of [['career', '08:35'], ['dsa', '22:00'], ['training', '20:15']] as const) {
    push('PLAN_AMENDED', LEGACY_START, { questKey, implementationIntention: { time, place: 'desk', first_action: 'open it' } }, `plan:${LEGACY_ARC_ID}:${questKey}`);
  }
  push('METRIC_RECORDED', LEGACY_START, { kind: 'weight_kg', value: 72, unit: 'kg' }, `baseline:${LEGACY_ARC_ID}:weight_kg`);

  const applications: { id: string; date: string; whyLine: string; followedUp: boolean; status: 'applied' | 'moved' }[] = [];
  const problems: { id: string; lastDate: string }[] = [];
  let resumeVersionId = '';
  const lifts = { Squat: 80, 'Bench Press': 60, Deadlift: 100 };
  let missedYesterday: string | null = null;
  const pause = { start: 50, days: 3 };

  for (let d = 0; d < days; d++) {
    const date = dateAt(d);
    minuteCursor = 0;

    if (d === pause.start) {
      push('ARC_PAUSED', date, { localDate: date, days: pause.days }, `arc-paused:${LEGACY_ARC_ID}:${date}`);
    }
    if (d >= pause.start && d < pause.start + pause.days) continue; // paused: nothing logged

    if (d > 0 && chance(skipRate)) {
      missedYesterday = date;
      continue; // never opened
    }

    push('APP_OPENED', date, { seconds: 0 }, `app-opened:${date}`, 'system');

    // A recovery claim for yesterday's miss, with a diagnostic reason —
    // store/recovery.ts (max one per missed date).
    if (missedYesterday && dateAt(d - 1) === missedYesterday && chance(0.7)) {
      push('QUEST_RECOVERED', date, { localDate: missedYesterday, reason: pick(['ran_out_of_time', 'too_tired', 'wrong_time', 'didnt_want_to'] as const) }, `recovery:${missedYesterday}`);
    }
    missedYesterday = null;

    const effort = rand(); // a day's overall energy
    const lowDay = effort < 0.15;

    // ── SLEEP: wake time around 08:30 ─────────────────────────────────
    const wakeOffset = int(-45, 50) + (lowDay ? 30 : 0);
    const wakeMin = 8 * 60 + 30 + wakeOffset;
    const wakeTime = `${String(Math.floor(wakeMin / 60)).padStart(2, '0')}:${String(wakeMin % 60).padStart(2, '0')}`;
    push('SLEEP_LOGGED', date, { localDate: date, wakeTime, sleepTime: pick(['01:30', '02:00', '02:15', '02:45']) }, `sleep:${seq}`);
    if (withinWakeWindow(wakeTime, DEFAULT_CONFIG.wakeTargetTime, SLEEP_TOLERANCE)) complete('sleep', date);

    // Resume versions at fixed points (external review on the second).
    if (d === 0 || d === 34 || d === 72) {
      resumeVersionId = `rv-${d}`;
      push('RESUME_VERSION_CREATED', date, { resumeVersionId, label: `v${d === 0 ? 1 : d === 34 ? 2 : 3}`, changedBecause: 'Added shipped work.', externalReview: d === 34 }, `resume-version:${resumeVersionId}`);
    }

    // ── CAREER: applications, or substitute work ──────────────────────
    if (!lowDay) {
      const appCount = int(0, 5);
      let qualityToday = 0;
      let previousWhy: string | undefined;
      for (let a = 0; a < appCount; a++) {
        const applicationId = `app-${d}-${a}`;
        // An occasional duplicate why-line exercises the quality gate.
        const whyLine = previousWhy && chance(0.1) ? previousWhy : `Role ${d}-${a} matches my agent and eval work closely.`;
        const fixture = { id: applicationId, local_date: date, company: `Co${d}${a}`, role: 'AI Engineer', role_category: pick(['ai', 'backend', 'fullstack']), resume_version_id: resumeVersionId, why_line: whyLine, quality_pass: false, status: 'applied' as const };
        const qualityPass = passesQualityGate(fixture, previousWhy);
        previousWhy = whyLine;
        if (qualityPass) qualityToday++;
        push('APPLICATION_LOGGED', date, { applicationId, company: fixture.company, role: fixture.role, roleCategory: fixture.role_category, source: pick(['linkedin', 'referral', 'careers-page']), resumeVersionId, whyLine, qualityPass }, `application:${applicationId}`);
        applications.push({ id: applicationId, date, whyLine, followedUp: false, status: 'applied' });
      }
      let substituteMinutes = 0;
      if (qualityToday < 3 && chance(0.6)) {
        substituteMinutes = int(20, 40);
        push('CAREER_SUBSTITUTE_LOGGED', date, { minutes: substituteMinutes, kind: pick(['resume_iteration', 'followups', 'networking', 'portfolio', 'writeup', 'mock'] as const) }, `substitute:${seq}`);
      }
      if (qualityToday >= 3 || substituteMinutes >= 25) complete('career', date);
    }

    // Follow-ups on applications >= 10 days old, and external outcomes.
    for (const app of applications) {
      if (!app.followedUp && app.status === 'applied' && app.date <= dateAt(d - 10) && chance(0.03)) {
        app.followedUp = true;
        push('FOLLOWUP_LOGGED', date, { applicationId: app.id }, `followup:${seq}`);
      }
    }
    if (applications.length > 10 && chance(0.12)) {
      const app = pick(applications.filter((a) => a.status === 'applied') ?? []);
      if (app) {
        app.status = 'moved';
        push('CAREER_EVENT_LOGGED', date, { kind: pick(['response', 'rejection', 'call', 'interview'] as const), applicationId: app.id }, `career-event:${seq}`);
      }
    }

    // ── DSA: problems, revisits ───────────────────────────────────────
    if (!lowDay || chance(0.4)) {
      const problemCount = lowDay ? 1 : int(0, 3);
      for (let p = 0; p < problemCount; p++) {
        const problemId = `prob-${d}-${p}`;
        const difficulty = pick(['E', 'M', 'M', 'H'] as const);
        const outcome = pick(['first_attempt', 'first_attempt', 'hint', 'editorial', 'unsolved'] as const);
        push('PROBLEM_LOGGED', date, { problemId, slug: `problem-${d}-${p}`, title: `Problem ${d}.${p}`, topic: pick(DSA_TOPICS), difficulty, outcome, minutes: int(15, 45) }, `problem:${seq}`);
        problems.push({ id: problemId, lastDate: date });
      }
      if (problemCount >= 1) complete('dsa', date);
      const due = problems.filter((p) => p.lastDate <= dateAt(d - 3));
      for (let r = 0; r < Math.min(2, due.length) && chance(0.5); r++) {
        const target = due[r]!;
        target.lastDate = date;
        push('PROBLEM_REVISITED', date, { problemId: target.id, outcome: pick(['first_attempt', 'hint', 'unsolved'] as const), minutes: int(10, 25) }, `revisit:${seq}`);
      }
    }

    // ── BUILD: sessions, artifacts ────────────────────────────────────
    const buildMinutes = lowDay ? int(0, 30) : int(20, 150);
    if (buildMinutes > 0) {
      const mode = chance(0.45) ? 'SHIP' : 'LEARN';
      const projectKey = d < 40 ? 'agent-one' : d < 80 ? 'eval-kit' : 'deploy-bot';
      push('BUILD_SESSION_LOGGED', date, { mode, minutes: buildMinutes, projectKey }, `build-session:${seq}`);
      if (mode === 'SHIP' && chance(0.3)) {
        const kind = d < 20 ? 'feature' : pick(['feature', 'project', 'eval', 'deployment', 'writeup'] as const);
        const artifactId = `art-${d}`;
        push('ARTIFACT_SHIPPED', date, { artifactId, kind, title: `${kind} ${d}`, url: `https://example.com/${artifactId}`, projectKey, costPerTaskStated: kind === 'project' && d > 60 }, `artifact:${artifactId}`);
      }
      if (buildMinutes >= 45) complete('build', date);
    }

    // ── Foundations: learning blocks, system design ───────────────────
    for (let b = 0; b < int(0, 2); b++) {
      push('LEARNING_BLOCK_LOGGED', date, { topic: pick(FOUNDATION_TOPICS), minutes: 15 }, `learning-block:${seq}`);
    }
    if (chance(0.12)) {
      push('SYSTEM_DESIGN_LOGGED', date, { system: pick(['URL shortener', 'Chat', 'Rate limiter', 'Feed']), mode: pick(['studied', 'studied', 'written_up', 'explained_aloud'] as const), minutes: int(30, 60) }, `system-design:${seq}`);
    }

    // ── TRAINING: sessions (4 days/week), steps ───────────────────────
    const trainingDay = [1, 2, 4, 5].includes(d % 7) && !lowDay;
    if (trainingDay) {
      const liftRows = Object.entries(lifts).map(([name, weight]) => {
        const reps = int(5, 8);
        return { name, weight_kg: weight, reps, est_1rm: Math.round(estimate1RM(weight, reps) * 10) / 10 };
      });
      push('TRAINING_SESSION_LOGGED', date, { localDate: date, type: 'strength', minutes: int(45, 75), rpe: int(6, 9), lifts: liftRows }, `training-session:${seq}`);
      if (d % 14 === 13) for (const k of Object.keys(lifts) as (keyof typeof lifts)[]) lifts[k] += 2.5;
    }
    const steps = int(4500, 12500);
    push('STEPS_LOGGED', date, { localDate: date, steps }, `steps:${seq}`);
    if (trainingDay || steps >= STEPS_FLOOR) complete('training', date);

    // ── ATTENTION: numeric screen time ────────────────────────────────
    const screen = int(25, 95);
    push('SCREENTIME_LOGGED', date, { localDate: date, minutes: screen }, `screentime:${seq}`);
    if (screen <= ATTENTION_LIMIT) complete('attention', date);

    // ── Maintenance, body metrics, benchmark ──────────────────────────
    const laundryDue = d % DEFAULT_CONFIG.maintenanceLaundryEveryDays === 0;
    const bath = chance(0.9);
    const fuel = chance(0.8);
    const laundry = laundryDue && chance(0.7);
    push('MAINTENANCE_LOGGED', date, { localDate: date, bath, fuel, laundry, allDone: bath && fuel && (!laundryDue || laundry) }, `maintenance:${seq}`);
    if (d % 7 === 0) push('METRIC_RECORDED', date, { kind: 'weight_kg', value: 72 - d * 0.02, unit: 'kg' }, `metric:${seq}`);
    if (d === 95 || d === 110) {
      push('METRIC_RECORDED', date, { kind: 'interview_benchmark', value: d === 110 ? 1 : 0, unit: 'pass' }, `interview-benchmark:${seq}`);
    }

    // ── Evening review (most days) ────────────────────────────────────
    if (chance(0.8)) {
      push('REVIEW_COMPLETED', date, { localDate: date, energy: int(1, 5), focus: int(1, 5), blocker: pick(['time', 'tired', 'wrong_time', 'didnt_want_to', 'nothing'] as const), tomorrowPriority: pick(['career', 'dsa', 'build', 'training'] as const), sleptAt: '02:00' }, `review:${date}`);
    }
  }

  return events;
}
