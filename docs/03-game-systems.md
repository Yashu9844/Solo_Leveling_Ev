# 03 — Game Systems

Every mechanic here answers five questions before it is allowed to exist: **why does it exist / what behaviour does it encourage / how can it be abused / when does it appear / when does it disappear.** The audit table at the end of this document holds the answers; a mechanic with no good answer to any of the five was cut.

---

## 1. The two-currency spine

This is the most important structural decision in the product.

| | **XP → Level** | **Evidence → Rank** |
|---|---|---|
| Measures | Effort expended | Change achieved |
| Input source | Self-report | External artefacts and measurements |
| Trust level | Trusted (you have no reason to lie to yourself, but you might) | Verified |
| Cadence | Continuous, every action | Four times in the arc |
| Can it fall? | No — it's a historical ledger | No — but it can stall indefinitely |
| Purpose | Immediate reward, keeps you going | Honesty valve, prevents self-deception |

**They are deliberately non-convertible.** No amount of XP produces a rank. This is what makes "Level 80 with an unchanged life" impossible to *feel good about* — the app will display `LEVEL 38 · RANK D` and, on the profile screen, the sentence: *"Rank D. Advancement requires: 60 problems logged (you have 61 ✓), first-attempt rate ≥ 50% on mediums (you have 34% ✗), one shipped project (none ✗)."*

That sentence is the product.

---

## 2. XP economy

### 2.1 Principles

1. XP attaches only to **volitional actions**. Never to weight, body fat, offers, interview outcomes, or anything determined by other people or biology.
2. One honest full day = **500 XP**. This is the unit of account; everything else is calibrated against it.
3. There is a **hard daily cap of 700 XP** (1.4× a full day). You cannot grind.
4. XP is **never removed**. It is a ledger of work actually done; retracting it would be factually false and would induce shame without producing behaviour. Accountability lives in attributes (which fall) and rank (which stalls), not in clawbacks.
5. Every XP grant writes an immutable ledger row with its reason. Total XP is a *projection*, never a stored mutable counter. (See `07`.)

### 2.2 Core daily quests — 500 XP total

| Quest | XP | Category | Completion criterion |
|---|---|---|---|
| **DSA Block** | 100 | MIND | ≥ 25 min focused, or ≥ 1 problem attempted to completion |
| **Build Block** (AI/agent) | 100 | CRAFT | ≥ 25 min focused on the current project milestone |
| **Physical Training** | 100 | BODY | A logged session (gym, or the defined fallback on non-gym days) |
| **Sleep Window** | 75 | RECOVERY | Wake time within ±30 min of target |
| **Fuel** | 60 | FUEL | Ate to plan (plan includes 3 discretionary meals/week) |
| **Attention** | 65 | ATTENTION | OS-reported screen time on named apps ≤ cap |

Six quests, and that is the maximum. Adding a seventh core quest is a change request that must delete one first.

Note the weighting: the two deep-work blocks are worth 40% of the day between them, and the three lifestyle quests together are worth 40%. That ratio encodes the product thesis — deep work is the point, lifestyle is the scaffolding that makes deep work possible.

### 2.3 Bonus XP — capped, and deliberately unexciting

| Source | XP | Cap |
|---|---|---|
| Additional DSA problem (easy / medium / hard) | 15 / 25 / 40 | MIND category cap |
| Scheduled revisit completed successfully | 20 | MIND category cap |
| AI feature shipped (committed + tested) | 50 | CRAFT category cap |
| Project milestone completed | 100 | once per milestone, not repeatable |
| Weekly quest completed | 150–250 | granted on the day it completes |
| Recovery quest completed | 40 | max 1 per day |
| Boss cleared | 500 | 4 in the arc |

**Category daily caps:** MIND 200 · CRAFT 200 · BODY 150 · RECOVERY 75 · FUEL 60 · ATTENTION 65.
**Overall daily cap: 700**, which binds before the category caps sum (750).

