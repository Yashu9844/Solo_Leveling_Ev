// InstrumentRecord -> the legacy event the owner's log has always held
// (platform/02 §21.2). Legacy instruments keep WRITING legacy event types for
// the rest of the owner's current arc, so an older build can always read the
// log and no mixed (legacy + INSTRUMENT_RECORDED) log ever exists for them.
//
// An adapter yields only the event type and payload. Event identity (id,
// idem_key, occurred_at) stays with the caller, because those formats belong
// to the store write paths that mint them.
import type { EventType } from '../../engine/types';
import type { InstrumentRecord } from '../framework';
import { hhmmFromMinutes, LEGACY_INSTRUMENTS, MAINTENANCE_ITEMS, type LegacyInstrumentId } from './ids';

export interface LegacyEventDraft {
  type: EventType;
  payload: Record<string, unknown>;
}

type Fields = Record<string, unknown>;

function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export function isLegacyInstrumentId(id: string): id is LegacyInstrumentId {
  return Object.hasOwn(LEGACY_INSTRUMENTS, id);
}

/** The legacy event a new record of this instrument is written as. */
export function legacyEventFor(instrumentId: LegacyInstrumentId, item: Pick<InstrumentRecord, 'localDate' | 'record'>): LegacyEventDraft {
  const r = item.record as Fields;
  switch (instrumentId) {
    case 'career.applications':
      if (r.kind === 'event') {
        return { type: 'CAREER_EVENT_LOGGED', payload: clean({ kind: r.eventKind, applicationId: r.applicationId, stuckOn: r.stuckOn }) };
      }
      if (r.kind === 'followup') return { type: 'FOLLOWUP_LOGGED', payload: { applicationId: r.applicationId } };
      return {
        type: 'APPLICATION_LOGGED',
        payload: { applicationId: r.applicationId, company: r.company, role: r.role, roleCategory: r.roleCategory, source: r.source, resumeVersionId: r.resumeVersionId, whyLine: r.whyLine, qualityPass: r.qualityPass },
      };
    case 'career.substitute':
      return { type: 'CAREER_SUBSTITUTE_LOGGED', payload: { minutes: r.minutes, kind: r.mode } };
    case 'dsa.problems':
      return r.isRevisit
        ? { type: 'PROBLEM_REVISITED', payload: { problemId: r.problemId, outcome: r.outcome, minutes: r.minutes } }
        : { type: 'PROBLEM_LOGGED', payload: clean({ problemId: r.problemId, slug: r.slug, title: r.title, topic: r.topic, difficulty: r.difficulty, outcome: r.outcome, minutes: r.minutes }) };
    case 'build.sessions':
      return { type: 'BUILD_SESSION_LOGGED', payload: clean({ mode: r.mode, minutes: r.minutes, projectKey: r.projectKey, note: r.note }) };
    case 'build.artifacts':
      return { type: 'ARTIFACT_SHIPPED', payload: clean({ artifactId: r.artifactId, kind: r.kind, title: r.title, url: r.url, projectKey: r.projectKey, costPerTaskStated: r.costPerTaskStated }) };
    case 'training.sessions': {
      const lifts = (r.lifts as { name: string; weightKg: number; reps: number; est1Rm?: number }[] | undefined) ?? [];
      return {
        type: 'TRAINING_SESSION_LOGGED',
        payload: clean({
          localDate: item.localDate, type: r.sessionType, minutes: r.minutes, rpe: r.rpe,
          lifts: lifts.map((lift) => ({ name: lift.name, weight_kg: lift.weightKg, reps: lift.reps, est_1rm: lift.est1Rm })),
        }),
      };
    }
    case 'training.steps':
      return { type: 'STEPS_LOGGED', payload: { localDate: item.localDate, steps: r.value } };
    case 'sleep.wake':
      return {
        type: 'SLEEP_LOGGED',
        payload: clean({ localDate: item.localDate, wakeTime: hhmmFromMinutes(r.minutes as number), sleepTime: typeof r.sleepMinutes === 'number' ? hhmmFromMinutes(r.sleepMinutes) : undefined }),
      };
    case 'attention.screen':
      return { type: 'SCREENTIME_LOGGED', payload: { localDate: item.localDate, minutes: r.value } };
    case 'foundations.blocks':
      return { type: 'LEARNING_BLOCK_LOGGED', payload: clean({ topic: r.topic, minutes: r.minutes, note: r.note }) };
    case 'foundations.design':
      return { type: 'SYSTEM_DESIGN_LOGGED', payload: clean({ system: r.topic, mode: r.mode, minutes: r.minutes, artifactUrl: r.artifactUrl, notes: r.notes }) };
    case 'maintenance.daily': {
      const done = new Set(r.done as string[]);
      const [bath, fuel, laundry] = MAINTENANCE_ITEMS.map((name) => done.has(name));
      return { type: 'MAINTENANCE_LOGGED', payload: { localDate: item.localDate, bath, fuel, laundry, allDone: r.allDone } };
    }
  }
}
