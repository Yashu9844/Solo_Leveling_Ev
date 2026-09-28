# 01 — Quests, XP Economy, Level, Rank, Failure & Recovery

Every number here is reproduced by `xp-simulation.py`. If you change a constant, re-run it.

---

## 1. The six core quests — full definition

### 1.1 CAREER — 100 XP

```
Completes when EITHER:
  (a) >= 3 applications logged that pass the quality gate, OR
  (b) >= 25 min of substitute career work logged
      (resume iteration | follow-ups | networking message |
       portfolio work | write-up drafting | mock interview)

Quality gate for an application (all three required):
  - company + role recorded
  - a resume version selected (not "none")
  - a one-line "why this role" (>= 15 chars, not a duplicate
    of the previous application's line)

Bonus: +10 per additional quality application, max +40
Cue: 08:35, immediately after waking
```

**Anti-gaming (your §13):** the third condition is the real gate. Duplicate or empty "why" lines across applications on the same day earn 0 XP for that application and are flagged. Beyond 8 applications in a day, further applications earn 0 — the category cap of 140 binds anyway. And the funnel does the deeper policing: sustained response rate < 5% over 40+ applications stops the weekly review from asking for more volume and switches the ask to targeting and resume.

### 1.2 DSA — 100 XP

```
Completes when EITHER >= 1 problem logged to completion, OR >= 25 min logged
Bonus: +15 easy / +25 medium / +40 hard per additional problem
       +20 per successful scheduled revisit
Cue: 22:00, after training
Target (weekly quest, not daily): 3 problems / ~1 hour per day
```

### 1.3 BUILD — 100 XP

```
Completes at >= 45 min of AI/agentic work.
Mode is REQUIRED at log time:  [ LEARN ]  or  [ SHIP ]
Bonus: +50 per shipped unit (a committed, tested feature)
Cue: 23:00, after DSA
Target (weekly quest): 2-3 hours/day, and a learn:ship ratio <= 2:1
```

**The learn/ship distinction is enforced, not just recorded.** The ENGINEERING attribute weights SHIP evidence at 0.40 and mastery-from-learning at 0.35, and a rule fires when the 14-day learn:ship ratio exceeds 3:1:

> *"14 days, 11 learning sessions, 2 shipped units. Learning without shipping produces no evidence. This week's BUILD target is SHIP-only."*

### 1.4 TRAINING — 100 XP

```
Completes when EITHER a training session is logged, OR steps >= 8,000
Bonus: +20 at >= 10,000 steps
Cue: 20:15, on return to PG
```

Rest days count. A walk counts. This is a **movement** quest, not a gym quest — the alternative is a 4-gym-day schedule that manufactures 3 automatic failures per week.

### 1.5 SLEEP — 60 XP

```
Completes when wake time is within +/- 30 min of 08:30 (i.e. 08:00-09:00)
Logged next morning, one tap, defaults to the alarm time
```

Consistency, not duration. Sleep regularity is the stronger predictor and it is the thing you can actually control on a night that ran long.

**"Day closed" rule:** all quests become unavailable from **03:00** (sleep target 02:00 + 60 min grace) until the 04:00 rollover. Work after 03:00 earns nothing. This is the sleep incentive — a hard ceiling rather than a penalty, and it carries no shame.

### 1.6 ATTENTION — 40 XP

```
Completes when the number you enter from Android Digital Wellbeing
is <= 60 min for the named apps (set at onboarding)
Numeric entry only. No yes/no. No estimate.
```

Self-reported screen time is unreliable enough to be worthless as a measurement. One extra tap into Digital Wellbeing buys an order of magnitude more honesty.

### 1.7 Maintenance — 20 XP, one row, not a core quest

```
[ ] Bath           daily
[ ] Fuel to plan   daily (whey+eggs+idli / PG+egg / oats+egg+chapathi)
[ ] Laundry        every 3 days, only appears when due
    -> 20 XP when ALL of today's items are ticked. One tap. Category cap 20.
```

