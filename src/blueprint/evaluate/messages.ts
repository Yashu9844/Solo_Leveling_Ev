// The facts the System's two voices read (platform/02 §18.4): the evidence
// context behind P1–P3 messages and the live-state context behind the
// transmission. Both are cuts of data other evaluators already derive; nothing
// is invented here. They are driven by the Blueprint's instruments, quests and
// checkpoint schedule, and by the V2 projections (day rollups, ledger, streak).
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { BuiltProjections } from '../../db/projectionParts';
import { buildDayOutcomes, consistencyOver } from '../../db/projectionParts';
import type { DayFacts, MessageContext } from '../../engine/messages';
import { applyEvents } from '../../engine/reduce';
import { streakFrom } from '../../engine/streak';
import { levelFor } from '../../engine/level';
import { isDayClosed } from '../../engine/time';
import { bandFor, phaseFor, type SystemMessageContext } from '../../engine/systemVoice';
import type { Rank, SystemEvent } from '../../engine/types';
import { engineConfigFromBlueprint } from '../engineConfig';
import { buildProjectionsV2 } from '../engine/projections';
import type { InstrumentConfig, SystemBlueprint } from '../schema';
import { rankSealedBefore, type SealedCheckpointFact } from './gate';
import type { InstrumentRecord } from '../../instruments/framework';
import { recordsFromEvents } from './env';
import { evidenceLines } from './evidenceMessages';

const TREND_MIN_SAMPLE = 3;
const CORRELATION_MIN_SAMPLE = 5;

function shift(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}
function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}

const firstOfType = (blueprint: SystemBlueprint, type: InstrumentConfig['type']) => blueprint.instruments.find((instrument) => instrument.type === type);

/** The core quest whose completion is the sleep guardrail's: the one reading a time_window instrument. */
function sleepQuestId(blueprint: SystemBlueprint): string | undefined {
  const wake = firstOfType(blueprint, 'time_window');
  const reads = (criterion: SystemBlueprint['quests'][number]['criterion']): boolean => (criterion.kind === 'signal' ? criterion.instrumentId === wake?.id : criterion.of.some(reads));
  return blueprint.quests.find((quest) => quest.type === 'core' && reads(quest.criterion))?.id;
}

export interface MessageInputs {
  blueprint: SystemBlueprint;
  events: readonly SystemEvent[];
  today: string;
  projections?: BuiltProjections;
}

