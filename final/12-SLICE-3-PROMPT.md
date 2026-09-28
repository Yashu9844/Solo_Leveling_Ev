# 12 — SLICE 3: XP Engine, Level Curve, LEVEL UP Moment

**Prerequisite:** Slice 2 complete and committed on `slice-2-core-loop`.

Paste everything between the `═══` markers into a **fresh** Claude Code session in Antigravity IDE.

---

## Before you paste — one structural problem to fix now

Slice 2 passed. Tests are good, the two flags Claude Code raised were both correct. But its §1 architectural note points at something bigger than it realised, and it needs fixing **before** XP lands on top of it.

### The problem

Claude Code is right that no event creates a quest instance. Its workaround — `db.quest_instance` as the live source of truth, with a parallel completion overlay in `reduce.ts` — works today. But it quietly breaks two things the spec promises:

- **`07 §6` says the event log alone is a complete backup.** Right now it isn't. Export the events, wipe the device, re-import — and you get the arc and the completions, but no templates and no instances. Your backup is incomplete and you would not find out until you needed it.
- **`07 §5` promises `verifyIntegrity()` rebuilds projections from scratch and diffs them.** With two sources of truth that can drift, there is nothing to diff against.

XP makes this materially worse. The moment `xp_ledger` rows are written alongside instance writes, you have three tables that can disagree, and "why is my XP wrong" becomes unanswerable.

### The fix, and why it's cheap

Nothing needs a new event type. Both tables are already **fully derivable**:

- **Templates** ← `ARC_STARTED` + `PLAN_AMENDED`, through the existing `generateCoreQuestTemplates`. Already deterministic.
- **Instances** ← templates × the set of `local_date`s present in the event log, through the existing `generateQuests`. State comes from `QUEST_COMPLETED` / `QUEST_UNDONE`.

The one thing this changes: **"was this day opened?" must come from `APP_OPENED` events, not from the presence of instance rows.** That's better anyway — it's a recorded fact rather than an inference from a cache, and Slice 4's streak logic needs it to be a fact.

So: `db.quest_template`, `db.quest_instance` and `db.xp_ledger` all become **caches**. The event log is the only source of truth. Step 0 below implements the rebuild and a test that proves it.

### The other two flags — both handled correctly, keep them

**The `idem_key` bug Claude Code found is real and its fix is right.** My prompt's `quest-complete:${instanceId}` would have silently dropped a re-completion after an undo, leaving the event log disagreeing with the projection — the exact failure mode Step 0 exists to prevent. Its monotonic sequence suffix is the correct answer. Keep it.

**The 01:49 IST discovery is correct product behaviour**, not a bug: a session at 01:49 genuinely belongs to the previous local day. But it exposed a missing screen state — before the arc starts, TODAY renders empty with a misleading "Six of six" line. Step 0 fixes the message.

---

## One note on XP and undo, because it is easy to get wrong

`01 §2.1` says **XP is never removed.** That is about *earned XP for work actually done* — the system does not claw back points to punish you.

It does **not** mean an undo leaves phantom XP behind. Undo corrects a mis-tap. And because `xp_ledger` is a projection of the event log, nothing is ever "deleted": a `QUEST_UNDONE` simply means the completion no longer contributes when the ledger is rebuilt.

**Implement it that way — recompute, never subtract.** No negative ledger rows, no compensating entries, no deletes. The invariant `amount >= 0` holds because every row is a fresh derivation.

---

═══════════════════════════════════════════════════════════════

# SLICE 3 — XP, LEVELS, AND THE LEVEL UP MOMENT. NOTHING ELSE.

Slices 0–2 are complete and committed. You are implementing **Slice 3 only**.

Read first: `final/01-quests-xp-level-rank.md` §2, §2.1.1 and §3 · `final/05-motivation-moments-notifications.md` §2 · `final/07-data-model-architecture.md` §1 and §5.

## SCOPE

XP is computed, ledgered, capped and displayed. Levels are real. The LEVEL UP Moment fires. And all derived tables become rebuildable from the event log.

## OUT OF SCOPE — do not implement

Streaks · MVD · grace · recovery quests · Reduced Mode · rank gates · attributes · the other five Moments (BOSS, MASTERY, EVIDENCE, RANK, CHECKPOINT) · weekly quests · the evening review · `rank.ts`, `streak.ts`, `attributes.ts`, `career.ts`, `dsa.ts`, `srs.ts`, `rules.ts`, `messages.ts` — all stay stubs.

