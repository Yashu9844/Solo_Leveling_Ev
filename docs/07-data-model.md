# 07 — Data Model

---

## 1. The core architectural decision: event sourcing with projections

**Everything that happens is an immutable event. All state — XP totals, levels, streaks, attributes — is a pure function of the event log.**

```
                    ┌──────────────────────────┐
                    │   EVENT LOG (append-only)│
                    │   never updated, never   │
                    │   deleted                │
                    └───────────┬──────────────┘
                                │  pure functions
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │  XP LEDGER   │  │  DAY ROLLUPS │  │  ATTRIBUTES  │
      │  (derived)   │  │  (derived)   │  │  (derived)   │
      └──────────────┘  └──────────────┘  └──────────────┘
```

Why this matters for this specific app:

- **XP corruption becomes impossible.** You asked how to prevent it. The answer is not validation or transactions — it's that there is no mutable XP counter to corrupt. `total_xp` is `SUM(ledger.amount)`, recomputable from scratch at any time. A bug in the XP rules is fixed by fixing the rule and replaying; no data migration, no reconciliation.
- **The engine becomes trivially testable.** `applyEvents(events, config) → state` is a pure function. Feed it a fixture of 120 days of events and assert the resulting level. No database, no mocks, no async. This is what makes "XP, LEVEL, STREAK, QUEST, PROGRESS must be deterministic" (your §42) achievable rather than aspirational.
- **Retroactive rule changes are safe.** If at Day 40 you decide hard problems should be worth 45 instead of 40, you change the constant and replay. The whole arc recomputes consistently.
- **Audit is free.** "Why am I Level 12?" is answerable by scrolling the ledger.
- **Idempotent by construction.** Every event has a client-generated UUIDv7 and an idempotency key; replaying the same event twice is a no-op. Even though V1 has no sync, this makes future sync (`Phase 7`) a non-event.

Cost: you must never write derived state as truth. The discipline is: **UI reads projections, actions write events, projections rebuild from events.** Projections are cached in IndexedDB for speed, with a `schema_version` — bump it and they rebuild on next launch.

---

## 2. Time handling

This is where habit apps break, so it's specified precisely.

```
occurred_at      ISO-8601 UTC instant, e.g. "2026-09-12T02:14:33.221Z"
                 The authoritative timestamp. Never a local string.

local_date       "YYYY-MM-DD", computed AT WRITE TIME in the arc timezone,
                 using a 04:00 day boundary. Stored on the event, never
                 recomputed later.

arc_timezone     IANA name, fixed at onboarding, e.g. "Asia/Kolkata".
                 Changing it is an explicit settings action that writes an
                 event and does NOT retroactively re-bucket past days.
```

**The 04:00 rollover is the single most important detail here.** Work finished at 00:40 belongs to the day that started at 06:30 the previous morning, not to a new day. Midnight rollover would punish exactly the late-evening deep work sessions the arc depends on, and would create a phantom "missed day" every time you worked past midnight.

```
localDate(instant, tz):
    shifted = instant - 4 hours
    return formatInTimeZone(shifted, tz, "yyyy-MM-dd")
```

**Travel:** if the device timezone differs from `arc_timezone`, the app shows a one-line banner ("Device in Asia/Singapore; arc is Asia/Kolkata") and continues using the arc timezone. It does not silently switch. Silent timezone switching is how streaks mysteriously break.

**DST:** irrelevant for Asia/Kolkata, but the implementation uses a real timezone library (`date-fns-tz` or `Temporal` when available) rather than offset arithmetic, so it's correct anywhere.

---

## 3. Schema

Dexie/IndexedDB. Indexes in `[brackets]`.

### 3.1 Immutable core

```ts
event {                             // THE source of truth
  id            uuidv7  [pk]        // time-ordered, client-generated
  type          string  [idx]       // see event catalogue below
  occurred_at   string  [idx]       // UTC ISO
  local_date    string  [idx]       // YYYY-MM-DD, 04:00 boundary
  arc_id        string  [idx]
  payload       json
  source        enum(user|system|import|rule)
  idem_key      string  [unique]    // dedupe
  schema_v      int
}

xp_ledger {                         // derived from events, but append-only
  id            uuidv7  [pk]
  event_id      uuidv7  [idx]
  local_date    string  [idx]
  amount        int                 // always positive; no negatives, ever
  category      enum(MIND|CRAFT|BODY|RECOVERY|FUEL|ATTENTION|BONUS|BOSS)
  reason        string              // "core:dsa_block", "bonus:problem:M"
  capped_from   int?                // if a cap reduced it, the pre-cap amount
}
```

