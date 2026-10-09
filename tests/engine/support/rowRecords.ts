// Test oracle for the legacy upcasters (platform/05 loop 3.7): derives the
// same InstrumentRecords from the legacy domain TABLES that
// db/domainProjections.ts#buildDomainTables folds out of the event log. The
// upcasters read events; this reads rows. They share no code, so agreement
// proves the instrument layer sees exactly what the owner's tables hold.
import type { DomainTables } from '../../../src/db/domainProjections';
import { LEGACY_INSTRUMENTS, MAINTENANCE_ITEMS, minutesSinceMidnight, type LegacyInstrumentId } from '../../../src/instruments/legacy/ids';

export interface NormalizedRecord {
  instrumentId: LegacyInstrumentId;
  localDate: string;
  record: Record<string, unknown>;
}

function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** career.substitute has no table (its minutes live only in the event), so it is not derivable here. */
export const ROW_DERIVABLE_INSTRUMENTS = (Object.keys(LEGACY_INSTRUMENTS) as LegacyInstrumentId[]).filter((id) => id !== 'career.substitute');

export function recordsFromDomainTables(tables: DomainTables): NormalizedRecord[] {
  const out: NormalizedRecord[] = [];
  const push = (instrumentId: LegacyInstrumentId, localDate: string, record: Record<string, unknown>) => out.push({ instrumentId, localDate, record: clean(record) });

  for (const a of tables.applications) {
    push('career.applications', a.local_date, {
      kind: 'application', applicationId: a.id, company: a.company, role: a.role, roleCategory: a.role_category, source: a.source,
      resumeVersionId: a.resume_version_id, whyLine: a.why_line, qualityPass: a.quality_pass, status: a.status,
      statusHistory: a.status_history, followedUpAt: a.followed_up_at, followupDueAt: a.followup_due_at,
    });
  }
  for (const e of tables.careerEvents) push('career.applications', e.local_date, { kind: 'event', eventKind: e.kind, applicationId: e.application_id, stuckOn: e.stuck_on });

  for (const v of tables.resumeVersions) {
    // The row keeps the instant, not the local date; the fixtures write both on the same UTC day.
    push('career.resumes', v.created_at.slice(0, 10), { kind: 'resume', title: v.label, projectKey: v.id, changedBecause: v.changed_because, externalReview: v.external_review });
  }

  const problemsById = new Map(tables.dsaProblems.map((p) => [p.id, p]));
  for (const attempt of tables.dsaAttempts) {
    const problem = problemsById.get(attempt.problem_id);
    push('dsa.problems', attempt.local_date, {
      problemId: attempt.problem_id, slug: problem?.slug, title: problem?.title, topic: problem?.topic, difficulty: problem?.difficulty,
      outcome: attempt.outcome, minutes: attempt.minutes, isRevisit: attempt.is_revisit,
    });
  }
  for (const s of tables.buildSessions) push('build.sessions', s.local_date, { minutes: s.minutes, mode: s.mode, projectKey: s.project_key, note: s.note });
  for (const a of tables.artifacts) push('build.artifacts', a.local_date, { artifactId: a.id, kind: a.kind, title: a.title, url: a.url, projectKey: a.project_key, costPerTaskStated: a.cost_per_task_stated });
  for (const t of tables.trainingSessions) {
    push('training.sessions', t.local_date, {
      sessionType: t.type, minutes: t.minutes, rpe: t.rpe,
      lifts: t.lifts.map((lift) => ({ name: lift.name, weightKg: lift.weight_kg, reps: lift.reps, est1Rm: lift.est_1rm })),
    });
  }
  for (const b of tables.learningBlocks) push('foundations.blocks', b.local_date, { topic: b.topic, minutes: b.minutes, note: b.note });
  for (const d of tables.systemDesigns) push('foundations.design', d.local_date, { topic: d.system, minutes: d.minutes, mode: d.mode, artifactUrl: d.artifact_url, notes: d.notes });

  // A wake sample and its optional `${id}::sleep` companion share one event.
  const sleepById = new Map(tables.metricSamples.filter((m) => m.kind === 'sleep_time').map((m) => [m.id, m.value]));
  for (const m of tables.metricSamples) {
    if (m.kind === 'steps') push('training.steps', m.local_date, { value: m.value });
    else if (m.kind === 'screen_time_min') push('attention.screen', m.local_date, { value: m.value });
    else if (m.kind === 'wake_time') push('sleep.wake', m.local_date, { minutes: m.value, sleepMinutes: sleepById.get(`${m.id}::sleep`) });
  }
  for (const m of tables.maintenanceLogs) {
    const ticked = { bath: m.bath, fuel: m.fuel, laundry: m.laundry };
    push('maintenance.daily', m.local_date, { done: MAINTENANCE_ITEMS.filter((item) => ticked[item]), allDone: m.all_done });
  }
  return out;
}

export { minutesSinceMidnight };

/** Order-independent, id-independent form for deep comparison. */
export function normalize(records: readonly NormalizedRecord[]): string[] {
  return records.map((r) => JSON.stringify([r.instrumentId, r.localDate, sortKeys(r.record)])).sort();
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}