---

## STEP 0 — MAKE ALL PROJECTIONS REBUILDABLE

This comes first. XP is built on top of it.

### 0.1 `db/projections.ts` — implement

```ts
/**
 * Rebuilds every derived table from the event log alone.
 * Wipes and repopulates quest_template, quest_instance, xp_ledger.
 * Deterministic: same log + same config → identical tables.
 */
export async function rebuildProjections(config: EngineConfig, deps: EngineDeps): Promise<void>

/**
 * Rebuilds into memory, diffs against the live tables, returns discrepancies.
 * Dev-only surface; used by the integrity test and the Profile dev action.
 */
export async function verifyIntegrity(config: EngineConfig, deps: EngineDeps): Promise<IntegrityReport>
```

Rebuild order:
1. `ARC_STARTED` → arc record
2. `+ PLAN_AMENDED` → `generateCoreQuestTemplates` → `quest_template`
3. The distinct `local_date`s appearing on `APP_OPENED` events, within the arc range → for each, `generateQuests` → `quest_instance`
4. `QUEST_COMPLETED` / `QUEST_UNDONE`, applied in event order → instance states
5. Completed instances → `computeXp` → `xp_ledger`

Because ids come from `deps.newId`, rebuild must produce **stable ids**. Derive instance ids deterministically from `(templateId, localDate)` — a hash or a plain composite key — rather than a fresh UUID. Report which approach you chose.

### 0.2 `APP_OPENED` must be written

TODAY currently doesn't write it. Add it: one `APP_OPENED` per local day, on first open of that day, idempotent by `` `app-opened:${localDate}` ``, payload `{ seconds: 0 }` for now (the duration metric is a later slice).

This is what makes "was this day opened" a fact. Slice 4's streak logic depends on it.

### 0.3 Dev action

Profile → Settings, `import.meta.env.DEV` only: **Verify integrity** — runs `verifyIntegrity()` and prints the report. Sits next to Reset arc.

### 0.4 Fix the empty-arc screen state

`priorityLine()` currently returns "Six of six. Day closed." both when all six are complete and when no templates are active. Split them:

- All six complete → `"Six of six. Day closed."`
- `localDate < arc.startDate` → `"Arc begins {startDate}."`
- `localDate > arc.endDate` → `"Arc complete. See your report."`
- No active templates for another reason → `"No quests today."`

### 0.5 Test it

```
✓ full log → rebuildProjections → tables match the live tables exactly
✓ wipe quest_template + quest_instance + xp_ledger → rebuild → identical state
✓ rebuild twice → deep-equal (determinism)
✓ instance ids are stable across rebuilds
✓ a day with no APP_OPENED produces no instances
✓ verifyIntegrity returns empty discrepancies on a clean database
```

**Report Step 0 as complete before starting Step 1.**

---

## STEP 1 — `engine/xp.ts`

```ts
export function computeXp(
  event: SystemEvent,
  dayState: DayState,
  config: EngineConfig
): XpGrant[]
```

Pure. Given an event and the day's state so far, returns the grants it produces.

### Rules, in this order

1. **Map the event to a base grant.** This slice: only `QUEST_COMPLETED` produces XP, reading `xp` and `category` from `config.coreQuests[questKey]`. Every other event type returns `[]`.
2. **Apply the category cap.** If `dayState.byCategory[cat] + amount > config.categoryCaps[cat]`, trim to the remainder and set `capped_from` to the untrimmed amount.
3. **Apply the daily cap.** If `dayState.total + amount > config.dailyCap` (700), trim again, recording `capped_from` if not already set.
4. **`BONUS` and `BOSS` are exempt from both caps** — per `01 §2.1.1`. Not used this slice (no weekly, boss or recovery grants exist yet), but the exemption must be in the code and covered by a test, so it isn't "fixed" later by someone assuming it's a bug.
5. **Never return a negative amount.** Never return an amount above the remaining headroom.

### Never earns XP

Per `01 §2.3` and the invariants in `02 §1` and `04 §1` — assert all of these in tests even though the events don't exist yet:

