// The read models under the Blueprint engine (platform/05 loop 6.2, ENGINE_V2).
//
// Each function here answers the same question as the legacy store function
// of the same purpose - same arguments, same result shape - by evaluating the
// Blueprint in force against the log, the checkpoint rows and the projections
// already in the database. E2 (platform/02 §22.2) is the proof that the
// answers are equal; the legacy functions call these behind the flag and
// stay in place untouched for when it is off.
//
// Every function returns undefined when there is no arc, so the legacy
// function's own no-arc handling still decides what that looks like.
import { evaluateAchievements } from '../blueprint/evaluate/achievement';
import { evaluateAttributes } from '../blueprint/evaluate/attribute';
import { evaluateBoss } from '../blueprint/evaluate/boss';
import { checkpointComparisonFor, evidenceSnapshot, realitySummary } from '../blueprint/evaluate/checkpoint';
import { evaluateCondition } from '../blueprint/evaluate/condition';
import { evaluateGate, rankSealedBefore } from '../blueprint/evaluate/gate';
import { messageContextFor, recoverableDayFor, systemMessageContextFor } from '../blueprint/evaluate/messages';
import { readModelEnv } from '../blueprint/evaluate/readModel';
import type { SignalEnv } from '../blueprint/evaluate/signals';
import { evaluateWeeklyReview } from '../blueprint/evaluate/weeklyReview';
import { stampsVersions } from '../blueprint/engine/projections';
import { resolveBlueprints, versionFor } from '../blueprint/resolve';
import type { SystemBlueprint } from '../blueprint/schema';
import { db } from '../db/db';
import { getAllEvents } from '../db/events';
import type { BuiltProjections } from '../db/projectionParts';
import { projectionEpoch } from '../db/projections';
import type { CheckpointRow } from '../db/schema';
import type { AttributeResult } from '../engine/attributes';
import type { BossResult } from '../engine/boss';
import type { MessageContext } from '../engine/messages';
import type { GateEvidence, GateResult } from '../engine/rank';
import { verdictTextFor } from '../engine/rank';
import type { SystemMessageContext } from '../engine/systemVoice';
import type { SystemEvent } from '../engine/types';
import { getActiveArc } from './arc';
import type { RealitySummary } from './reality';

interface ReadInputs {
  blueprint: SystemBlueprint;
  events: SystemEvent[];
  checkpoints: CheckpointRow[];
  projections: BuiltProjections;
  env: SignalEnv;
}

// One screen refresh asks for several read models; they all want the same inputs. Loading the log, upcasting
// it and building the shared environment is the expensive part, so it is done once per STATE: the key changes
// whenever the log grows, a checkpoint is sealed, the projections are rebuilt, or the date asked about changes.
let cache: { key: string; inputs: ReadInputs } | undefined;

/** Everything one read needs, loaded once: the log, the checkpoint rows, the cached projections and the shared env. */
export async function readInputs(today: string): Promise<ReadInputs | undefined> {
  if (!(await getActiveArc())) return undefined;
  const [eventCount, lastEvent, checkpointRows] = await Promise.all([db.event.count(), db.event.orderBy('id').last(), db.checkpoint.toArray()]);
  const key = [today, eventCount, lastEvent?.id ?? '', projectionEpoch(), checkpointRows.map((row) => `${row.id}:${row.sealed_at ?? ''}:${row.rank_after ?? ''}`).join(',')].join('|');
  if (cache?.key === key) return cache.inputs;
  const [events, checkpoints, templates, instances, ledger, dayRollups] = await Promise.all([
    getAllEvents(), db.checkpoint.toArray(), db.quest_template.toArray(), db.quest_instance.toArray(), db.xp_ledger.toArray(), db.day_rollup.toArray(),
  ]);
  const { versions } = resolveBlueprints(events);
  const blueprint = versionFor(versions, today) ?? versions[0];
  if (!blueprint) return undefined;
  const projections: BuiltProjections = { templates, instances, ledger, dayRollups, playerState: null };
  const inputs: ReadInputs = { blueprint, events, checkpoints, projections, env: readModelEnv({ blueprint, events, checkpoints, asOf: today, projections }) };
  cache = { key, inputs };
  return inputs;
}

