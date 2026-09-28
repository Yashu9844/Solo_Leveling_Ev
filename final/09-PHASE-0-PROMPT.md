# 09 — PHASE 0: Claude Code Implementation Prompt

Paste everything between the `═══` markers into Claude Code inside Antigravity IDE, with the repository open.

**Before you paste:** make sure `final/` and `docs/` are inside the repo so Claude Code can read them. If the repo is empty, that's fine — the prompt handles both cases.

**After it finishes:** verify on your phone using the checklist at the bottom of this file, then start Slice 1 in a fresh conversation.

---

═══════════════════════════════════════════════════════════════

# PHASE 0 — FOUNDATION ONLY. DO NOT BUILD THE APPLICATION.

You are implementing **Phase 0** of a project called **SYSTEM**: a single-user, offline-first, Android-first Progressive Web App. A complete product and architecture specification already exists in this repository.

## THE MOST IMPORTANT INSTRUCTION

**Build the foundation only. Then stop and report.**

Do not implement onboarding. Do not implement quests. Do not implement the XP rules. Do not implement any screen beyond empty routed placeholders. Do not implement business logic of any kind.

Phase 0 succeeds when the skeleton is verifiable — it builds, it tests, it installs on an Android phone, it works offline — and **not one line of domain logic has been written**. Subsequent work happens in numbered vertical slices, one at a time, in separate sessions. If you find yourself writing a function that computes XP, a quest, a level or a streak, you have gone too far: stop and revert that file.

---

## STEP 1 — INSPECT BEFORE YOU TOUCH ANYTHING

1. List the repository contents. Report what exists.
2. **Read these specification files in full before writing any code:**
   - `final/00-FINAL-SPEC.md` — vision, mission, the six quests, what changed and why
   - `final/01-quests-xp-level-rank.md` — all formulas and constants
   - `final/06-ux-screens-design.md` §4 — the design tokens (copy them exactly)
   - `final/07-data-model-architecture.md` — **the authoritative architecture, schema, and engine boundary**
   - `final/08-testing-slices-scope.md` — the slice list and test strategy
3. If a `package.json`, `src/`, or any prior work exists: **do not delete or overwrite it.** Report what you found and integrate around it. If existing work conflicts with the spec, stop and ask.
4. If there is no git repository, run `git init` and create a `.gitignore` for a Node/Vite project.
5. Confirm Node ≥ 20 and report the version.

**Do not proceed to Step 2 until you have reported the results of Step 1.**

---

## STEP 2 — SCAFFOLD

Create a Vite + React 18 + TypeScript project at the repository root (or integrate with what exists).

**Install exactly these runtime dependencies and nothing else:**

```
react react-dom react-router-dom zustand dexie date-fns date-fns-tz uuid
```

**Dev dependencies:**

```
typescript vite @vitejs/plugin-react
tailwindcss postcss autoprefixer
vitest @vitest/coverage-v8 fast-check
@playwright/test
eslint typescript-eslint eslint-plugin-react-hooks
vite-plugin-pwa
```

**Do not install:** any UI component library, any charting library, any date library other than date-fns, any state library other than zustand, any AI/LLM SDK, any analytics or error-reporting package. If you believe something else is needed, stop and ask first.

TypeScript must be `strict: true` with `noUncheckedIndexedAccess: true`.

---

## STEP 3 — DIRECTORY STRUCTURE

Create exactly this:

```
src/
  engine/                  ← PURE. No I/O. No React. No Dexie. No Date.now().
    time.ts
    xp.ts
    level.ts
    rank.ts
    quests.ts
    streak.ts
    attributes.ts
    career.ts
    dsa.ts
    srs.ts
    rules.ts
    messages.ts
    reduce.ts
    types.ts
    config.ts              ← all tunable constants live here, nowhere else
    index.ts
  db/
    schema.ts              ← Dexie table definitions
    db.ts                  ← Dexie instance
    events.ts              ← append-only event write + idempotency
    projections.ts         ← rebuild projections from the event log
  store/
    useSystemStore.ts      ← Zustand; injects the clock and id generator
  ui/
    tokens.css             ← design tokens as CSS custom properties
    components/
    screens/
      Today.tsx
      Progress.tsx
      Skills.tsx
      Profile.tsx
    AppShell.tsx           ← 4-tab bottom navigation
  App.tsx
  main.tsx
tests/
  engine/                  ← Vitest, pure, fast
  e2e/                     ← Playwright
public/
  icon-192.png  icon-512.png  icon-maskable-512.png
```