Two things to notice. First, the maximum a "grinder" can extract over an honest full day is **+200 XP, 40%** — and to get it they have to do 40% more actual work, which is not gaming, that's just working. Second, the marginal problem is worth 25 XP against a 100 XP block: **the first unit of work in a category is worth 4× the second.** That is the anti-gaming design encoded directly in the economy. It says: breadth beats depth-grinding, and showing up in all six categories beats maxing one.

### 2.4 What deliberately earns zero XP

- Opening the app. Checking stats. Reading a message. Customising anything.
- Any body measurement, weight entry, or body-fat estimate.
- Completing the daily review. *(Rationale: XP for the review would incentivise reviewing over working, and would make the review a chore you do for points rather than a thing you do because it's useful. The review's reward is the report it produces.)*
- Streak maintenance itself. The streak is a status, not an income.

### 2.5 XP inflation

There is none, structurally: the daily cap is fixed for the whole arc, quest values never scale with level, and no multipliers exist. Total XP is therefore bounded by `700 × days`, and a Day-90 XP number is directly comparable to a Day-10 XP number. This is why random double-XP events are rejected — they would break exactly this property.

---

## 3. Level system

### 3.1 Curve

```
XP required to advance from level n:   req(n) = round₁₀( 200 + 62 · n^0.98 )
```

| From → To | XP needed | Cumulative to reach |
|---|---|---|
| 1 → 2 | 260 | — |
| 2 → 3 | 320 | 260 |
| 5 → 6 | 500 | 1,400 |
| 10 → 11 | 790 | 4,490 |
| 20 → 21 | 1,370 | 15,010 |
| 30 → 31 | 1,940 | 31,260 |
| 40 → 41 | 2,500 | 53,180 |
| 50 → 51 | 3,070 | 80,750 |

### 3.2 Simulated arc outcomes

Monte Carlo, 40 runs per condition, 120 days, bonus XP modelled:

| Core-quest completion rate | Avg XP/day | Total XP | Level @30 | @60 | @90 | **@120** |
|---|---|---|---|---|---|---|
| 50% | 284 | 34,136 | 14 | 21 | 26 | **31** |
| 60% | 333 | 39,945 | 16 | 23 | 29 | **34** |
| 70% | 383 | 45,941 | 17 | 25 | 31 | **36** |
| 85% | 456 | 54,710 | 19 | 27 | 34 | **40** |
| 95% | 506 | 60,733 | 20 | 29 | 36 | **42** |
| 100% | 533 | 63,916 | 20 | 30 | 37 | **44** |

**Days per level at 85% performance:** L1→5 ≈ 0.7 days each · L10→15 ≈ 1.9 · L20→25 ≈ 3.2 · L30→35 ≈ 4.4 · L35→40 ≈ 5.0.

**First week at perfect play:** Day 1 → L2, Day 2 → L4, Day 3 → L5, Day 5 → L7, Day 7 → L8.

### 3.3 Why these numbers

- **Level 40 is the arc's natural terminus**, not Level 100. Your brief asked whether 100 is right; it isn't. A 120-day arc reaching Level 100 requires either trivial levels (one per day, meaningless) or absurd XP inflation. Level 40 with 5 days per level at the end means the final levels are genuinely earned. It also leaves headroom: if you run a second arc, you continue from 40 rather than resetting.
- **Fast early ramp is deliberate** — endowed progress. Levelling up on Day 1 and again on Day 2 establishes the loop before motivation decays.
- **The 50%-vs-100% spread is only 31 vs 44 levels, and that is intentional.** Level is not the discriminator between a good arc and a mediocre one — Rank is. If Level punished mediocre performance hard, a bad fortnight would produce a visibly stalled bar and trigger abandonment. Level's job is to keep you moving; Rank's job is to tell the truth.
- **No level resets, no prestige, no soft caps.** All of those are retention mechanics for products that need users to stay for years.

### 3.4 Level-up experience