Not part of core-completion %. Cannot compete with the six. Present so the day feels complete, absent from every score that matters.

---

## 2. XP economy

### 2.1 Category caps

| Category | Daily cap | Sources |
|---|---|---|
| CAREER | 140 | quest 100 + up to 40 bonus applications |
| MIND | 200 | DSA 100 + extra problems + revisits |
| CRAFT | 200 | BUILD 100 + shipped units |
| BODY | 150 | TRAINING 100 + steps bonus |
| SLEEP | 60 | quest only |
| ATTENTION | 40 | quest only |
| LEARN | 75 | SE foundations blocks, 25 XP per 15 min, max 3/day |
| MAINT | 20 | all-done bonus |
| **Hard daily cap** | **700** | binds before the 885 sum of category caps |

### 2.1.1 Uncapped grants — `BONUS` and `BOSS`

Three grant types are **exempt from both category caps and the daily cap**:

| Grant | Category | Frequency limit (this is what constrains it) |
|---|---|---|
| Weekly quest payout | `BONUS` | once per weekly quest, per week |
| Recovery quest | `BONUS` | max 1 per day |
| Boss cleared | `BOSS` | once per boss, 4 in the arc |

**Why exempt:** each is *frequency*-limited rather than *volume*-limited, so it cannot be farmed. And capping them produces an absurdity — clearing a boss on an ordinary 555 XP day would silently discard 355 of the 500 XP, making the biggest moment in the arc feel like nothing.

Consequently `categoryCaps` in `engine/config.ts` is typed `Record<Exclude<XpCategory,'BONUS'|'BOSS'>, number>` — 8 entries, matching the table above exactly. Do not invent caps for `BONUS` or `BOSS`.

### 2.2 Verified behaviour (60 seeds × 120 days, simulated)

```
Daily XP at 85% completion:  min 280 · p25 485 · median 555 · p75 615 · max 700
Days hitting the 700 cap:    3 / 120     <- a ceiling, not a wall
Honest full core day:        500
Cap ratio:                   1.40x
First DSA unit vs second:    100 vs 25   = 4x
First application vs each extra: 100 vs 10 = 10x
MVD floor:                   35 XP = 7% of a day
```

The 4× and 10× ratios are the anti-gaming design encoded in the economy: **showing up across all six categories always beats grinding one.**

### 2.3 Zero XP, deliberately

Opening the app · checking any screen · completing the evening review · any body measurement (weight, waist, body fat) · any external outcome (recruiter call, interview, offer) · streak maintenance itself.

The review earns nothing because paying for reviews incentivises reviewing over working. Its reward is the report it produces.

---

## 3. Level system

```
req(n) = round₁₀( 200 + 84 · n^0.98 )
```

> **Revision note (31 Aug 2026).** The coefficient was 62 in v1 and 75 in the first final draft. Both were tuned on a simulation that **omitted the uncapped grants in §2.1.1** — weekly payouts, boss clears, recovery quests. Including them adds ~13% to arc totals and pushed the terminus to Level 43. **The coefficient is now 84**, restoring Level 40 at 85% completion. This is a one-line change in `engine/config.ts`; `level.ts` is not yet implemented, so nothing downstream is affected.

| From → To | XP | Cumulative to reach |
|---|---|---|
| 1 → 2 | 280 | — |
| 2 → 3 | 370 | 280 |
| 3 → 4 | 450 | 650 |
| 5 → 6 | 610 | 1,630 |
| 10 → 11 | 1,000 | 5,460 |
| 15 → 16 | 1,390 | 11,260 |
| 20 → 21 | 1,780 | 19,000 |
| 25 → 26 | 2,170 | 28,680 |
| 30 → 31 | 2,550 | 40,300 |
| 35 → 36 | 2,940 | 53,830 |
| 40 → 41 | 3,320 | 69,280 |
| 45 → 46 | 3,700 | 86,650 |
| 50 → 51 | 4,080 | 105,930 |

