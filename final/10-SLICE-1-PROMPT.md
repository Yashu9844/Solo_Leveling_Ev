# 10 — SLICE 1: Onboarding & Arc Creation

**Prerequisite:** Phase 0 complete and committed on `phase-0-foundation`.

Paste everything between the `═══` markers into a **fresh** Claude Code session in Antigravity IDE.

---

## Before you paste — three corrections from the Phase 0 report

Claude Code raised five items in its §9. Three of them were genuine defects in my spec and are now fixed in the repo docs. The prompt below tells it to apply the resulting changes. Summary so you know what's moving:

| Flag | Resolution |
|---|---|
| **Event count: doc said 27, list had 30** | Claude Code was right. `07 §4.1` now says 30. Its `EventType` union is correct as built — no change needed. |
| **`reduce.ts` conflict between docs 09 and 08** | Its resolution was the right one. Now codified: `applyEvents([])` returning the empty base state is *specified*, not an exception. |
| **`categoryCaps` excluded `BONUS`/`BOSS`** | Correct call, and it exposed a real gap. `01 §2.1.1` now specifies that `BONUS` and `BOSS` grants are exempt from **both** category caps and the daily cap, because each is frequency-limited rather than volume-limited — and because a boss clear on an ordinary day would otherwise silently lose 355 of its 500 XP. |
| **`noUnusedParameters` / engine stub lint** | Its handling was right. The prompt adds a per-slice cleanup step so the override shrinks as stubs get implemented. |
| **npm audit: 9 vulns, 2 critical** | Deferred deliberately, with a change to how you test on the phone. See below. |

### ⚠ One change with a real consequence: the level coefficient

`engine/config.ts` currently has `level.coefficient: 75`. **It must become 84.**

The 75 was tuned on a simulation that omitted weekly-quest payouts, boss clears and recovery grants. Adding those adds ~13% to arc totals and pushed the Level-40 terminus to 43. Re-simulated at 60 runs per condition, coefficient **84** restores Level 40 at 85% completion. `01 §3` now carries the corrected table.

It is a one-line change, `level.ts` isn't implemented yet, and no test snapshot depends on it — so now is the cheapest possible moment to make it.

### On the npm audit

Leave the dependencies alone for now. Every advisory is in dev tooling (the vite/vitest/esbuild dev-server chain) or needs a breaking major bump (react-router v6→v7, uuid v10→v11). None of it ships: the built app makes zero network requests and runs under `default-src 'self'`.

But one advisory is not purely theoretical — the esbuild dev-server issue means any site you visit can talk to your dev server while it's listening on a network interface. So: **use `adb reverse` and `localhost`, never `--host`, when testing on the phone.** That was already the recommended route; now it's the required one.

Schedule the bumps as a dedicated maintenance slice after Slice 2, when there's a working app to regression-test against.

---

═══════════════════════════════════════════════════════════════

# SLICE 1 — ONBOARDING & ARC CREATION. NOTHING ELSE.

Phase 0 is complete and committed on `phase-0-foundation`. You are implementing **Slice 1 only**.

## SCOPE — what this slice delivers

A user can install the app, complete a six-step onboarding in under 90 seconds, and end up with a persisted arc, six core quest templates carrying their implementation-intention sentences, a Day-0 baseline, and an alarm-setup screen.

**That is all.** After Slice 1, opening TODAY still shows "Phase 0 — not implemented." Quest instances, XP, levels, streaks and the daily loop are **Slice 2 and 3**.

## OUT OF SCOPE — do not implement, even partially

Quest *instances* (as opposed to templates) · the TODAY screen's content · XP computation · levels · ranks · streaks · attributes · the evening review · any of `xp.ts`, `level.ts`, `rank.ts`, `streak.ts`, `attributes.ts`, `career.ts`, `dsa.ts`, `srs.ts`, `rules.ts`, `messages.ts` — these stay stubs.

If you find yourself computing an XP value or generating a daily quest instance, stop and revert that file.

---

## STEP 0 — READ AND APPLY THE SPEC CORRECTIONS

1. Re-read `final/01-quests-xp-level-rank.md` §2.1.1 and §3, and `final/06-ux-screens-design.md` §5.1.
2. **Change `level.coefficient` from 75 to 84** in `src/engine/config.ts`. Nothing else about the level system changes; `level.ts` remains a stub.
3. Confirm `categoryCaps` is still typed to exclude `BONUS` and `BOSS`, and add a comment there pointing at `01 §2.1.1` so the exemption isn't "fixed" later by someone assuming it's an omission.
4. In `src/engine/reduce.ts`, replace the "deliberate exception" comment with a specification reference: the empty-base-state return is required behaviour per `08` Slice 0 criteria, not a compromise.

Report these four as done before proceeding.

---

## STEP 1 — DATA: ARC, QUEST TEMPLATES, BASELINE

### 1.1 Events written by this slice

Only these three event types. Everything else stays unused.

```
ARC_STARTED         payload: { arcId, startDate, endDate, timezone,
                               dayBoundaryHour, dayCloseHour,
                               mainQuestText, stakeText? }
PLAN_AMENDED        payload: { questKey, implementationIntention }
                    — one per core quest, written at onboarding
METRIC_RECORDED     payload: { kind, value, unit }
                    — baseline: height_cm, weight_kg, and any optional
                      values the user supplies
```

