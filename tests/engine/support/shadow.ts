// The shadow-equivalence harness (platform/05 loop 4.8): runs the Blueprint
// engine beside the legacy one over a corpus and reports every difference.
//   E1  projections — the five cache tables, deep-equal
//   E2  read models — attributes, gate reports, bosses, achievements, reality,
//       frozen evidence, checkpoint comparison, weekly review, message context,
//       transmission context and the recoverable day, against the live store
//       functions on a database holding only that day's log prefix
// Corpora: the golden 120-day log, a fuzz sample, and (locally) the owner's
// export. This file is the engine of both `npm run shadow` and the
// tests/engine/shadow.test.ts smoke test.
import 'fake-indexeddb/auto';
import { isDeepStrictEqual } from 'node:util';
import { buildProjectionsV2 } from '../../../src/blueprint/engine/projections';
import { evaluateAchievements } from '../../../src/blueprint/evaluate/achievement';
import { evaluateAttributes } from '../../../src/blueprint/evaluate/attribute';
import { evaluateBosses } from '../../../src/blueprint/evaluate/boss';
import { checkpointComparisonFor, evidenceSnapshot, realitySummary } from '../../../src/blueprint/evaluate/checkpoint';
import { evaluateGate, rankSealedBefore } from '../../../src/blueprint/evaluate/gate';
import { messageContextFor, recoverableDayFor, systemMessageContextFor } from '../../../src/blueprint/evaluate/messages';
import { readModelEnv } from '../../../src/blueprint/evaluate/readModel';
import { evaluateWeeklyReview } from '../../../src/blueprint/evaluate/weeklyReview';
import { legacyBlueprintFor, LEGACY_BLUEPRINT_V1, type LegacyArcFacts } from '../../../src/blueprint/legacy/legacyV1';
import type { SystemBlueprint } from '../../../src/blueprint/schema';
import { buildProjections } from '../../../src/db/projections';
import type { CheckpointRow } from '../../../src/db/schema';
import { DEFAULT_CONFIG } from '../../../src/engine/config';
import { BOSSES } from '../../../src/engine/boss';
import type { Checkpoint } from '../../../src/engine/rank';
import { arcDay } from '../../../src/engine/time';
import type { ArcStartedPayload, SystemEvent } from '../../../src/engine/types';
import { getAchievementsReport } from '../../../src/store/achievements';
import { getAttributes } from '../../../src/store/attributes';
import { getBossStatus } from '../../../src/store/boss';
import { computeGateEvidence, getCheckpointComparison, getCheckpointReport } from '../../../src/store/checkpoint';
import { computeMessageContext } from '../../../src/store/messages';
import { getRecoverableDay } from '../../../src/store/recovery';
import { getRealitySummary } from '../../../src/store/reality';
import { buildSystemMessageContext } from '../../../src/store/systemMessage';
import { getWeeklyReview } from '../../../src/store/weeklyReview';
import { dateAt, legacyActivityLog } from './legacyActivityLog';
import { loadLegacyDb, prefixOf } from './legacyDb';
import { fuzzDeps, randomEventLog } from './randomEventLog';

export interface ShadowSection { name: string; compared: number; mismatches: string[] }
export interface ShadowReport { sections: ShadowSection[]; ok: boolean; seconds: number }

export interface ShadowOptions {
  /** Raw-event fuzz logs for E1. */
  fuzzSeeds?: number;
  /** Extra activity seeds for E1. */
  activitySeeds?: number;
  /** 0-based offsets of the golden log's days compared at E2. */
  goldenDays?: number[];
  /** Fuzz logs (first N seeds) also compared at E2, on their last day. */
  fuzzE2Seeds?: number;
  /** The owner's events, when available locally, and their sealed checkpoint rows. */
  owner?: { events: SystemEvent[]; checkpoints: CheckpointRow[] };
  /** Blueprint under test; defaults to the legacy Blueprint for each log's own arc. */
  blueprintFor?: (arc: LegacyArcFacts) => SystemBlueprint;
  log?: (line: string) => void;
}

const norm = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null));
const MAX_MISMATCHES = 3;

class Collector {
  readonly sections = new Map<string, ShadowSection>();
  check(section: string, label: string, a: unknown, b: unknown): void {
    const entry = this.sections.get(section) ?? { name: section, compared: 0, mismatches: [] };
    this.sections.set(section, entry);
    entry.compared++;
    if (!isDeepStrictEqual(norm(a), norm(b)) && entry.mismatches.length < MAX_MISMATCHES) entry.mismatches.push(`${label}: V2 ${JSON.stringify(norm(a)).slice(0, 160)} ≠ legacy ${JSON.stringify(norm(b)).slice(0, 160)}`);
    else if (!isDeepStrictEqual(norm(a), norm(b))) entry.mismatches.push('…');
  }
}

