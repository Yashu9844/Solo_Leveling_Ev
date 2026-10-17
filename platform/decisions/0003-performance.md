# 0003 · Performance budgets (loop 15.1)

`npm run perf` (tests/perf, one file at a time, never part of `npm test`) holds the maximum System lived for a year (X2's eleven domains, 365 days, 12,752 events) to the budgets of platform/04 §33.3. Times are measured on the development machine and multiplied by 4 (`CPU_SLOWDOWN`) to stand for a mid-range Android; **that factor is an assumption, not a measurement** — the real check is the owner's device (a Phase 16/17 item).

| Operation | Budget | Measured (device-equivalent) |
|---|---|---|
| Full rebuild, compute only, 12,752 events | < 150 ms | ~120 ms |
| `generateBlueprint` | < 20 ms | ~9 ms |
| `validateBlueprint` | < 10 ms | ~3 ms |
| Gates + attributes from a shared snapshot | < 50 ms | ~30 ms |
| The snapshot itself (not in the §33.3 table; measured and capped at 100 ms) | — | ~40 ms |
| A whole read (snapshot + gates + attributes) | < 150 ms | ~60 ms |

**15.2 (incremental rebuild) is not triggered**: the rebuild is inside its budget. The margin is thin (about 20%), so it should be re-measured when the log or the projections grow.

What was fixed to get here: (1) a SignalEnv now answers each instrument question once per read instead of once per condition (four rank gates asked the same question four times); (2) a practice instrument's topic-mastery signal, the most expensive one, is computed only when read; (3) the day outcomes through yesterday are the outcomes through today without the last day, not a second computation. Before: gates + attributes 331 ms. After: 30 ms.

Flakiness, recorded honestly: run inside the parallel unit suite the same measurements came out three times slower and failed. That is why the budgets are a separate command; run them with nothing else running.
