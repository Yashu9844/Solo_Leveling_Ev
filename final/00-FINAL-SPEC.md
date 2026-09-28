# SYSTEM — Final Implementation-Ready Specification

**Platform:** Android-first PWA (Chrome, installed via WebAPK)
**Architecture:** Local-first, offline, no server, no account
**Arc:** 1 Sep 2026 → 29 Dec 2026 · 120 days · Asia/Kolkata · day boundary 04:00
**Status:** Phase 3 complete. Implementation-ready. **No code written yet.**

---

## Document set

| File | Sections from your brief |
|---|---|
| `00-FINAL-SPEC.md` | 1 · 2 · what changed from v1 and why |
| `01-quests-xp-level-rank.md` | 3 · 8 · 9 · 10 · 11 |
| `02-career-system.md` | 4 |
| `03-learning-systems.md` | 5 · 6 |
| `04-physical-lifestyle.md` | 7 |
| `05-motivation-moments-notifications.md` | 12 · 13 |
| `06-ux-screens-design.md` | 14 · 15 · 16 · 17 |
| `07-data-model-architecture.md` | 18 · 19 · 20 · 21 · 22 |
| `08-testing-slices-scope.md` | 23 · 24 · 25 |
| `09-PHASE-0-PROMPT.md` | The paste-ready Claude Code prompt |
| `xp-simulation.py` | Reproduces every number in `01` |

The v1 docs in `docs/` remain valid for **research and rationale** (`02-behavioral-evidence.md` especially). Where `final/` and `docs/` disagree, **`final/` wins.**

---

## 1. Final product vision

**SYSTEM is the instrumentation layer around one engineer's 120-day attempt to become materially better at engineering, AI, and physical capability — and to prove it with evidence rather than feeling.**

It is not a productivity app. It holds no errands, no calendar, no notes. It answers two questions and nothing else:

> **Every morning:** what do I need to do today?
> **Every 30 days:** did anything actually change?

Everything in the product that does not serve one of those two questions has been cut.

---

## 2. Final 120-day mission

Your stated objective, made falsifiable. Two columns, permanently separated, because you were right that they are not the same kind of thing.

### CONTROLLED — this is what the system scores you on

| Domain | Threshold at Day 120 |
|---|---|
| **DSA** | ≥ 240 problems logged · first-attempt rate on mediums ≥ 60% (28d) · ≥ 8 topics Fluent, ≥ 3 Retained |
| **Interview readiness** | Benchmark passed: 3 unseen mediums in 90 min, first-attempt, working solution + stated complexity |
| **SE foundations** | OS · networking · databases · distributed systems · concurrency · backend · system design — all ≥ Applied, ≥ 5 at Fluent · 12 system designs studied, 4 written up, 2 explained aloud |
| **AI / agentic** | ≥ 3 public projects with README + eval suite · ≥ 1 deployed and publicly reachable · cost-per-task measured on ≥ 1 · ≥ 1 technical write-up published |
| **Resume / evidence** | ≥ 3 versions, ≥ 1 externally reviewed, updated at every checkpoint from real accomplishments |
| **Applications** | ≥ 280 quality applications · follow-through rate ≥ 70% |
| **Networking** | ≥ 8 real conversations (not connection requests) |
| **Interview prep** | ≥ 4 mock interviews recorded with failure notes |
| **Physical** | ≥ 55 training sessions · est. 1RM aggregate ≥ +12% · mean daily steps ≥ 8,000 |
| **Consistency** | Core-quest completion 60–85% band · wake-time SD < 45 min (28d) · screen time ≤ 60 min/day average |

### EXTERNAL — tracked, displayed, **never scored, never gated, never punished**

Recruiter responses · screening calls · interview loops entered · onsites · offers.

These appear in a dedicated Career Funnel panel with conversion rates. They are **market feedback about your positioning**, not a measure of your effort. The app will never reduce a rank, withhold a reward, or write a discouraging message because a company didn't call.

### Success definition

**SUCCESS** = all CONTROLLED thresholds met. That is the arc succeeding, with or without an offer.
**PARTIAL** = ≥ 7 of 10 CONTROLLED domains met.
**SYSTEM FAILURE** = core completion < 50% for > 4 consecutive weeks, or median daily app time > 4 min (the app became the task).
**INFORMATIVE NULL** = all CONTROLLED met, zero external response. This is not your failure — it is data about targeting, positioning or market, and the Day-120 report will say so explicitly and name which.

---

