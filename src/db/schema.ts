// Dexie table + index declarations only. No queries, no business logic.
// Mirrors final/07-data-model-architecture.md §4. Version 1.
import type {
  EventSource,
  EventType,
  QuestInstance,
  QuestTemplate,
  XpCategory,
} from '../engine/types';

export interface EventRow {
  id: string; // uuidv7, pk
  type: EventType;
  occurred_at: string;
  local_date: string;
  arc_id: string;
  payload: Record<string, unknown>;
  source: EventSource;
  idem_key: string; // unique
  schema_v: number;
}

export interface XpLedgerRow {
  id: string; // pk
  event_id: string;
  // Denormalized beyond final/07 §4.1's literal xp_ledger shape — lets
  // the UI show "this quest earned N XP" without joining back through
  // db.event on every render. Always derivable from event_id's payload.
  instance_id?: string;
  local_date: string;
  amount: number; // always >= 0
  category: XpCategory;
  reason: string;
  capped_from?: number;
}

export interface ProfileRow {
  id: string; // pk
  name: string;
  created_at: string;
  arc_timezone: string;
  height_cm?: number;
  settings: Record<string, unknown>;
  // docs/07-data-model.md's backup nudge: "a local-only app on one phone
  // is one broken screen away from losing the arc." Updated by every
  // real export (store/checkpoint.ts's exportSnapshotJson), read by
  // Profile's backup-status line and the weekly review's export prompt.
  last_export_at?: string;
}

export interface ArcRow {
  id: string; // pk
  start_date: string;
  end_date: string;
  timezone: string;
  day_boundary_hour: number;
  day_close_hour: number;
  main_quest_text: string;
  stake_text?: string;
  status: 'active' | 'paused' | 'complete';
}

// Same shape as the pure engine type — the row IS the persisted template.
export type QuestTemplateRow = QuestTemplate;

// Same shape as the pure engine type — the row IS the generated instance.
export type QuestInstanceRow = QuestInstance;

export interface ApplicationRow {
  id: string; // pk
  local_date: string;
  company: string;
  role: string;
  role_category: string;
  source: string;
  resume_version_id: string;
  why_line: string;
  quality_pass: boolean;
  status: string;
  status_history: { status: string; date: string }[];
  followup_due_at?: string;
  followed_up_at?: string;
  recruiter_contact?: string;
  notes?: string;
}

export interface CareerEventRow {
  id: string; // pk — EXTERNAL, never earns XP
  local_date: string;
  kind:
    | 'response'
    | 'call'
    | 'interview'
    | 'onsite'
    | 'offer'
    | 'rejection'
    | 'conversation'
    | 'mock'
    | 'followup';
  application_id?: string;
  company?: string;
  stuck_on?: string;
  notes?: string;
}

export interface ResumeVersionRow {
  id: string; // pk
  label: string;
  created_at: string;
  changed_because: string;
  external_review?: boolean;
}

export interface DsaProblemRow {
  id: string; // pk
  slug: string;
  title: string;
  topic: string;
  difficulty: 'E' | 'M' | 'H';
  first_logged_at: string;
  insight?: string;
}

export interface DsaAttemptRow {
  id: string; // pk
  problem_id: string;
  event_id: string;
  local_date: string;
  outcome: 'first_attempt' | 'hint' | 'editorial' | 'unsolved';
  minutes: number;
  is_revisit: boolean;
  next_review_at?: string;
}

export interface LearningBlockRow {
  id: string; // pk
  local_date: string;
  topic: string;
  minutes: number;
  note?: string;
}

export interface SystemDesignStudyRow {
  id: string; // pk
  local_date: string;
  system: string;
  mode: 'studied' | 'written_up' | 'explained_aloud';
  minutes: number;
  artifact_url?: string;
  notes?: string;
}

export interface BuildSessionRow {
  id: string; // pk
  local_date: string;
  mode: 'LEARN' | 'SHIP';
  minutes: number;
  project_key: string;
  note?: string;
}

export interface ArtifactRow {
  id: string; // pk
  kind: 'feature' | 'eval' | 'project' | 'deployment' | 'writeup' | 'resume' | 'portfolio';
  title: string;
  url?: string;
  project_key: string;
  local_date: string;
  notes?: string;
  // final/03 §4.4's P2 requirement ("cost per task measured and
  // stated") — a self-certification, kind: 'project' only.
  cost_per_task_stated?: boolean;
}

