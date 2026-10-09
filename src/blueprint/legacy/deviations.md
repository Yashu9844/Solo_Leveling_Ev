# Legacy deviations the V2 engine reproduces on purpose

LEGACY_BLUEPRINT_V1 is the golden master: it reproduces what the code **does**, not what `final/` says
(platform/02 §22.1). The spec's own list (rank hard-coded `E`, MVD = opened day with a completion, no
per-extra-application bonus, no per-difficulty problem bonus, Reduced Mode that does not collapse quests,
level unlocks displayed but not enforced, onboarding rhythm answers ignored) is kept.

The equivalence work (loops 4.x) found these additional behaviours, each reproduced exactly and each a
candidate for an owner-approved fix (platform/02 §22.4) — never a side effect of generalisation:

| # | Behaviour | Where | How V2 keeps it |
|---|---|---|---|
| D1 | Last week's ENGINEERING attribute in the weekly review counts foundation mastery from **all** learning blocks, including this week's, because `getAttributes(date)` reads mastery points unwindowed. The weekly delta for ENGINEERING is therefore understated. | `store/attributes.ts` via `store/weeklyReview.ts` | `SignalEnv.unboundedTotals`, set only for the weekly review's "before" read |
| D2 | The recovery card lists missed quests in cache-table primary-key order (`attention, build, career, dsa, sleep, training`), not in quest order. | `store/recovery.ts` | `recoverableDayFor` sorts templates by id |
| D3 | A re-logged problem keeps the topic and difficulty of its **first** log (the `dsa_problem` row is never updated), whatever the second log's payload says. | `db/domainProjections.ts` | the upcaster inherits them |
| D4 | A boss counts as cleared for the rank gate when its window is open and its conditions currently hold, even if it was never formally cleared. | `store/checkpoint.ts` via `store/boss.ts` | `evaluateBoss(...).cleared` |
| D5 | Streak consistency (and so the "core completion" gate term and MVD consistency) is capped at **yesterday**; MVD days for achievements run through **today**. | `store/streak.ts`, `store/achievements.ts` | the `consistency_*` and `mvd_days` global signals |
| D6 | The interview-readiness benchmark counts as passed once **any** sample equals exactly 1. | `store/checkpoint.ts` | metric `max` ≥ 1 (equal while samples are 0/1, which is all the app writes) |

Each entry is pinned by a test in `tests/engine/` so that a change to it fails loudly.