## 3. What changed from v1, and why

You told me not to blindly preserve the previous design. Nine changes.

### C1 — **Fuel is demoted; Career becomes a core quest.** ⚠ resolves a contradiction in your brief

Your §9 says *"do not add a seventh core quest for job applications."* Your §17 mockup lists **Career** as the first quest row. Both can't hold with six quests.

I resolved it toward §17, because the morning application block is a **daily, fixed-time, fully-controllable behaviour that directly serves objective #1**. Burying it in a subsystem denies it the cue→action→reward loop that is the entire mechanism of this product. It would be the highest-leverage behaviour in your day with the weakest support in the app.

Career doesn't become a *seventh* quest — it takes Fuel's slot. Fuel is demoted because your food is largely determined by PG catering: whey + 2 eggs + 2 idlis, PG lunch + egg, oats + egg + chapathi. The daily *variance under your control* is small, which makes it a poor core quest — a quest you pass 95% of the time carries almost no information. It moves to Maintenance.

**Final six: CAREER · DSA · BUILD · TRAINING · SLEEP · ATTENTION.**

### C2 — Quest thresholds are set at the **sustainable floor**, not your aspirational target

Your routine is: 08:30 wake → 30 min applications → ~10 hours office → gym + steps → 1 hour DSA → 3 hours AI → 02:00 sleep. That is a day with essentially zero slack, and it will not survive 120 days at full intensity.

If the BUILD quest requires 3 hours, you will fail it constantly and the completion rate will sit around 40%, which produces the collapse pattern rather than accountability. So:

| Quest | Completion threshold (the floor) | Your target (lives in weekly quests) |
|---|---|---|
| CAREER | 3 quality applications *or* 25 min substitute career work | 3–8 applications |
| DSA | 1 problem *or* 25 min | 3 problems / 1 hour |
| BUILD | 45 min | 2–3 hours |
| TRAINING | a session *or* ≥ 8,000 steps | session + 10,000 steps |

**Targets belong in weekly quests where missing one costs you a bonus. Floors belong in daily quests where missing one costs you a day.** This is the single most important calibration decision in the spec.

### C3 — Rank gates use **externally verifiable but fully controllable** evidence

v1's Rank A gate required "an interview taken." Your §10 correctly points out you don't control that. Corrected: gates now require artefacts a stranger could verify — a public repo URL, a deployed endpoint, a published write-up, a recorded mock, a logged application count — all of which are 100% under your control.