/** Events as the app reads them: ordered by id (db/events.ts getAllEvents). The raw fuzz generator's ids are not zero-padded, so generation order is NOT id order. */
const asRead = (events: SystemEvent[]): SystemEvent[] => [...events].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

function arcOf(events: readonly SystemEvent[]): LegacyArcFacts {
  const started = events.find((event) => event.type === 'ARC_STARTED')!.payload as unknown as ArcStartedPayload;
  return { id: started.arcId, start_date: started.startDate, end_date: started.endDate, timezone: started.timezone, day_boundary_hour: started.dayBoundaryHour, day_close_hour: started.dayCloseHour, main_quest_text: started.mainQuestText };
}

function e1(collector: Collector, corpus: string, raw: SystemEvent[], blueprintFor: ShadowOptions['blueprintFor']): void {
  const events = asRead(raw);
  const legacy = buildProjections(events, DEFAULT_CONFIG, fuzzDeps);
  const blueprint = (blueprintFor ?? legacyBlueprintFor)(arcOf(events));
  const v2 = buildProjectionsV2(events, fuzzDeps, [blueprint]);
  const name = `E1 ${corpus}`;
  collector.check(name, `${corpus} templates`, v2.templates, legacy.templates);
  collector.check(name, `${corpus} instances`, v2.instances, legacy.instances);
  collector.check(name, `${corpus} ledger`, v2.ledger, legacy.ledger);
  collector.check(name, `${corpus} dayRollups`, v2.dayRollups, legacy.dayRollups);
  collector.check(name, `${corpus} playerState`, v2.playerState, legacy.playerState);
}

async function e2(collector: Collector, corpus: string, raw: SystemEvent[], offsetOrDate: number | string, checkpoints: CheckpointRow[], blueprintFor: ShadowOptions['blueprintFor']): Promise<void> {
  const events = asRead(raw);
  const today = typeof offsetOrDate === 'string' ? offsetOrDate : dateAt(offsetOrDate);
  const prefix = prefixOf(events, today);
  const rows = checkpoints.filter((row) => row.sealed_at === undefined || row.sealed_at.slice(0, 10) <= today);
  const deps = await loadLegacyDb(prefix, today, rows);
  const blueprint = (blueprintFor ?? legacyBlueprintFor)(arcOf(events));
  const facts = rows.map((row) => ({ day: row.day, sealed_at: row.sealed_at, rank_after: row.rank_after }));
  const input = { events: prefix, checkpoints: facts };
  const env = readModelEnv({ ...input, blueprint, asOf: today });
  const label = `${corpus} ${today}`;
  const start = blueprint.arc.startDate;
  const now = `${today}T08:30:00.000Z`;
  const day = arcDay(now, start, blueprint.arc.timezone, blueprint.arc.dayBoundaryHour);

  collector.check('E2 attributes', label, evaluateAttributes(blueprint, env), await getAttributes(today, DEFAULT_CONFIG));
  for (const checkpointDay of [0, 14, 30, 60, 90, 120] as Checkpoint['day'][]) {
    const gate = blueprint.gates.find((g) => g.day === checkpointDay)!;
    const legacy = await getCheckpointReport(checkpointDay, today, DEFAULT_CONFIG);
    collector.check('E2 gates', `${label} gate ${checkpointDay}`, evaluateGate(gate, rankSealedBefore(facts, checkpointDay), env), legacy.result);
    collector.check('E2 checkpoint comparison', `${label} gate ${checkpointDay}`, checkpointComparisonFor(blueprint, rows, checkpointDay, env), await getCheckpointComparison(checkpointDay, today, DEFAULT_CONFIG));
  }
  collector.check('E2 bosses', label, evaluateBosses(blueprint.bosses, env, prefix), await Promise.all(BOSSES.map((boss) => getBossStatus(boss.id, today))));
  collector.check('E2 achievements', label, evaluateAchievements(blueprint, env), await getAchievementsReport(today, DEFAULT_CONFIG));
  collector.check('E2 frozen evidence', label, evidenceSnapshot(blueprint, env), await computeGateEvidence(today, DEFAULT_CONFIG));
  collector.check('E2 reality', label, realitySummary(blueprint, env), await getRealitySummary(today));
  const legacyWeekly = await getWeeklyReview(today, DEFAULT_CONFIG, deps);
  const v2Weekly = evaluateWeeklyReview(blueprint, input, today);
  collector.check('E2 weekly review', label, { thisWeek: v2Weekly.thisWeek, lastWeek: v2Weekly.lastWeek, review: v2Weekly.review, nudge: v2Weekly.resumeNudge, correlation: v2Weekly.sleepDsaCorrelation },
    { thisWeek: legacyWeekly.thisWeek, lastWeek: legacyWeekly.lastWeek, review: legacyWeekly.review, nudge: legacyWeekly.resumeNudge, correlation: legacyWeekly.sleepDsaCorrelation });
  collector.check('E2 message context', label, messageContextFor({ blueprint, events: prefix, today }), await computeMessageContext(today, DEFAULT_CONFIG));
  collector.check('E2 transmission context', label, systemMessageContextFor({ ...input, blueprint, today, arcDay: day, now }), await buildSystemMessageContext(today, day, DEFAULT_CONFIG, { now: () => now }));
  collector.check('E2 recoverable day', label, recoverableDayFor(prefix, buildProjectionsV2(prefix, fuzzDeps, [blueprint]), blueprint, today), await getRecoverableDay(today, DEFAULT_CONFIG));
}

