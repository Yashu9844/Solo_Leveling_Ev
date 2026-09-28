# 07 — Data Model, Architecture, Android/PWA, Backup, Integrity

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────┐
│  UI  — React 18 + TypeScript + Tailwind              │
│  screens · components · design tokens · Moments      │
│  reads projections · dispatches intents              │
└─────────────────────┬────────────────────────────────┘
                      │ intent
┌─────────────────────▼────────────────────────────────┐
│  DOMAIN ENGINE  — pure · deterministic · zero I/O    │
│                                                       │
│   time.ts        localDate(instant, tz, boundary=4)  │
│   xp.ts          computeXp(event, dayState, config)  │
│   level.ts       levelFor(totalXp) · req(n)          │
│   rank.ts        evaluateGates(checkpoints, evidence)│
│   quests.ts      generateQuests(date, history, cfg)  │
│   streak.ts      streakFrom(days, graceConfig)       │
│   attributes.ts  attributesFrom(window28)            │
│   career.ts      funnel · quality · followthrough    │
│   dsa.ts         mastery states · weighted volume    │
│   srs.ts         nextReview(outcome, history)        │
│   rules.ts       evaluateRules(history) → proposals  │
│   messages.ts    selectMessage(context, state, log)  │
│   reduce.ts      applyEvents(events, config) → State │
└─────────────────────┬────────────────────────────────┘
                      │ events in / state out