Under 2 seconds, non-blocking, dismissible by tapping anywhere. Shows: new level number, one line naming what specifically got you there ("Level 12. Reached on your 4th consecutive training day."), and any unlock. **No confetti, no sound by default, no full-screen takeover on the third level-up onward.** Escalating celebration for a routine event trains you to discount it.

### 3.5 Level unlocks

Unlocks are **feature reveals**, used to keep onboarding shallow — not rewards. This is a progressive-disclosure mechanism dressed as progression, and it directly serves the "90-second onboarding" requirement.

| Level | Unlocks | Why here |
|---|---|---|
| 1 | Core quests, home, evening review | The minimum viable product |
| 3 | Weekly quests | After 3 days you understand dailies |
| 5 | Attributes screen | Needs ~5 days of data to be non-noisy |
| 8 | Spaced revisit scheduling for DSA | First problems are due for revisit around here |
| 12 | Weekly review screen | ~2 weeks in, enough data for trends |
| 15 | Boss quests | You've proven the loop; now the stakes rise |
| 20 | Skill tree detail view | Deferred to V2 anyway |
| 25 | Arc projection / pace-vs-target | Enough history for a projection to be honest |

---

## 4. Rank system

**Your brief asked whether E→D→C→B→A→S is psychologically useful or just cosmetic. Under the obvious implementation — rank = f(level) — it is purely cosmetic and should be cut. Retied to evidence, it becomes the most important mechanic in the product.**

### 4.1 Rules

- Rank advances **only** at a checkpoint (Day 30 / 60 / 90 / 120), plus one early promotion at Day 14.
- Every gate requires **evidence entered from outside the app** — numbers you read off a scale, a repo URL, an application confirmation, a screen-time report, a problem log.
- Rank **never regresses**. Falling in rank would be a shame mechanic and would punish honest data entry, which is the last thing you want to discourage. It *stalls*, which is punishment enough and is informative rather than punitive.
- Missing a gate is **not a failure state**. The UI says: "Rank C requires 2 of 3 conditions. You have 1. Next checkpoint: Day 60." Then it lists exactly what's missing.
- **Rank is the only place the app is allowed to be blunt.**

### 4.2 The gates

| Rank | When | Requirements (all must hold unless stated) |
|---|---|---|
| **E** | Day 0 | Start. Everyone starts here. |
| **D** | Day 14 | MVD consistency ≥ 70% over 14 days. *Effort-only gate — early rank must be reachable, or the mechanic never establishes itself.* |
| **C** | Day 30+ | ① Core-quest completion ≥ 60% over trailing 28d ② ≥ 60 DSA problems logged ③ ≥ 12 training sessions ④ ≥ 1 AI feature committed to a repo |
| **B** | Day 60+ | ① Completion ≥ 65% ② ≥ 140 problems, **first-attempt rate ≥ 50% on mediums** ③ ≥ 28 sessions ④ 1 project deployed or publicly visible ⑤ Boss I cleared |
| **A** | Day 90+ | All of B, plus: ① ≥ 1 **external event** — interview taken, application confirmed, PR merged into a repo you don't own, talk given, or article published ② wake-time SD < 60 min over trailing 28d ③ ≥ 2 shipped projects with evaluation harnesses |
| **S** | Day 120 | All of A, plus the **arc goal**: an offer received, OR (interview-ready benchmark met AND ≥ 15 applications sent AND ≥ 3 interview loops entered) |

The A gate deliberately requires something **outside your unilateral control** — you can't grant yourself an interview. That's the point. It is the difference between a system that measures your effort and a system that measures your life.

### 4.3 Rank display

`LEVEL 27 · RANK C` in the status line. Tapping rank opens the gate checklist with ✓/✗ per condition and the days remaining to the next checkpoint. No decorative rank artwork, no rank-based theming — the rank's value is entirely informational and dressing it up would dilute that.

---

## 5. Attributes