### Simulated arc outcomes

Monte Carlo, 60 runs per condition, 120 days, **including** capped bonuses and the uncapped weekly / boss / recovery grants:

| Core completion | XP/day | Total | L@30 | L@60 | L@90 | **L@120** |
|---|---|---|---|---|---|---|
| 50% | 363 | 43,574 | 14 | 21 | 26 | **31** |
| 60% | 430 | 51,657 | 16 | 23 | 29 | **34** |
| 70% | 500 | 60,044 | 17 | 25 | 31 | **37** |
| **85%** | **600** | **71,984** | **19** | **27** | **34** | **40** |
| 95% | 668 | 80,200 | 20 | 29 | 36 | **43** |
| 100% | 702 | 84,201 | 20 | 30 | 37 | **44** |

**Days per level at 85%:** L1→5 = 0.7 · L5→10 = 1.3 · L10→15 = 1.9 · L15→20 = 2.6 · L20→25 = 3.2 · L25→30 = 3.9 · L30→35 = 4.5 · L35→40 = 5.2.

**First week, core-complete daily (~555/day):** Day 1 → L2 · Day 2 → L4 · Day 3 → L5 · Day 5 → L6 · Day 7 → L8.

**Why Level 40 and not 100:** at 120 days, reaching 100 requires either one level per day (meaningless) or XP inflation. Level 40 with 5+ days per level at the end means the last levels are genuinely earned, and a second arc continues from 40 rather than resetting.

**Why the 50%–100% spread is only 31 → 44:** Level is not the discriminator between a good arc and a mediocre one. Rank is. If Level punished a bad fortnight hard, the visible stall would trigger abandonment at exactly the wrong moment.

### Level unlocks (progressive disclosure, not rewards)

| L | Unlocks |
|---|---|
| 1 | Six core quests, Today, evening review, Maintenance |
| 3 | Weekly quests |
| 5 | Attributes screen |
| 6 | Career funnel view |
| 8 | DSA spaced revisits |
| 10 | Skills screen (DSA topics · SE foundations · AI tiers) |
| 12 | Weekly review |
| 15 | Boss quests |
| 20 | Arc projection (pace vs target) |

---

## 4. Rank — the evidence system

**Level measures effort. Rank measures evidence. They are not convertible, and Level 30 with Rank D is a normal, intended, informative state.**

### 4.1 Rules

- Advances only at Day 14, 30, 60, 90, 120.
- Every gate requires evidence that is **externally verifiable but entirely within your control** — a public repo URL, a reachable deployment, a published write-up, a recorded mock, a logged count.
- **No gate anywhere references a recruiter response, interview, or offer.** Those are external outcomes and appear only in the Career Funnel.
- Never regresses. Stalls instead, which is informative rather than punitive.
- The Profile screen always shows the next gate as a ✓/✗ checklist. This is the app's most important sentence.

### 4.2 Gates

| Rank | Day | Requirements |
|---|---|---|
| **E** | 0 | Start |
| **D** | 14 | MVD consistency ≥ 70% over 14 days *(effort-only — early rank must be reachable)* |
| **C** | 30 | Core completion ≥ 60% (28d) · ≥ 55 problems · ≥ 12 training sessions · **≥ 1 AI feature committed to a public repo** · ≥ 70 quality applications · ≥ 3 SE foundation topics at Introduced |
| **B** | 60 | Completion ≥ 65% · ≥ 130 problems, first-attempt on mediums ≥ 50% · ≥ 28 sessions · **1 public project with README + eval suite** · ≥ 150 applications · resume v2 with ≥ 1 external review · ≥ 3 foundation topics at Fluent · Boss I cleared |
| **A** | 90 | Completion ≥ 65% · ≥ 200 problems, first-attempt M ≥ 60% · ≥ 42 sessions · **2 public projects, ≥ 1 deployed and reachable** · **≥ 1 published technical write-up** · ≥ 230 applications, follow-through ≥ 70% · ≥ 8 networking conversations · ≥ 2 recorded mocks · wake SD < 60 min · ≥ 5 foundation topics Fluent, ≥ 2 Retained · Bosses I–II cleared |
| **S** | 120 | All of A at the Day-120 thresholds in `00 §2` · **interview-ready benchmark passed** · 3 public projects with evals · 12 system designs studied / 4 written / 2 explained aloud · ≥ 280 applications · ≥ 4 mocks · Bosses I–IV cleared · arc data sealed and exported |