- Any body `METRIC_RECORDED` (`weight_kg`, `waist_cm`, `bodyfat_pct`)
- Any external `CAREER_EVENT_LOGGED` (`response`, `call`, `interview`, `onsite`, `offer`, `rejection`)
- `APP_OPENED`, `REVIEW_COMPLETED`, `CHECKPOINT_SEALED`

---

## STEP 2 — `engine/level.ts`

```ts
export function levelRequirement(n: number, config: EngineConfig): number
export function levelFor(totalXp: number, config: EngineConfig): LevelState
// LevelState = { level, xpIntoLevel, xpForNext, totalXp }
```

```
req(n) = round₁₀( config.level.base + config.level.coefficient · n^config.level.exponent )
       = round₁₀( 200 + 84 · n^0.98 )
```

**Read every term from config. No literals.** The published table in `01 §3` is the test fixture — `req(1)=280, req(2)=370, req(3)=450, req(5)=610, req(10)=1000, req(20)=1780, req(30)=2550, req(40)=3320`.

Handle multi-level-up: a single grant large enough to cross two boundaries advances two levels.

---

## STEP 3 — WIRING

`store/quests.ts`'s `completeQuest` / `undoQuest` extend to write `xp_ledger` **in the same Dexie transaction** as the event and the instance update. Three writes, one transaction, or none.

On undo: **recompute the day's ledger from events. Do not delete rows individually and do not write a negative row.** The rebuild is the mechanism (see the note above the markers).

`player_state` (total XP, level) is a projection — recomputed, never incremented in place.

---

## STEP 4 — UI

### TODAY
- Quest rows now show their XP: `+100`, `+60`, `+40`. Completed rows show what was actually granted (which may be capped).
- Status line: `DAY 12 · LEVEL 4 · RANK E` — **level is real now; rank stays hardcoded `E` until Slice 12.**
- A 4px XP bar under the status line: current level progress, `--accent` fill, static when idle, 500 ms fill on change.
- On completion: XP counter rolls 400 ms ease-out. **Tap → visible feedback in under 300 ms**, offline. This is a hard budget, asserted in Playwright.

### Profile
Real level, real total XP, real progress: `LEVEL 12 · 760 / 1,240 to L13 · total XP 9,460`. Rank still `E`.

### LEVEL UP Moment
Spec: `05 §2.2` and `§2.3`. Full screen, 700 ms:

```
accent rule sweeps L→R           260 ms
number cross-fades, 6px rise     240 ms
unlock line fades in             200 ms
haptic: navigator.vibrate([12, 40, 24])
```

```
┌─────────────────────────────────┐
│                                  │
│           LEVEL                  │
│         03 → 04                  │
│                                  │
│    ────────────────────          │
│    UNLOCKED · Weekly quests      │   ← only if this level unlocks something
│                                  │
│      tap anywhere                │
└─────────────────────────────────┘
```

- Monospace numerals, one accent, near-black ground. **No gradient, no particles, no glow, no sound.**
- Dismissible on any tap. Never blocks input.
- **Degrades after the third occurrence** — level-ups 4+ become an inline banner on TODAY, per `05 §2.3`.
- `prefers-reduced-motion` disables motion and haptics, keeps the content.
- Unlock line reads from the `01 §3` unlock table; omit the line entirely when that level unlocks nothing.

Unlocks are **displayed** this slice, not enforced. Gating screens by level is Slice 13.

---

## STEP 5 — TESTS

### `tests/engine/xp.test.ts` (new)
```
✓ each core quest yields exactly 100/100/100/100/60/40
✓ six core completions in a day sum to exactly 500
✓ category cap trims and records capped_from
✓ daily cap 700 binds before the 885 category-cap sum
✓ BONUS and BOSS grants bypass both caps
✓ APP_OPENED / REVIEW_COMPLETED / CHECKPOINT_SEALED yield []
✓ INVARIANT: no body metric_sample produces a ledger row
✓ INVARIANT: no external career_event produces a ledger row
✓ property [fast-check]: ∀ event sequences, 0 ≤ daily capped XP ≤ 700
✓ property [fast-check]: every grant amount ≥ 0
✓ property: total_xp === SUM(ledger.amount)
```