Every file in `src/engine/` must exist with correct type signatures and a `TODO: Slice N` comment body. **Signatures and types only. No implementations.** Example of what is wanted:

```ts
// src/engine/xp.ts
import type { SystemEvent, DayState, EngineConfig, XpGrant } from './types';

/**
 * Pure. Computes XP grants for an event given the day's state so far.
 * Applies category caps then the daily cap. Never returns a negative amount.
 * TODO: Slice 3
 */
export function computeXp(
  event: SystemEvent,
  dayState: DayState,
  config: EngineConfig
): XpGrant[] {
  throw new Error('Not implemented — Slice 3');
}
```

---

## STEP 4 — THE ENGINE BOUNDARY (this is the load-bearing part)

`src/engine/` must be pure and deterministic. Enforce it mechanically in `eslint.config.js`:

```js
{
  files: ['src/engine/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [
      'react*', 'react-dom*', 'dexie*', 'zustand*', 'uuid',
      '**/db/*', '**/store/*', '**/ui/*'
    ]}],
    'no-restricted-globals': ['error',
      'window', 'document', 'localStorage', 'indexedDB', 'navigator'],
    'no-restricted-properties': ['error',
      { object: 'Date',   property: 'now',          message: 'Inject the clock.' },
      { object: 'Math',   property: 'random',       message: 'Inject randomness.' },
      { object: 'crypto', property: 'randomUUID',   message: 'Inject the id generator.' }
    ],
    'no-restricted-syntax': ['error', {
      selector: "NewExpression[callee.name='Date']",
      message: 'Inject the clock — no new Date() in engine/.'
    }]
  }
}
```

Then **prove it works**: temporarily add `const x = Date.now();` to `src/engine/xp.ts`, run lint, confirm it errors, remove it, confirm lint passes. Report both results.

The clock and id generator are passed in:

```ts
export interface EngineDeps {
  now: () => string;        // ISO UTC instant
  newId: () => string;      // uuidv7
}
```

---

## STEP 5 — TYPES, CONFIG, TIME

**`src/engine/types.ts`** — define (types only, no logic): `SystemEvent`, `EventType` (the 30 types listed in `final/07-data-model-architecture.md` §4.1), `XpCategory`, `XpGrant`, `QuestKey`, `QuestState`, `DayState`, `PlayerState`, `Attribute`, `Rank`, `MasteryState`, `EngineConfig`, `EngineDeps`.

**`src/engine/config.ts`** — every tunable constant, transcribed exactly from `final/01-quests-xp-level-rank.md`. Nothing may be hard-coded anywhere else in the codebase:

```ts
export const DEFAULT_CONFIG = {
  arc: {
    timezone: 'Asia/Kolkata',
    dayBoundaryHour: 4,
    dayCloseHour: 3,
    startDate: '2026-09-01',
    endDate:   '2026-12-29',
  },
  coreQuests: {
    career:    { xp: 100, category: 'CAREER'    },
    dsa:       { xp: 100, category: 'MIND'      },
    build:     { xp: 100, category: 'CRAFT'     },
    training:  { xp: 100, category: 'BODY'      },
    sleep:     { xp:  60, category: 'SLEEP'     },
    attention: { xp:  40, category: 'ATTENTION' },
  },                                    // sums to 500
  categoryCaps: {
    CAREER: 140, MIND: 200, CRAFT: 200, BODY: 150,
    SLEEP: 60, ATTENTION: 40, LEARN: 75, MAINT: 20,
  },
  dailyCap: 700,
  mvdXp: 35,
  recoveryXp: 40,
  bossXp: 500,
  level: { base: 200, coefficient: 84, exponent: 0.98, roundTo: 10 },
  streak: { graceDaysPer28: 4, reducedModeTriggerMisses: 2, reducedModeExitDays: 2 },
  attributes: { windowDays: 28 },
  srs: { firstAttemptIntervals: [3, 10, 30, 90], hint: 3, editorial: 2, unsolved: 1,
         maxRevisitsPerDay: 3, retainedMinGapDays: 21 },
} as const;
```