/** The evidence context behind P1–P3 System messages. */
export function messageContextFor({ blueprint, events, today, projections }: MessageInputs): MessageContext {
  const built = projections ?? buildProjectionsV2([...events], { now: () => '', newId: () => '' }, [blueprint]);
  const config = engineConfigFromBlueprint(blueprint);
  const state = applyEvents([...events], config);
  const records = recordsFromEvents(events);
  const of = (type: InstrumentConfig['type']): InstrumentRecord[] => {
    const instrument = firstOfType(blueprint, type);
    return instrument ? [...(records.get(instrument.id) ?? [])] : [];
  };

  const rollups = new Map(built.dayRollups.map((row) => [row.local_date, row]));
  const todayRollup = rollups.get(today);
  const today_facts: DayFacts = { local_date: today, core_completed: todayRollup?.core_completed ?? 0, core_total: todayRollup?.core_total ?? 0 };
  const trailingDays: DayFacts[] = built.dayRollups
    .filter((row) => row.local_date < today)
    .sort((a, b) => a.local_date.localeCompare(b.local_date))
    .map((row) => ({ local_date: row.local_date, core_completed: row.core_completed, core_total: row.core_total }));

  // The owner's System speaks through the fields below, which are written for it (and name its domains in their sentences).
  // A generated System speaks through its own templates, which name nothing that is not in its Blueprint.
  if (blueprint.origin !== 'legacy') return { today: today_facts, trailingDays, evidence: evidenceLines(blueprint, events, today) };

  // P1 — the longest single deep block ever, if today set it. Deep work is every duration/study instrument that is not a pipeline substitute.
  const deepInstruments = blueprint.instruments.filter((instrument) => ['build.sessions', 'foundations.blocks', 'foundations.design'].includes(instrument.id));
  const deepByDate = new Map<string, number>();
  for (const instrument of deepInstruments) for (const record of records.get(instrument.id) ?? []) {
    deepByDate.set(record.localDate, Math.max(deepByDate.get(record.localDate) ?? 0, record.record.minutes as number));
  }
  const todayLongest = deepByDate.get(today) ?? 0;
  const priorMax = Math.max(0, ...[...deepByDate].filter(([date]) => date < today).map(([, minutes]) => minutes));

  const attempts = of('practice_item').filter((record) => record.record.isRevisit !== true);
  const hardFirst = attempts.filter((record) => record.record.outcome === 'first_attempt' && record.record.difficulty === 'H').sort((a, b) => a.localDate.localeCompare(b.localDate));
  // Any artifact instrument that can record a deployment (the resume-version instrument cannot).
  const deploymentInstruments = blueprint.instruments.filter((instrument) => instrument.type === 'artifact' && ((instrument.params.kinds as string[] | undefined) ?? []).includes('deployment'));
  const deployments = deploymentInstruments.flatMap((instrument) => records.get(instrument.id) ?? []).filter((record) => record.record.kind === 'deployment').sort((a, b) => a.localDate.localeCompare(b.localDate));

  const medium = attempts.filter((record) => record.record.difficulty === 'M');
  const cur14 = medium.filter((r) => r.localDate >= shift(today, -13) && r.localDate <= today);
  const prev14 = medium.filter((r) => r.localDate >= shift(today, -27) && r.localDate <= shift(today, -14));
  const rate = (rows: InstrumentRecord[]) => rows.filter((r) => r.record.outcome === 'first_attempt').length / rows.length;

  const wake = of('time_window');
  const curWake = wake.filter((r) => r.localDate >= shift(today, -27) && r.localDate <= today).map((r) => r.record.minutes as number);
  const prevWake = wake.filter((r) => r.localDate >= shift(today, -55) && r.localDate <= shift(today, -28)).map((r) => r.record.minutes as number);

  const sleepId = sleepQuestId(blueprint);
  const sleepHitDates = new Set(Object.values(state.quests).filter((c) => c.quest_key === sleepId).map((c) => c.local_date));
  const afterHit = attempts.filter((r) => sleepHitDates.has(r.localDate));
  const afterMiss = attempts.filter((r) => !sleepHitDates.has(r.localDate));

  return {
    today: today_facts,
    trailingDays,
    newLongestDeepBlockMinutes: todayLongest > 0 && todayLongest > priorMax ? todayLongest : undefined,
    firstHardProblemFirstAttempt: hardFirst.length > 0 && hardFirst[0]!.localDate === today,
    firstDeploymentReachable: deployments.length > 0 && deployments[0]!.localDate === today,
    firstAttemptRateMTrend: cur14.length >= TREND_MIN_SAMPLE && prev14.length >= TREND_MIN_SAMPLE ? { current: rate(cur14), previous: rate(prev14) } : undefined,
    wakeSdTrend: curWake.length >= 2 && prevWake.length >= 2 ? { current: stddev(curWake), fourWeeksAgo: stddev(prevWake) } : undefined,
    dsaFirstAttemptBySleep: afterHit.length >= CORRELATION_MIN_SAMPLE && afterMiss.length >= CORRELATION_MIN_SAMPLE
      ? { afterHit: rate(afterHit), afterMiss: rate(afterMiss) }
      : undefined,
  };
}

export interface RecoverableDayV2 { localDate: string; coreCompleted: number; coreTotal: number; missedTitles: string[] }

/** The most recent incomplete, unpaused, unrecovered, actually-opened day within the 2-day recovery window. */
export function recoverableDayFor(events: readonly SystemEvent[], projections: BuiltProjections, blueprint: SystemBlueprint, today: string): RecoverableDayV2 | null {
  const state = applyEvents([...events], engineConfigFromBlueprint(blueprint));
  if (!state.arc) return null;
  for (const localDate of [shift(today, -1), shift(today, -2)].filter((d) => d >= state.arc!.start_date)) {
    if (state.recoveries[localDate] || state.arc.paused_dates.includes(localDate)) continue;
    // The cache table is read in primary-key order, which is the order the titles are listed in.
    const core = projections.templates
      .filter((t) => t.type === 'core' && t.active_from <= localDate && (t.active_to === null || localDate < t.active_to))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (core.length === 0) continue;
    const dayInstances = projections.instances.filter((i) => i.local_date === localDate);
    if (dayInstances.length === 0) continue; // never opened, not missed
    const done = new Set(dayInstances.filter((i) => i.state === 'complete').map((i) => i.template_id));
    const coreCompleted = core.filter((t) => done.has(t.id)).length;
    if (coreCompleted >= core.length) continue;
    return { localDate, coreCompleted, coreTotal: core.length, missedTitles: core.filter((t) => !done.has(t.id)).map((t) => t.title) };
  }
  return null;
}