**Cut from 7 to 5.** INTELLIGENCE, ENGINEERING, STRENGTH, DISCIPLINE, CONSISTENCY, FOCUS and CONFIDENCE contain at most 4–5 independent dimensions; DISCIPLINE / CONSISTENCY / FOCUS in particular would move together on nearly every input, which means they'd carry near-zero independent information while tripling the surface area you have to trust.

### 5.1 The five

All are **0–100, derived, non-editable, computed from a rolling 28-day window**, and every one shows its formula on tap.

| Attribute | Group | Formula (all terms clamped to [0,1], result × 100) |
|---|---|---|
| **DISCIPLINE** | Mind | `0.5·(MVD days/28) + 0.3·(sleep-window hits/28) + 0.2·(attention-cap hits/28)` |
| **DEPTH** | Mind | `min(1, mean_daily_deep_minutes/28d ÷ 75) × block_quality` where `block_quality = min(1, mean_block_length ÷ 40min)` |
| **PROBLEM SOLVING** | Mind | `0.45·min(1, weighted_problems_28d ÷ 60) + 0.35·first_attempt_rate_mediums + 0.20·revisit_success_rate` <br>weights: easy 1, medium 2, hard 3.5 |
| **CRAFT** | Craft | `0.4·min(1, active_build_days_28d ÷ 20) + 0.35·min(1, shipped_units_28d ÷ 6) + 0.25·eval_coverage` <br>shipped unit = a committed, tested feature |
| **VITALITY** | Body | `0.5·min(1, sessions_28d ÷ 16) + 0.5·(1 − min(1, wake_time_SD_minutes ÷ 90))` |

### 5.2 Design notes

**Why rolling windows instead of lifetime accumulators.** An accumulator only goes up, so it stops being informative after week 3 — it just tells you the arc is long. A 28-day window means a bad fortnight visibly moves the number, which is the accountability signal, and it *recovers* when you do, which is the hope signal. You asked whether attributes should decay. They should — but as a natural property of the window, never as a punitive "−5 DISCIPLINE" event. There is no decay animation and no loss notification.

Sensitivity, so you know what the number means: 0 missed days in 28 → ~100. 3 missed → ~89. 7 missed → ~75. 14 missed → ~50.

**Why non-editable.** The moment an attribute is editable it stops being a measurement and becomes a mood. Everything editable belongs in the profile, not in the attributes.

**Why formulas are shown.** Principle P3. A number you can't explain is a number you stop believing around Day 20, at which point it's worse than nothing — it's noise you've learned to ignore. Showing the formula also converts the attribute from a score into an *instruction*: "PROBLEM SOLVING is 62 because your first-attempt rate on mediums is 41%" tells you exactly what to do tomorrow.

**Explicitly not an attribute: CONFIDENCE.** It's measured separately and differently — see `04 §Self-efficacy`. Deriving confidence from task completion assumes the thing you actually want to test.

### 5.3 On the BODY / MIND / CAREER composite scores

**Recommendation: don't build them.** You'd have XP, Level, Rank, 5 attributes and 3 composites — four overlapping representations of one dataset, and the composites are the least informative of the four because averaging destroys the diagnostic value. "MIND SCORE 71" tells you nothing actionable; "PROBLEM SOLVING 62, DEPTH 80" tells you to fix your first-attempt rate.

Group the attributes visually under **BODY / MIND / CRAFT** headings on the profile screen. Same organising benefit, no extra arithmetic to distrust.

### 5.4 Measured metrics vs game attributes — the hard boundary

You were right to insist on this distinction. Implementation:

- They live in **separate tables** (`metric_sample` vs the attribute projection) and **separate screens**.
- Metrics are **raw, unweighted, timestamped, and shown as trends with error bands**. Weight is displayed as a 7-day rolling mean with the raw dots behind it, because a single reading is mostly water.
- **No metric is ever an input to XP.** Two metrics feed attributes — wake-time SD into VITALITY, and screen time into DISCIPLINE — because they're behavioural consistency measures, not body outcomes. Weight, body fat, and girths feed **nothing**. They are evidence only.

---

## 6. Quest system

### 6.1 Types

