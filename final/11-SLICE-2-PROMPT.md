# 11 — SLICE 2: The Core Loop

**Prerequisite:** Slice 1 complete and committed on `slice-1-onboarding`.

Paste everything between the `═══` markers into a **fresh** Claude Code session in Antigravity IDE.

---

## Before you paste — three things from the Slice 1 report

Slice 1 passed. Nothing blocking. Three items carry forward.

### 1. There is a latent crash, and Slice 2 fixes it first

Claude Code flagged it correctly in its §9: onboarding writes `PLAN_AMENDED` and `METRIC_RECORDED`, but `reduce.ts` still throws on both. It called this "expected and safe" because TODAY doesn't read derived state yet — true today, false the moment Slice 2 starts reading state. `hydrate()` would throw on any app boot after onboarding.

Step 0 of the prompt fixes this before anything else.

### 2. My spec had a gap: the self-efficacy instrument

Claude Code was right to refuse to invent a 6-item survey and to write `{}` instead. The instrument *is* specified — but in `docs/13-day0-baseline.md`, and Phase 0 only told it to read `final/`. My documentation error.

The six items are now written into the Slice 2 prompt directly, as a bounded carry-over. It's about 30 minutes of work and it matters, because Day-0 self-efficacy is one of the five data points in your Before/After report — and you can't collect it retroactively.

### 3. The alarm mismatch is intentional — here's why

Claude Code noticed that onboarding captures three intention sentences (career, DSA, training) but only two of them become alarms, while the evening review gets an alarm without an intention. It followed the literal spec rather than inventing a fourth alarm. Right call, and the asymmetry is deliberate:

- **Career (08:35)** and **DSA (22:00)** need alarms because nothing in your environment signals them. You wake up; nothing says "apply." You finish the gym; nothing says "open the editor."
- **Training (20:15)** has a natural environmental cue — *you physically arrive at the PG*. The intention sentence still matters (it names the first action: "change and start"), but it doesn't need a phone to fire it.
- **Evening review (23:30)** is a logging reminder, not an implementation intention.

Three alarms is a hard cap (`05 §3.4`). Spending one on a cue the environment already provides would waste it.

### 4. Your git situation — one thing to check

Your repo now has a remote at `github.com/Yashu9844/Solo_Leveling`. Before you push: `final/` and `docs/` contain your height, weight, daily schedule, sleep times, PG living situation and career targets. Nothing dangerous, but it's more personal detail than most people want on a public profile.

If the repo is public, consider `.gitignore`-ing `docs/` and `final/` and keeping the specs local — Claude Code reads them from disk either way.

---

═══════════════════════════════════════════════════════════════

# SLICE 2 — THE CORE LOOP. NOTHING ELSE.

Slices 0 and 1 are complete and committed. You are implementing **Slice 2 only**.

Read first: `final/01-quests-xp-level-rank.md` §1 and §6 · `final/06-ux-screens-design.md` §5.2 and §5.3 · `final/07-data-model-architecture.md` §3 and §4.2.

## SCOPE — what this slice delivers

The app becomes usable. Daily quest instances generate from the six templates, TODAY shows them, tapping completes them, tapping again undoes, state survives a kill-and-reopen, the day rolls over at 04:00 and closes at 03:00.

**No XP.** Completing a quest changes quest state and nothing else. `xp.ts` stays a stub.

## OUT OF SCOPE — do not implement

XP · levels · Moments · streaks · MVD · the "5/10-minute version" button (needs MVD, Slice 4) · the Maintenance row (Slice 9) · the adaptive priority line (needs `rules.ts`, Slice 11) · weekly quests · revisit quests · the evening review · `xp.ts`, `level.ts`, `rank.ts`, `streak.ts`, `attributes.ts`, `career.ts`, `dsa.ts`, `srs.ts`, `rules.ts`, `messages.ts` — all stay stubs.

If you find yourself writing a function that returns an XP amount, stop and revert.

---

## STEP 0 — FIX THE LATENT CRASH FIRST

`reduce.ts` currently throws on `PLAN_AMENDED` and `METRIC_RECORDED`, both of which onboarding already writes. `hydrate()` therefore fails on any boot after onboarding.