export async function runShadow(options: ShadowOptions = {}): Promise<ShadowReport> {
  const started = Date.now();
  const log = options.log ?? (() => undefined);
  const collector = new Collector();
  const { blueprintFor } = options;
  void LEGACY_BLUEPRINT_V1;

  log('E1 golden 120-day log');
  const golden = legacyActivityLog({ seed: 42, days: 120 });
  e1(collector, 'golden', golden, blueprintFor);
  const activitySeeds = options.activitySeeds ?? 100;
  log(`E1 ${activitySeeds} activity seeds`);
  for (let seed = 1; seed <= activitySeeds; seed++) e1(collector, 'activity', legacyActivityLog({ seed, days: 60, skipRate: 0.2 }), blueprintFor);
  const fuzzSeeds = options.fuzzSeeds ?? 1000;
  log(`E1 ${fuzzSeeds} fuzz logs`);
  for (let seed = 1; seed <= fuzzSeeds; seed++) e1(collector, 'fuzz', randomEventLog(seed), blueprintFor);

  const goldenDays = options.goldenDays ?? [0, 6, 13, 20, 29, 44, 49, 53, 59, 76, 89, 104, 119];
  log(`E2 golden log, ${goldenDays.length} days`);
  for (const offset of goldenDays) await e2(collector, 'golden', golden, offset, [], blueprintFor);

  const fuzzE2Seeds = options.fuzzE2Seeds ?? 10;
  log(`E2 ${fuzzE2Seeds} fuzz logs (last day)`);
  for (let seed = 1; seed <= fuzzE2Seeds; seed++) {
    const events = randomEventLog(seed, 40);
    const last = events.reduce((max, event) => (event.local_date > max ? event.local_date : max), events[0]!.local_date);
    await e2(collector, `fuzz ${seed}`, events, last, [], blueprintFor);
  }

  if (options.owner) {
    const { events, checkpoints } = options.owner;
    log('E1 + E2 on the owner export');
    e1(collector, 'owner', events, blueprintFor);
    const dates = [...new Set(events.filter((e) => e.type === 'APP_OPENED').map((e) => e.local_date))].sort();
    const picks = dates.filter((_, index) => index % 7 === 0 || index === dates.length - 1);
    for (const date of picks) await e2(collector, 'owner', events, date, checkpoints, blueprintFor);
  }

  const sections = [...collector.sections.values()];
  return { sections, ok: sections.every((section) => section.mismatches.length === 0), seconds: (Date.now() - started) / 1000 };
}

export function formatReport(report: ShadowReport): string {
  const width = Math.max(...report.sections.map((section) => section.name.length));
  const lines = report.sections.map((section) => {
    const status = section.mismatches.length === 0 ? 'clean' : `${section.mismatches.length}+ DIFFER`;
    return `${section.name.padEnd(width)}  ${String(section.compared).padStart(6)} compared  ${status}`;
  });
  const details = report.sections.filter((section) => section.mismatches.length > 0).flatMap((section) => [`\n${section.name}:`, ...section.mismatches.map((m) => `  ${m}`)]);
  return [...lines, ...details, `\n${report.ok ? 'SHADOW CLEAN' : 'SHADOW FOUND DIFFERENCES'} in ${report.seconds.toFixed(1)}s`].join('\n');
}
