// final/07-data-model-architecture.md §6: "the event log alone is a
// complete backup." db/projections.ts's rebuildProjections already makes
// that true for quest_template/quest_instance/xp_ledger/day_rollup/
// player_state (Slice 3-4). It was never true for the domain detail
// tables (applications, DSA problems, training sessions, artifacts,
// etc.) — they're written alongside their events by each store/*.ts
// module's own write path, never derived from the log by anything. This
// module is that derivation, built for the same reason rebuildProjections
// was: so verifyIntegrity() has something real to diff against, and so
// import (store/backup.ts) can actually restore what export promised to
// save.
//
// Deliberately a SEPARATE fold from rebuildProjections, not merged into
// it. rebuildProjections runs after nearly every write in the app (every
// quest completion, every domain log) — folding a dozen more tables into
// that hot path multiplies the blast radius of any bug here across code
// that has been running reliably for many slices. This fold is invoked
// only by verifyIntegrity (read-only diff) and importSnapshotJson (an
// explicit, rare, already-destructive operation) — both places where a
// bug here is caught immediately rather than silently corrupting live
// data on a routine quest tap.
//
// Every write path this mirrors was audited for exactly one property:
// every field the fold needs is either in the event's envelope
// (id, local_date, occurred_at) or its payload — never a second,
// independently-generated id or a second, independently-read clock
// value that the event itself doesn't carry. Three real gaps were found
// and fixed doing this (not just documented): PROBLEM_LOGGED was missing
// `title` entirely; CAREER_EVENT_LOGGED's row used a different id than
// its own event; logFollowup and createResumeVersion each read the clock
// two or three separate times for values that all needed to be the same
// instant. See the store/career.ts and store/dsa.ts diffs from that
// pass.
import { addDays, format, parseISO } from 'date-fns';
import type {
  ArtifactShippedPayload,
  BuildSessionLoggedPayload,
  CareerEventLoggedPayload,
  EngineConfig,
  LearningBlockLoggedPayload,
  MaintenanceLoggedPayload,
  MetricRecordedPayload,
  ProblemLoggedPayload,
  ProblemRevisitedPayload,
  ResumeVersionCreatedPayload,
  ScreentimeLoggedPayload,
  SleepLoggedPayload,
  StepsLoggedPayload,
  SystemDesignLoggedPayload,
  SystemEvent,
  TrainingSessionLoggedPayload,
} from '../engine/types';
import { careerEventKindToStatus, type ApplicationStatus } from '../engine/career';
import { nextReview, type ReviewHistoryEntry } from '../engine/srs';
import type {
  ApplicationRow,
  ArtifactRow,
  BuildSessionRow,
  CareerEventRow,
  DsaAttemptRow,
  DsaProblemRow,
  LearningBlockRow,
  MaintenanceLogRow,
  MetricSampleRow,
  ResumeVersionRow,
  SystemDesignStudyRow,
  TrainingSessionRow,
} from './schema';

export interface DomainTables {
  applications: ApplicationRow[];
  careerEvents: CareerEventRow[];
  resumeVersions: ResumeVersionRow[];
  dsaProblems: DsaProblemRow[];
  dsaAttempts: DsaAttemptRow[];
  learningBlocks: LearningBlockRow[];
  systemDesigns: SystemDesignStudyRow[];
  buildSessions: BuildSessionRow[];
  artifacts: ArtifactRow[];
  trainingSessions: TrainingSessionRow[];
  metricSamples: MetricSampleRow[];
  maintenanceLogs: MaintenanceLogRow[];
}

function payload<T>(event: SystemEvent): T {
  return event.payload as unknown as T;
}

/**
 * Pure. Folds the full event log into every domain detail table, in the
 * exact shape the live write paths produce. `events` must already be in
 * chronological order (getAllEvents()'s convention — id is uuidv7, so
 * ordering by id is ordering by time); nothing here re-sorts.
 */