| Type | Count | Cadence | Generation | Purpose |
|---|---|---|---|---|
| **Core Daily** | 6 | Every day | Fixed at onboarding | The floor and the spine |
| **Weekly** | 2–3 | Monday–Sunday | Template + rules | Aggregate targets dailies can't express |
| **Adaptive Support** | 0–2 | As triggered | Rules engine | Respond to observed patterns |
| **Recovery** | 0–1 | After a miss | Rules engine | Re-entry path after a lapse |
| **Revisit** | 0–3 | Scheduled | Spaced-repetition algorithm | Retention, not throughput |
| **Main Quest** | 1 | The whole arc | Authored once | The reason the arc exists |
| **Boss** | 4 | Checkpoint-anchored | Fixed at onboarding | Consolidation and stakes |
| **Side** | unlimited | Ad hoc | You author | Autonomy valve; zero XP pressure |

### 6.2 Generation model — hybrid, and no AI

You suspected hybrid was right. It is. Concretely:

**Fixed** — the 6 core dailies. Never change during the arc without an explicit "amend the arc" action at a checkpoint. Stability is the whole value of a core quest; a core quest that changes weekly is a to-do list.

**Template-driven** — weeklies, from a small library instantiated with your current numbers:
```
"Solve {n} problems in {topic}"  where n = ceil(last_4wk_median × 1.1),
                                       topic = weakest topic by first-attempt rate
"Ship {n} features toward {milestone}"
"Complete {n} training sessions"
"Read and take notes on 1 paper or spec in {domain}"
```

**Rule-driven adaptive** — a small, readable, fully deterministic rule set. Examples of actual rules:

```
IF  dsa_completion(7d) < 0.5
AND completion_rate(morning_slot) > completion_rate(evening_slot) + 0.2
THEN propose: "Move DSA block to {morning_slot}" [schedule change, not a quest]

IF  category_completion(BODY, 7d) == 0
AND days_since_last_session >= 5
THEN generate quest: "Return session — 20 minutes, any modality" [reduced target]

IF  first_attempt_rate(topic, 14d) < 0.35 AND problems(topic,14d) >= 5
THEN generate quest: "Review {topic} fundamentals before new problems" [learning goal]

IF  consecutive_missed_days >= 2
THEN enter Reduced Mode: core quest set → MVD only, for 2 days.
```

**Why no LLM.** Every insight you described the AI coach producing — *"you completed DSA 11/14 days but missed it three times after gym days"* — is a `GROUP BY` over your own event log. Deterministic rules are more accurate than a model summarising the same table, run offline, cost nothing, are unit-testable, and never hallucinate a pattern that isn't there. The rules engine is maybe 200 lines. Build that. Revisit the question at Day 60 with real data about which rules fired and whether they helped.

### 6.3 Quest states

`LOCKED → AVAILABLE → IN_PROGRESS → COMPLETE`
                   ↘ `INCOMPLETE` (at day rollover) `→ RECOVERABLE (48h) → EXPIRED`

Note there is no `FAILED` state anywhere in the schema or the UI. `INCOMPLETE` is the terminal word.

### 6.4 Quest detail screen contents

Because this is where the intention→action conversion actually happens, the quest detail screen carries the highest-leverage content in the app:

1. **Your own if-then sentence**, verbatim, at the top.
2. **The 5-minute version**, as a primary button, not a fallback link.
3. **Your relevant history** — "you've done this 11 of the last 14 days" or "your last 3 graph problems were first-attempt."
4. XP value, small, at the bottom.

Note what's *not* there: no motivational quote. The quote goes on the home screen where it costs nothing; here, competence evidence outperforms it.

---

## 7. Failure and recovery

This is the subsystem most likely to determine whether the arc survives past Day 20.

### 7.1 The Minimum Viable Day

```
MVD  =  10 minutes of DSA or build work
     +  10 minutes of deliberate movement
     +  sleep time logged
```
Worth 35 XP — 7% of a full day. **Deliberately tiny.** The MVD protects your streak; it does not build your level. That asymmetry is the design: it removes any incentive to farm the floor while making the floor genuinely reachable on your worst day.