export interface SkillNodeRow {
  id: string; // pk
  domain: 'dsa' | 'foundations' | 'ai';
  key: string;
  title: string;
  tier?: string;
  parent_id?: string;
}

export interface SkillStateRow {
  node_id: string; // pk
  state: 'unseen' | 'introduced' | 'applied' | 'fluent' | 'retained';
  evidence: Record<string, unknown>;
  updated_at: string;
}

export interface TrainingSessionRow {
  id: string; // pk
  local_date: string;
  type: string;
  minutes: number;
  rpe?: number;
  lifts: { name: string; weight_kg: number; reps: number; est_1rm: number }[];
}

export interface MetricSampleRow {
  id: string; // pk
  local_date: string;
  kind: 'weight_kg' | 'waist_cm' | 'bodyfat_pct' | 'steps' | 'screen_time_min' | 'wake_time' | 'sleep_time' | 'interview_benchmark';
  value: number;
  unit: string;
  note?: string;
}

export interface MaintenanceLogRow {
  local_date: string; // pk
  bath: boolean;
  fuel: boolean;
  laundry: boolean;
  all_done: boolean;
}

export interface DayRollupRow {
  local_date: string; // pk
  xp_earned: number;
  xp_capped_away: number;
  core_completed: number;
  core_total: number;
  mvd_met: boolean;
  grace_applied: boolean;
  reduced_mode: boolean;
  deep_minutes: number;
  longest_block_minutes: number;
  problems: { E: number; M: number; H: number; first_attempt: number };
  applications: number;
  quality_applications: number;
  learn_minutes: number;
  build_mode_split: { LEARN: number; SHIP: number };
  steps: number;
  energy?: number;
  focus?: number;
  blocker?: string;
  app_seconds: number;
}

export interface PlayerStateRow {
  id: string; // pk, singleton row
  total_xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next: number;
  rank: string;
  rank_since_day: number;
  arc_streak: number;
  consistency_7: number;
  consistency_28: number;
  grace_remaining: number;
  schema_v: number;
}

export interface AttributeSnapshotRow {
  id: string; // pk — composite key [local_date, attribute] encoded as `${local_date}::${attribute}`
  local_date: string;
  attribute: string;
  value: number;
  components: Record<string, number>;
}

// export_verified is required true before sealing from Day 30 onward
// (final/07 §8's export-before-seal rule) — Day 0 is exempt since there
// is nothing to export yet at arc creation. Enforced at the write site
// (src/store/onboarding.ts for Day 0; Slice 12 for Day 30+), not here.
export interface CheckpointRow {
  id: string; // pk
  day: 0 | 14 | 30 | 60 | 90 | 120;
  sealed_at?: string;
  export_verified: boolean;
  metrics: Record<string, unknown>;
  self_efficacy: Record<string, unknown>;
  automaticity: Record<string, unknown>;
  enjoyment: Record<string, unknown>;
  rank_before: string;
  rank_after?: string;
  gates: Record<string, unknown>;
  controlled: Record<string, unknown>;
  external: Record<string, unknown>;
  verdict_text?: string;
  quest_templates_snapshot: Record<string, unknown>;
}

export interface ReflectionStateRow {
  id: string; // pk — matches the reflection's static id in engine/reflections.ts
  times_shown: number;
  last_shown_at?: string;
}

/**
 * final/00 §C8 / final/01 §2.1.1's "weekly quest payout" — one accepted
 * proposal per week, direct-write like `checkpoint`'s self_efficacy
 * field (not event-sourced for its acceptance; only completion is,
 * via WEEKLY_QUEST_COMPLETED, for the XP grant's audit trail).
 * `progress` is never stored — store/weeklyQuest.ts always recomputes
 * it live from the real underlying table (dsa_attempt, currently the
 * only proposal kind), the same "derived, not cached" principle as
 * every other live-computed status in this app (Boss windows, mastery
 * states). `completed_at` is set once, the moment progress first
 * reaches `target` — checked on every read, same idempotent-claim
 * pattern as store/boss.ts's clearBoss.
 */