export function buildDomainTables(events: SystemEvent[], config: EngineConfig): DomainTables {
  const applicationsById = new Map<string, ApplicationRow>();
  const careerEvents: CareerEventRow[] = [];
  const resumeVersions: ResumeVersionRow[] = [];
  const dsaProblemsById = new Map<string, DsaProblemRow>();
  const dsaAttempts: DsaAttemptRow[] = [];
  const attemptHistoryByProblem = new Map<string, ReviewHistoryEntry[]>();
  const learningBlocks: LearningBlockRow[] = [];
  const systemDesigns: SystemDesignStudyRow[] = [];
  const buildSessions: BuildSessionRow[] = [];
  const artifacts: ArtifactRow[] = [];
  const trainingSessions: TrainingSessionRow[] = [];
  const metricSamples: MetricSampleRow[] = [];
  const maintenanceByDate = new Map<string, MaintenanceLogRow>();

  for (const event of events) {
    switch (event.type) {
      case 'APPLICATION_LOGGED': {
        const p = payload<{
          applicationId: string;
          company: string;
          role: string;
          roleCategory: string;
          source: string;
          resumeVersionId: string;
          whyLine: string;
          qualityPass: boolean;
        }>(event);
        applicationsById.set(p.applicationId, {
          id: p.applicationId,
          local_date: event.local_date,
          company: p.company,
          role: p.role,
          role_category: p.roleCategory,
          source: p.source,
          resume_version_id: p.resumeVersionId,
          why_line: p.whyLine,
          quality_pass: p.qualityPass,
          status: 'applied',
          status_history: [{ status: 'applied', date: event.local_date }],
          followup_due_at: shiftDate(event.local_date, 10),
        });
        break;
      }

      case 'CAREER_EVENT_LOGGED': {
        const p = payload<CareerEventLoggedPayload>(event);
        careerEvents.push({
          id: event.id,
          local_date: event.local_date,
          kind: p.kind,
          application_id: p.applicationId,
          stuck_on: p.stuckOn,
        });
        if (p.applicationId && p.kind !== 'followup') {
          const application = applicationsById.get(p.applicationId);
          if (application) {
            const status: ApplicationStatus = careerEventKindToStatus(p.kind) ?? (application.status as ApplicationStatus);
            applicationsById.set(p.applicationId, {
              ...application,
              status,
              status_history: [...application.status_history, { status, date: event.local_date }],
            });
          }
        }
        break;
      }

      case 'FOLLOWUP_LOGGED': {
        const p = payload<{ applicationId: string }>(event);
        const application = applicationsById.get(p.applicationId);
        if (application) {
          applicationsById.set(p.applicationId, { ...application, followed_up_at: event.occurred_at });
        }
        break;
      }

      case 'RESUME_VERSION_CREATED': {
        const p = payload<ResumeVersionCreatedPayload>(event);
        resumeVersions.push({
          id: p.resumeVersionId,
          label: p.label,
          created_at: event.occurred_at,
          changed_because: p.changedBecause,
          external_review: p.externalReview,
        });
        break;
      }

      case 'PROBLEM_LOGGED': {
        const p = payload<ProblemLoggedPayload>(event);
        if (!dsaProblemsById.has(p.problemId)) {
          dsaProblemsById.set(p.problemId, {
            id: p.problemId,
            slug: p.slug,
            title: p.title,
            topic: p.topic,
            difficulty: p.difficulty,
            first_logged_at: event.occurred_at,
            insight: p.insight,
          });
        }
        const history = attemptHistoryByProblem.get(p.problemId) ?? [];
        const nextReviewAt = nextReview(p.outcome, [...history, { local_date: event.local_date, outcome: p.outcome }], config.srs);
        attemptHistoryByProblem.set(p.problemId, [...history, { local_date: event.local_date, outcome: p.outcome }]);
        dsaAttempts.push({
          id: event.id,
          problem_id: p.problemId,
          event_id: event.id,
          local_date: event.local_date,
          outcome: p.outcome,
          minutes: p.minutes,
          is_revisit: false,
          next_review_at: nextReviewAt,
        });
        break;
      }

      case 'PROBLEM_REVISITED': {
        const p = payload<ProblemRevisitedPayload>(event);
        const history = attemptHistoryByProblem.get(p.problemId) ?? [];
        const nextReviewAt = nextReview(p.outcome, [...history, { local_date: event.local_date, outcome: p.outcome }], config.srs);
        attemptHistoryByProblem.set(p.problemId, [...history, { local_date: event.local_date, outcome: p.outcome }]);
        dsaAttempts.push({
          id: event.id,
          problem_id: p.problemId,
          event_id: event.id,
          local_date: event.local_date,
          outcome: p.outcome,
          minutes: p.minutes,
          is_revisit: true,
          next_review_at: nextReviewAt,
        });
        break;
      }

      case 'LEARNING_BLOCK_LOGGED': {
        const p = payload<LearningBlockLoggedPayload>(event);
        learningBlocks.push({ id: event.id, local_date: event.local_date, topic: p.topic, minutes: p.minutes, note: p.note });
        break;
      }

      case 'SYSTEM_DESIGN_LOGGED': {
        const p = payload<SystemDesignLoggedPayload>(event);
        systemDesigns.push({
          id: event.id,
          local_date: event.local_date,
          system: p.system,
          mode: p.mode,
          minutes: p.minutes,
          artifact_url: p.artifactUrl,
          notes: p.notes,
        });
        break;
      }

      case 'BUILD_SESSION_LOGGED': {
        const p = payload<BuildSessionLoggedPayload>(event);
        buildSessions.push({
          id: event.id,
          local_date: event.local_date,
          mode: p.mode,
          minutes: p.minutes,
          project_key: p.projectKey,
          note: p.note,
        });
        break;
      }

      case 'ARTIFACT_SHIPPED': {
        const p = payload<ArtifactShippedPayload>(event);
        artifacts.push({
          id: p.artifactId,
          kind: p.kind,
          title: p.title,
          url: p.url,
          project_key: p.projectKey,
          local_date: event.local_date,
          cost_per_task_stated: p.costPerTaskStated,
        });
        break;
      }

      case 'TRAINING_SESSION_LOGGED': {
        const p = payload<TrainingSessionLoggedPayload>(event);
        trainingSessions.push({
          id: event.id,
          local_date: event.local_date,
          type: p.type,
          minutes: p.minutes,
          rpe: p.rpe,
          lifts: p.lifts,
        });
        break;
      }

      case 'STEPS_LOGGED': {
        const p = payload<StepsLoggedPayload>(event);
        metricSamples.push({ id: event.id, local_date: event.local_date, kind: 'steps', value: p.steps, unit: 'steps' });
        break;
      }

      case 'METRIC_RECORDED': {
        // store/onboarding.ts's Day-0 baseline capture (idem_key prefix
        // "baseline:") reuses this same event type but deliberately
        // writes NO metric_sample row of its own — the baseline instead
        // lives in checkpoint.metrics (db.checkpoint's day-0 row) and,
        // for height, on the profile row. Two of its four possible kinds
        // ('height_cm', 'problems_solved') aren't even valid
        // MetricSampleRow kinds; the other two ('weight_kg',
        // 'bodyfat_pct') do overlap with store/training.ts's ongoing
        // logBodyMetric, so the kind alone can't distinguish them — the
        // idem_key prefix is the only reliable signal, and this mirrors
        // the live write path exactly rather than guessing.
        if (event.idem_key.startsWith('baseline:')) break;
        const p = payload<MetricRecordedPayload>(event);
        metricSamples.push({
          id: event.id,
          local_date: event.local_date,
          kind: p.kind as MetricSampleRow['kind'],
          value: p.value,
          unit: p.unit,
          note: p.note,
        });
        break;
      }

      case 'SLEEP_LOGGED': {
        const p = payload<SleepLoggedPayload>(event);
        metricSamples.push({
          id: event.id,
          local_date: event.local_date,
          kind: 'wake_time',
          value: toMinutesSinceMidnight(p.wakeTime),
          unit: 'min',
        });
        if (p.sleepTime) {
          metricSamples.push({
            id: `${event.id}::sleep`,
            local_date: event.local_date,
            kind: 'sleep_time',
            value: toMinutesSinceMidnight(p.sleepTime),
            unit: 'min',
          });
        }
        break;
      }

      case 'SCREENTIME_LOGGED': {
        const p = payload<ScreentimeLoggedPayload>(event);
        metricSamples.push({ id: event.id, local_date: event.local_date, kind: 'screen_time_min', value: p.minutes, unit: 'min' });
        break;
      }

      case 'MAINTENANCE_LOGGED': {
        const p = payload<MaintenanceLoggedPayload>(event);
        maintenanceByDate.set(event.local_date, {
          local_date: event.local_date,
          bath: p.bath,
          fuel: p.fuel,
          laundry: p.laundry,
          all_done: p.allDone,
        });
        break;
      }

      // CAREER_SUBSTITUTE_LOGGED has no dedicated table (its kind/minutes
      // live only in the event, read directly by store/checkpoint.ts and
      // store/boss.ts's evidence gathering). BOSS_CLEARED, QUEST_*,
      // REVIEW_COMPLETED and everything db/projections.ts's
      // rebuildProjections already owns need no fold here.
      default:
        break;
    }
  }

  return {
    applications: [...applicationsById.values()],
    careerEvents,
    resumeVersions,
    dsaProblems: [...dsaProblemsById.values()],
    dsaAttempts,
    learningBlocks,
    systemDesigns,
    buildSessions,
    artifacts,
    trainingSessions,
    metricSamples,
    maintenanceLogs: [...maintenanceByDate.values()],
  };
}

function toMinutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}