The MVD is the single most important mechanic in the failure system, because the streak that matters is the one attached to it.

### 7.2 Streaks — one, and it's on the floor

- **One streak: the Arc Streak**, counting consecutive MVD-or-better days.
- Displayed *smaller* than the 7-day and 28-day consistency percentages, which carry the real signal.
- **4 grace days per rolling 28**, applied **automatically** at rollover. Not a "streak freeze" item you have to remember to spend — requiring a user action to prevent a loss is a mechanic that generates anxiety on exactly the days you're least able to handle it.
- Grace consumption is reported neutrally in the weekly review: "3 of 4 grace days used this cycle." That's information, not a warning.
- No per-domain streaks (no DSA streak, no gym streak). Six streaks means six things to lose, six anxiety sources, and a strong pull toward compliance-over-substance.

### 7.3 The lapse flow

```
Day rollover, quest incomplete
  ↓
No notification fires. No red. Nothing is pushed at you.
  ↓
Next morning, home screen shows:
    "Yesterday: 4 of 6. DSA and Build incomplete."
    [ Recovery quest available — expires in 48h ]
  ↓
Recovery quest = today's version + the missed objective, worth 40 XP
  (deliberately less than the 100 XP you'd have earned by just doing it,
   so recovering is never better than not missing)
  ↓
One diagnostic tap, optional, 4 choices, no free text:
    ○ Ran out of time   ○ Too tired   ○ Wrong time of day   ○ Didn't want to
  ↓
That answer feeds the rules engine. Three "wrong time of day" answers
in 14 days triggers a schedule-change proposal at the weekly review.
```

### 7.4 Reduced Mode

Two consecutive missed days → the core quest set automatically collapses to MVD only for two days, with a plain statement: *"Reduced to the floor for two days. The arc continues."*

This targets the setback effect directly. The evidence says lapses are more damaging when interpreted as evidence about the self rather than the situation, and that responses to failure can be regulated to avoid the cascade. Reduced Mode makes the *system* absorb the lapse rather than making you white-knuckle back to a six-quest day you're not currently capable of.

Reduced Mode exits automatically after 2 successful MVD days.

### 7.5 Arc Pause

Illness, travel, family emergency, work crisis. Explicit, one tap, up to 7 days per arc. During a pause: no quests generate, streak is preserved, attribute windows exclude paused days, and the arc end date shifts. **No penalty of any kind.** Principle P5.

If a mechanic in this app ever punishes you for being ill, it's a bug and it gets removed.

### 7.6 Things this system deliberately does not do

- Does not delete XP.
- Does not reset the streak to 0 for a single miss.
- Does not send a notification about a missed quest. (A notification whose content is "you failed" is a shame delivery mechanism.)
- Does not use red, ever, for an incomplete quest. Incomplete is neutral grey.
- Does not use the words *failed*, *broken*, *lost*, *ruined*.

---

## 8. Achievements

**Eight in V1**, not fifty. Each one marks a genuine threshold and each is a *statement of accumulated fact*, not a sticker.

| Achievement | Trigger | Text shown |
|---|---|---|
| First Move | First quest completed | "Day 1 logged. The rest is repetition." |
| Two Weeks | 14 MVD-or-better days | "14 days. Past the point most attempts end." |
| Century | 100 problems logged | "100 problems. You have a sample size now." |
| Shipped | First feature committed + tested | "It exists outside your machine." |
| Return | Completed a recovery quest after a 2+ day gap | "You came back. That's the skill." |
| Regular | Wake-time SD < 45 min over 28 days | "Your body knows what time it is." |
| Under Pressure | First external interview or public ship | "You put it in front of someone else." |
| The Arc | Day 120 completed | "120 days. Read the report." |

Note "Return" — an achievement for **recovering from a lapse**, which is the behaviour most worth reinforcing and the one almost no habit app rewards.