export async function attributesV2(today: string): Promise<AttributeResult[] | undefined> {
  const inputs = await readInputs(today);
  return inputs && (evaluateAttributes(inputs.blueprint, inputs.env) as unknown as AttributeResult[]);
}

export async function bossStatusV2(bossId: string, today: string): Promise<BossResult | undefined> {
  const inputs = await readInputs(today);
  const def = inputs?.blueprint.bosses.find((boss) => boss.id === bossId);
  return inputs && def ? (evaluateBoss(def, inputs.env, inputs.events) as unknown as BossResult) : undefined;
}

export async function gateEvidenceV2(today: string): Promise<GateEvidence | undefined> {
  const inputs = await readInputs(today);
  return inputs && (evidenceSnapshot(inputs.blueprint, inputs.env) as unknown as GateEvidence);
}

export async function gateResultV2(day: number, today: string): Promise<{ result: GateResult; checkpoint: CheckpointRow | undefined; verdictText: string } | undefined> {
  const inputs = await readInputs(today);
  const gate = inputs?.blueprint.gates.find((candidate) => candidate.day === day);
  if (!inputs || !gate) return undefined;
  const result = evaluateGate(gate, rankSealedBefore(inputs.checkpoints, day), inputs.env);
  return { result, checkpoint: inputs.checkpoints.find((row) => row.day === day), verdictText: verdictTextFor(result) };
}

export async function checkpointComparisonV2(day: number, today: string) {
  const inputs = await readInputs(today);
  return inputs && checkpointComparisonFor(inputs.blueprint, inputs.checkpoints, day, inputs.env);
}

/** Each Blueprint milestone with its live label and whether it is met (the Skills milestone panel). */
export async function milestonesV2(today: string): Promise<{ id: string; label: string; progress: string; met: boolean }[] | undefined> {
  const inputs = await readInputs(today);
  return inputs && inputs.blueprint.milestones.map((milestone) => {
    const result = evaluateCondition(milestone.condition, inputs.env);
    return { id: milestone.id, label: milestone.label, progress: result.label, met: result.met };
  });
}

export async function achievementsV2(today: string) {
  const inputs = await readInputs(today);
  return inputs && evaluateAchievements(inputs.blueprint, inputs.env);
}

export async function realityV2(today: string): Promise<RealitySummary | undefined> {
  const inputs = await readInputs(today);
  return inputs && (realitySummary(inputs.blueprint, inputs.env) as unknown as RealitySummary);
}

/** Everything in the weekly review that is a read model; the weekly-quest proposal stays with store/weeklyQuest.ts. */
export async function weeklyReviewV2(today: string) {
  const inputs = await readInputs(today);
  return inputs && evaluateWeeklyReview(inputs.blueprint, { events: inputs.events, checkpoints: inputs.checkpoints, projections: inputs.projections }, today);
}

export async function messageContextV2(today: string): Promise<MessageContext | undefined> {
  const inputs = await readInputs(today);
  return inputs && messageContextFor({ blueprint: inputs.blueprint, events: inputs.events, today, projections: inputs.projections });
}

export async function systemMessageContextV2(today: string, arcDay: number, now: string): Promise<SystemMessageContext | null | undefined> {
  const inputs = await readInputs(today);
  return inputs && systemMessageContextFor({ blueprint: inputs.blueprint, events: inputs.events, today, arcDay, now, checkpoints: inputs.checkpoints, projections: inputs.projections });
}

export async function recoverableDayV2(today: string) {
  const inputs = await readInputs(today);
  return inputs && recoverableDayFor(inputs.events, inputs.projections, inputs.blueprint, today);
}

/** The Blueprint version a sealed checkpoint should record - only for arcs with explicit versions, so the owner's rows keep their legacy shape. */
export async function blueprintVersionStampV2(today: string): Promise<number | undefined> {
  const { versions } = resolveBlueprints(await getAllEvents());
  return stampsVersions(versions) ? (versionFor(versions, today) ?? versions[0])?.version : undefined;
}
