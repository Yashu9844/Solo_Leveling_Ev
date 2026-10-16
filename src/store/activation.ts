// Bringing a generated System into being (platform/03 §23.2, §24; 05 loop 10.4). One transaction writes the genesis of the arc:
// ARC_STARTED, BLUEPRINT_ACTIVATED (version 1), the person's starting measurements, the arc/profile rows, the Day-0 checkpoint and
// the projections the screens read - so a person is either at the start of a System or at the start of nothing, never half-way.
// The legacy path (store/onboarding.ts initialiseArc) is the owner's and is untouched.
import { activationEvent, assertActivatable } from '../blueprint/activation';
import { blueprintVersionRows, replaceBlueprintVersions } from '../db/blueprintProjection';
import { buildProjectionsV2 } from '../blueprint/engine/projections';
import type { SystemBlueprint } from '../blueprint/schema';
import { db } from '../db/db';
import { appendEvent, getAllEvents } from '../db/events';
import { replaceProjectionTables } from '../db/projections';
import type { ArcRow, CheckpointRow, ProfileRow } from '../db/schema';
import { localDate } from '../engine/time';
import type { ArcStartedPayload, EngineDeps, MetricRecordedPayload, SystemEvent } from '../engine/types';
import { engineV2Enabled } from '../flags';
import { getActiveArc } from './arc';
import { refreshBlueprintVersions } from './systemBlueprint';

export interface NewSystemInput {
  /** A validated, generated Blueprint whose `arcId` is the arc being created. */
  blueprint: SystemBlueprint;
  name: string;
  /** Starting measurements by metric id (weight_kg, ...). Those the Blueprint does not track are dropped. */
  baseline?: Record<string, number>;
  /** Each if-then the person wrote, by the core quest it belongs to; written as PLAN_AMENDED, as the owner's three always were. */
  intentions?: { questId: string; time: string; place: string; first_action: string }[];
}

const UNITS: Record<string, string> = { weight_kg: 'kg', waist_cm: 'cm', bodyfat_pct: '%' };

function makeEvent(deps: EngineDeps, blueprint: SystemBlueprint, localDay: string, type: SystemEvent['type'], payload: object, idemKey: string): SystemEvent {
  return { id: deps.newId(), type, occurred_at: deps.now(), local_date: localDay, arc_id: blueprint.arcId, payload: payload as Record<string, unknown>, source: 'user', idem_key: idemKey, schema_v: 1 };
}

/**
 * Creates the arc for `input.blueprint` and makes it version 1. Returns the arc id. If an arc already exists (a double tap, a second tab)
 * this changes nothing and returns that arc's id. Throws, changing nothing, if the Blueprint cannot become active.
 */
export async function activateNewSystem(input: NewSystemInput, deps: EngineDeps): Promise<string> {
  if (!engineV2Enabled()) throw new Error('A generated System needs the Blueprint engine (ENGINE_V2).');
  const existing = await getActiveArc();
  if (existing) return existing.id;

  const { blueprint } = input;
  const { arc } = blueprint;
  const today = localDate(deps.now(), arc.timezone, arc.dayBoundaryHour);
  const arcDay = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${arc.startDate}T00:00:00Z`)) / 86_400_000) + 1;
  await assertActivatable(blueprint, undefined, { today, arcDay, nextCheckpointDay: arcDay, arcId: blueprint.arcId });

  const started: ArcStartedPayload = {
    arcId: blueprint.arcId, startDate: arc.startDate, endDate: arc.endDate, timezone: arc.timezone, dayBoundaryHour: arc.dayBoundaryHour, dayCloseHour: arc.dayCloseHour,
    mainQuestText: blueprint.identity.primaryObjective,
  };
  const tracked = new Set(blueprint.metrics.filter((metric) => 'manual' in metric.source).map((metric) => metric.id));
  const baseline = Object.entries(input.baseline ?? {}).filter(([kind, value]) => tracked.has(kind) && Number.isFinite(value));
  // Created in this order: the log sorts by id, and the arc must start before anything is recorded in it.
  const genesis: SystemEvent[] = [
    makeEvent(deps, blueprint, today, 'ARC_STARTED', started, `arc-started:${blueprint.arcId}`),
    activationEvent(blueprint, { id: deps.newId(), occurred_at: deps.now(), local_date: today }),
  ];
  const quests = new Set(blueprint.quests.map((quest) => quest.id));
  for (const { questId, ...sentence } of input.intentions ?? []) {
    if (!quests.has(questId)) continue;
    genesis.push(makeEvent(deps, blueprint, today, 'PLAN_AMENDED', { questKey: questId, implementationIntention: sentence }, `plan:${blueprint.arcId}:${questId}`));
  }
  for (const [kind, value] of baseline) {
    const payload: MetricRecordedPayload = { kind, value, unit: UNITS[kind] ?? '' };
    genesis.push(makeEvent(deps, blueprint, today, 'METRIC_RECORDED', payload, `baseline:${blueprint.arcId}:${kind}`));
  }

  // Everything derived is computed before the transaction opens: hashing awaits WebCrypto, and awaiting it inside would commit early.
  const log = [...(await getAllEvents()), ...genesis];
  const versionRows = await blueprintVersionRows(log);
  const built = buildProjectionsV2(log, deps);

  const arcRow: ArcRow = {
    id: blueprint.arcId, start_date: arc.startDate, end_date: arc.endDate, timezone: arc.timezone, day_boundary_hour: arc.dayBoundaryHour, day_close_hour: arc.dayCloseHour,
    main_quest_text: blueprint.identity.primaryObjective, status: 'active',
  };
  const checkpointRow: CheckpointRow = {
    id: deps.newId(), day: 0, sealed_at: deps.now(), export_verified: false, metrics: Object.fromEntries(baseline), self_efficacy: {}, automaticity: {}, enjoyment: {},
    rank_before: 'E', rank_after: 'E', gates: {}, controlled: {}, external: {}, quest_templates_snapshot: { templates: built.templates }, blueprint_version: blueprint.version,
  };
  const profileRow: ProfileRow = {
    id: blueprint.arcId, name: input.name, created_at: deps.now(), arc_timezone: arc.timezone,
    settings: { wakeTime: arc.wakeTime, sleepTime: arc.sleepTime },
  };

  await db.transaction(
    'rw',
    [db.event, db.arc, db.checkpoint, db.profile, db.blueprint_version, db.quest_template, db.quest_instance, db.xp_ledger, db.day_rollup, db.player_state],
    async () => {
      // A second activation that raced this one: the first to commit wins, this one writes nothing.
      if ((await db.arc.count()) > 0) return;
      for (const event of genesis) await appendEvent(event);
      await replaceBlueprintVersions(versionRows);
      await db.arc.add(arcRow);
      await db.checkpoint.add(checkpointRow);
      await db.profile.add(profileRow);
      await replaceProjectionTables(built);
    },
  );
  await refreshBlueprintVersions();
  return (await getActiveArc())?.id ?? blueprint.arcId;
}