**No achievement for perfect days, perfect weeks, or long streaks.** Those reward the exact perfectionism that produces the abandonment cascade.

### Identity unlocks

Separate from achievements, capped at 5 across the arc, and — per the evidence caveat in `02` — strictly **retrospective**:

| Identity | Earned at | Framing |
|---|---|---|
| Problem Solver | 100 problems, ≥ 45% first-attempt on mediums | "You have solved 100 problems. That is what a problem solver does." |
| Builder | 2 projects shipped publicly | — |
| Consistent | 60 MVD days in 90 | — |
| Someone Who Trains | 40 sessions | — |
| Someone Who Keeps Promises | 80% if-then plan firing rate over 60 days | — |

Never assigned aspirationally. Never revoked.

---

## 9. Boss quests

Four across the arc, anchored to the checkpoints. Bosses exist to create **consolidation moments** — a forced integration of scattered daily work into something whole — and to place a meaningful event inside the week 4–6 novelty trough.

| Boss | Window | Clear condition | Reward |
|---|---|---|---|
| **I — The Baseline** | Days 25–32 | 60 problems logged · 12 sessions · 1 feature committed · Day-30 checkpoint data entered | 500 XP, Rank C gate opens |
| **II — First Ship** | Days 55–65 | An agent project deployed publicly with a README and an evaluation harness | 500 XP, Rank B gate opens |
| **III — The Loop** | Days 85–95 | One complete external interview loop OR 15 applications + 2 mock interviews recorded | 500 XP, Rank A gate opens |
| **IV — The Arc** | Days 115–120 | Day-120 checkpoint completed and Before/After report generated | 500 XP, Rank S evaluated |

Bosses are **announced 7 days ahead** with a checklist showing exactly what's outstanding. No surprises, no timers, no "boss health bars." A boss can't be failed — the window simply passes and it re-opens at the next checkpoint.

**Boss III is deliberately outside your unilateral control.** You cannot schedule someone else's interview. This is the mechanic that connects the app to the world.

---

## 10. System events

**Cut from MVP.** Double XP Day, random events, surprise challenges — all rejected. Reasoning in `02 §Variable rewards`: they're a slot-machine mechanic, you explicitly said you don't want that, and multipliers destroy XP comparability across the arc.

What survives, for V2 at earliest: **scheduled, pre-announced Challenge Weeks** — a fixed theme (e.g. "Graphs Week: every DSA quest is a graph problem") with no XP multiplier. Variety without randomness, and it's known in advance so you can plan around it.

---

## 11. Rewards

Three tiers, and only one of them is in the app:

1. **Immediate (in-app, < 2s):** XP, bar movement, one line of specific competence feedback. This is the tier that matters — immediate rewards predict persistence.
2. **Milestone (in-app):** level-ups, achievements, identity unlocks, rank advancement.
3. **Real-world (you define, app only reminds):** at onboarding you write 4 rewards tied to the 4 bosses. The app stores the text and shows it when the boss clears. It does not gamify this, does not track whether you took it, and does not judge you.

**No cosmetic unlocks — no themes, no avatars, no profile decorations.** They generate exactly the "spending 30 minutes customising instead of doing DSA" failure mode you named in §48. A single theme, well-designed, ships with the app.

---

## 12. Anti-gaming — the full strategy

Threat model first. The adversary is you, at 11pm, tired, wanting the number to go up without doing the work.