### 4.3 The display that does the work

```
LEVEL 31 · RANK C

Rank C → B requires 8 conditions. You meet 5.
  ✓ Completion 71%          ✓ 141 problems
  ✗ First-attempt M  46%    (need 50%)
  ✓ 31 sessions             ✗ Public project w/ eval suite  (0 of 1)
  ✓ 162 applications        ✗ Resume externally reviewed
  ✓ 4 foundation topics Fluent
Next checkpoint: Day 60 (11 days)
```

---

## 5. Attributes — six, derived, non-editable, 28-day rolling window

All 0–100. All show their formula on tap. All fall naturally as the window rolls; there is no decay event and no loss notification.

| Attribute | Group | Formula (terms clamped to [0,1], ×100) |
|---|---|---|
| **DISCIPLINE** | Mind | `0.40·(MVD days/28) + 0.35·(sleep hits/28) + 0.25·(attention hits/28)` |
| **DEPTH** | Mind | `min(1, mean_daily_deep_min ÷ 150) × min(1, mean_block_len ÷ 45)` |
| **PROBLEM SOLVING** | Mind | `0.45·min(1, weighted_problems_28d ÷ 110) + 0.35·first_attempt_rate_M + 0.20·revisit_success_rate`<br>weights: E 1 · M 2 · H 3.5 |
| **ENGINEERING** | Craft | `0.35·min(1, foundation_mastery_points ÷ 24) + 0.40·min(1, shipped_units_28d ÷ 6) + 0.25·eval_coverage`<br>mastery points: Introduced 1 · Applied 2 · Fluent 3 · Retained 4, summed over 9 topics (max 36) |
| **MOMENTUM** | Career | `0.40·min(1, applications_28d ÷ 70) + 0.35·quality_rate + 0.25·followthrough_rate`<br>quality = share passing the 3-condition gate; follow-through = share of apps ≥14d old followed up or closed |
| **VITALITY** | Body | `0.40·min(1, sessions_28d ÷ 16) + 0.30·min(1, mean_steps ÷ 8000) + 0.30·(1 − min(1, wake_SD_min ÷ 90))` |

**Window sensitivity:** 0 missed days in 28 → ~100 · 3 → ~89 · 7 → ~75 · 14 → ~50.

**No CONFIDENCE attribute.** Self-efficacy is measured separately as a 6-item task-specific instrument at each checkpoint (see `04`), because deriving confidence from task completion assumes what you'd want to test.

**No composite BODY/MIND/CAREER scores.** The six attributes are grouped visually under those headings; averaging them further would destroy the diagnostic value, which is the only value they have.

---

## 6. Streaks, failure and recovery

### 6.1 Minimum Viable Day — 35 XP

```
MVD = 10 min of DSA or BUILD
    + 10 min of movement (walk counts)
    + wake time logged
```

7% of a full day. **It protects the streak; it does not build the level.** That asymmetry is the whole design — the floor is genuinely reachable on your worst day and genuinely worthless as a farming strategy.

### 6.2 One streak, on the floor

- **Arc Streak** = consecutive MVD-or-better days.
- Displayed *smaller* than the 7-day and 28-day consistency percentages, which carry the real signal.
- **4 grace days per rolling 28, applied automatically at rollover.** Not a token you must remember to spend — requiring an action to prevent a loss creates anxiety on precisely the days you can least handle it.
- Grace use is reported neutrally in the weekly review: "2 of 4 grace days used this cycle."
- **No per-quest streaks.** Six streaks would be six things to lose.

