// The Day-0 checkpoint row is created empty during onboarding
// (store/onboarding.ts) — self_efficacy: {}, automaticity: {}, enjoyment:
// {}. saveCheckpointInstruments (below) fills in all three, at Day 0 and
// at every later administration (docs/04 §5.2-5.3: Day 0/30/60/90/120).
//
// Slice 12 — final/01 §4: rank gate evidence, sealing, and the export
// gate that blocks sealing. computeGateEvidence pulls every field
// engine/rank.ts's GateEvidence needs from real tables where the data
// exists (career, DSA, foundations, training, resume, system design —
// all real as of Slices 6-11; the four bossXCleared fields became real
// too in Slice 13, via store/boss.ts's getBossStatus; costPerTaskMeasured
// and interviewBenchmarkPassed became real in Slice 14, via
// ArtifactRow.cost_per_task_stated and store/training.ts's
// logInterviewBenchmark respectively).
import { addDays, format, parseISO } from 'date-fns';
import {
  evaluateGates,
  verdictTextFor,
  checkpointComparison,
  checkpointImproved,
  ZERO_EVIDENCE,
  type Checkpoint,
  type ComparisonRow,
  type GateEvidence,
  type GateResult,
} from '../engine/rank';
import type { DsaAttemptFixture } from '../engine/dsa';
import { foundationMasteryFor, FOUNDATION_TOPICS } from '../engine/foundations';
import { followThroughRate, type ApplicationFixture, type ApplicationStatus } from '../engine/career';
import { getStreakState } from './streak';
import { getBossStatus } from './boss';
import { getAllEvents } from '../db/events';
import { rebuildProjections } from '../db/projections';
import { buildDomainTables } from '../db/domainProjections';
import { db } from '../db/db';
import type { ArcRow, CheckpointRow, EventRow, ProfileRow } from '../db/schema';
import type { EngineConfig, EngineDeps, Rank, SystemEvent } from '../engine/types';

function shiftDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), 'yyyy-MM-dd');
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 999; // insufficient evidence reads as the fail-safe worst case, never as "perfect"
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}

// docs/04-domain-systems.md §5.2-5.3 / docs/13-day0-baseline.md — three
// self-report instruments, administered at Day 0/30/60/90/120 (final/11
// SLICE-2-PROMPT built self-efficacy only and explicitly deferred the
// other two with a "TODO: Slice 12" marker; automaticity/enjoyment's
// exact item wording turned out to live in docs/13, not final/, which
// is why the deferral happened in the first place). All three are
// "tracked metrics, never an attribute, never XP-linked" (docs/04 §5.3)
// — supplementary self-report, not part of the evidence gate final/01
// §4 evaluates, so recording them is never blocked by sealing and never
// blocks it either.
export interface SelfEfficacy {
  items: [number, number, number, number, number, number]; // 0-100 each
  mean: number;
}
export interface Automaticity {
  items: [number, number, number, number]; // 1-7 each ("I do this without having to consciously remember or decide")
  mean: number;
}
export interface Enjoyment {
  items: [number, number, number]; // 0-10 each: DSA, Building/AI, Training
  mean: number;
}

export interface CheckpointInstruments {
  selfEfficacy?: SelfEfficacy['items'];
  automaticity?: Automaticity['items'];
  enjoyment?: Enjoyment['items'];
}