export interface WeeklyQuestRow {
  id: string; // pk
  week_start_date: string;
  week_end_date: string;
  kind: 'dsa_topic_volume' | 'ship_project';
  description: string;
  target: number;
  topic?: string; // set for kind: 'dsa_topic_volume'
  xp: number;
  completed_at?: string;
}

/**
 * Dexie `.stores()` schema string per table. Passed to `db.version(1).stores(SCHEMA_V1)`.
 * Primary key first; `&` = unique index; `[a+b]` = compound index.
 */
export const SCHEMA_V1 = {
  event: 'id, type, occurred_at, local_date, arc_id, &idem_key, [type+local_date]',
  xp_ledger: 'id, event_id, local_date, category, [category+local_date]',
  profile: 'id',
  arc: 'id, status',
  quest_template: 'id, arc_id, type, key, active_from, active_to',
  quest_instance: 'id, template_id, local_date, state, [template_id+local_date]',
  application: 'id, local_date, status, role_category, followup_due_at, resume_version_id',
  career_event: 'id, local_date, kind, application_id, [kind+local_date]',
  resume_version: 'id, created_at',
  dsa_problem: 'id, slug, topic, difficulty',
  dsa_attempt: 'id, problem_id, local_date, next_review_at, [outcome+local_date]',
  learning_block: 'id, local_date, topic, [topic+local_date]',
  system_design_study: 'id, local_date, system',
  build_session: 'id, local_date, mode, project_key, [mode+local_date]',
  artifact: 'id, kind, project_key, local_date',
  skill_node: 'id, domain, key, parent_id',
  skill_state: 'node_id, state',
  training_session: 'id, local_date, type',
  metric_sample: 'id, local_date, kind, [kind+local_date]',
  maintenance_log: 'local_date',
  day_rollup: 'local_date',
  player_state: 'id',
  attribute_snapshot: 'id, local_date, attribute',
  checkpoint: 'id, day, sealed_at',
} as const;

// final/05 §1.2 — the reflection library's content (id, text, category,
// tone, context, day range, cooldown) is static and lives in code
// (engine/reflections.ts), not a table — it never changes at runtime,
// same reasoning as engine/config.ts's constants. Only the mutable
// per-reflection show-state needs a live row, added here as a real
// Dexie version bump rather than folded into SCHEMA_V1: unlike every
// other change this session (new optional fields on existing rows,
// which Dexie never validates and so need no schema change at all),
// this is a brand-new object store — a browser that already
// materialized version 1 would never pick it up if it were only added
// to that version's stores string, since Dexie only runs `.stores()`
// upgrade logic when the version number itself increases.
export const SCHEMA_V2_ADDITIONS = {
  reflection_state: 'id, last_shown_at',
} as const;

export const SCHEMA_V3_ADDITIONS = {
  weekly_quest: 'id, week_start_date, week_end_date, completed_at',
} as const;

/**
 * design/04-SYSTEM-MESSAGE-ENGINE.md §14 — the System-voice layer's two
 * mutable tables. The library itself is static code (engine/voicePack.ts),
 * for the same reason engine/reflections.ts's is.
 *
 * `system_message_state` mirrors `reflection_state` exactly: per-line
 * show history, so the cooldown and the least-shown-first ranking have
 * something to read.
 *
 * `system_transmission` is what makes the message stable. One row per
 * local_date holding the state fingerprint it was chosen for — a reload,
 * a re-render or a round trip through another tab recomputes the same
 * fingerprint and reuses the row, so the System does not change its mind
 * about a day it has already reported on. Neither table is an event:
 * which sentence was displayed is device state, not evidence about the
 * arc, and putting it in the log would weaken what verifyIntegrity()
 * proves (design/00 §10).
 */
export const SCHEMA_V4_ADDITIONS = {
  system_message_state: 'id, last_shown_date',
  system_transmission: 'local_date',
} as const;

export interface SystemMessageStateRow {
  id: string; // pk — the static id in engine/voicePack.ts
  times_shown: number;
  last_shown_date?: string;
}

export interface SystemTransmissionRow {
  local_date: string; // pk — the 04:00-boundary date
  fingerprint: string;
  message_id: string;
  chosen_at: string;
}