**`src/engine/time.ts`** — this one file **is** implemented in Phase 0, because everything else depends on it and it is the highest-risk correctness area:

```ts
export function localDate(instantIso: string, tz: string, boundaryHour = 4): string
export function isDayClosed(instantIso: string, tz: string, closeHour = 3, boundaryHour = 4): boolean
export function arcDay(instantIso: string, startDate: string, tz: string): number
```

Write its tests now (`tests/engine/time.test.ts`) and make them pass:

```
✓ 2026-09-12T21:10:00Z (02:40 IST, 13 Sep) → local_date 2026-09-12
✓ 2026-09-12T22:35:00Z (04:05 IST, 13 Sep) → local_date 2026-09-13
✓ 2026-09-12T21:35:00Z (03:05 IST, 13 Sep) → isDayClosed === true
✓ 2026-09-12T20:55:00Z (02:25 IST, 13 Sep) → isDayClosed === false
✓ arcDay for 2026-09-01 === 1, for 2026-12-29 === 120
✓ a DST-observing fixture timezone neither skips nor doubles a day
```

Verify the IST offsets yourself (UTC+05:30) and correct my example instants if any are wrong — report if you do.

---

## STEP 6 — DEXIE SCHEMA

`src/db/schema.ts` — declare all tables and indexes from `final/07-data-model-architecture.md` §4. Version 1. Tables and indexes only; no queries, no business logic.

`src/db/events.ts` — implement only:

```ts
export async function appendEvent(e: SystemEvent): Promise<void>   // rejects duplicate idem_key
export async function getAllEvents(): Promise<SystemEvent[]>       // ordered by id (uuidv7 = time-ordered)
```

`src/db/projections.ts` — signatures only, `TODO: Slice 3`.

Write `tests/engine/events.test.ts` (may use fake-indexeddb): appending twice with the same `idem_key` is a no-op and does not throw at the call site.

---

## STEP 7 — UI SHELL

- `src/ui/tokens.css` — the token block from `final/06-ux-screens-design.md` §4.1, verbatim. Wire Tailwind to consume them.
- `AppShell.tsx` — 4-tab bottom navigation: TODAY · PROGRESS · SKILLS · PROFILE. 44px minimum touch targets. Bottom-anchored. Safe-area insets honoured.
- Four screens, each rendering only its title and the text `Phase 0 — not implemented`.
- Dark only. Tabular numerals via `font-variant-numeric: tabular-nums`.
- Honour `prefers-reduced-motion` in the global stylesheet from the start.

**No other components. No quest rows, no XP bars, no cards.**

---

## STEP 8 — PWA CONFIGURATION

Configure `vite-plugin-pwa`:
- `registerType: 'prompt'`, `skipWaiting: false`
- Precache the entire built shell
- Navigation fallback to `index.html`
- **No runtime caching rules** — the app makes no network requests
- Manifest exactly as in `final/07-data-model-architecture.md` §6.1, including the three shortcuts and the maskable icon
- Generate the three placeholder PNG icons (a plain `#0A0B0D` square with a `#4DA3FF` glyph is fine for now); the maskable one must respect the safe zone

Add `<meta name="theme-color" content="#0A0B0D">` and a viewport tag with `viewport-fit=cover`.

**Do not implement:** push, notification permission requests, background sync, periodic sync, or the Badging API. Badging is not supported on Android — do not add it at any point.

---

## STEP 9 — TEST HARNESSES

**Vitest** — `environment: 'node'` for `tests/engine/` (pure, fast), coverage on `src/engine/**`. Add `fast-check` and one placeholder property test so the harness is proven.

**Playwright** — Chromium, `devices['Pixel 7']` viewport. Two tests only:
1. App loads and the four tabs are visible and navigable
2. App loads with `context.setOffline(true)` set before first navigation (after a warm-up load to populate the SW cache)

**Scripts** in `package.json`:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "verify": "npm run typecheck && npm run lint && npm run test && npm run build"
}
```

---

## STEP 10 — RUN AND VERIFY

Run and report the **actual output** of each:

```
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Then report the built bundle size (gzipped).

---

## STEP 11 — ANDROID DEVICE VERIFICATION