**Event catalogue** — the complete V1 set, 22 types:

```
ARC_STARTED  ARC_PAUSED  ARC_RESUMED  ARC_AMENDED
QUEST_COMPLETED  QUEST_UNDONE  QUEST_RECOVERED
PROBLEM_LOGGED  PROBLEM_REVISITED
SESSION_LOGGED  METRIC_RECORDED
SLEEP_LOGGED  SCREENTIME_LOGGED  FUEL_LOGGED
REVIEW_COMPLETED  WEEK_REVIEWED
ARTIFACT_SHIPPED  CAREER_EVENT_LOGGED
CHECKPOINT_SEALED  BOSS_CLEARED
PLAN_AMENDED  APP_OPENED
```

`APP_OPENED` exists solely to compute the guardrail metric (median daily app time). It stores duration only, never content.

### 3.2 Configuration (mutable, versioned)

```ts
profile { id, name, created_at, arc_timezone,
          height_cm?, dob?,                    // optional, never required
          settings: json }

arc { id [pk], start_date, end_date, timezone, day_boundary_hour=4,
      main_quest_text, stake_text?, status: active|paused|complete }

quest_template {
  id [pk], arc_id [idx], type: core|weekly|adaptive|recovery|revisit|boss|side,
  key, title, category, xp, criterion: json,
  implementation_intention: { time, place, first_action },   // the if-then
  temptation_bundle?: string,
  active_from, active_to,       // amendments create a new row, never edit
  locked_until_checkpoint: bool
}

quest_instance {
  id [pk], template_id [idx], local_date [idx],
  state: available|in_progress|complete|incomplete|recoverable|expired,
  progress: json, completed_at?, recovered: bool
}
```

**Quest templates are versioned by row, never mutated.** An amendment at a checkpoint closes the old row (`active_to`) and opens a new one. This means the Day-120 report can show exactly what you changed and when — which is itself an anti-gaming measure (§`03 §12`).

### 3.3 Domain data

```ts
dsa_problem {
  id [pk], slug, title, topic [idx], difficulty: E|M|H,
  first_logged_at, insight?
}

dsa_attempt {
  id [pk], problem_id [idx], event_id, local_date [idx],
  outcome: first_attempt|hint|editorial|unsolved,
  minutes, is_revisit: bool,
  next_review_at [idx]            // drives revisit quest generation
}

training_session { id, local_date [idx], type, minutes, rpe,
                   lifts: [{ name, weight_kg, reps, est_1rm }] }

metric_sample { id, local_date [idx], kind [idx], value, unit, note? }
// kind: weight_kg | bodyfat_pct | waist_cm | screen_time_min
//     | wake_time | sleep_time | ...
// NOTE: no metric_sample row ever produces an xp_ledger row.

artifact { id, kind: feature|eval|project|deployment|writeup,
           title, url?, project_key [idx], local_date, notes? }

career_event { id, kind: application|screen|technical|onsite|offer
                       |rejection|conversation|mock,
               company?, role?, local_date [idx], stage, stuck_on?, notes? }

skill_node { id [pk], domain: dsa|ai|system_design|career, key, title,
             tier?, parent_id? }
skill_state { node_id [pk], state: unseen|introduced|applied|fluent|retained,
              evidence: json, updated_at }
```

### 3.4 Derived projections (cache; rebuildable)

```ts
day_rollup {                        // [pk] local_date
  local_date, xp_earned, xp_capped_away,
  core_completed, core_total,
  mvd_met: bool, grace_applied: bool, reduced_mode: bool,
  deep_minutes, longest_block_minutes,
  problems: { E, M, H, first_attempt },
  energy?, focus?, blocker?,
  app_seconds
}

player_state {                      // [pk] singleton
  total_xp, level, xp_into_level, xp_for_next,
  rank, rank_since_day,
  arc_streak, consistency_7, consistency_28,
  grace_remaining, schema_v
}

attribute_snapshot {                // [pk] [local_date, attribute]
  local_date, attribute, value, components: json
}                                   // components => the formula breakdown UI

checkpoint {                        // IMMUTABLE once sealed
  id [pk], day: 0|30|60|90|120, sealed_at,
  metrics: json, self_efficacy: json, automaticity: json, enjoyment: json,
  rank_before, rank_after, gates: json,
  verdict_text, quest_templates_snapshot: json
}
```

