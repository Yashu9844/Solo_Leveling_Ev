// Legacy domain events -> InstrumentRecords (platform/02 §21.2). The owner's
// event log is never rewritten: the instrument layer reads it through these
// pure adapters. Each record's `eventId` is the event that proves it; its `id` is the id
// the legacy table uses for the same fact (the event id, or the application /
// artifact id).
//
// Same contract as db/domainProjections.ts#buildDomainTables: `events` are in
// chronological order and already de-duplicated by idem_key (getAllEvents()
// and the reducer's seen-key set guarantee that). Stateful facts — an
// application's current stage, a revisit's topic and difficulty — are folded
// the same way buildDomainTables folds them, so a record equals the row.
import { careerEventKindToStatus, type ApplicationStatus } from '../../engine/career';
import type {
  ArtifactShippedPayload,
  BuildSessionLoggedPayload,
  CareerEventLoggedPayload,
  CareerSubstituteLoggedPayload,
  LearningBlockLoggedPayload,
  MaintenanceLoggedPayload,
  ResumeVersionCreatedPayload,
  ProblemLoggedPayload,
  ProblemRevisitedPayload,
  ScreentimeLoggedPayload,
  SleepLoggedPayload,
  StepsLoggedPayload,
  SystemDesignLoggedPayload,
  SystemEvent,
  TrainingSessionLoggedPayload,
} from '../../engine/types';
import type { InstrumentRecord } from '../framework';
import { LEGACY_INSTRUMENTS, MAINTENANCE_ITEMS, minutesSinceMidnight, type LegacyInstrumentId } from './ids';
import { addDays, format, parseISO } from 'date-fns';

/** The laundry/followup arithmetic buildDomainTables uses for an application's follow-up date. */
const FOLLOWUP_AFTER_DAYS = 10;

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

function payload<T>(event: SystemEvent): T {
  return event.payload as unknown as T;
}

function record(
  instrumentId: LegacyInstrumentId,
  event: SystemEvent,
  value: Record<string, unknown>,
  id: string = event.id
): InstrumentRecord {
  const { type, domainId } = LEGACY_INSTRUMENTS[instrumentId];
  return { id, instrumentId, instrumentType: type, domainId, localDate: event.local_date, eventId: event.id, blueprintVersion: 1, record: value };
}