Extend the `applyEvents` switch to handle, at minimum:

```
PLAN_AMENDED        → attach/replace the implementation intention on the named template
METRIC_RECORDED     → append to a baseline metrics map on state
QUEST_COMPLETED     → mark the instance complete (this slice)
QUEST_UNDONE        → revert it (this slice)
```

**Keep throwing on every other event type.** Do not add a permissive `default:` case — an unhandled event must fail loudly for the rest of the build.

Add a regression test: replay the full event log that onboarding produces, and assert `hydrate()` does not throw. Report this as fixed before continuing.

---

## STEP 1 — CARRY-OVER: THE DAY-0 SELF-EFFICACY INSTRUMENT

My spec referenced this without defining it. Here it is. Six items, each 0–100, presented as sliders or steppers with 10-point increments.

> **How confident are you, right now, that you could:**
> 1. Solve an unseen medium DSA problem in 25 minutes, in front of an interviewer?
> 2. Explain your last project's architecture to a senior engineer for 10 minutes?
> 3. Design an evaluation suite for an agent from a blank file?
> 4. Complete your planned training session on a day you don't feel like it?
> 5. Hold your wake time within 30 minutes for the next 14 days?
> 6. Apply to 5 roles above your current level this week?

Store the six raw values plus their mean as `checkpoint.self_efficacy` on the Day-0 row:

```ts
self_efficacy: { items: [number, number, number, number, number, number], mean: number }
```

**Where it lives:** Profile → a "Complete Day-0 baseline" row, shown only while `checkpoint(day: 0).self_efficacy` is empty. Not a new onboarding step — onboarding is already at its 90-second budget and this is a one-time catch-up for an arc that already exists.

Following the same pattern, also accept the **automaticity (4 items)** and **enjoyment (3 items)** instruments as empty-for-now. Do not build them; leave `{}` and a `TODO: Slice 12` comment.

Wording rules for this screen: no framing that implies a low score is a failure. The header reads *"Baseline. There is no good or bad answer — this is the number we compare against in December."*

---

## STEP 2 — QUEST INSTANCE GENERATION

### `engine/quests.ts` — implement `generateQuests`

```ts
/**
 * Pure. Produces the day's quest instances from the active core templates.
 * Deterministic: same inputs → identical output.
 */
export function generateQuests(
  localDate: string,
  templates: QuestTemplate[],
  existing: QuestInstance[],
  config: EngineConfig,
  deps: EngineDeps
): QuestInstance[]
```

Rules:

- One instance per active core template whose `active_from <= localDate` and (`active_to === null` or `localDate < active_to`).
- **Idempotent.** If an instance already exists for `(template_id, localDate)`, return it unchanged. Never regenerate over a completed quest — this is the property that makes a mid-day refresh safe.
- Initial state is `available`.
- Instances are generated for the **current local date only**. Do not backfill missing past days; a day with no instances is a day that wasn't opened, and Slice 4's streak logic needs to be able to tell the difference.
- No weekly, revisit, adaptive or recovery quests. Core only.

### `engine/time.ts` — one addition

```ts
/** True when the arc day is closed to new completions (03:00 → 04:00 local). */
export function isDayClosed(instantIso: string, config: EngineConfig): boolean
```
This already exists from Phase 0 — confirm its signature works against config rather than loose args, and adapt callers if not.

---

## STEP 3 — TODAY SCREEN

Wireframe: `final/06-ux-screens-design.md` §5.2. Build only these regions:

```
┌─────────────────────────────────────┐
│  DAY 12 · LEVEL 1 · RANK E          │  ← level/rank hardcoded until Slice 3/12
│                                      │
│  Today: applications at 08:35.       │  ← simple priority line, see below
│                                      │
│  ○  CAREER      3 applications       │  ← no XP values shown this slice
│  ○  DSA         1 problem / 25m      │
│  ●  BUILD       45 min               │
│  ○  TRAINING    session or 8k steps  │
│  ○  SLEEP       wake 08:00–09:00     │
│  ○  ATTENTION   ≤ 60 min             │
└─────────────────────────────────────┘
```

