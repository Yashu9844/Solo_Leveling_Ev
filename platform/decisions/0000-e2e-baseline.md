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

## Other pre-existing issues found (no failing test)

| Issue | Where | Impact |
|---|---|---|
| `CHECKPOINT_SEALED` is never appended by `sealCheckpoint` | `src/store/checkpoint.ts` | The six "CHECKPOINT SEALED" System voice lines (`voicePack.ts` event-checkpoint-001…006) can never fire. It also means the reducer's throw on that type is never hit in practice. |
| `tsc -b` covers only `src/` | `tsconfig.app.json` | Tests are type-checked only through vitest/playwright transforms. A test-typecheck step belongs in the verify gate (Phase 1). |
| 34 lint errors in the committed tree | three attribute detail screens + root `_*-shot.mjs` scripts | Fixed in the baseline commit (dead imports removed; scratch scripts ignored). |