### `tests/engine/level.test.ts` (new)
```
✓ req(n) matches the §3 table exactly at n = 1,2,3,5,10,15,20,25,30,35,40
✓ cumulative to reach L10 = 5,460 · L20 = 19,000 · L40 = 69,280
✓ exactly-enough XP levels up; one XP short does not
✓ a single grant crossing two boundaries advances two levels
✓ coefficient read from config — mutate it and the output follows
✓ levelFor(0) → level 1, 0 into level, 280 for next
```

### `tests/engine/projections.test.ts` (new) — the Step 0 suite above

### `tests/e2e/xp.spec.ts` (new)
```
✓ completing a quest shows +XP and advances the bar
✓ tap → XP feedback rendered in under 300 ms      ← performance assertion
✓ undo removes the XP; total returns to its prior value
✓ crossing a level boundary fires the LEVEL UP Moment
✓ the Moment dismisses on any tap
✓ the 4th level-up renders as an inline banner, not full screen
✓ prefers-reduced-motion: Moment content present, no animation
```

### Lint hygiene
`xp.ts` and `level.ts` are implemented — take both off the stub-args allowance.

---

## STEP 6 — VERIFY, REPORT, STOP

```
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Android — **`adb reverse` on localhost, never `--host`**:

```
npm run build && npm run preview -- --port 5173
adb reverse tcp:5173 tcp:5173
```

Checklist for the user:

```
[ ] Completing a quest shows +XP immediately — no perceptible lag
[ ] The bar moves
[ ] Undo takes the XP back and the total is correct
[ ] Level up feels earned, not cheap: no confetti, no noise
[ ] The haptic is a short double-tick, not a long buzz
[ ] Six core quests in one day = exactly 500 XP
[ ] Dev → Verify integrity reports no discrepancies
```

### Report sections

1. Step 0: rebuild strategy, the instance-id approach chosen, and the integrity test result
2. Files created and modified
3. Verbatim command output
4. Test results, assertion by assertion
5. **Discipline check** — confirm `rank.ts`, `streak.ts`, `attributes.ts`, `career.ts`, `dsa.ts`, `srs.ts`, `rules.ts`, `messages.ts` are still stubs
6. The measured tap→feedback time from the Playwright assertion
7. Bundle size gzipped, delta from Slice 2's 108.93 kB
8. Anything ambiguous or wrong in the spec — flag, don't silently resolve
9. What Slice 4 will need

Commit on `slice-3-xp-levels`:

```
feat(slice-3): XP engine, level curve, LEVEL UP moment

Implements computeXp with category and daily caps, the BONUS/BOSS
exemption, and levelFor on req(n)=round10(200+84·n^0.98). Makes
quest_template, quest_instance and xp_ledger fully rebuildable from
the event log; adds verifyIntegrity. APP_OPENED now written per day.
```

## THEN STOP. Do not begin Slice 4.

## STANDING RULES

- Never delete or overwrite existing work. Conflicts → stop and ask.
- Never invent a constant. Everything comes from `engine/config.ts`.
- No new dependencies without asking.
- No clock, database or DOM access inside `engine/`.
- **The word "failed" appears in no user-facing string, ever.**
- Ambiguity → ask. Do not guess and move on.

═══════════════════════════════════════════════════════════════

---

## Your checklist after Slice 3

```
[ ] Report §1 confirms wipe-and-rebuild reproduces state exactly
[ ] Report §5 confirms 8 engine modules are still stubs
[ ] Report §6 shows tap→feedback under 300 ms
[ ] Six quests in a day = exactly 500 XP on your phone
[ ] The level-up moment feels good but not cheap
```

If the LEVEL UP moment feels like a mobile game, say so and I'll cut it back. That one is a taste call and only you can make it.

## Slice 4 opener (fresh session)

> Read `final/01-quests-xp-level-rank.md` §6, and `final/10-risks-and-failure-modes.md` §A1–A2. Slices 0–3 are complete and committed.
>
> Implement **Slice 4 only: the failure system.** MVD (35 XP floor), the single Arc Streak on MVD-or-better days, 4 auto-applied grace days per rolling 28, recovery quests at 40 XP with a 48-hour window, Reduced Mode at two consecutive misses, and Arc Pause. `streak.ts` becomes real. "Was this day opened" reads from `APP_OPENED`.
>
> No red, no notifications on a miss, and the word "failed" appears nowhere. Stop after Slice 4 and report.
