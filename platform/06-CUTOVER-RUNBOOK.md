# 06 — Cutover runbook: the owner's engine moves to the Blueprint engine

**Status when this was written (10 Oct 2026): code is done through loop 6.2; nothing has been deployed, and nothing in this runbook has been executed.** Loops 6.3, 6.4 and 6.5 need the owner and real days. They are not code. This file is what the person doing them needs.

The swap is one build-time flag, `VITE_ENGINE_V2=true`. With it **off** (the default) the app is the app the owner has always had. With it **on**, the owner's System runs on the Blueprint engine, and every number the owner can see was proven equal beforehand (below). Rolling back is deploying the previous build; the owner's log never gains a shape an older build cannot read.

---

## What was proven before this runbook (and how to re-run it)

| Claim | Evidence | Re-run |
|---|---|---|
| The five cache tables are byte-identical (E1) | golden-120, 100+ activity seeds, 1,000 fuzz logs | `npm run shadow` |
| Every read model is identical (E2): attributes, six gate reports (every label and number), checkpoint comparisons, bosses, achievements, frozen evidence, reality, weekly review, message and transmission contexts, recoverable day | live store functions vs. the Blueprint evaluators on prefix databases | `npm run shadow` |
| The whole unit suite passes with the flag **on**, unchanged, including the golden read-model snapshots | `vitest.v2.config.ts` | `npm run verify:v2` |
| No browser failure is attributable to the flag (its failures are a subset of the flag-off failures; the rest is load flakiness on a busy machine - see `platform/decisions/0000-e2e-baseline.md`) | Playwright, flag-on build | `VITE_ENGINE_V2=true npx playwright test` |
| **E3 - pixels:** every route and the main sheets render identically on the Blueprint engine (41 captures at 360 / 390 / 430 px, tolerance 0.1%, against a baseline recorded from the legacy engine) | `tests/e2e/visual-baseline.spec.ts` | `VITE_ENGINE_V2=true npx playwright test visual-baseline` (Windows/Chromium baselines; another OS needs its own recording) |
| Dexie v5 upgrades a seeded v4 database byte for byte; a stale tab closes itself | `tests/engine/schema-v5.test.ts` | `npm test` |
| An older build skips every new event type and reads the owner's log unchanged | `reduce.test.ts`, `event-payloads-v2.test.ts` | `npm test` |

**Not proven, because it cannot be here: the owner's own export.** `platform-fixtures/private/owner-export.json` was absent on the machine this was built on, so every owner-fixture check was skipped. Steps 1–3 below put it through the same harness.

Known legacy behaviours the Blueprint engine reproduces on purpose are listed in `src/blueprint/legacy/deviations.md`. They are the owner's to approve or fix later (platform/02 §22.4); the cutover must not change them.

---

## Before anything: the three things only the owner can do

1. **Export a backup** from Settings → Data. Copy the file to `platform-fixtures/private/owner-export.json` (gitignored; never commit it).
2. Decide the date with `npm run cutover:check` (step 4 of 02 §22.3: **not within ±3 days of a checkpoint**). It prints `OK` or `NOT today` and the earliest safe date.
3. Be willing to open Settings → Data → **Verify integrity** after the deploy and look at the result.

## 6.3 — Soak on the platform origin (≥ 7 days)

1. Run the harness on the real log: `npm run shadow`. It now includes the owner export (E1 on the whole log, E2 on every 7th day and the last). Expect **SHADOW CLEAN**. Any difference stops here: do not proceed, send the report to whoever maintains this repo.
2. Deploy a **separate** origin with a distinct database name and the flag on:
   `VITE_DB_NAME=system-arc-platform VITE_ENGINE_V2=true npm run build` → host it away from the owner's origin (platform/04 §34, Q8). It must never share an origin with the owner's real database.
3. On that origin import the export (Settings → Data → Import), open Today, Progress, Skills, Profile, Checkpoint. Compare with the owner's real app side by side: same quests, same XP, same level, same attributes, same gate lists.
4. For 7 days: log the same activity on both (or replay it), and each day run **Verify integrity** on the platform origin. It must report clean.
5. Record the outcome in `platform/decisions/` as a short note (date, days soaked, integrity results).

## 6.4 — The cutover (the owner's origin; irreversible only in the sense that the owner's app updates)

Preconditions: 6.3 done; `npm run cutover:check` says OK for the deploy date; a **fresh export** taken the same day.

1. Deploy the build with `VITE_ENGINE_V2=true` (and the default database name) to the owner's origin. The service worker auto-updates, so the owner's phone takes it on next open. The first open upgrades Dexie to v5 (two empty tables).
2. The owner opens Settings → Data → **Verify integrity**. Expected: **clean**.
3. The owner checks Today, Progress, Skills and Profile look and behave the same.
4. If anything differs: **rollback** (below), keep the export, and report. Do not try to fix forward on the owner's live arc.

## 6.5 — Seven-day soak, then the decision record

Daily Verify integrity for 7 days; the rollback plan stays valid (the owner's log has no new event shape, and the previous build still reads it). Then write `platform/decisions/0001-cutover.md`: dates, integrity results, anything unexpected, and whether to proceed to Phase 7. **That record is the owner's sign-off, not anyone else's.**

---

## Rollback

Deploy the previous build (flag off or the commit before 6.1). It opens the same database: the only schema change is two additive empty stores, which an older build never touches, and the owner's event log contains nothing an older build cannot read. If Dexie refuses to open a v5 database from v4 code on a device, use the rehearsed path: **import the backup export** into a fresh install of the previous build (the export is the whole truth — `verifyIntegrity` proves it), or ship the previous code with the v5 schema declared (platform/04 §38.4). Rehearsing this is loop 15.3.

## If `npm run shadow` or `npm run verify:v2` ever fails

That is the system working: a difference was found *before* the owner saw it. Do not loosen a test to make it pass. The report names the read model, the day and the first differing field.