export interface SystemContextInputs extends MessageInputs {
  checkpoints: readonly SealedCheckpointFact[];
  arcDay: number;
  /** The instant "now", for the phase of day and whether the day has closed. */
  now: string;
}

/** The live-state context behind the System transmission; null before an arc exists. */
export function systemMessageContextFor(input: SystemContextInputs): SystemMessageContext | null {
  const { blueprint, events, today, arcDay, now } = input;
  const config = engineConfigFromBlueprint(blueprint);
  const state = applyEvents([...events], config);
  const arc = state.arc;
  if (!arc) return null;
  const built = input.projections ?? buildProjectionsV2([...events], { now: () => '', newId: () => '' }, [blueprint]);

  const rollup = built.dayRollups.find((row) => row.local_date === today);
  const yesterdayRollup = built.dayRollups.find((row) => row.local_date === shift(today, -1));
  const totalXp = built.ledger.reduce((sum, row) => sum + row.amount, 0);
  const outcomes = buildDayOutcomes([...events], state.quests, arc.start_date, arc.paused_dates, shift(today, -1));
  const streak = outcomes.length > 0 ? streakFrom(outcomes, config.streak) : undefined;
  const recoverable = recoverableDayFor(events, built, blueprint, today);

  const xpTarget = Object.values(config.coreQuests).reduce((sum, quest) => sum + quest.xp, 0);
  const xpEarned = rollup?.xp_earned ?? 0;
  const coreCompleted = rollup?.core_completed ?? 0;
  const coreTotal = rollup?.core_total ?? 0;
  const progressPct = xpTarget > 0 ? Math.max(0, Math.min(100, Math.round((xpEarned / xpTarget) * 100))) : 0;
  const level = levelFor(totalXp, config);
  const levelBefore = levelFor(Math.max(0, totalXp - xpEarned), config);

  const dayClosed = isDayClosed(now, config);
  const minutesOfDay = (() => { const [hh, mm] = formatInTimeZone(parseISO(now), config.arc.timezone, 'HH:mm').split(':'); return Number(hh ?? 0) * 60 + Number(mm ?? 0); })();
  const nextCheckpoint = blueprint.progression.checkpointDays.find((d) => d >= arcDay);
  const lastOpen = events.filter((e) => e.type === 'APP_OPENED' && e.local_date < today).map((e) => e.local_date).sort().at(-1);
  const rank: Rank = (() => { const sealedRows = input.checkpoints.filter((c) => c.sealed_at !== undefined && c.rank_after !== undefined); return sealedRows.length === 0 ? 'E' : rankSealedBefore(input.checkpoints, Math.max(...sealedRows.map((c) => c.day)) + 1); })();

  return {
    localDate: today,
    arcDay,
    minutesOfDay,
    phase: phaseFor(minutesOfDay, dayClosed),
    dayClosed,
    arcState: today < arc.start_date ? 'before' : today > arc.end_date ? 'after' : 'active',
    xpEarned, xpTarget, progressPct,
    band: bandFor(progressPct, coreCompleted, coreTotal),
    coreCompleted, coreTotal,
    firstActionOfDay: coreCompleted === 1,
    level: level.level, xpIntoLevel: level.xpIntoLevel, xpForNext: level.xpForNext,
    rank,
    streak: streak?.arc_streak ?? 0,
    consistency7: streak ? consistencyOver(streak.history, 7) : 0,
    reducedMode: streak?.reduced_mode ?? false,
    recoveryAvailable: recoverable !== null,
    mvdMet: rollup?.mvd_met ?? false,
    daysToCheckpoint: nextCheckpoint === undefined ? null : nextCheckpoint - arcDay,
    eventsToday: events.filter((e) => e.local_date === today).map((e) => e.type),
    leveledUpToday: level.level > levelBefore.level,
    yesterdayCleared: yesterdayRollup ? yesterdayRollup.core_total > 0 && yesterdayRollup.core_completed >= yesterdayRollup.core_total : null,
    daysSinceLastOpen: lastOpen ? differenceInCalendarDays(parseISO(today), parseISO(lastOpen)) : null,
    // A generated System tells the static voice pack what it is; the owner's does not, and so hears the pack as written (platform/02 §18.3).
    ...(blueprint.origin === 'legacy' ? {} : { designations: blueprint.domains.map((domain) => domain.designation), boundaryHour: config.arc.dayBoundaryHour }),
  };
}
