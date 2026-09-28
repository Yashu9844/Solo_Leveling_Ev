// Orchestrates the one write onboarding is allowed to make: an entire arc,
// atomically, or nothing. Not pure (touches the clock, id generation, and
// Dexie) — that's why it lives in store/, not engine/. The pure part
// (turning intentions into quest templates) is generateCoreQuestTemplates
// in engine/quests.ts; this module just wires it to persistence.
import type {
  ArcStartedPayload,
  CoreQuestKey,
  EngineConfig,
  EngineDeps,
  ImplementationIntention,
  MetricRecordedPayload,
  PlanAmendedPayload,
  SystemEvent,
} from '../engine/types';
import { generateCoreQuestTemplates } from '../engine/quests';
import { localDate } from '../engine/time';
import { db } from '../db/db';
import { appendEvent } from '../db/events';
import type { ArcRow, CheckpointRow, ProfileRow } from '../db/schema';

export interface OnboardingIntentions {
  career: ImplementationIntention;
  dsa: ImplementationIntention;
  training: ImplementationIntention;
}

export interface OnboardingBaseline {
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number; // ships empty — never prefilled, never estimated
  problemsSolvedSoFar?: number;
}

export interface OnboardingInput {
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
  dayBoundaryHour: number;
  dayCloseHour: number;
  wakeTime: string;
  sleepTime: string;
  trainingDays: string[];
  stepsTarget: number;
  screenCapMinutes: number;
  attentionApps: string[];
  mainQuestText: string;
  stakeText?: string;
  intentions: OnboardingIntentions;
  baseline: OnboardingBaseline;
}

/** True once an arc row exists. Used for the /onboarding <-> /today routing guard. */
export async function hasArc(): Promise<boolean> {
  return (await db.arc.count()) > 0;
}

/**
 * Writes ARC_STARTED, one PLAN_AMENDED per captured intention, and any
 * baseline METRIC_RECORDED events, plus the arc/quest_template/checkpoint/
 * profile projection rows a fresh app needs to boot straight to /today —
 * all inside one Dexie transaction. If an arc already exists (including a
 * race from a double-tapped submit button), this is a no-op that returns
 * the existing arc's id rather than creating a second one.
 */