**XP values are not rendered this slice.** Showing `+100` before XP exists would be a lie on screen.

### The priority line — deterministic, not adaptive

Slice 11 owns the adaptive version. For now:

> The first incomplete core quest, in the fixed order `career → dsa → build → training → sleep → attention`, rendered as `"Today: {title} at {intention.time}."` — or `"Today: {title}."` when that template has no intention.
> When all six are complete: `"Six of six. Day closed."`

### Quest row behaviour

- Row is 64px, full-width. **Two distinct tap targets, both ≥ 44px**: the circle completes/undoes; the rest of the row opens the detail sheet.
- States and glyphs per `06 §4.4`: `○` available · `●` complete. `◐` in-progress and `↺` recoverable are **not** used this slice.
- Incomplete is `--state-pending` grey. **Never red.**
- Completion animates in 180 ms. No XP counter, no bar.

### Day-closed state

Between **03:00 and 04:00 local**, quests are not completable. Rows render disabled with one line at the top:

> `Day closed. Next day begins at 04:00.`

No shame framing, no explanation of why. Just the fact.

### Rollover while the app is open

TODAY must recompute `localDate` on `visibilitychange` and on window focus, and regenerate instances if the date changed. You leave this app open overnight; a stale date is a real bug, not a hypothetical.

---

## STEP 4 — QUEST DETAIL SHEET

Wireframe `06 §5.3`, minimal version. Bottom sheet, ~60% height.

Render exactly:
1. Quest title
2. **The implementation-intention sentence, verbatim, in a bordered block** — this is the whole reason Slice 1 captured them, and it is the highest-evidence element in the product
3. The completion criterion in plain words
4. One primary button: `Mark complete` / `Undo`

**Not this slice:** the 5/10-minute version button, the "you've done this N of the last 14 days" history line, mode selectors, or any logging fields. Those arrive with MVD (Slice 4) and the domain slices (6–9).

Templates without an intention (`build`, `sleep`, `attention`) simply omit region 2. Do not substitute placeholder text.

---

## STEP 5 — COMPLETION AND UNDO

```
QUEST_COMPLETED   payload: { instanceId, templateId, questKey, localDate }
                  idem_key: `quest-complete:${instanceId}`
QUEST_UNDONE      payload: { instanceId, localDate }
                  idem_key: `quest-undo:${instanceId}:${monotonic}`
```

- Undo is allowed **for the rest of the local day only**. After rollover, a completed quest is frozen.
- Undo is not allowed once the day is closed (03:00–04:00).
- Both write events; the instance state is a projection, never mutated directly.
- Completing must feel instant — optimistic UI update, then the write. If the write fails, revert the UI and show one quiet line. Do not block on the transaction.

---

## STEP 6 — TESTS

### `tests/engine/quests.test.ts` (extend)
```
✓ generateQuests produces exactly 6 instances for a fresh day
✓ idempotent: called twice with existing instances, returns them unchanged
✓ never overwrites a completed instance
✓ templates outside their active window are excluded
✓ deterministic with a seeded newId
✓ generates for the given localDate only — no backfill
```

### `tests/engine/reduce.test.ts` (extend)
```
✓ the onboarding event log replays without throwing        ← Step 0 regression
✓ PLAN_AMENDED attaches the intention to the right template
✓ METRIC_RECORDED accumulates baseline metrics
✓ QUEST_COMPLETED marks the instance complete
✓ QUEST_UNDONE reverts it
✓ complete → undo → complete leaves exactly one completion in effect
✓ replaying the full log twice is deep-equal
✓ an unhandled event type still throws — no silent default
```

### `tests/engine/time.test.ts` (extend)
```
✓ 02:59 local → day open, previous local_date
✓ 03:05 local → isDayClosed true
✓ 04:01 local → day open, new local_date
```

### `tests/e2e/core-loop.spec.ts` (new)
```
✓ complete a quest → reload → still complete
✓ complete → undo → reload → not complete
✓ with a mocked clock at 03:05, rows are disabled and the banner shows
✓ with a mocked clock crossing 04:00 while the page is open,
  a visibilitychange regenerates instances for the new date
✓ all six rows are reachable without scrolling at 412×915 (Pixel 7)
```