Every event goes through the existing `appendEvent()` with a deterministic `idem_key` so a double-tap on "Initialise system" cannot create two arcs. Suggested key: `` `arc-started:${arcId}` ``, `` `plan:${arcId}:${questKey}` ``, `` `baseline:${arcId}:${kind}` ``.

### 1.2 `engine/quests.ts` — implement ONE function only

```ts
/**
 * Pure. Produces the six core quest templates for a new arc.
 * Deterministic: same inputs → identical output, including ids
 * (ids come from deps.newId, so the test injects a seeded generator).
 * TODO markers remain on every other export in this file.
 */
export function generateCoreQuestTemplates(
  arcId: string,
  intentions: Record<QuestKey, ImplementationIntention>,
  config: EngineConfig,
  deps: EngineDeps
): QuestTemplate[]
```

It must emit exactly six templates, reading XP and category **from `config.coreQuests`** — never from literals:

| key | xp | category | criterion |
|---|---|---|---|
| `career` | 100 | CAREER | `{ kind: 'applications_or_substitute', applications: 3, substituteMinutes: 25 }` |
| `dsa` | 100 | MIND | `{ kind: 'problems_or_minutes', problems: 1, minutes: 25 }` |
| `build` | 100 | CRAFT | `{ kind: 'minutes_with_mode', minutes: 45, modes: ['LEARN','SHIP'] }` |
| `training` | 100 | BODY | `{ kind: 'session_or_steps', steps: 8000 }` |
| `sleep` | 60 | SLEEP | `{ kind: 'wake_window', toleranceMinutes: 30 }` |
| `attention` | 40 | ATTENTION | `{ kind: 'screen_time_under', minutes: 60 }` |

Each template carries `implementation_intention: { time, place, first_action }`, `active_from = arc.startDate`, `active_to = null`, `locked_until_checkpoint = true`.

**Do not implement `generateQuests()` (daily instances). That is Slice 2.**

### 1.3 `engine/reduce.ts` — handle `ARC_STARTED` only

Extend `applyEvents` to fold `ARC_STARTED` into state (arc record present, `arcDay` computable). Every other event type must still throw `Not implemented — Slice N`. Do not add a permissive default case that silently ignores unknown events — an unhandled event type must fail loudly for the rest of the build.

### 1.4 Day-0 baseline

Write a `checkpoint` row with `day: 0`, `sealed_at` set, `export_verified: false`, holding the baseline metrics and any instrument answers.

**Day 0 is exempt from the export-before-seal rule** — that rule applies from Day 30 onward (`07 §8`). Note this in a comment so Slice 12 doesn't reintroduce it.

---

## STEP 2 — ONBOARDING UI

Six steps, wireframes in `final/06-ux-screens-design.md` §5.1. Route at `/onboarding`, **outside the 4-tab shell**.

| Step | Content | Notes |
|---|---|---|
| 1/6 | Framing + name | Two sentences, one input |
| 2/6 | Arc dates, timezone, boundary | Defaults from `config.arc`; show computed day count |
| 3/6 | Rhythm | Wake 08:30 · sleep 02:00 · training days · steps target 8000 · screen cap 60 min + app names |
| 4/6 | Main quest | Two-line free text. Required. |
| 5/6 | **Implementation intentions** | Three sentences: career, DSA, training. **The highest-value screen in the slice.** |
| 6/6 | Baseline + alarms | Height 178 · weight 72 · body fat **left blank with a note, never prefilled** · optional self-efficacy · alarm setup |

### Behaviour

- **Routing guard:** if an arc already exists, `/onboarding` redirects to `/today`. App boot with no arc redirects *to* `/onboarding`.
- **Back navigation** preserves entered values. Nothing is persisted until the final button.
- **One write:** "Initialise system" writes all events in a single Dexie transaction. Partial arcs must be impossible.
- **No typing beyond** name, main quest, the three intention sentences, and numeric baselines. Everything else is pickers, chips and steppers.
- **Body fat ships empty** with the note from `04 §3.5` about measurement error. Never prefill, never estimate.

### Alarm setup (step 6)

Render the three alarms with labels taken **verbatim from the user's own intention sentences**:

```
08:35   <career intention sentence>
22:00   <dsa intention sentence>
23:30   Evening review — 25 seconds
```

Provide a "Copy times" button and plain instructions to add them in the phone's Clock app. **Do not implement `.ics` generation, notification permission requests, or any push code** — see `05 §3`.

---

## STEP 3 — DEV AFFORDANCE

Add a **Reset arc** action under Profile → Settings, visible only when `import.meta.env.DEV`:

> Deletes all events and projections, clears the arc, returns to `/onboarding`.

You will re-run onboarding a dozen times while stopwatching it. Without this you will be uninstalling the PWA repeatedly. It must be **DEV-only** — this button in production is a data-loss weapon.

---

## STEP 4 — TESTS