function meanOf(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Self-efficacy is the one instrument every administration always
 * includes, so its presence alone is a reliable "has this checkpoint's
 * instrument round been done" signal — same semantics the old
 * Day-0-only `selfEfficacyIsComplete` had, just generalised to any
 * checkpoint day. */
export function instrumentsComplete(checkpoint: CheckpointRow | undefined): boolean {
  if (!checkpoint) return false;
  return Object.keys(checkpoint.self_efficacy).length > 0;
}

export async function getCheckpoint(day: Checkpoint['day']): Promise<CheckpointRow | undefined> {
  return db.checkpoint.where('day').equals(day).first();
}

/**
 * Writes whichever instrument fields are provided onto the day-`day`
 * checkpoint, creating the row if it doesn't exist yet (mirrors
 * markExported's create-if-missing pattern, minus `export_verified` —
 * an instrument has nothing to do with the export gate). Deliberately
 * ignores `sealed_at`: unlike markExported/sealCheckpoint, which guard
 * the frozen evidence gate, these three fields are self-report data a
 * person might fill in before OR after sealing, and sealing's
 * immutability is about the gate result, not about this.
 */
export async function saveCheckpointInstruments(
  day: Checkpoint['day'],
  instruments: CheckpointInstruments,
  deps: { newId(): string }
): Promise<void> {
  const patch: Partial<CheckpointRow> = {};
  if (instruments.selfEfficacy) {
    const self_efficacy: SelfEfficacy = { items: instruments.selfEfficacy, mean: meanOf(instruments.selfEfficacy) };
    patch.self_efficacy = self_efficacy as unknown as Record<string, unknown>;
  }
  if (instruments.automaticity) {
    const automaticity: Automaticity = { items: instruments.automaticity, mean: meanOf(instruments.automaticity) };
    patch.automaticity = automaticity as unknown as Record<string, unknown>;
  }
  if (instruments.enjoyment) {
    const enjoyment: Enjoyment = { items: instruments.enjoyment, mean: meanOf(instruments.enjoyment) };
    patch.enjoyment = enjoyment as unknown as Record<string, unknown>;
  }

  const existing = await getCheckpoint(day);
  if (existing) {
    await db.checkpoint.update(existing.id, patch);
    return;
  }
  const row: CheckpointRow = {
    id: deps.newId(),
    day,
    export_verified: false,
    metrics: {},
    self_efficacy: {},
    automaticity: {},
    enjoyment: {},
    rank_before: 'E',
    gates: {},
    controlled: {},
    external: {},
    quest_templates_snapshot: {},
    ...patch,
  };
  await db.checkpoint.add(row);
}

/** The rank as of the most recently sealed checkpoint, or 'E' before any
 * checkpoint has ever been sealed. This — not the target rank of an
 * upcoming, unsealed checkpoint — is what every "RANK X" display in the
 * app should read; rank only ever changes at a sealing. */
export async function getCurrentRank(): Promise<Rank> {
  const all = await db.checkpoint.toArray();
  const sealed = all.filter((c) => c.sealed_at !== undefined && c.rank_after !== undefined);
  if (sealed.length === 0) return 'E';
  return sealed.reduce((a, b) => (a.day > b.day ? a : b)).rank_after as Rank;
}

/** The rank already sealed as of the most recent SEALED checkpoint
 * strictly before `day` — "never regresses" needs to know what it's
 * not regressing from. Falls back to 'E' before any checkpoint exists. */
async function ranksSealedBefore(day: Checkpoint['day']): Promise<Rank> {
  const all = await db.checkpoint.where('day').below(day).toArray();
  const sealed = all.filter((c) => c.sealed_at !== undefined && c.rank_after !== undefined);
  if (sealed.length === 0) return 'E';
  const latest = sealed.reduce((a, b) => (a.day > b.day ? a : b));
  return latest.rank_after as Rank;
}

const CHECKPOINT_DAYS: Checkpoint['day'][] = [14, 30, 60, 90];

/**
 * Gathers every field engine/rank.ts's GateEvidence needs from real data.
 * `today` is the local_date the checkpoint is being evaluated as of —
 * ordinarily the checkpoint's own day, but evaluating early (to preview
 * "how close am I") is legitimate and this takes whatever date it's given.
 */
export async function computeGateEvidence(today: string, config: EngineConfig): Promise<GateEvidence> {
  const cutoff28 = shiftDate(today, -27);
  const inLast = (localDate: string, cutoff: string) => localDate >= cutoff && localDate <= today;

  const [
    streak,
    dsaAttempts,
    dsaProblems,
    applications,
    events,
    artifacts,
    resumeVersions,
    learningBlocks,
    systemDesigns,
    trainingSessions,
    metricSamples,
    checkpointsBefore,
    bossI,
    bossII,
    bossIII,
    bossIV,
  ] = await Promise.all([
    getStreakState(today, config),
    db.dsa_attempt.toArray(),
    db.dsa_problem.toArray(),
    db.application.toArray(),
    getAllEvents(),
    db.artifact.toArray(),
    db.resume_version.toArray(),
    db.learning_block.toArray(),
    db.system_design_study.toArray(),
    db.training_session.toArray(),
    db.metric_sample.toArray(),
    db.checkpoint.toArray(),
    getBossStatus('I', today),
    getBossStatus('II', today),
    getBossStatus('III', today),
    getBossStatus('IV', today),
  ]);

  const problemById = new Map(dsaProblems.map((p) => [p.id, p]));
  const nonRevisit = dsaAttempts.filter((a) => !a.is_revisit);
  const nonRevisitFixtures28d: DsaAttemptFixture[] = nonRevisit
    .filter((a) => inLast(a.local_date, cutoff28))
    .map((a) => {
      const problem = problemById.get(a.problem_id);
      return {
        problem_id: a.problem_id,
        topic: problem?.topic ?? '',
        difficulty: problem?.difficulty ?? 'E',
        local_date: a.local_date,
        outcome: a.outcome,
        is_revisit: false,
      };
    });
  const mediumAttempts28d = nonRevisitFixtures28d.filter((a) => a.difficulty === 'M');

  const applicationFixtures: ApplicationFixture[] = applications.map((a) => ({
    id: a.id,
    local_date: a.local_date,
    company: a.company,
    role: a.role,
    role_category: a.role_category,
    resume_version_id: a.resume_version_id,
    why_line: a.why_line,
    quality_pass: a.quality_pass,
    status: a.status as ApplicationStatus,
    followed_up_at: a.followed_up_at,
    followup_due_at: a.followup_due_at,
  }));

  const substituteEvents = events.filter((e) => e.type === 'CAREER_SUBSTITUTE_LOGGED');
  const substituteKindCount = (kind: string) =>
    substituteEvents.filter((e) => (e.payload as unknown as { kind: string }).kind === kind).length;

  const blocks = learningBlocks.map((b) => ({ topic: b.topic, local_date: b.local_date }));
  const masteryStates = FOUNDATION_TOPICS.map((topic) => foundationMasteryFor(topic, blocks));

  const projectKeys = new Set(artifacts.filter((a) => a.kind === 'project').map((a) => a.project_key));
  const evalProjectKeys = new Set(artifacts.filter((a) => a.kind === 'eval').map((a) => a.project_key));
  const publicProjectsWithEvalSuite = [...projectKeys].filter((k) => evalProjectKeys.has(k)).length;

  const stepsInWindow = metricSamples.filter((s) => s.kind === 'steps' && inLast(s.local_date, cutoff28)).map((s) => s.value);
  const wakeTimesInWindow = metricSamples
    .filter((s) => s.kind === 'wake_time' && inLast(s.local_date, cutoff28))
    .map((s) => s.value);
  const screenTimeInWindow = metricSamples
    .filter((s) => s.kind === 'screen_time_min' && inLast(s.local_date, cutoff28))
    .map((s) => s.value);

  // Est. 1RM aggregate gain — final/00 §2's "+12%": for every exercise
  // name with >= 2 dated samples, compare the earliest to the latest
  // est_1rm; average the per-exercise % gains. 0 without qualifying data.
  const liftsByName = new Map<string, { local_date: string; est_1rm: number }[]>();
  for (const session of trainingSessions) {
    for (const lift of session.lifts) {
      const list = liftsByName.get(lift.name) ?? [];
      list.push({ local_date: session.local_date, est_1rm: lift.est_1rm });
      liftsByName.set(lift.name, list);
    }
  }
  const perExerciseGains: number[] = [];
  for (const samples of liftsByName.values()) {
    if (samples.length < 2) continue;
    const sorted = [...samples].sort((a, b) => a.local_date.localeCompare(b.local_date));
    const first = sorted[0]!.est_1rm;
    const last = sorted[sorted.length - 1]!.est_1rm;
    if (first > 0) perExerciseGains.push((last - first) / first);
  }
  const trainingEst1RmGainPct = perExerciseGains.length > 0 ? mean(perExerciseGains) : 0;

  const priorSealed = checkpointsBefore.filter((c) => CHECKPOINT_DAYS.includes(c.day as 14 | 30 | 60 | 90));
  const arcSealed = CHECKPOINT_DAYS.every((day) => priorSealed.some((c) => c.day === day && c.sealed_at !== undefined));

  return {
    mvdConsistency14d: streak.consistency_14 / 100,
    coreCompletion28d: streak.consistency_28 / 100,
    problemsTotal: nonRevisit.length,
    firstAttemptRateM28d:
      mediumAttempts28d.length > 0 ? mediumAttempts28d.filter((a) => a.outcome === 'first_attempt').length / mediumAttempts28d.length : 0,
    trainingSessionsTotal: trainingSessions.length,
    meanSteps: mean(stepsInWindow),
    wakeSdMin: stddev(wakeTimesInWindow),
    screenTimeAvgMin: screenTimeInWindow.length > 0 ? mean(screenTimeInWindow) : 999,
    qualityApplicationsTotal: applicationFixtures.filter((a) => a.quality_pass).length,
    followThroughRate: followThroughRate(applicationFixtures, today),
    networkingConversations: substituteKindCount('networking'),
    recordedMocks: substituteKindCount('mock'),
    aiFeaturePublicRepo: artifacts.some((a) => a.kind === 'feature' && !!a.url),
    publicProjectsTotal: projectKeys.size,
    publicProjectsWithEvalSuite,
    publicProjectsDeployedReachable: artifacts.filter((a) => a.kind === 'deployment').length,
    publishedWriteups: artifacts.filter((a) => a.kind === 'writeup').length,
    resumeVersionsTotal: resumeVersions.length,
    resumeExternallyReviewed: resumeVersions.some((r) => r.external_review === true),
    foundationTopicsIntroducedPlus: masteryStates.filter((s) => s !== 'unseen').length,
    foundationTopicsFluentPlus: masteryStates.filter((s) => s === 'fluent' || s === 'retained').length,
    foundationTopicsRetainedPlus: masteryStates.filter((s) => s === 'retained').length,
    systemDesignsStudied: systemDesigns.length,
    systemDesignsWrittenUp: systemDesigns.filter((s) => s.mode === 'written_up').length,
    systemDesignsExplainedAloud: systemDesigns.filter((s) => s.mode === 'explained_aloud').length,
    trainingEst1RmGainPct,
    // final/03 §4.4's P2 requirement ("cost per task measured and
    // stated") is a project-level self-certification, not a formula —
    // true once any 'project' artifact has been flagged as such (see
    // ArtifactShippedPayload.costPerTaskStated and
    // ui/build/LogBuildSessionSheet.tsx's checkbox, shown only for that
    // kind).
    costPerTaskMeasured: artifacts.some((a) => a.kind === 'project' && a.cost_per_task_stated === true),
    // final/02 §2.2 — "self-administered, logged, repeatable": true
    // forever once any attempt has passed (store/training.ts's
    // logInterviewBenchmark).
    interviewBenchmarkPassed: metricSamples.some((s) => s.kind === 'interview_benchmark' && s.value === 1),
    bossICleared: bossI.cleared,
    bossIICleared: bossII.cleared,
    bossIIICleared: bossIII.cleared,
    bossIVCleared: bossIV.cleared,
    arcSealed,
  };
}

export interface CheckpointReport {
  checkpoint: CheckpointRow | undefined;
  result: GateResult;
  verdictText: string;
}

/** The full Day-`day` report: real evidence, the gate result, and the
 * display verdict — final/01 §4.3's "most important sentence." Safe to
 * call before the checkpoint row exists or before its day arrives (a
 * preview), and again after sealing (re-reads the same real data). */
export async function getCheckpointReport(day: Checkpoint['day'], today: string, config: EngineConfig): Promise<CheckpointReport> {
  const [checkpoint, previousRank, evidence] = await Promise.all([
    getCheckpoint(day),
    ranksSealedBefore(day),
    computeGateEvidence(today, config),
  ]);
  const result = evaluateGates({ day, previousRank }, evidence);
  return { checkpoint, result, verdictText: verdictTextFor(result) };
}

export interface CheckpointComparisonResult {
  rows: ComparisonRow[];
  improved: boolean;
}

/**
 * final/06 §5.8's "vs DAY 0" (really: vs the previous sealed
 * checkpoint) comparison, and final/05 §2.1's gate for whether the
 * CHECKPOINT Moment fires at all ("sealed with improvement"). The
 * previous checkpoint's GateEvidence snapshot is read from its own
 * `metrics` field, frozen there by sealCheckpoint at the time it was
 * sealed — Day 0's `metrics` is a different shape (raw baseline body
 * metrics, not GateEvidence, per store/onboarding.ts), so a Day-0-only
 * arc falls back to engine/rank.ts's ZERO_EVIDENCE, which is exactly
 * what Day 0's evidence would compute to for an arc with zero activity.
 */
export async function getCheckpointComparison(day: Checkpoint['day'], today: string, config: EngineConfig): Promise<CheckpointComparisonResult> {
  const DAYS: Checkpoint['day'][] = [0, 14, 30, 60, 90, 120];
  const allCheckpoints = await db.checkpoint.toArray();
  const previousDay = DAYS.filter((d) => d < day).sort((a, b) => b - a)[0];
  const previousSealed = previousDay !== undefined
    ? allCheckpoints.find((c) => c.day === previousDay && c.sealed_at !== undefined && c.day !== 0)
    : undefined;

  const before = previousSealed ? (previousSealed.metrics as unknown as GateEvidence) : ZERO_EVIDENCE;
  const after = await computeGateEvidence(today, config);
  const rows = checkpointComparison(before, after);
  return { rows, improved: checkpointImproved(rows) };
}

/**
 * A full, real export — pretty-printed JSON, re-importable via
 * importSnapshotJson below. Most of the app really is "the event log
 * alone is a complete backup" (final/07 §6): replaying `events` through
 * engine/reduce.ts's applyEvents + db/projections.ts's rebuildProjections
 * + db/domainProjections.ts's buildDomainTables reproduces quest state,
 * XP, streaks and every domain detail table (applications, DSA problems,
 * training sessions, etc.) exactly. Three things genuinely aren't
 * event-sourced in this app and are included verbatim instead, not
 * derived: `arc` (the row is written once at onboarding and never
 * updated by ARC_PAUSED/ARC_RESUMED — pause state is always read fresh
 * from the events by every consumer, so the row itself is just an
 * anchor: id/start_date/timezone/boundary-hour), `profile` (name and
 * settings have no event backing them at all — there is no
 * PROFILE_CREATED event type), and `checkpoints` (self_efficacy,
 * automaticity, enjoyment and the sealed gate snapshot are freeform
 * instrument data, deliberately kept outside event-sourcing since
 * Slice 12 — see store/checkpoint.ts's file header).
 *
 * Also records this moment as the backup nudge's "last export" —
 * docs/07-data-model.md: "shows export status on the Profile screen...
 * if no export exists in 14 days, the Profile screen says so in red."
 * Calling this function IS taking a backup, so it updates that marker
 * itself rather than leaving every call site responsible for
 * remembering to.
 */
export async function exportSnapshotJson(deps: { now(): string }): Promise<string> {
  const now = deps.now();
  const [events, arc, profileBefore, checkpoints] = await Promise.all([
    getAllEvents(),
    db.arc.toCollection().first(),
    db.profile.toCollection().first(),
    db.checkpoint.toArray(),
  ]);

  if (profileBefore) {
    await db.profile.update(profileBefore.id, { last_export_at: now });
  }
  const profile = profileBefore ? { ...profileBefore, last_export_at: now } : undefined;

  return JSON.stringify(
    { exported_at: now, schema_v: 1, events, arc: arc ?? null, profile: profile ?? null, checkpoints },
    null,
    2
  );
}

/**
 * The backup-nudge status docs/07-data-model.md describes: how long
 * since the last real export. `daysSince` falls back to days-since-arc-
 * start when nothing has ever been exported — a fresh, one-day-old arc
 * that has "never backed up" is not the same situation the 14-day red
 * threshold is warning about, and treating them identically would flag
 * red on Day 1 of every arc, exactly the anxiety-on-day-one this app
 * avoids everywhere else (final/01 §6.6).
 */
export interface BackupStatus {
  lastExportAt: string | null;
  daysSince: number;
}

export async function getBackupStatus(deps: { now(): string }): Promise<BackupStatus> {
  const [profile, arc] = await Promise.all([db.profile.toCollection().first(), db.arc.toCollection().first()]);
  const lastExportAt = profile?.last_export_at ?? null;
  const since = lastExportAt ?? arc?.start_date;
  const daysSince = since
    ? Math.max(0, Math.floor((new Date(deps.now()).getTime() - new Date(since).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  return { lastExportAt, daysSince };
}

export class ImportValidationError extends Error {}

interface SnapshotShape {
  events: unknown[];
  arc?: unknown;
  profile?: unknown;
  checkpoints?: unknown[];
}

function validateSnapshot(json: string): SnapshotShape {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportValidationError('Not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { events?: unknown }).events)) {
    throw new ImportValidationError('Not a Solo Leveling export — missing an events array.');
  }
  return parsed as SnapshotShape;
}

/**
 * Wipes every table in the database and restores it from an
 * exportSnapshotJson() export: events replayed through
 * rebuildProjections + db/domainProjections.ts's buildDomainTables, plus
 * arc/profile/checkpoints restored verbatim (see exportSnapshotJson's
 * doc comment for why those three aren't event-derivable). Throws
 * ImportValidationError — never silently imports a malformed or
 * unrelated file — and never partially imports: validation happens
 * entirely before the first write.
 */
export async function importSnapshotJson(json: string, config: EngineConfig, deps: EngineDeps): Promise<void> {
  const snapshot = validateSnapshot(json);

  await db.transaction(
    'rw',
    [
      db.event,
      db.arc,
      db.profile,
      db.checkpoint,
      db.quest_template,
      db.quest_instance,
      db.xp_ledger,
      db.day_rollup,
      db.player_state,
      db.application,
      db.career_event,
      db.resume_version,
      db.dsa_problem,
      db.dsa_attempt,
      db.learning_block,
      db.system_design_study,
      db.build_session,
      db.artifact,
      db.training_session,
      db.metric_sample,
      db.maintenance_log,
    ],
    async () => {
      await Promise.all([
        db.event.clear(),
        db.arc.clear(),
        db.profile.clear(),
        db.checkpoint.clear(),
        db.quest_template.clear(),
        db.quest_instance.clear(),
        db.xp_ledger.clear(),
        db.day_rollup.clear(),
        db.player_state.clear(),
        db.application.clear(),
        db.career_event.clear(),
        db.resume_version.clear(),
        db.dsa_problem.clear(),
        db.dsa_attempt.clear(),
        db.learning_block.clear(),
        db.system_design_study.clear(),
        db.build_session.clear(),
        db.artifact.clear(),
        db.training_session.clear(),
        db.metric_sample.clear(),
        db.maintenance_log.clear(),
      ]);

      const importedEvents = snapshot.events as SystemEvent[];
      if (importedEvents.length > 0) await db.event.bulkAdd(importedEvents as unknown as EventRow[]);
      if (snapshot.arc) await db.arc.add(snapshot.arc as ArcRow);
      if (snapshot.profile) await db.profile.add(snapshot.profile as ProfileRow);
      if (snapshot.checkpoints && snapshot.checkpoints.length > 0) {
        await db.checkpoint.bulkAdd(snapshot.checkpoints as CheckpointRow[]);
      }

      const domain = buildDomainTables(importedEvents, config);
      if (domain.applications.length > 0) await db.application.bulkAdd(domain.applications);
      if (domain.careerEvents.length > 0) await db.career_event.bulkAdd(domain.careerEvents);
      if (domain.resumeVersions.length > 0) await db.resume_version.bulkAdd(domain.resumeVersions);
      if (domain.dsaProblems.length > 0) await db.dsa_problem.bulkAdd(domain.dsaProblems);
      if (domain.dsaAttempts.length > 0) await db.dsa_attempt.bulkAdd(domain.dsaAttempts);
      if (domain.learningBlocks.length > 0) await db.learning_block.bulkAdd(domain.learningBlocks);
      if (domain.systemDesigns.length > 0) await db.system_design_study.bulkAdd(domain.systemDesigns);
      if (domain.buildSessions.length > 0) await db.build_session.bulkAdd(domain.buildSessions);
      if (domain.artifacts.length > 0) await db.artifact.bulkAdd(domain.artifacts);
      if (domain.trainingSessions.length > 0) await db.training_session.bulkAdd(domain.trainingSessions);
      if (domain.metricSamples.length > 0) await db.metric_sample.bulkAdd(domain.metricSamples);
      if (domain.maintenanceLogs.length > 0) await db.maintenance_log.bulkAdd(domain.maintenanceLogs);
    }
  );

  await rebuildProjections(config, deps);
}

/** Marks the day-`day` checkpoint as exported — final/08's "sealing
 * blocked without export" gate. Creates the row if it doesn't exist yet
 * (Day 0's row is created at onboarding; 14/30/60/90/120 are not). */
export async function markExported(day: Checkpoint['day'], deps: { newId(): string }): Promise<void> {
  const existing = await getCheckpoint(day);
  if (existing) {
    if (existing.sealed_at) return; // sealed rows are immutable — see sealCheckpoint
    await db.checkpoint.update(existing.id, { export_verified: true });
    return;
  }
  const row: CheckpointRow = {
    id: deps.newId(),
    day,
    export_verified: true,
    metrics: {},
    self_efficacy: {},
    automaticity: {},
    enjoyment: {},
    rank_before: 'E',
    gates: {},
    controlled: {},
    external: {},
    quest_templates_snapshot: {},
  };
  await db.checkpoint.add(row);
}

export class CheckpointSealError extends Error {}

/**
 * Seals the day-`day` checkpoint: freezes the gate result, the rank
 * transition, and a snapshot of the active quest templates into the row,
 * and sets `sealed_at`. Refuses (throws CheckpointSealError, never a
 * silent no-op) when export hasn't been verified yet — final/08's
 * "sealing blocked without export" — or when the checkpoint is already
 * sealed — final/08's "sealed checkpoints reject writes," which this
 * enforces by rejecting the seal attempt itself rather than by locking
 * the row after the fact.
 */
export async function sealCheckpoint(day: Checkpoint['day'], today: string, config: EngineConfig, deps: { now(): string }): Promise<GateResult> {
  const existing = await getCheckpoint(day);
  if (existing?.sealed_at) {
    throw new CheckpointSealError(`Day ${day} checkpoint is already sealed.`);
  }
  if (!existing?.export_verified) {
    throw new CheckpointSealError('Export the arc data before sealing this checkpoint.');
  }

  const previousRank = await ranksSealedBefore(day);
  const evidence = await computeGateEvidence(today, config);
  const result = evaluateGates({ day, previousRank }, evidence);

  const templates = await db.quest_template.toArray();
  await db.checkpoint.update(existing.id, {
    sealed_at: deps.now(),
    rank_before: previousRank,
    rank_after: result.rank,
    gates: { conditions: result.conditions, targetRank: result.targetRank } as unknown as Record<string, unknown>,
    metrics: evidence as unknown as Record<string, unknown>,
    quest_templates_snapshot: templates as unknown as Record<string, unknown>,
  });

  return result;
}
