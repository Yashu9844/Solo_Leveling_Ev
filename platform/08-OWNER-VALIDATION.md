# 08 · Owner regression validation (loop 16.1 — prepared; the sign-off is the owner's)

Purpose: before anyone else uses this build, prove it has not changed the owner's own System. This is the written protocol; nothing in it has been run on the owner's data, because the owner's export is not on the machine the platform was built on.

## A. The three equivalence levels, on the owner's export

| Level | What | Command | Pass |
|---|---|---|---|
| E1 | the five cache tables and the twelve domain tables, rebuilt from the owner's whole log, byte-identical between the legacy and the Blueprint engine | `npm run shadow` (reads `platform-fixtures/private/owner-export.json`) | `SHADOW CLEAN`, exit 0 |
| E2 | every read model on every 7th day and the last: attributes, six gate reports, bosses, achievements, checkpoint comparisons, reality, weekly review, daily report, message contexts, transmission | same run | same |
| E3 | pixels: 41 captures at 360/390/430 px | `VITE_ENGINE_V2=true npx playwright test visual-baseline` | 0 diff (tolerance 0.1%) |

Also: `npm run verify:v2` (the whole unit suite with the flag on) and `npm run perf` on the machine you will deploy from.

## B. Walkthrough (flag on, platform origin, your imported export beside your real app)

Tick each, side by side with the real app. Anything that differs is a finding, not a judgement call.

- [ ] Today: the same six quests, in the same order, same designations and reality labels, same XP shown for each completed one.
- [ ] Complete one quest on the platform origin and on the real app with the same input: same XP, same level bar, same "day cleared" moment when the sixth is done.
- [ ] Log each kind once (a problem, an application, a build session, a training session, wake time, screen time): the Moment, the toast and the numbers match.
- [ ] Progress → SYSTEM: level, rank, streak, attribute bars and their values; Progress → REALITY.
- [ ] Skills: every tab, mastery states, the interview benchmark.
- [ ] Profile: rank, next checkpoint and its day, every gate condition (✓/✗ and the numbers), bosses, achievements, body metrics.
- [ ] Open (do not seal) the next checkpoint: the gate list is identical.
- [ ] Evening review: the same four priority options; completing it grants no XP; the daily report matches.
- [ ] Weekly review: the same rows (Career, DSA, Build, Learn, Training), the same improved/declined/bottleneck, the same proposals and nudge.
- [ ] Settings → Data → Verify integrity: **clean**.
- [ ] Export from the platform origin, import into a scratch profile: nothing lost.
- [ ] Reload with the network off: Today renders.

## C. Thirty days of integrity

After the cutover (6.4) run Settings → Data → **Verify integrity** once a day for 30 days and log it. The contract (17.1) may not happen before this, or before the arc is sealed — whichever you choose (platform/04 §38.7).

| Date | Day of arc | Verify integrity | Anything odd |
|---|---|---|---|
| | | clean / NOT clean | |

(30 rows.) One "NOT clean" resets the count and stops everything: export, then send the report.

## D. Sign-off

> I ran A, B and C on my own data on ______. E1 ☐ clean ☐ not clean · E2 ☐ clean ☐ not clean · E3 ☐ 0 diff ☐ diff · walkthrough ☐ no differences ☐ differences listed below · 30 days ☐ clean.
> Differences and what was done about each: …
> Signed ______________________ Date ____________