Print instructions for the user to verify on their physical Android phone. Do not attempt to do this yourself — you cannot reach the device.

Recommend the `adb reverse` route, because installability, service workers and `navigator.storage.persist()` all require a secure context, and `localhost` counts as one:

```
npm run build && npm run preview -- --port 5173
adb reverse tcp:5173 tcp:5173
# On the phone, open Chrome → http://localhost:5173
```

Give the user this checklist to run:

```
[ ] Chrome menu shows "Install app" / "Add to Home screen"
[ ] Installs as a WebAPK — its own icon, own task in the app switcher
[ ] Launches standalone: no browser address bar
[ ] All four tabs navigate
[ ] Airplane mode → force-close → reopen → app still loads
[ ] Icon is not a generic globe; maskable icon is not clipped
[ ] Bottom tabs sit above the gesture bar (safe-area insets work)
[ ] Lighthouse PWA audit on the preview build passes installability
```

Also print the `chrome://inspect` remote-debugging instructions.

---

## STEP 12 — COMMIT AND REPORT, THEN STOP

Commit on a branch named `phase-0-foundation`:

```
chore(phase-0): scaffold foundation — architecture, tokens, routing,
Dexie schema, event model, pure engine boundary, test harnesses, PWA shell

No domain logic implemented. Engine modules are typed stubs.
Only engine/time.ts is implemented, with tests.
```

Then produce a report with exactly these sections:

1. **What existed before I started** — repository contents at Step 1
2. **What I created** — file tree
3. **Dependencies installed** — with the reason for each
4. **Command output** — verbatim results of every command in Step 10
5. **Engine boundary proof** — the lint error when `Date.now()` was added, and the clean run after removal
6. **`time.ts` test results** — each assertion, pass/fail, and any instants of mine you corrected
7. **Bundle size** — gzipped
8. **What I deliberately did NOT implement** — confirm each engine module is still a typed stub
9. **Anything in the spec that was ambiguous or wrong** — flag it; do not silently resolve it
10. **What Slice 1 will need** — a short readiness note

## THEN STOP.

**Do not begin Slice 1.** Do not implement onboarding, quests, XP, levels, streaks, or any screen content. Wait for the user to verify Phase 0 on their phone and start a new session for Slice 1.

## RULES THAT APPLY THROUGHOUT

- **Never delete or overwrite existing user work.** If something conflicts, stop and ask.
- **Never invent a constant.** Every number comes from `final/01-quests-xp-level-rank.md` via `engine/config.ts`.
- **Never add a dependency** not listed in Step 2 without asking.
- **Never put logic in the engine that reads a clock, a database, or the DOM.**
- **Never use the word "failed"** in any user-facing string, now or later.
- If the spec is ambiguous, **ask** — do not guess and move on.
- If you cannot complete a step, say so plainly in the report rather than working around it.

═══════════════════════════════════════════════════════════════

---

## After Phase 0 — your verification checklist

Before you start Slice 1, confirm:

```
[ ] The report's Section 5 shows the lint rule actually caught Date.now()
[ ] Section 6 shows the 02:40 IST case filing under the PREVIOUS day
[ ] Section 8 confirms every engine module except time.ts is still a stub
[ ] The app installed on your phone as a WebAPK with its own icon
[ ] It opened in airplane mode after a force-close
[ ] Bundle is under ~200 kb gzipped
[ ] Section 9 is empty, or you have answered whatever it raised
```

If Section 8 shows implemented logic anywhere beyond `time.ts`, **revert those files before Slice 1.** The value of the slice methodology is entirely in the discipline of it.

## Slice 1 opener (for a fresh session)

> Read `final/00-FINAL-SPEC.md`, `final/01-quests-xp-level-rank.md`, `final/06-ux-screens-design.md` §5.1, and `final/08-testing-slices-scope.md`. Phase 0 is complete and committed on `phase-0-foundation`.
>
> Implement **Slice 1 only: onboarding and arc creation.** Six steps, target 90 seconds end to end, capturing the three implementation-intention sentences and the alarm-setup screen. Write the events, create the arc record and the six core quest templates. Tests for arc creation and quest-template generation.
>
> Do not implement Today, quests, or XP. Stop after Slice 1 and report.
