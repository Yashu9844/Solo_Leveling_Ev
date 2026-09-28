// final/02-career-system.md §2 — logging an application (or substitute
// work) is what completes the CAREER core quest: 3 quality applications
// OR 25 minutes of substitute work, whichever comes first, reusing
// store/quests.ts's completeQuest so the event+rebuild mechanics (and
// XP/caps) don't get a second implementation. The manual QuestRow tap
// stays available as a fallback/override — this only adds an automatic
// path on top of it, it doesn't replace it.
import type {
  ApplicationLoggedPayload,
  CareerEventKind,
  CareerEventLoggedPayload,
  CareerSubstituteLoggedPayload,
  EngineConfig,
  EngineDeps,
  FollowupLoggedPayload,
  ResumeVersionCreatedPayload,
} from '../engine/types';
import { passesQualityGate, careerEventKindToStatus, type ApplicationFixture } from '../engine/career';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import { completeQuest } from './quests';
import type { ApplicationRow, CareerEventRow, ResumeVersionRow } from '../db/schema';

const REBUILD_ADJACENT_TABLES = [
  db.event,
  db.arc,
  db.quest_template,
  db.quest_instance,
  db.xp_ledger,
  db.day_rollup,
  db.player_state,
  db.application,
  db.career_event,
  db.resume_version,
];

async function maybeCompleteCareerQuest(
  today: string,
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  const templates = await db.quest_template.toArray();
  const careerTemplate = templates.find((t) => t.key === 'career' && t.type === 'core');
  if (!careerTemplate) return;

  const instance = (await db.quest_instance.where('local_date').equals(today).toArray()).find(
    (i) => i.template_id === careerTemplate.id
  );
  if (!instance || instance.state === 'complete') return;

  const qualityAppsToday = (await db.application.where('local_date').equals(today).toArray()).filter(
    (a) => a.quality_pass
  ).length;

  const substituteEvents = (await db.event.where('local_date').equals(today).toArray()).filter(
    (e) => e.type === 'CAREER_SUBSTITUTE_LOGGED'
  );
  const substituteMinutesToday = substituteEvents.reduce(
    (sum, e) => sum + ((e.payload as unknown as CareerSubstituteLoggedPayload).minutes ?? 0),
    0
  );

  if (qualityAppsToday >= 3 || substituteMinutesToday >= 25) {
    await completeQuest(instance, 'career', arcId, config, deps);
  }
}

export interface LogApplicationInput {
  company: string;
  role: string;
  roleCategory: string;
  source: string;
  resumeVersionId: string;
  whyLine: string;
}

/** Returns whether the application passed the quality gate — the UI
 * shows this immediately; a failing application still gets logged
 * (final/02 §2.1: "Duplicate or empty lines earn 0 XP ... and are
 * flagged in the weekly review" — logged, not silently discarded). */
export async function logApplication(
  today: string,
  arcId: string,
  input: LogApplicationInput,
  config: EngineConfig,
  deps: EngineDeps
): Promise<boolean> {
  const todaysApplications = await db.application.where('local_date').equals(today).toArray();
  const previousWhyLine = todaysApplications[todaysApplications.length - 1]?.why_line;

  const fixture: ApplicationFixture = {
    id: deps.newId(),
    local_date: today,
    company: input.company,
    role: input.role,
    role_category: input.roleCategory,
    resume_version_id: input.resumeVersionId,
    why_line: input.whyLine,
    quality_pass: false,
    status: 'applied',
  };
  const qualityPass = passesQualityGate(fixture, previousWhyLine);

  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    const payload: ApplicationLoggedPayload = {
      applicationId: fixture.id,
      company: input.company,
      role: input.role,
      roleCategory: input.roleCategory,
      source: input.source,
      resumeVersionId: input.resumeVersionId,
      whyLine: input.whyLine,
      qualityPass,
    };
    await appendEvent({
      id: deps.newId(),
      type: 'APPLICATION_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `application:${fixture.id}`,
      schema_v: 1,
    });

    const row: ApplicationRow = {
      id: fixture.id,
      local_date: today,
      company: input.company,
      role: input.role,
      role_category: input.roleCategory,
      source: input.source,
      resume_version_id: input.resumeVersionId,
      why_line: input.whyLine,
      quality_pass: qualityPass,
      status: 'applied',
      status_history: [{ status: 'applied', date: today }],
      followup_due_at: shiftDate(today, 10),
    };
    await db.application.add(row);
  });

  // Deliberately OUTSIDE the transaction above: maybeCompleteCareerQuest
  // calls store/quests.ts's completeQuest, which opens its own
  // transaction and itself calls rebuildProjections (another nested
  // transaction). Calling it as a separate, sequential top-level call —
  // the same calling convention Today.tsx's handleToggle already uses —
  // keeps this on the one proven-correct call shape for completeQuest
  // rather than introducing a second, deeper one. This costs atomicity
  // with the application write above (a crash in between leaves the
  // application logged but the quest not yet auto-completed), but
  // that's exactly what verifyIntegrity()/a later manual tap self-heals,
  // and the gap is a single microtask wide in practice.
  if (qualityPass) {
    await maybeCompleteCareerQuest(today, arcId, config, deps);
  }

  return qualityPass;
}