### `tests/engine/quests.test.ts`
```
✓ generateCoreQuestTemplates returns exactly 6 templates
✓ keys are exactly career, dsa, build, training, sleep, attention
✓ xp values are 100/100/100/100/60/40 and sum to 500
✓ every xp and category is read from config, not literals
    (mutate a config value in the test and assert the output follows)
✓ each template carries its implementation_intention verbatim
✓ deterministic: same inputs + seeded newId → deep-equal output
✓ active_from === arc.startDate, active_to === null,
  locked_until_checkpoint === true
```

### `tests/engine/reduce.test.ts` (extend)
```
✓ applyEvents([]) still returns the empty base state
✓ applyEvents([ARC_STARTED]) yields state with the arc present
✓ arcDay from that state: startDate → 1, endDate → 120
✓ replaying the same log twice is deep-equal (determinism)
✓ duplicate ARC_STARTED with the same idem_key is a no-op
✓ an unhandled event type throws — no silent default case
```

### `tests/e2e/onboarding.spec.ts`
```
✓ fresh app boot with no arc redirects to /onboarding
✓ full six-step flow completes and lands on /today
✓ arc persists across a reload
✓ /onboarding redirects to /today once an arc exists
✓ double-clicking "Initialise system" creates exactly one arc
✓ back-navigation through the steps preserves entered values
```

### Lint hygiene
`quests.ts` now has a real implementation. **Narrow the engine `no-unused-vars` `args: 'none'` override so it no longer covers `quests.ts`.** Repeat this shrinking step in every future slice — otherwise the override quietly hides real unused-parameter bugs for the rest of the build. If narrowing per-file is awkward in flat config, use a per-file `/* eslint-disable */` block on the remaining stubs instead and remove the global override entirely.

---

## STEP 5 — VERIFY, REPORT, STOP

Run and report verbatim output:

```
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Then print the Android verification instructions using **`adb reverse` on localhost, not `--host`** (dev-server advisory — see the note in `10-SLICE-1-PROMPT.md`):

```
npm run build && npm run preview -- --port 5173
adb reverse tcp:5173 tcp:5173
# phone → Chrome → http://localhost:5173
```

With this checklist for the user:

```
[ ] Onboarding completes in under 90 seconds (stopwatch, real thumbs)
[ ] Every control is reachable one-handed
[ ] No step requires typing beyond name / main quest / 3 sentences / numbers
[ ] Reopening the app goes straight to /today, not back to onboarding
[ ] Airplane mode: full onboarding still completes
[ ] The three alarm labels read as your own sentences, not generic text
[ ] Reset arc (DEV) works and returns you to step 1
```

### Report sections

1. The four Step 0 corrections, confirmed applied
2. Files created and modified
3. Verbatim command output
4. Test results, listed assertion by assertion
5. **Confirmation that `xp.ts`, `level.ts`, `rank.ts`, `streak.ts`, `attributes.ts`, `career.ts`, `dsa.ts`, `srs.ts`, `rules.ts`, `messages.ts` are all still stubs** — this is the discipline check
6. Which engine files came off the unused-args lint override
7. Bundle size, gzipped, and the delta from Phase 0
8. Anything ambiguous or wrong in the spec — flag, don't silently resolve
9. What Slice 2 will need

Commit on `slice-1-onboarding`:

```
feat(slice-1): onboarding, arc creation, core quest templates

Implements engine/quests.ts generateCoreQuestTemplates and ARC_STARTED
handling in reduce.ts. Level coefficient corrected 75 → 84 per 01 §3.
All other engine modules remain stubs.
```

## THEN STOP. Do not begin Slice 2.

## STANDING RULES

- Never delete or overwrite existing work. Conflicts → stop and ask.
- Never invent a constant. Everything comes from `engine/config.ts`.
- No new dependencies without asking.
- No clock, database or DOM access inside `engine/`.
- **The word "failed" appears in no user-facing string, ever.**
- Ambiguity → ask. Do not guess and move on.

═══════════════════════════════════════════════════════════════

---

## Your verification checklist after Slice 1

```
[ ] Report §5 confirms 10 engine modules are still stubs
[ ] Report §1 confirms coefficient is now 84
[ ] Onboarding stopwatched under 90 s on the actual phone
[ ] The three alarms are set on your phone with your own sentences
[ ] Determinism test passes: same log replayed twice is deep-equal
```

If onboarding takes longer than 90 seconds, **cut a field rather than accepting it.** That number is a product requirement, not an aspiration — every second there is a second of friction on Day 1, which is the day the arc is most likely to die.

## Slice 2 opener (fresh session)

> Read `final/01-quests-xp-level-rank.md` §1 and §6, `final/06-ux-screens-design.md` §5.2, and `final/07-data-model-architecture.md` §3. Slices 0 and 1 are complete and committed.
>
> Implement **Slice 2 only: the core loop.** Daily quest instance generation from the six templates, the TODAY screen, quest completion and undo, the 04:00 rollover and the 03:00 day-close. `generateQuests()` in `quests.ts` becomes real; `xp.ts` stays a stub — completing a quest changes quest state only, no XP yet.
>
> Do not implement XP, levels or Moments. Stop after Slice 2 and report.