┌─────────────────────▼────────────────────────────────┐
│  STORE — Zustand · orchestration · clock injection   │
└─────────────────────┬────────────────────────────────┘
┌─────────────────────▼────────────────────────────────┐
│  PERSISTENCE — Dexie 4 / IndexedDB                   │
│  events (append-only) · projections (rebuildable)    │
└─────────────────────┬────────────────────────────────┘
┌─────────────────────▼────────────────────────────────┐
│  SERVICE WORKER — Workbox precache · offline nav     │
└──────────────────────────────────────────────────────┘
```

### The engine boundary — enforced, not hoped for

Nothing under `src/engine/` may import React, Dexie, or call `Date.now()`, `new Date()`, `Math.random()`, or `crypto.randomUUID()`. The clock and any randomness are **parameters**.

Enforced in CI by ESLint:

```js
// eslint.config.js
{
  files: ['src/engine/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: ['react*', 'dexie*', 'zustand*', '../store/*', '../db/*', '../ui/*']
    }],
    'no-restricted-globals': ['error', 'Date', 'localStorage', 'indexedDB', 'window', 'document'],
    'no-restricted-properties': ['error',
      { object: 'Date', property: 'now' },
      { object: 'Math', property: 'random' },
      { object: 'crypto', property: 'randomUUID' }
    ]
  }
}
```

That single constraint is what makes "XP, LEVEL, STREAK, QUEST, PROGRESS are deterministic" mechanically true rather than aspirational.

---

## 2. Tech stack — retained, with three notes

| Layer | Choice | Note |
|---|---|---|
| Build | **Vite 5** | Not Next.js — no server, no SEO, one user |
| UI | **React 18 + TypeScript (strict)** | — |
| Styling | **Tailwind + CSS custom properties** | Tokens in `:root`, Tailwind consuming them |
| State | **Zustand** + pure reducers | Store is a thin shell over the engine |
| Persistence | **Dexie 4** | — |
| Dates | **date-fns + date-fns-tz** | ⚠ Not `Temporal` — still not baseline-safe. Revisit post-arc. |
| Charts | **Hand-rolled inline SVG** | ~200 lines beats 60–100 kb for 6 sparklines and a radar |
| PWA | **vite-plugin-pwa** (Workbox) | — |
| Tests | **Vitest** (engine + unit) · **Playwright** (flows) | ⚠ Playwright cannot drive your physical phone — see §6.3 |
| IDs | **uuidv7** (`uuid` v10+) | Time-ordered; injected into the engine, never generated inside it |

**Runtime dependencies: 7.** Target bundle < 200 kb gzipped.

**No LLM, no AI SDK, no analytics, no error reporting, no fonts from a CDN.** CSP is `default-src 'self'` with no exceptions.

---

## 3. Time handling

```
occurred_at    ISO-8601 UTC instant — the authoritative timestamp
local_date     "YYYY-MM-DD", computed AT WRITE TIME, never recomputed
arc_timezone   "Asia/Kolkata", fixed at onboarding
day_boundary   04:00
day_close      03:00  (sleep target 02:00 + 60 min grace)
```

```ts
export function localDate(instant: string, tz: string, boundaryHour = 4): string {
  const shifted = subHours(parseISO(instant), boundaryHour);
  return formatInTimeZone(shifted, tz, 'yyyy-MM-dd');
}
```

**The 04:00 boundary is load-bearing for this specific user.** You work until 02:00. A midnight rollover would file every night's AI session under the following day, generate a phantom missed day, and break the streak roughly every night. This is the highest-risk correctness area in the codebase and it has its own test file.

**Travel:** if the device timezone differs from `arc_timezone`, show a one-line banner and keep using `arc_timezone`. Never switch silently — silent timezone switching is how streaks mysteriously break.

---

## 4. Data model

### 4.1 Immutable core

```ts
event {
  id           uuidv7  [pk]
  type         string  [idx]
  occurred_at  string  [idx]     // UTC ISO
  local_date   string  [idx]     // YYYY-MM-DD, 04:00 boundary
  arc_id       string  [idx]
  payload      json
  source       'user'|'system'|'import'|'rule'
  idem_key     string  [unique]
  schema_v     int
}

xp_ledger {
  id           uuidv7  [pk]
  event_id     uuidv7  [idx]
  local_date   string  [idx]
  amount       int                // ALWAYS >= 0. No negatives, ever.
  category     'CAREER'|'MIND'|'CRAFT'|'BODY'|'SLEEP'
             | 'ATTENTION'|'LEARN'|'MAINT'|'BONUS'|'BOSS'
  reason       string             // "core:career" | "bonus:problem:M"
  capped_from  int?               // pre-cap amount, if a cap trimmed it
}
```

**Event catalogue — 30 types, the complete V1 set:**
*(Corrected 31 Aug 2026. An earlier revision said 27; the enumerated list has always been 30 and the list is authoritative.)*

```
ARC_STARTED  ARC_PAUSED  ARC_RESUMED  ARC_AMENDED
QUEST_COMPLETED  QUEST_UNDONE  QUEST_RECOVERED
APPLICATION_LOGGED  CAREER_SUBSTITUTE_LOGGED  CAREER_EVENT_LOGGED
RESUME_VERSION_CREATED  FOLLOWUP_LOGGED
PROBLEM_LOGGED  PROBLEM_REVISITED
LEARNING_BLOCK_LOGGED  SYSTEM_DESIGN_LOGGED
BUILD_SESSION_LOGGED  ARTIFACT_SHIPPED
TRAINING_SESSION_LOGGED  STEPS_LOGGED  METRIC_RECORDED
SLEEP_LOGGED  SCREENTIME_LOGGED  MAINTENANCE_LOGGED
REVIEW_COMPLETED  WEEK_REVIEWED
CHECKPOINT_SEALED  BOSS_CLEARED  PLAN_AMENDED  APP_OPENED
```

`APP_OPENED` stores duration only — it exists solely to compute the guardrail metric.

### 4.2 Configuration (versioned by row, never mutated)

```ts
profile     { id, name, created_at, arc_timezone, height_cm, settings }
arc         { id, start_date, end_date, timezone, day_boundary_hour: 4,
              day_close_hour: 3, main_quest_text, stake_text?,
              status: 'active'|'paused'|'complete' }

quest_template {
  id, arc_id, type: 'core'|'weekly'|'adaptive'|'recovery'|'revisit'|'boss'|'side',
  key: 'career'|'dsa'|'build'|'training'|'sleep'|'attention'|...,
  title, category, xp, criterion: json,
  implementation_intention: { time, place, first_action },
  active_from, active_to,             // amendment = new row, never an edit
  locked_until_checkpoint: boolean
}

quest_instance {
  id, template_id [idx], local_date [idx],
  state: 'available'|'in_progress'|'complete'|'incomplete'|'recoverable'|'expired',
  progress: json, completed_at?, recovered: boolean
}
```

No `FAILED` state exists anywhere in the schema.

### 4.3 Career

```ts
application {
  id, local_date [idx], company, role,
  role_category [idx], source, resume_version_id [idx],
  why_line, quality_pass: boolean,
  status [idx], status_history: [{status, date}],
  followup_due_at [idx], followed_up_at?, recruiter_contact?, notes?
}

career_event {                       // EXTERNAL — never earns XP
  id, local_date [idx],
  kind: 'response'|'call'|'interview'|'onsite'|'offer'|'rejection'
      | 'conversation'|'mock'|'followup',
  application_id?, company?, stuck_on?, notes?
}

resume_version { id, label, created_at, changed_because, external_review? }
```

### 4.4 Learning

```ts
dsa_problem  { id, slug, title, topic [idx], difficulty, first_logged_at, insight? }
dsa_attempt  { id, problem_id [idx], event_id, local_date [idx],
               outcome: 'first_attempt'|'hint'|'editorial'|'unsolved',
               minutes, is_revisit: boolean, next_review_at [idx] }

learning_block { id, local_date [idx], topic [idx], minutes, note? }
system_design_study { id, local_date, system,
                      mode: 'studied'|'written_up'|'explained_aloud',
                      minutes, artifact_url?, notes? }

build_session { id, local_date [idx], mode: 'LEARN'|'SHIP',
                minutes, project_key [idx], note? }
artifact { id, kind: 'feature'|'eval'|'project'|'deployment'|'writeup'
                   |'resume'|'portfolio',
           title, url?, project_key [idx], local_date, notes? }

skill_node  { id, domain: 'dsa'|'foundations'|'ai', key, title, tier?, parent_id? }
skill_state { node_id [pk], state: 'unseen'|'introduced'|'applied'|'fluent'|'retained',
              evidence: json, updated_at }
```

### 4.5 Physical & lifestyle

```ts
training_session { id, local_date [idx], type, minutes, rpe,
                   lifts: [{ name, weight_kg, reps, est_1rm }] }
metric_sample    { id, local_date [idx], kind [idx], value, unit, note? }
// kind: weight_kg | waist_cm | bodyfat_pct | steps | screen_time_min
//     | wake_time | sleep_time
// INVARIANT: no metric_sample of kind weight_kg | waist_cm | bodyfat_pct
//            may ever produce an xp_ledger row.
maintenance_log  { id, local_date [pk], bath, fuel, laundry, all_done }
```

### 4.6 Projections (cache, rebuildable)

```ts
day_rollup { local_date [pk], xp_earned, xp_capped_away,
             core_completed, core_total, mvd_met, grace_applied, reduced_mode,
             deep_minutes, longest_block_minutes,
             problems: {E,M,H,first_attempt}, applications, quality_applications,
             learn_minutes, build_mode_split: {LEARN, SHIP},
             steps, energy?, focus?, blocker?, app_seconds }

player_state { total_xp, level, xp_into_level, xp_for_next,
               rank, rank_since_day, arc_streak,
               consistency_7, consistency_28, grace_remaining, schema_v }

attribute_snapshot { [local_date, attribute] [pk], value, components: json }

checkpoint {                          // IMMUTABLE once sealed
  id [pk], day: 0|30|60|90|120, sealed_at, export_verified: boolean,
  metrics: json, self_efficacy: json, automaticity: json, enjoyment: json,
  rank_before, rank_after, gates: json,
  controlled: json, external: json,
  verdict_text, quest_templates_snapshot: json
}
```

### 4.7 Indexes

```
event           type · occurred_at · local_date · [type+local_date]
xp_ledger       local_date · [category+local_date]
quest_instance  local_date · [template_id+local_date] · state
dsa_attempt     local_date · problem_id · next_review_at · [outcome+local_date]
application     local_date · status · role_category · followup_due_at
career_event    [kind+local_date]
learning_block  [topic+local_date]
build_session   [mode+local_date]
metric_sample   [kind+local_date]
```

**Scale:** 120 days × ~20 events/day ≈ **2,400 events** for the entire arc. Every query is effectively a full scan of a tiny dataset. **Do not optimise anything.** Correctness and clarity over performance, always.

---

## 5. Integrity

| Guarantee | Mechanism |
|---|---|
| XP cannot be corrupted | No mutable counter exists. `total_xp = SUM(ledger.amount)` |
| XP cannot go negative | Type constraint `amount >= 0` + property test |
| No double-count | `idem_key` unique index; UUIDv7 generated at **intent**, not at write |
| Caps always applied | Enforced in the pure reducer, never at the call site; `capped_from` records the trim |
| Rules can change safely | Replay from the event log |
| Outcomes never score | Invariant test: no `career_event` of external kind, and no body `metric_sample`, produces a ledger row |
| Backdating is visible | Events where `occurred_at` and write time differ by > 6 h are flagged; weekly review reports the count |
| Checkpoints are immutable | `sealed_at` set once; all later writes rejected |
| Projections cannot drift | `schema_v` mismatch forces rebuild; `verifyIntegrity()` recomputes from scratch and diffs |

**Deliberately not guaranteed: that you told the truth.** No schema prevents logging a workout you didn't do. That is what the evidence layer and rank gates are for. The app will not add friction — photo proof, mandatory timers — chasing an unwinnable battle that would cost more in daily seconds than it saves in honesty.

---

## 6. Android / PWA strategy

### 6.1 Manifest

```json
{
  "name": "SYSTEM",
  "short_name": "SYSTEM",
  "id": "/",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0A0B0D",
  "theme_color": "#0A0B0D",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512",
      "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Log problem",     "url": "/log/problem" },
    { "name": "Log application", "url": "/log/application" },
    { "name": "Evening review",  "url": "/review" }
  ]
}
```

Maskable icons are required for a non-embarrassing WebAPK icon. The three long-press shortcuts are genuinely useful — log a problem without ever seeing the home screen.

### 6.2 Android capabilities — verified, and what to skip

| Capability | Status on Android Chrome | Decision |
|---|---|---|
| `beforeinstallprompt` → real install button | ✅ | **Use.** A single "Install" row on Profile. Never a popup. |
| WebAPK install (proper icon, own task) | ✅ | **Required** — installed is the target mode |
| Vibration API | ✅ | **Use** for Moments haptics |
| Screen Wake Lock | ✅ Baseline 2025 | **Use** for the deep-work timer. Re-acquire on `visibilitychange`. |
| `navigator.storage.persist()` | ✅ auto-granted on engagement | **Call on first run** |
| Web Share API | ✅ | **Use** for checkpoint summary sharing (optional, Q7) |
| Background Sync | ✅ but unnecessary | **Skip** — nothing to sync |
| Periodic Background Sync | ⚠ gated, unreliable for fixed times | **Skip** |
| **Notification Triggers** | ❌ never shipped | **Cannot use** — OS alarms instead |
| **Badging API** | ❌ **not supported on Android** | **Do not implement.** Android auto-badges from unread notifications. |
| Web Push | ✅ but needs a server | **Phase 7, optional** |

### 6.3 Testing on the real phone

Playwright cannot drive your physical device. The verification loop is:

```
1.  npm run dev -- --host          → exposes on the LAN
2.  Phone and laptop on the same Wi-Fi
3.  Chrome on phone → http://<laptop-ip>:5173
    ⚠ beforeinstallprompt, service worker and persist() need a
      secure context. Use one of:
        - npm run preview -- --host  behind `npx local-ssl-proxy`, or
        - `adb reverse tcp:5173 tcp:5173` then visit http://localhost:5173
          (localhost counts as a secure context), or
        - deploy the preview build to any static HTTPS host
4.  chrome://inspect on the laptop → remote-debug the phone
5.  Lighthouse PWA audit on the built output
```

**`adb reverse` is the recommended path** — it gives a secure context, real device rendering, and DevTools, with no tunnel or certificate.

### 6.4 Service worker

Precache the entire shell (the app is small enough) · navigation fallback to `index.html` · **no runtime caching strategy** (there are no network requests) · `skipWaiting: false` with an "Update available" row that applies on tap. Auto-updating mid-session in an app writing to IndexedDB is an unnecessary way to lose an event.

---

## 7. Offline

**The app is not "offline-capable." It is offline.** There is no online mode, no auth, no API, no sync, no conflict resolution, no network state anywhere in the UI. It must work in airplane mode from first launch after install.

---

## 8. Backup — the one real risk

Local-only means the phone is the only copy. Make it loud.

```
┌─────────────────────────────────┐
│  DATA SAFETY                     │
│                                  │
│  Last backup                     │
│  3 days ago                      │
│                                  │
│  [ EXPORT BACKUP ]               │
│                                  │
│  Next recommended: Sunday        │
└─────────────────────────────────┘
```

- **Export** = one JSON file: the complete event log + config. Because all state is derived, **the event log alone is a complete backup.** Filename `system-arc-2026-09-01-day-042.json`. Plus an optional CSV bundle for analysis elsewhere.
- **Import** = same format, idempotent by `idem_key`. Re-importing is safe; merging two exports works.
- **Paper-log CSV importer** — **a V1 requirement**, not a nice-to-have. Days 1–14 are tracked on paper from 1 September and must import cleanly (`docs/13-day0-baseline.md` defines the shape).
- `navigator.storage.persist()` on first run.
- Weekly export prompt at the Sunday review.
- **Checkpoint sealing is blocked until an export completes in that session.** `checkpoint.export_verified` must be true.
- Profile shows days since last export. **Past 14 days it turns `--state-alert` red** — the only non-safety use of red in the app.

**Honest residual risk:** lose the phone between exports and you lose up to a week. That is the accepted price of no server (your Q2). The event model is designed so a sync layer can be added later without touching the domain engine — `idem_key` + UUIDv7 make replication a no-op.

---

## 9. Security & privacy

No network requests after load · self-hosted fonts · CSP `default-src 'self'` · no auth (device lock screen is the access control) · **no salary data collected, ever** · optional export encryption (WebCrypto AES-GCM + PBKDF2) since the export is what ends up in a cloud drive · "delete everything" drops the database, unregisters the SW, clears caches, no tombstones.

**Threat model, stated plainly:** the realistic threats are device loss and shoulder-surfing. There is no remote attack surface. Effort goes to backup, not cryptography.