| Attack | Defence |
|---|---|
| Grind trivial tasks for volume | Category caps + hard daily cap. First unit in a category worth 4× the second. |
| Log work not done | Cannot be prevented, and the app shouldn't pretend to. Countered at the **evidence layer**: rank gates require artefacts (repo URLs, first-attempt rates, external events). Lying to XP is easy and pointless; lying to Rank requires forging a GitHub repo. |
| Farm easy DSA problems | Difficulty-weighted (1 / 2 / 3.5) and PROBLEM SOLVING attribute is 35% first-attempt-rate on **mediums** — easy problems can't move it. |
| Farm the MVD floor | MVD = 35 XP, 7% of a day. Protects the streak, doesn't build the level. |
| Retroactively complete yesterday | Backfill allowed only within the 04:00 rollover grace, then locked. Later edits are possible but write an audit row and appear in the weekly review as "3 backdated entries." |
| Redefine quests to be easier | Core quests are locked between checkpoints. Amendments are allowed at checkpoints only and are recorded in the checkpoint snapshot, so the Day-120 report shows what you changed and when. |
| Split one session into many for bonuses | Deep-work XP requires a ≥ 25-minute contiguous block; DEPTH attribute multiplies by `mean_block_length / 40`, so fragmentation actively lowers the score. |
| Inflate screen-time compliance | Numeric entry from the OS report, not a yes/no. |
| Optimise the score instead of the life | Rank gates. The North Star is Deep Work Day Rate, not XP. The Day-120 report leads with real-world deltas and puts Level in a footnote. |

**Goodhart's law is the real threat here**, and the structural answer is that the app has *two* measures with different trust levels, and the prestigious one is the one that's expensive to fake. You can optimise XP all you like; XP is not the thing anyone, including you, will care about on 29 December.

---

## 13. Mechanic audit

Every mechanic, the five questions, and the verdict.

| Mechanic | Why it exists | Behaviour encouraged | Abuse vector | Appears | Disappears | Verdict |
|---|---|---|---|---|---|---|
| XP | Converts a 90-day reward into a 2-second one | Complete the action, log it | Volume grinding | Day 1 | Never | **Keep** |
| Level | Visible cumulative progress; endowed progress early | Persistence through low-motivation stretches | Feels good without real change | Day 1 | Never | **Keep**, but demoted below Rank |
| Rank | Truth valve against self-deception | Produce external evidence | Very hard to fake | Day 14 | Never | **Keep — highest value** |
| Attributes (5) | Diagnostic: *which* thing is weak | Fix the weak dimension | None significant (derived, non-editable) | L5 | Never | **Keep** |
| Body/Mind/Career scores | — | — | Averaging hides the diagnosis | — | — | **CUT** |
| Core dailies (6) | The spine | The six behaviours | Redefinition | Day 1 | Never | **Keep** |
| Weekly quests | Targets dailies can't express | Aggregate volume | Self-set too low | L3 | Never | **Keep** |
| Adaptive quests | Respond to observed patterns | Correct the specific failure | Ignorable | Day 7 | Never | **Keep, rules-based** |
| Arc Streak (1) | Loss aversion, one anchor | Never a zero-day | Floor-farming | Day 1 | Never | **Keep, floor-based** |
| Per-domain streaks | — | — | Six anxiety sources | — | — | **CUT** |
| Grace days | Absorbs the setback effect | Continuation after a lapse | Coasting on grace | Day 1 | Never | **Keep, auto-applied** |
| Recovery quests | Designed re-entry path | Return after lapse | Worth less than not missing | Day 2 | Never | **Keep** |
| Achievements (8) | Mark real thresholds | The threshold behaviours | Collecting for its own sake | Day 1 | Never | **Keep, 8 only** |
| Identity unlocks (5) | Habit↔identity association | Long-run persistence | Aspirational assignment | L8 | Never | **Keep, retrospective only** |
| Boss quests (4) | Consolidation + stakes in the novelty trough | Integration of scattered work | Deadline anxiety | L15 | Never | **Keep, 4 only** |
| Double XP / random events | — | — | Slot-machine schedule; breaks XP comparability | — | — | **CUT** |
| Cosmetic unlocks | — | — | Customisation replaces work | — | — | **CUT** |
| Leaderboards | — | — | No second user; comparison harm | — | — | **CUT** |
| XP penalties / loss | — | — | Shame without behaviour change | — | — | **CUT** |
| Level reset / prestige | — | — | Multi-year retention mechanic | — | — | **CUT** |