export async function logSubstituteWork(
  today: string,
  arcId: string,
  minutes: number,
  kind: CareerSubstituteLoggedPayload['kind'],
  config: EngineConfig,
  deps: EngineDeps
): Promise<void> {
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    const payload: CareerSubstituteLoggedPayload = { minutes, kind };
    const id = deps.newId();
    await appendEvent({
      id,
      type: 'CAREER_SUBSTITUTE_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      // Not once-per-day like most idem_keys — substitute work can be
      // logged multiple times a day, so each entry is its own event,
      // uniqueness anchored to the event's own generated id.
      idem_key: `substitute:${id}`,
      schema_v: 1,
    });
  });

  // Outside the transaction — see the comment in logApplication above.
  await maybeCompleteCareerQuest(today, arcId, config, deps);
}

/** EXTERNAL outcomes (response/call/interview/onsite/offer/rejection) and
 * the CONTROLLED conversation/mock kinds share one audit trail — never
 * XP either way; see engine/xp.ts's computeXp, which returns [] for
 * CAREER_EVENT_LOGGED regardless of kind. */
export async function logCareerEvent(
  today: string,
  arcId: string,
  kind: CareerEventKind,
  deps: EngineDeps,
  applicationId?: string,
  stuckOn?: string
): Promise<void> {
  const payload: CareerEventLoggedPayload = { kind, applicationId, stuckOn };
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    const eventId = deps.newId();
    await appendEvent({
      id: eventId,
      type: 'CAREER_EVENT_LOGGED',
      occurred_at: deps.now(),
      local_date: today,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `career-event:${eventId}`,
      schema_v: 1,
    });
    const row: CareerEventRow = { id: eventId, local_date: today, kind, application_id: applicationId, stuck_on: stuckOn };
    await db.career_event.add(row);

    if (applicationId && kind !== 'followup') {
      const application = await db.application.get(applicationId);
      if (application) {
        const status = careerEventKindToStatus(kind) ?? application.status;
        await db.application.update(applicationId, {
          status,
          status_history: [...application.status_history, { status, date: today }],
        });
      }
    }
  });
}

export async function logFollowup(today: string, arcId: string, applicationId: string, deps: EngineDeps): Promise<void> {
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    const payload: FollowupLoggedPayload = { applicationId };
    const id = deps.newId();
    // A single clock read, reused for the event's occurred_at, the
    // idem_key, and the application row's followed_up_at — three
    // separate deps.now() calls used to read three slightly different
    // instants, which meant a rebuild (db/domainProjections.ts) could
    // never reproduce followed_up_at exactly from the event alone.
    const now = deps.now();
    await appendEvent({
      id,
      type: 'FOLLOWUP_LOGGED',
      occurred_at: now,
      local_date: today,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `followup:${id}`,
      schema_v: 1,
    });
    await db.application.update(applicationId, { followed_up_at: now });
  });
}

export async function createResumeVersion(
  today: string,
  label: string,
  changedBecause: string,
  arcId: string,
  deps: EngineDeps,
  externalReview = false
): Promise<string> {
  const id = deps.newId();
  // One clock read, reused for occurred_at and created_at — previously
  // three separate deps.now() calls (plus a fourth deriving local_date
  // from a raw UTC slice instead of `today`, ignoring the arc's
  // timezone/day-boundary-hour entirely, unlike every other write in
  // this file). Both fixed: `today` is the caller's already-computed
  // local_date (same convention as logApplication), and event.id is
  // reused as the row's own id.
  const now = deps.now();
  await db.transaction('rw', REBUILD_ADJACENT_TABLES, async () => {
    const payload: ResumeVersionCreatedPayload = { resumeVersionId: id, label, changedBecause, externalReview };
    await appendEvent({
      id,
      type: 'RESUME_VERSION_CREATED',
      occurred_at: now,
      local_date: today,
      arc_id: arcId,
      payload: payload as unknown as Record<string, unknown>,
      source: 'user',
      idem_key: `resume-version:${id}`,
      schema_v: 1,
    });
    const row: ResumeVersionRow = { id, label, created_at: now, changed_because: changedBecause, external_review: externalReview };
    await db.resume_version.add(row);
  });
  return id;
}

export async function getResumeVersions(): Promise<ResumeVersionRow[]> {
  return db.resume_version.toArray();
}

export async function getTodayApplicationCount(today: string): Promise<{ quality: number; total: number }> {
  const applications = await db.application.where('local_date').equals(today).toArray();
  return { quality: applications.filter((a) => a.quality_pass).length, total: applications.length };
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y!, m! - 1, d!) + days * 86_400_000;
  return new Date(utcMs).toISOString().slice(0, 10);
}
