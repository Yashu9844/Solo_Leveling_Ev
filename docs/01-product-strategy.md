# 01 — Product Strategy

## 1. Product Vision

**SYSTEM is a personal accountability instrument that makes difficult, high-leverage real-world actions feel immediately rewarding, and makes self-deception structurally impossible.**

It borrows the *grammar* of progression games — quests, XP, levels, ranks, attributes, bosses — because that grammar solves a specific psychological problem: long-horizon goals produce no feedback for months, and humans do not persist without feedback. It borrows none of the aesthetics, terminology, characters, or assets of any existing work.

The product is not trying to be enjoyable. It is trying to be *usable at 6:30am by someone who does not want to get up.*

## 2. Product Problem

The user has clear goals (better job, better body, better skills) and no clear problem with knowing *what* to do. The failure is entirely at the intention→action boundary, and it has four distinct sub-failures:

| Sub-problem | What it looks like | What actually fixes it |
|---|---|---|
| **Activation** | "I'll do DSA after dinner" → doesn't happen | Pre-committed if-then plan + a floor so low it's absurd to refuse |
| **Feedback latency** | Career improvement is invisible for 90 days | Immediate, same-session reward signal for the action itself |
| **Lapse cascade** | One missed day becomes four | A recovery path designed *before* the lapse, not after |
| **Self-deception** | Feeling productive without being productive | Periodic forced comparison against external evidence |

Note that only one of the four is solved by motivation content. Most habit apps solve only the feedback-latency problem (streaks, checkmarks) and are silent on the other three. That is the gap.

**Anti-problem — what this product is explicitly not for:** it is not a task manager, not a calendar, not a note-taking system, not a journal. It does not need to hold your errands.

## 3. Target User

**N = 1.** This is a single-user product for a specific person, and that is a design *advantage*, not a limitation. It means:

- No auth, no multi-tenancy, no account recovery, no GDPR surface, no server.
- Quest content can be hard-tuned to one person's actual schedule and skill level.
- The North Star metric can be a real-life outcome instead of a retention proxy.
- Anything that only exists to serve a hypothetical second user gets cut.

Design for one. If it later needs to serve others, the event-sourced data model (see `07`) makes that a migration, not a rewrite.

**User context that shapes the design:**
- Working software engineer with a day job → the arc must survive workdays, not assume free time.
- Mobile-primary usage, in short bursts, often one-handed, often tired.
- Technically sophisticated → the app can show its own formulas without being confusing, and *should*, because opaque numbers are distrusted numbers.
- Four-month fixed horizon → no need to design for year-3 retention. Design for 120 days of intensity followed by a deliberate, well-designed ending.

## 4. User Psychology — the specific person at the specific moment

The design should be argued from concrete moments, not from personas. Six moments define the product:

**M1 — 06:30, alarm, still in bed.**
Need: a single unambiguous instruction, zero decisions, zero scrolling. Anything requiring thought loses to going back to sleep.
Design: Home screen top line is a *sentence*, not a dashboard. "Today: DSA at 07:15. Everything else is bonus."

**M2 — 19:45, after work, tired, phone in hand, DSA scheduled.**
This is the moment the entire product exists for. Motivation is at its lowest and the task is at its hardest.
Design: the quest offers a **5-minute version** as a first-class option, not as a failure state. Behavioural activation logic — action precedes motivation, not the reverse. Starting is the whole battle; completion usually follows automatically once started.

**M3 — 23:10, missed two quests.**
Risk: shame → avoidance → tomorrow is worse.
Design: the review screen never uses the word "failed." It reports, offers a recovery quest, and asks one diagnostic question. Self-compassion framing, because the evidence says it increases subsequent effort rather than decreasing it.

**M4 — Day 9, first genuinely bad day (sick / work crisis / travel).**
Risk: the setback effect. Streak breaks, identity as "someone who does this" cracks.
Design: grace day auto-applies. Streak is on the floor, not the ceiling. The message is "arc continues," not "streak lost."

**M5 — Day 45, the novelty is gone.**
The longitudinal evidence says gamification effects dip around weeks 4–6 and then partially recover. The dip is predictable, so it should be *designed for* rather than discovered.
Design: Week 5–7 is when the first Boss resolves and the Day-30 checkpoint has just delivered hard evidence of change. Real progress data is scheduled to arrive exactly when the novelty runs out.

**M6 — Day 120, the end.**
Risk: arc ends, everything collapses, all gains lost.
Design: the arc has a designed ending — a Before/After report, and an explicit "what carries forward" decision where you choose which 2 behaviours become unmonitored defaults.

## 5. Behavioral Model

The model the product implements, in order of causal importance:

```
                    ┌─────────────────────────────────────────┐
                    │  CUE (time + place, pre-committed)      │  ← implementation intention
                    └────────────────┬────────────────────────┘
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │  FRICTION REDUCTION + TINY FLOOR        │  ← activation energy
                    │  "5 minutes counts"                     │
                    └────────────────┬────────────────────────┘
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │  ACTION                                  │
                    └────────────────┬────────────────────────┘
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │  IMMEDIATE REWARD (< 2 s)                │  ← immediate > delayed for persistence
                    │  XP, progress bar movement, one line     │
                    └────────────────┬────────────────────────┘
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │  COMPETENCE SIGNAL                       │  ← self-efficacy via mastery experience
                    │  "3rd hard problem this week"            │
                    └────────────────┬────────────────────────┘
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │  IDENTITY ACCUMULATION                   │  ← habit↔identity is bidirectional
                    │  "you are someone who does this"         │
                    └────────────────┬────────────────────────┘
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │  PERIODIC EVIDENCE RECONCILIATION        │  ← the anti-self-deception valve
                    │  Day 30 / 60 / 90 / 120                 │
                    └─────────────────────────────────────────┘
```

