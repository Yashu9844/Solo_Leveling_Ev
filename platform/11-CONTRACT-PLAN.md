# 11 · Contract plan (loop 17.1 — deliberately NOT done)

Loop 17.1 deletes the legacy engine paths and the `ENGINE_V2` branches. It is the only irreversible step of the plan, and platform/04 §38.7 allows it only after **(a) the owner's arc is sealed, or (b) 30 consecutive days of clean daily `verifyIntegrity` on the owner's device after the cutover** — the owner's choice. Neither is true: the cutover (6.3–6.5) has not happened. So this loop is a plan, and nothing was deleted.

## When you decide it is time

1. `platform/08-OWNER-VALIDATION.md` section C is complete (30 clean rows) or the arc is sealed and exported.
2. L0–L8 are green with the flag on: `npm run verify:v2`, `npm run shadow`, `npm run perf`, `npm run drill`, the adaptive and legacy e2e.
3. Take an export and keep it somewhere that is not the phone.

## What goes, and what stays forever

**Stays forever** (the owner's history depends on it): `LEGACY_BLUEPRINT_V1` and `src/blueprint/legacy/*`, the upcasters (`src/instruments/records.ts` and friends), the legacy write adapters, `deviations.md`, the legacy event types in the reducer, and the forward-compatible reducer.

**Goes** (read `git grep -n "engineV2Enabled\|ENGINE_V2"` for the list; each branch keeps the V2 side):

| Area | Legacy path to delete | Check before deleting |
|---|---|---|
| Projections | `buildProjections` in `src/db/projections.ts` (the V2 builder is byte-identical for the owner, E1) | `npm run shadow` clean |
| Read models | the legacy bodies of `store/attributes.ts`, `checkpoint.ts` (gate evidence), `boss.ts`, `achievements.ts`, `reality.ts`, `messages.ts`, `systemMessage.ts`, `weeklyReview.ts`, `streak.ts` | E2 clean |
| Engine | `engine/attributes.ts`, `rank.ts` gate bodies, `boss.ts`, `achievements.ts` evaluators that the `blueprint/evaluate/*` replaced | unit tests that import them move to the evaluators |
| Flag | `src/flags.ts` `engineV2Enabled`, `VITE_ENGINE_V2`, `vitest.v2.config.ts`, the `test:v2` / `verify:v2` scripts | the whole suite green on the single remaining path |
| Tests | the equivalence suites (`shadow`, `evaluate-*`, `golden-*`) become regression suites against stored snapshots, not against the deleted engine | keep the golden snapshots; delete only the "legacy side" calls |

## How to do it safely

One commit per area, in the order above, each gated by `npm run verify` and the e2e. Do not squash: a bad area must be revertable on its own. After the last commit, run the rollback drill (`07-ROLLBACK-RUNBOOK.md`) — a rollback to a pre-contract build is exactly what the contract makes impossible to do by code alone, so the export in step 3 above is the rollback.
