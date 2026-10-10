# 0000 — E2E baseline and pre-existing issues

**Date:** 29 Sep 2026 · **Loop:** 0.1 (baseline gates)

## What happened

1. The first e2e baseline run reported 68 passed / 45 failed. **It was invalid.** `playwright.config.ts` had `reuseExistingServer: !CI` on Vite's default port 4173, and a `vite preview` of a *different checkout* (`C:\Users\yashwanth\Desktop\Solo_leveling`) was already listening there. Every run silently tested that other app.
   Fixed: this repo's suite now uses port **4273** with `reuseExistingServer: false`, so a taken port fails loudly instead of testing the wrong build.
2. Against this checkout, the suite was 91 passed / 22 failed. Of those, **4 were test drift** from the design/07 rename (quest titles CAREER → ASCENSION, etc.; reset now lands on `/start`).
3. **Test drift fix, which is also platform groundwork.** Specs located quests by display title (`'Complete CAREER'`). Titles are presentation and will become user-configurable (platform/03 §27.1), so tests now locate quests by stable key:
   - The quest toggle carries `data-testid="quest-toggle-${key}"`.
   - Completion is read from `aria-pressed`.
   - `helpers.ts#waitForQuestInstanceState` matches `quest_template.key`.
   - Screen-reader labels are unchanged.

## Baseline after the fix

**95 passed / 18 failed** (113 tests). All 18 failures are one pre-existing product bug:

| Bug | Where | Failing tests | Status |
|---|---|---|---|
| StreakGrid day cells are 14×14 px `<button>`s, below the 44 px tap floor (final/06 §7, design/00 §9) | `src/ui/components/StreakGrid.tsx` (added 24 Sep), on `/progress` | `responsive.spec` × 3 tests × 6 viewports | **Open — needs a design decision** (owner). 120 tappable days cannot each be 44 px on a phone. Options: make cells non-interactive with a separate accessible day picker; make the whole grid one control with arrow-key navigation; or exempt it with an explicit rule change. |

The gate G2 ("e2e green") is therefore evaluated as **no new failures versus this list** until the owner decides.

**Known flaky test** (found during loop 1.1, pre-existing):

- `core-loop.spec.ts` › "all six rows are reachable without scrolling at 412x915" fails intermittently with `<main>` overflowing by exactly **131 px**.
- It failed 3 of 8 runs on the committed tree before loop 1.1, and 1 of 5 with it.
- The fixture arc starts 1 Sep while the test clock sits at 5 Sep, so four unopened days switch **Reduced Mode** on. The Reduced-Mode banner plus the reflection line then push Today past 915 px in some runs.
- The exact source of the run-to-run variance is not yet identified. It is recorded, not fixed: the fix is either test data (start the arc on the clock's day) or a product decision about Today's height with Reduced Mode on.

## Other pre-existing issues found (no failing test)

| Issue | Where | Impact |
|---|---|---|
| `CHECKPOINT_SEALED` is never appended by `sealCheckpoint` | `src/store/checkpoint.ts` | The six "CHECKPOINT SEALED" System voice lines (`voicePack.ts` event-checkpoint-001…006) can never fire. It also means the reducer's throw on that type is never hit in practice. |
| `tsc -b` covers only `src/` | `tsconfig.app.json` | Tests are type-checked only through vitest/playwright transforms. A test-typecheck step belongs in the verify gate (Phase 1). |
| 34 lint errors in the committed tree | three attribute detail screens + root `_*-shot.mjs` scripts | Fixed in the baseline commit (dead imports removed; scratch scripts ignored). |

---

## Update, 10 Oct 2026 - e2e under the Blueprint engine (loop 6.2)

**Result: no e2e failure is attributable to `ENGINE_V2`.** Evidence, all on the same machine in one session:

| Run | Flag | Failures |
|---|---|---|
| Full suite, 4 workers, flag-on build | on | the 18 known `responsive.spec` failures + backup, career, settings:42, weekly-review:44, xp:128 |
| `backup career settings xp`, 4 workers, at the **session's starting commit** (before any platform work from loop 3.5) | - | backup, career, settings:42, xp:57 |
| The same four, current code | off | backup, career, settings:42, xp:57 |
| `backup career build settings streak xp weekly-review`, **2 workers** | off | backup, xp:57, xp:128 |
| The same seven, **2 workers** | on | xp:57, xp:128 |

So: with the flag on the failures are a **subset** of the flag-off failures, and four of them fail identically at the starting commit. The common cause is load. These specs time out at 30 s or race a 400 ms window (`xp.spec`'s `dismissMomentIfPresent`), and this machine runs other projects' dev servers during the suite. `xp.spec:128` passes alone in ~26 s with the flag off and on.

What was found and fixed on the way (each is a real defect, independent of load):
- **5.1's `versionchange` handler reloaded the page on a database DELETION**, which `backup.spec` triggers; it now reloads only for an upgrade.
- **The reducer copied the whole completions map on every completion**, making a rebuild quadratic in the log: 477 ms at 6,600 events. It is now in place (~30 ms) - an improvement for the legacy engine as well. `npm run bench` reproduces the numbers.
- **`resolveBlueprints` re-ran the whole reducer** just to read the arc; it now folds only the ARC_* events.
- The V2 read models reload the log and rebuild their environment per call; one screen refresh makes several calls, so `store/v2Reads.ts` now caches by (day, log length, last event, projection epoch, checkpoint rows).

The 18 `responsive.spec` failures are unchanged and still need the owner's design decision above.