**`checkpoint` is the most important table in the database.** It is append-only, never edited after sealing, and it is what makes the Day-120 Before/After report trustworthy. If everything else were lost, five checkpoint rows would still answer the question the arc was run to answer.

### 3.5 Content

```ts
reflection { id [pk], text, category, tone, context[],
             min_day, max_day, cooldown_days, weight }

reflection_shown { id, reflection_id [idx], shown_at, context }

achievement { key [pk], title, body, earned_at?, evidence: json }
identity    { key [pk], title, body, earned_at?, evidence: json }
```

---

## 4. Indexes

```
event:          type, occurred_at, local_date, [type+local_date]
xp_ledger:      local_date, [category+local_date]
quest_instance: local_date, [template_id+local_date], state
dsa_attempt:    local_date, problem_id, next_review_at, [outcome+local_date]
metric_sample:  [kind+local_date]
career_event:   [kind+local_date]
day_rollup:     local_date (pk)
```

`dsa_attempt.next_review_at` is the hottest index — it's queried on every home-screen render to generate revisit quests. `[type+local_date]` covers essentially every analytics query the rules engine runs.

Scale check: 120 days × ~15 events/day ≈ **1,800 events** for the whole arc. Every query in this app is effectively a full scan of a tiny dataset. **Do not optimise anything.** Correctness and clarity over performance, always, at this size.

---

## 5. Integrity

| Guarantee | Mechanism |
|---|---|
| XP can't be corrupted | No mutable counter exists; total = SUM(ledger) |
| XP can't go negative | Ledger amounts are `>= 0` by type constraint |
| No double-count | `idem_key` unique index; UUIDv7 generated at intent, not at write |
| Caps always applied | Caps enforced in the pure reducer, not at the call site; `capped_from` records what was trimmed |
| Rules can change safely | Replay from the event log |
| Backdating is visible | Events where `occurred_at` and write time differ by > 6h are flagged; weekly review reports "n backdated entries" |
| Checkpoints can't be revised | `sealed_at` set once; writes rejected thereafter |
| Projections can't drift | `schema_v` mismatch forces rebuild; a `verifyIntegrity()` dev command recomputes from scratch and diffs |

**Deliberately not guaranteed: that you told the truth.** No amount of schema design prevents logging a workout you didn't do. That's what the evidence layer and rank gates are for. The app should not pretend otherwise, and should not add friction (photo proof, timers you must run) chasing an unwinnable battle — that friction would cost more in daily seconds than it saves in honesty.

---

## 6. Export, import, backup

**Export** — single JSON file, the complete event log plus config, versioned. Because state is derived, **the event log alone is a complete backup.** File name: `system-arc-2026-09-01-day-042.json`. Also a CSV bundle (days, problems, sessions, metrics) for analysis elsewhere.

**Import** — same format, idempotent by `idem_key`, so re-importing is safe and merging two exports works.

**The paper-log importer** — a specific CSV shape matching `13-day0-baseline.md`, so the Days 1–14 you track on paper from 1 September import cleanly when V1 ships. **This is a V1 requirement, not a nice-to-have**, because the plan depends on it.

**Backup nudge** — because a local-only app on one phone is one broken screen away from losing the arc, the app: calls `navigator.storage.persist()` on first run; shows export status on the Profile screen; and prompts for an export every Sunday at the weekly review, and always at a checkpoint. The prompt is a single button that triggers a file download. This is the one place `--state-alert` red is allowed: if no export exists in 14 days, the Profile screen says so in red.

---

## 7. Privacy

Everything is local. No account, no telemetry, no analytics endpoint, no crash reporting, no fonts loaded from a CDN (self-hosted), no network requests at all after the initial app load. The service worker caches the shell and then the app is fully functional offline forever.

- **Optional fields stay optional** and are never required to progress. Salary is not collected at all (`04 §6.3`).
- **Delete** — a single "delete everything" in settings that drops the IndexedDB database and unregisters the service worker. No soft delete, no tombstones, no recovery.
- **Export is the only egress**, user-initiated, to the user's own filesystem.
- If a lock screen isn't enough protection for you, the export can be passphrase-encrypted (WebCrypto AES-GCM, PBKDF2) — a ~40-line addition, worth it since the export is the artefact most likely to end up in a cloud drive.