/** Drops keys whose value is undefined, so records compare equal under toEqual and JSON alike. */
function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export function upcastLegacyEvents(events: readonly SystemEvent[]): InstrumentRecord[] {
  const out: InstrumentRecord[] = [];
  // Index of each application's record in `out`, and the facts revisits need from their problem.
  const applicationAt = new Map<string, number>();
  const problems = new Map<string, { slug: string; title: string; topic: string; difficulty: 'E' | 'M' | 'H' }>();

  for (const event of events) {
    switch (event.type) {
      case 'APPLICATION_LOGGED': {
        const p = payload<{ applicationId: string; company: string; role: string; roleCategory: string; source: string; resumeVersionId: string; whyLine: string; qualityPass: boolean }>(event);
        applicationAt.set(p.applicationId, out.length);
        out.push(record('career.applications', event, clean({
          kind: 'application', applicationId: p.applicationId, company: p.company, role: p.role, roleCategory: p.roleCategory,
          source: p.source, resumeVersionId: p.resumeVersionId, whyLine: p.whyLine, qualityPass: p.qualityPass,
          status: 'applied' as ApplicationStatus, statusHistory: [{ status: 'applied' as ApplicationStatus, date: event.local_date }],
          followupDueAt: shiftDate(event.local_date, FOLLOWUP_AFTER_DAYS),
        }), p.applicationId));
        break;
      }
      case 'CAREER_EVENT_LOGGED': {
        const p = payload<CareerEventLoggedPayload>(event);
        out.push(record('career.applications', event, clean({ kind: 'event', eventKind: p.kind, applicationId: p.applicationId, stuckOn: p.stuckOn })));
        if (p.applicationId && p.kind !== 'followup') {
          const index = applicationAt.get(p.applicationId);
          if (index !== undefined) {
            const application = out[index]!;
            const current = application.record as { status: ApplicationStatus; statusHistory: { status: ApplicationStatus; date: string }[] };
            const status = careerEventKindToStatus(p.kind) ?? current.status;
            out[index] = { ...application, record: { ...application.record, status, statusHistory: [...current.statusHistory, { status, date: event.local_date }] } };
          }
        }
        break;
      }
      case 'FOLLOWUP_LOGGED': {
        const p = payload<{ applicationId: string }>(event);
        const index = applicationAt.get(p.applicationId);
        if (index !== undefined) {
          const application = out[index]!;
          out[index] = { ...application, record: { ...application.record, followedUpAt: event.occurred_at } };
        }
        break;
      }
      case 'RESUME_VERSION_CREATED': {
        const p = payload<ResumeVersionCreatedPayload>(event);
        // Resume versions are evidence of career work, not an XP source: an
        // artifact-type record whose project is the version itself.
        out.push(record('career.resumes', event, clean({ kind: 'resume', title: p.label, projectKey: p.resumeVersionId, changedBecause: p.changedBecause, externalReview: p.externalReview })));
        break;
      }
      case 'CAREER_SUBSTITUTE_LOGGED': {
        const p = payload<CareerSubstituteLoggedPayload>(event);
        out.push(record('career.substitute', event, { minutes: p.minutes, mode: p.kind }));
        break;
      }
      case 'PROBLEM_LOGGED': {
        const p = payload<ProblemLoggedPayload>(event);
        // The problem keeps the topic and difficulty of its FIRST log (the
        // dsa_problem row is never updated), so a re-log inherits them.
        if (!problems.has(p.problemId)) problems.set(p.problemId, { slug: p.slug, title: p.title, topic: p.topic, difficulty: p.difficulty });
        const first = problems.get(p.problemId)!;
        out.push(record('dsa.problems', event, clean({
          problemId: p.problemId, slug: first.slug, title: first.title, topic: first.topic, difficulty: first.difficulty,
          outcome: p.outcome, minutes: p.minutes, isRevisit: false,
        })));
        break;
      }
      case 'PROBLEM_REVISITED': {
        const p = payload<ProblemRevisitedPayload>(event);
        const problem = problems.get(p.problemId);
        // A revisit of a problem the log never introduced (only the fuzz
        // generator does this) has no topic or difficulty to carry.
        out.push(record('dsa.problems', event, clean({
          problemId: p.problemId, slug: problem?.slug, title: problem?.title, topic: problem?.topic, difficulty: problem?.difficulty,
          outcome: p.outcome, minutes: p.minutes, isRevisit: true,
        })));
        break;
      }
      case 'BUILD_SESSION_LOGGED': {
        const p = payload<BuildSessionLoggedPayload>(event);
        out.push(record('build.sessions', event, clean({ minutes: p.minutes, mode: p.mode, projectKey: p.projectKey, note: p.note })));
        break;
      }
      case 'ARTIFACT_SHIPPED': {
        const p = payload<ArtifactShippedPayload>(event);
        out.push(record('build.artifacts', event, clean({ artifactId: p.artifactId, kind: p.kind, title: p.title, url: p.url, projectKey: p.projectKey, costPerTaskStated: p.costPerTaskStated }), p.artifactId));
        break;
      }
      case 'TRAINING_SESSION_LOGGED': {
        const p = payload<TrainingSessionLoggedPayload>(event);
        out.push(record('training.sessions', event, clean({
          sessionType: p.type, minutes: p.minutes, rpe: p.rpe,
          lifts: p.lifts.map((lift) => ({ name: lift.name, weightKg: lift.weight_kg, reps: lift.reps, est1Rm: lift.est_1rm })),
        })));
        break;
      }
      case 'STEPS_LOGGED':
        out.push(record('training.steps', event, { value: payload<StepsLoggedPayload>(event).steps }));
        break;
      case 'SLEEP_LOGGED': {
        const p = payload<SleepLoggedPayload>(event);
        out.push(record('sleep.wake', event, clean({ minutes: minutesSinceMidnight(p.wakeTime), sleepMinutes: p.sleepTime ? minutesSinceMidnight(p.sleepTime) : undefined })));
        break;
      }
      case 'SCREENTIME_LOGGED':
        out.push(record('attention.screen', event, { value: payload<ScreentimeLoggedPayload>(event).minutes }));
        break;
      case 'LEARNING_BLOCK_LOGGED': {
        const p = payload<LearningBlockLoggedPayload>(event);
        out.push(record('foundations.blocks', event, clean({ topic: p.topic, minutes: p.minutes, note: p.note })));
        break;
      }
      case 'SYSTEM_DESIGN_LOGGED': {
        const p = payload<SystemDesignLoggedPayload>(event);
        out.push(record('foundations.design', event, clean({ topic: p.system, minutes: p.minutes, mode: p.mode, artifactUrl: p.artifactUrl, notes: p.notes })));
        break;
      }
      case 'MAINTENANCE_LOGGED': {
        const p = payload<MaintenanceLoggedPayload>(event);
        const ticked: Record<(typeof MAINTENANCE_ITEMS)[number], boolean> = { bath: p.bath, fuel: p.fuel, laundry: p.laundry };
        // `allDone` is the write-time fact (it depends on the laundry cadence
        // then in force); it is what the legacy ledger pays XP from.
        out.push(record('maintenance.daily', event, { done: MAINTENANCE_ITEMS.filter((item) => ticked[item]), allDone: p.allDone }));
        break;
      }
      default:
        break;
    }
  }
  return out;
}