export async function initialiseArc(
  input: OnboardingInput,
  config: EngineConfig,
  deps: EngineDeps
): Promise<string> {
  return db.transaction(
    'rw',
    [db.event, db.arc, db.quest_template, db.checkpoint, db.profile],
    async () => {
      const existing = await db.arc.toCollection().first();
      if (existing) {
        return existing.id;
      }

      const arcId = deps.newId();
      const now = deps.now();
      const today = localDate(now, input.timezone, input.dayBoundaryHour);

      // generateCoreQuestTemplates only reads arc dates from config.arc,
      // so the caller (here) injects the onboarding-chosen dates via an
      // effective config rather than the function taking a separate param.
      const effectiveConfig: EngineConfig = {
        ...config,
        arc: {
          timezone: input.timezone,
          dayBoundaryHour: input.dayBoundaryHour,
          dayCloseHour: input.dayCloseHour,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      };

      const templates = generateCoreQuestTemplates(
        arcId,
        {
          career: input.intentions.career,
          dsa: input.intentions.dsa,
          training: input.intentions.training,
        },
        effectiveConfig,
        deps
      );

      const arcStartedPayload: ArcStartedPayload = {
        arcId,
        startDate: input.startDate,
        endDate: input.endDate,
        timezone: input.timezone,
        dayBoundaryHour: input.dayBoundaryHour,
        dayCloseHour: input.dayCloseHour,
        mainQuestText: input.mainQuestText,
        stakeText: input.stakeText,
      };

      await appendEvent(
        makeEvent(deps, arcId, today, 'ARC_STARTED', arcStartedPayload, `arc-started:${arcId}`)
      );

      const intentionEntries: [CoreQuestKey, ImplementationIntention][] = [
        ['career', input.intentions.career],
        ['dsa', input.intentions.dsa],
        ['training', input.intentions.training],
      ];
      for (const [questKey, implementationIntention] of intentionEntries) {
        const payload: PlanAmendedPayload = { questKey, implementationIntention };
        await appendEvent(
          makeEvent(deps, arcId, today, 'PLAN_AMENDED', payload, `plan:${arcId}:${questKey}`)
        );
      }

      const baselineEntries = baselineToMetrics(input.baseline);
      for (const metric of baselineEntries) {
        await appendEvent(
          makeEvent(deps, arcId, today, 'METRIC_RECORDED', metric, `baseline:${arcId}:${metric.kind}`)
        );
      }

      const arcRow: ArcRow = {
        id: arcId,
        start_date: input.startDate,
        end_date: input.endDate,
        timezone: input.timezone,
        day_boundary_hour: input.dayBoundaryHour,
        day_close_hour: input.dayCloseHour,
        main_quest_text: input.mainQuestText,
        stake_text: input.stakeText,
        status: 'active',
      };
      await db.arc.add(arcRow);
      await db.quest_template.bulkAdd(templates);

      const checkpointRow: CheckpointRow = {
        id: deps.newId(),
        day: 0,
        sealed_at: now,
        // Day 0 is exempt from the export-before-seal rule — final/07 §8
        // applies it from Day 30 onward. See db/schema.ts's CheckpointRow.
        export_verified: false,
        metrics: Object.fromEntries(baselineEntries.map((m) => [m.kind, m.value])),
        self_efficacy: {},
        automaticity: {},
        enjoyment: {},
        rank_before: 'E',
        rank_after: 'E',
        gates: {},
        controlled: {},
        external: {},
        quest_templates_snapshot: { templates },
      };
      await db.checkpoint.add(checkpointRow);

      const profileRow: ProfileRow = {
        id: arcId,
        name: input.name,
        created_at: now,
        arc_timezone: input.timezone,
        height_cm: input.baseline.heightCm,
        settings: {
          wakeTime: input.wakeTime,
          sleepTime: input.sleepTime,
          trainingDays: input.trainingDays,
          stepsTarget: input.stepsTarget,
          screenCapMinutes: input.screenCapMinutes,
          attentionApps: input.attentionApps,
        },
      };
      await db.profile.add(profileRow);

      return arcId;
    }
  );
}

/**
 * DEV-only. Deletes all Slice 0-4 data and returns the app to a fresh
 * pre-onboarding state. Gated behind import.meta.env.DEV at the call site
 * (Profile screen) — this function itself has no such guard, so never
 * call it from anything but that DEV-gated button.
 */
export async function resetArc(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.event,
      db.arc,
      db.quest_template,
      db.quest_instance,
      db.xp_ledger,
      db.day_rollup,
      db.player_state,
      db.checkpoint,
      db.profile,
    ],
    async () => {
      await db.event.clear();
      await db.arc.clear();
      await db.quest_template.clear();
      await db.quest_instance.clear();
      await db.xp_ledger.clear();
      await db.day_rollup.clear();
      await db.player_state.clear();
      await db.checkpoint.clear();
      await db.profile.clear();
    }
  );
}

function makeEvent<T extends object>(
  deps: EngineDeps,
  arcId: string,
  localDateStr: string,
  type: SystemEvent['type'],
  payload: T,
  idemKey: string
): SystemEvent {
  return {
    id: deps.newId(),
    type,
    occurred_at: deps.now(),
    local_date: localDateStr,
    arc_id: arcId,
    payload: payload as Record<string, unknown>,
    source: 'user',
    idem_key: idemKey,
    schema_v: 1,
  };
}

function baselineToMetrics(baseline: OnboardingBaseline): MetricRecordedPayload[] {
  const metrics: MetricRecordedPayload[] = [];
  if (baseline.heightCm != null) {
    metrics.push({ kind: 'height_cm', value: baseline.heightCm, unit: 'cm' });
  }
  if (baseline.weightKg != null) {
    metrics.push({ kind: 'weight_kg', value: baseline.weightKg, unit: 'kg' });
  }
  if (baseline.bodyFatPct != null) {
    metrics.push({ kind: 'bodyfat_pct', value: baseline.bodyFatPct, unit: '%' });
  }
  if (baseline.problemsSolvedSoFar != null) {
    metrics.push({ kind: 'problems_solved', value: baseline.problemsSolvedSoFar, unit: 'count' });
  }
  return metrics;
}