This *preserves* the anti-self-deception property (you can't fake a public repo to yourself) while removing the punishment for market conditions. Strictly better than v1.

### C4 — Attributes 5 → 6: **MOMENTUM** added

Career is now a core quest and had no attribute representation. Added MOMENTUM (application cadence × quality × follow-through). ENGINEERING now covers both SE-foundations mastery and AI shipping, with the split visible in its formula breakdown so the learn-vs-ship distinction survives.

### C5 — **"Day closed" replaces sleep XP weighting**

Sleep is 60 XP, not 75. Instead of pricing late nights, quests become **unavailable after 03:00** (sleep target 02:00 + 60 min grace) until the 04:00 rollover. Working past 03:00 earns nothing. That's a firmer constraint than an XP penalty, and it carries no shame.

### C6 — Level curve re-tuned: coefficient 62 → **84**

The new quest set has richer bonus sources (extra applications, office learning blocks, steps, maintenance). Re-tuned twice: first to 75, then to **84** once the uncapped weekly, boss and recovery grants were included in the simulation — they add ~13% to arc totals. Level 40 remains the arc terminus at 85% completion. Full table and simulation in `01 §3`.

### C7 — A **Moments** system, per your §29

You're right that v1 drifted toward a scientific dashboard. Added a defined set of six full-attention reveal moments with a specified motion and haptic language — restrained, monospace, one accent, no neon. Spec in `05`.

### C8 — **SE foundations** get a real home

OS · networking · databases · distributed systems · concurrency · backend · system design are now a first-class tracked domain (`FOUNDATIONS`) with mastery states and a `LEARN` XP category for 15-minute office blocks — without becoming a seventh core quest. This is where your 10:00–20:00 free periods land.

### C9 — Android-specific decisions locked

`beforeinstallprompt` install button · Vibration API for Moments haptics · Screen Wake Lock for the deep-work timer (Baseline 2025) · **Badging API is not supported on Android — do not implement it** (Android auto-badges from unread notifications instead). OS alarms remain the notification strategy; no push backend in V1.

---

## 4. The two things I want to flag directly

### 4.1 Your sleep window is 6.5 hours, and it is the binding constraint on everything else

02:00 → 08:30. The arc is optimising cognitive output — DSA first-attempt rate, agent architecture, system design — and those are precisely the functions most sensitive to short sleep. There is a real risk that months 2–4 quietly degrade the exact capability the arc exists to build, and that it looks like "I'm getting worse at hard problems" rather than "I'm under-slept."

I'm not going to moralise about it or refuse to build it. Two design responses instead:

1. **The Sleep quest measures consistency, not duration** — wake within ±30 min of 08:30. Regularity is the stronger predictor and it's the thing you can actually hold.
2. **The app computes and reports the correlation itself.** The daily report and every weekly review will show, from your own data: *"DSA first-attempt rate after a hit sleep window: N%. After a miss: M%."* By Day 30 you will have your own answer, in your own numbers, rather than my opinion.

If that correlation turns out to be strong, the Day-30 checkpoint offers a concrete amendment: move the BUILD block earlier (start 21:00, DSA after) or cap it at 02:00 hard. That decision should be yours, made on evidence.

### 4.2 280+ quality applications may not exist

3–8 per morning × 120 days = 360–960. There are unlikely to be that many genuinely relevant roles for your target profile, and forcing the number is exactly the gaming behaviour your §13 asks the system to detect.

So the CAREER quest completes on **3 quality applications OR 25 minutes of substitute career work** — resume iteration, follow-ups on open applications, a networking message, portfolio or write-up work. All controllable, all leverage-positive, none of it padding.

And the funnel does the quality policing: if response rate stays below ~5% across 40+ applications, the weekly review will tell you the problem is targeting or resume, not volume — and will stop asking for more applications until that's addressed.

---

## 5. Final six core quests — summary

| # | Quest | XP | Threshold (floor) | Category |
|---|---|---|---|---|
| 1 | **CAREER** | 100 | 3 quality applications, or 25 min substitute career work | CAREER |
| 2 | **DSA** | 100 | 1 problem logged, or 25 min | MIND |
| 3 | **BUILD** | 100 | 45 min AI/agentic work, mode tagged `LEARN` or `SHIP` | CRAFT |
| 4 | **TRAINING** | 100 | a logged session, or ≥ 8,000 steps | BODY |
| 5 | **SLEEP** | 60 | wake within ±30 min of 08:30 | SLEEP |
| 6 | **ATTENTION** | 40 | Digital Wellbeing total ≤ 60 min | ATTENTION |
| | **TOTAL** | **500** | | |

**Structure:** the four *engines* (Career, DSA, Build, Training) are 400 XP = 80% of a day. The two *guardrails* (Sleep, Attention) are 100 XP = 20%. That ratio is the product's thesis in one line: most of your score comes from the things that build the outcome; the rest protects your capacity to do them.

**Not core quests, and deliberately so:** SE foundations study (→ `LEARN` category, any time, feeds ENGINEERING) · system design (→ weekly quests + FOUNDATIONS tree) · fuel, bath, laundry (→ Maintenance, one row, 20 XP for all-done) · job-search outcomes (→ External panel, never scored).

---

## 6. Final product principles

Unchanged from v1 except **P8**, which is new and comes from your §29.

**P1** — The app is instrumentation, never the activity. Time in app is a cost. Target median 45 s/day.
**P2** — XP attaches only to volitional actions. Never to weight, body fat, recruiter calls, interviews, or offers.
**P3** — Every number shows its formula on tap, or it gets deleted.
**P4** — The floor is sacred; the ceiling is optional. Daily quests hold floors; weekly quests hold targets.
**P5** — No mechanic punishes rest, illness, or life.
**P6** — Level measures effort and accepts self-report. Rank measures evidence and does not.
**P7** — Design for the ending. Day 120 is an experience, not a shutdown.
**P8** — **Earned moments deserve weight.** Restraint is not the same as coldness. Six defined moments get real presence; everything else stays quiet so those six land.

---

## 7. Implementation order

`09-PHASE-0-PROMPT.md` is the prompt to paste into Claude Code in Antigravity IDE. It scaffolds the foundation **only** — architecture, tokens, routing, Dexie schema, event model, pure-engine boundary, test harnesses, PWA config, Android install verification — and then **stops** so you can verify on your phone before Slice 1 begins.

Do not let it build the application in one operation. The slice list is in `08`.