Two properties of this model matter:

- **The reward is immediate and the verification is delayed.** That is deliberate and it is the inverse of most productivity apps, which give delayed rewards ("see your yearly stats!") and no verification at all. Immediate rewards drive persistence; delayed verification prevents drift.
- **Nothing in the loop depends on feeling motivated.** Motivation appears nowhere in the causal chain. It is an output, not an input.

## 6. Core Product Loop

Three nested loops at three timescales.

### Daily loop — 45 seconds total, 5 touchpoints
```
morning brief (8s) → [do work] → log quest (10s) → [do work] → log quest (10s)
   → evening review (25s) → daily report shown → sleep
```
Design constraint: **any single interaction that exceeds 20 seconds is a bug.** Instrumented and reported in the weekly review as "app time" — see the guardrail metric below.

### Weekly loop — 3 minutes, Sunday evening
```
weekly evaluation → what moved / what declined / bottleneck named
   → next week's 3 adjusted quests auto-proposed → accept or edit → done
```
The system proposes. You accept. You do **not** author quests from scratch weekly — that is the "app becomes the task" failure mode.

### Checkpoint loop — 15 minutes, Days 30 / 60 / 90 / 120
```
enter real-world numbers → deltas computed vs Day 0 and vs last checkpoint
   → rank gate evaluated → immutable snapshot written
   → honest verdict rendered → arc plan adjusted for next 30 days
```

## 7. Product Principles

Seven principles. Every design decision in the rest of this report is traceable to one of them; where two conflict, the lower number wins.

**P1 — The app is instrumentation, never the activity.**
Time in app is a *cost*, not engagement. Every screen is judged by how fast you can leave it. There is no browsing, no feed, no infinite customisation.

**P2 — XP attaches only to volitional actions.**
Never to outcomes, never to measurements, never to things determined by biology, luck, or other people. Outcomes are evidence; actions are score.

**P3 — Numbers must be explainable in one sentence, or they get deleted.**
Every attribute, score and level shows its own formula on tap. An unexplainable number is a number you will stop trusting around Day 20, at which point it is worse than no number.

**P4 — The floor is sacred; the ceiling is optional.**
The system's job is to prevent zero-days, not to maximise perfect days. A 10-minute day is a win the system celebrates without irony, because the alternative was nothing and because the streak logic depends on the floor being reachable.

**P5 — No mechanic that punishes rest, illness, or life.**
Rest days are quests, not gaps. Sickness pauses the arc without penalty. Nothing in the system may create pressure toward sleep deprivation, overtraining, or eating restriction.

**P6 — Self-report earns XP. Only evidence earns Rank.**
The two currencies have different trust levels and must never be convertible.

**P7 — Design for the ending.**
Day 120 is a designed experience, not a shutdown. The arc concludes with a report, a verdict, and a deliberate decision about what continues unmonitored.

## 8. North Star Metric

**Proposed NSM: `Deep Work Day Rate` — the percentage of the trailing 28 days on which at least one Deep Block (≥ 40 minutes of focused DSA or AI build work) was completed.**

Why this and not your suggested "percentage of days where the user completes their highest-impact quests":

- Yours is close, but "highest-impact quests" is plural and includes gym, sleep and diet, which are *supporting* behaviours. They matter, but they are not the mechanism by which your career changes. A 4-month arc that produces perfect sleep and no shipped code has failed at its stated purpose. The NSM should point at the bottleneck, and the bottleneck is deep technical work.
- It's a **leading** indicator that is tightly coupled to the lagging outcomes (problems solved, projects shipped, interview performance).
- It's **hard to game**: you cannot fake 40 minutes of focus to yourself in a way that produces the downstream artifacts, and the metric requires only one such block, so there's no incentive to inflate.
- It's **robust to bad days**: one block, not six quests.

**Guardrail metric: `Median daily app time`. Target < 90 seconds. Alarm at > 4 minutes.**
If the NSM rises while app time rises past the alarm threshold, the product is becoming the task and is failing regardless of what the NSM says. This pairing is the numerical expression of §48 of your brief and of principle P1.

**Truth metrics (checked at checkpoints only, never daily):** DSA first-attempt success rate on mediums; public repos shipped with evaluation harnesses; training sessions completed; wake-time standard deviation; external career events (applications sent, interviews taken).

**Explicitly rejected as metrics:** daily active use, session count, session length, streak length, total XP, level. All of these go *up* when the product gets worse. They are diagnostics at best, and at worst they are the exact metrics that turn a tool into a slot machine.

## 9. Product Philosophy

The product should read as a **flight instrument panel operated by a mentor who respects you**, not as a game trying to retain you.

| It should feel like | It must never feel like |
|---|---|
| A briefing | A notification stream |
| A logbook | A diary you owe entries to |
| An honest scoreboard | A leaderboard |
| A coach who tells you the truth | A cheerleader |
| Mission control | A nagging parent |
| A well-made tool | A casino |

Concretely, this means the app's voice is **declarative and specific**, never exclamatory and never generic. It says "Third hard problem this week. Your first-attempt rate on graphs is now 58%, up from 31%." It does not say "Amazing work, keep it up! 🎉"

The tone test: *would this sentence be acceptable coming from a senior engineer you respect who reviewed your week?* If it reads as flattery, it's cut.