That last assertion matters: six rows above the fold on a real Android viewport is the constraint that caps the core set at six. If it fails, tell me rather than shrinking the rows.

### Lint hygiene
`quests.ts` is now fully implemented — remove its remaining inline `/* eslint-disable */` block. **Also take `reduce.ts` off the stub-args allowance now** that it has four real branches; it was deferred last slice and deferring again means it never happens.

---

## STEP 7 — VERIFY, REPORT, STOP

Run and report verbatim:

```
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Android verification — **`adb reverse` on localhost, never `--host`**:

```
npm run build && npm run preview -- --port 5173
adb reverse tcp:5173 tcp:5173
# phone → Chrome → http://localhost:5173
```

Checklist for the user:

```
[ ] Six quest rows visible without scrolling, one-handed
[ ] Tapping the circle completes; tapping again undoes
[ ] Tapping the row opens the sheet with YOUR sentence in it
[ ] Completion feels instant (no perceptible lag)
[ ] Kill the app from the app switcher, reopen → state intact
[ ] Airplane mode: everything above still works
[ ] Priority line names a real quest and a real time
[ ] Nothing on screen shows an XP number yet
```

### Report sections

1. Step 0 crash fix, with the regression test result
2. Day-0 instrument: built, and where it surfaces
3. Files created and modified
4. Verbatim command output
5. Test results, assertion by assertion
6. **Discipline check** — confirm `xp.ts`, `level.ts`, `rank.ts`, `streak.ts`, `attributes.ts`, `career.ts`, `dsa.ts`, `srs.ts`, `rules.ts`, `messages.ts` are all still stubs
7. Lint override status — `quests.ts` and `reduce.ts` both off the allowance
8. Bundle size gzipped, and delta from Slice 1's 105.67 kB
9. Anything ambiguous or wrong in the spec — flag, don't silently resolve
10. What Slice 3 will need

Commit on `slice-2-core-loop`:

```
feat(slice-2): daily quest instances, TODAY screen, completion and undo

Implements generateQuests, the TODAY screen, the quest detail sheet,
04:00 rollover and 03:00 day-close. Fixes reduce.ts throwing on
PLAN_AMENDED/METRIC_RECORDED. Adds the Day-0 self-efficacy instrument.
No XP — xp.ts remains a stub.
```

## THEN STOP. Do not begin Slice 3.

## STANDING RULES

- Never delete or overwrite existing work. Conflicts → stop and ask.
- Never invent a constant. Everything comes from `engine/config.ts`.
- No new dependencies without asking.
- No clock, database or DOM access inside `engine/`.
- **The word "failed" appears in no user-facing string, ever.**
- Ambiguity → ask. Do not guess and move on.

═══════════════════════════════════════════════════════════════

---

## Your checklist after Slice 2

```
[ ] Report §1 confirms hydrate() no longer throws
[ ] Report §6 confirms 10 engine modules are still stubs
[ ] Six rows fit above the fold on your actual phone
[ ] Your own intention sentence appears in the quest sheet
[ ] Kill-and-reopen preserves completions
```

**This is the slice where the app becomes real.** After it passes, install it to your home screen and start using it for the six core quests — even with no XP, no levels, no streaks. Logging six taps a day from here builds the event history that every later slice reads.

## Slice 3 opener (fresh session)

> Read `final/01-quests-xp-level-rank.md` §2 and §3, and `final/05-motivation-moments-notifications.md` §2. Slices 0–2 are complete and committed.
>
> Implement **Slice 3 only: the XP engine, the level curve, and the LEVEL UP Moment.** `xp.ts` and `level.ts` become real: category caps, the 700 daily cap, the `BONUS`/`BOSS` exemption per `01 §2.1.1`, and `req(n) = round₁₀(200 + 84·n^0.98)`. Property tests with fast-check. The XP counter and bar appear on TODAY and Profile. LEVEL UP fires in under 300 ms with haptics.
>
> Do not implement streaks, MVD or recovery. Stop after Slice 3 and report.