### 6.3 Lapse flow

```
Rollover with quests incomplete
  → no notification, no red, nothing pushed
  → next morning: "Yesterday: 4 of 6. BUILD and ATTENTION incomplete."
  → [ Recovery quest · expires in 48h · +40 XP ]
       (worth less than the 100 you'd have earned, so recovering
        is never better than not missing)
  → one optional diagnostic tap, no free text:
       ○ Ran out of time  ○ Too tired  ○ Wrong time  ○ Didn't want to
  → 3× "wrong time" in 14 days → schedule-change proposal at the weekly review
```

### 6.4 Reduced Mode

Two consecutive missed days → the core set collapses to MVD only for two days:

> *"Reduced to the floor for two days. The arc continues."*

Exits automatically after 2 successful MVD days. This is the setback-effect countermeasure: the system absorbs the lapse instead of asking you to white-knuckle back to a six-quest day you're not currently capable of.

### 6.5 Arc Pause

Illness, travel, work crisis. One tap, up to 7 days. No quests generate, streak preserved, attribute windows exclude paused days, end date shifts. **Zero penalty.**

### 6.6 Never

No XP is ever removed · no streak resets on a single miss · no notification about a missed quest · no red on an incomplete quest · the words *failed*, *broken*, *lost*, *ruined* appear nowhere in the codebase or copy.

---

## 7. Boss quests — four real-world milestones

Announced 7 days ahead with a live checklist. Cannot be failed; a missed window reopens at the next checkpoint. 500 XP each.

| Boss | Window | Clear conditions |
|---|---|---|
| **I · FIRST EVIDENCE** | Days 25–35 | 55 problems · 12 sessions · 70 applications · **1 AI feature in a public repo with a README** · Day-30 checkpoint sealed |
| **II · STRONG ENGINEERING BASE** | Days 50–70 | OS · networking · databases · distributed systems · concurrency · backend each ≥ Applied · ≥ 3 at Fluent · 6 system designs studied, 2 written up |
| **III · AI ENGINEER** | Days 75–95 | An agent project: public repo · README · **eval suite with a golden set** · deployed and reachable · cost-per-task measured · technical write-up published |
| **IV · INTERVIEW READY** | Days 100–120 | 200+ problems, first-attempt M ≥ 60% · 8 topics Fluent + 3 Retained · 12 designs studied / 4 written / 2 explained aloud · resume v3 externally reviewed · 4 recorded mocks · **benchmark passed** · arc sealed |

Boss I lands squarely in the Days 28–45 novelty trough that the longitudinal gamification evidence predicts. That placement is deliberate: the counter to fading novelty is substance, not more novelty.

---

## 8. Achievements and identities

**8 achievements**, each a statement of accumulated fact:

| Achievement | Trigger |
|---|---|
| First Move | First quest completed |
| Two Weeks | 14 MVD-or-better days |
| Century | 100 problems logged |
| Shipped | First feature committed and tested in a public repo |
| **Return** | A recovery quest completed after a 2+ day gap |
| Regular | Wake SD < 45 min over 28 days |
| In Public | First deployment or published write-up |
| The Arc | Day 120 sealed |

"Return" rewards recovering from a lapse — the behaviour most worth reinforcing and the one almost no habit app rewards. **No achievement for perfect days, perfect weeks, or streak length.**

**5 identities**, strictly retrospective, never aspirational:

Problem Solver (100 problems, ≥ 45% first-attempt M) · Builder (2 public projects) · Consistent (60 MVD days in 90) · Someone Who Trains (40 sessions) · Someone Who Keeps Promises (80% if-then firing rate over 60 days).

---

## 9. Cut — and staying cut

Random XP multipliers · double-XP days · surprise rewards · loot · cosmetic unlocks · themes · avatars · leaderboards · social competition · XP penalties · level reset / prestige · per-quest streaks · composite BODY/MIND/CAREER scores · Badging API (unsupported on Android) · any LLM call in V1.
