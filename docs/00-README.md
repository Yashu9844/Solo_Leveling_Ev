# SYSTEM — Product Discovery Report

**Working codename:** SYSTEM (placeholder — see §12 Open Questions)
**Author:** Product discovery pass, 30 Aug 2026
**Status:** Pre-implementation. No code written yet, by design.
**Pilot:** Yashavanth R Siddesh — 4-month Winter Arc, 01 Sep 2026 → 29 Dec 2026 (120 days)

---

## How to read these documents

| File | What it settles |
|---|---|
| `00-README.md` | This page. Executive summary, the disagreements, the final recommendation. |
| `01-product-strategy.md` | Vision, problem, user, principles, core loop, North Star metric. |
| `02-behavioral-evidence.md` | The research base. Every concept graded by evidence strength, with a build/skip decision. |
| `03-game-systems.md` | XP economy, levels, ranks, attributes, quests, failure/recovery, achievements, anti-gaming. All formulas. |
| `04-domain-systems.md` | Career, DSA, AI engineering, fitness, self-efficacy. Skill model and real-world evidence tracking. |
| `05-motivation-and-messaging.md` | System messages vs quotes, the message selection engine, notification strategy. |
| `06-ux-and-wireframes.md` | UX principles, design system, navigation, textual wireframes for all screens. |
| `07-data-model.md` | Schema, event ledger, timezone handling, integrity guarantees. |
| `08-architecture-and-pwa.md` | Stack, offline strategy, service worker, notification reality check, privacy. |
| `09-mvp-and-roadmap.md` | MVP scope, cut list, development slices, testing strategy. |
| `10-risks-and-failure-modes.md` | How this app could hurt you, and the design controls for each. |
| `11-experiment-protocol.md` | The Day-0 → Day-120 measurement framework. Before/after report design. |
| `12-open-questions.md` | Decisions I need from you before Phase 3. |
| `13-day0-baseline.md` | **Use this on 1 September.** Paper protocol that maps 1:1 to the app schema. |

---

## Executive summary

You asked for a leveling system. What you actually need is a **commitment and evidence system with a game surface on top**. The game part is easy and mostly solved; the hard part is making the numbers refuse to lie to you.

The central design problem you correctly identified — *"the app should not allow me to become Level 80 while my actual life is unchanged"* — is not solved by tracking real-world metrics alongside game metrics. Showing both side by side just lets you look at the flattering one. It is solved structurally, by making the prestige currency **unobtainable without external evidence**.

That is the core architectural decision in this report:

> **Level measures effort. Rank measures evidence. They are computed from different inputs and they can diverge.**

XP and Level come from actions you control and self-report. They go up when you work. Fine.
**Rank does not accept self-report.** Rank advances only at four checkpoints (Day 30/60/90/120) and only when you enter real numbers that came from outside the app — problems solved with first-attempt success rates, a repo URL, an interview date, a scale reading, an application confirmation. If you are Level 35 with no evidence, the app tells you: **Rank D. Evidence required.** That sentence is the entire product.

Everything else in this report serves that spine.

---

## Where I disagree with your brief

You asked me to challenge you. Twelve places I would change the design. Full reasoning in the linked docs.

### 1. Cut "thousands of motivational quotes" to about 150 original messages
A large quote database is the lowest-leverage feature you described, and it carries copyright risk. Motivational text is not what converts *"I don't feel like doing DSA"* into opening the editor — an if-then plan attached to a specific time and place is (Gollwitzer & Sheeran's meta-analysis, d ≈ 0.65, across 94 studies). Quotes are decoration on top of a mechanism. Build the mechanism. Write ~150 original lines you actually endorse, with cooldowns. → `05`

### 2. Ranks E→D→C→B→A→S are cosmetic *if tied to XP*. Retie them to evidence.
Your instinct that ranks might be "just cosmetic" is right under the obvious implementation. Made evidence-gated, they become the most valuable mechanic in the product. → `03 §Rank`

### 3. Never grant XP for body weight, body fat, or any outcome you don't directly control
XP must attach only to volitional actions. Attaching XP to a scale reading creates a direct incentive toward restriction and dehydration on weigh-in day, and punishes you for water weight and glycogen. Weight is tracked as *evidence*, on a 7-day rolling trend, never as score. This is non-negotiable in my recommendation. → `03`, `10`

### 4. Seven attributes is too many. Use five, make them derived, and let them fall.
INTELLIGENCE / ENGINEERING / STRENGTH / DISCIPLINE / CONSISTENCY / FOCUS / CONFIDENCE overlap heavily — DISCIPLINE, CONSISTENCY and FOCUS would move together on nearly every input, which means they carry almost no independent information. Five attributes, each computed from a rolling 28-day window with a published formula, none editable. The rolling window gives you decay for free without a punitive "you lost points" event. → `03 §Attributes`

### 5. Drop the separate BODY / MIND / CAREER scores
You'd then have XP, Level, Rank, 5 attributes, *and* 3 composite scores — four overlapping representations of the same underlying data. Group the five attributes visually under Body / Mind / Craft headings instead. Same information, no extra arithmetic to distrust. → `03`

### 6. One streak, and it protects a floor — not a perfect day
The evidence on streaks is genuinely mixed. They exploit loss aversion effectively, and they also produce the setback effect where a single lapse triggers disproportionate abandonment. The resolution: the streak tracks **Minimum Viable Days**, a floor so low (10 min of study + 10 min of movement + logging sleep) that you can clear it on your worst day. Consistency percentages (7-day, 28-day) carry the real signal. Plus 4 auto-applied grace days per 28. → `03 §Failure`

### 7. Reframe "No junk food" — prohibition goals break badly
Inhibitional goals are the classic trigger for the what-the-hell effect: one biscuit, and the day is "ruined," so you may as well. Replace with an approach goal that has an allowance built in: **"Ate to plan"** where the plan explicitly includes 3 discretionary meals per week. You cannot blow a budget you were given. → `03`, `10`

### 8. Self-reported social media time is close to worthless as a measurement
The logged-vs-self-reported discrepancy literature is damning — self-estimates correlate weakly with actual usage and are systematically biased. Don't ask "did you stay under an hour?" Ask you to open your phone's own Screen Time / Digital Wellbeing screen and type in the number it shows. One extra tap, an order of magnitude more honest. → `04`

### 9. No AI in V1. Not one call.
Everything you described the "AI coach" doing — *"you completed DSA 11/14 days but missed it three times after gym days"* — is a `GROUP BY`. It is deterministic statistics over your own event log, it runs offline, it costs nothing, it can be unit-tested, and it will be more accurate than an LLM summarising the same table. Build the rules engine. If after 60 days the rules feel insufficient, *then* consider a model. → `08`, `09`

### 10. Cut Double XP days and random events entirely
Variable-ratio reinforcement is the mechanic that makes slot machines work. You explicitly said you don't want a dopamine casino. Random XP multipliers also destroy XP as a unit of account — a 2× day makes your own historical numbers incomparable. Scheduled challenge weeks (fixed, known in advance, no multiplier) give you the variety without the pathology. → `03`, `10`

### 11. Your onboarding as specified would take 30+ minutes and you'd abandon it
You listed roughly 40 profile fields before Day 1. Target **90 seconds** to first quest completion. Ask for: name, arc dates, wake/sleep targets, gym days, and your one main quest. Everything else is progressive disclosure — asked at the moment it first becomes useful, or at the Day-30 checkpoint. → `06`, `09`

### 12. The home screen you sketched has about twice as much on it as it should
System status, day, level, rank, XP bar, today's quests, main quest progress, today's priority, system message, quick actions — that is nine regions. On a phone, before coffee. Cut to three: one status line, the quest list, one primary action. → `06`

**Two things in your brief I think are excellent and would keep exactly as stated:** the insistence that the app must not become the productivity task (§48), and the demand that the system show real-world progression alongside game progression (§18). Both are load-bearing and both are unusual for someone to think of before building.

---

## The recommended product, in one page

**What it is:** A single-user, offline-first PWA. No account, no server, no cloud. All data in IndexedDB on your phone, with a one-tap encrypted JSON export you are nudged to take weekly.

**The daily loop (target: 45 seconds of app time per day):**
```
06:30  Native phone alarm fires (not a PWA notification — see 08)
       You open SYSTEM. Home screen shows Day 12 · Level 8 · Rank D
       and six quests. One line of text tells you today's priority.
       You read it. You close the app. Elapsed: 8 seconds.

07:15  You do the DSA block. You do it because at onboarding you wrote
       "At 07:15, at my desk, I will open my editor before opening
       anything else" and the app showed you that sentence at 07:14.

07:55  You open the app, tap DSA, log: 2 problems, 1 medium first-try,
       1 hard with a hint. +140 XP. Elapsed: 15 seconds.

...    Repeats for train / build / fuel / attention.

22:30  Evening review. Five taps: energy, focus, what broke, tomorrow's
       one priority, sleep time. Daily report appears. Elapsed: 25 seconds.
```

**The weekly loop:** Sunday. One screen. What moved, what declined, what the bottleneck is, and three concretely adjusted quests for next week — generated by rules, not by you fiddling with settings.

**The checkpoint loop:** Day 30, 60, 90, 120. This is where the app gets serious. You enter real numbers. The app compares them to Day 0, computes deltas, decides whether Rank advances, and writes an immutable snapshot. It will tell you if you have been busy without improving.

**Success criterion, restated as a testable claim:**
> On 29 December 2026, the Day-120 report shows: ≥ 250 DSA problems logged with a ≥ 65% first-attempt rate on mediums, ≥ 2 AI agent projects shipped to public repos with evals, ≥ 55 training sessions, wake-time standard deviation < 45 minutes, and ≥ 1 completed external interview loop. If those are true, the system worked. If Level is 40 and those are not true, the system failed, and the app should say so in plain language.

---

## What happens next

1. You read this, and answer `12-open-questions.md` — there are 9 questions, 4 of them block architecture.
2. **On 1 September you start the arc on paper** using `13-day0-baseline.md`. Do not wait for software. The arc is the point; the app is instrumentation.
3. I build V1 in the slices defined in `09`, one at a time, each one built → run → tested → verified → checkpointed before the next begins.
4. Around Day 14 you migrate the paper log in via a CSV import built for exactly that purpose.
5. Day 30 is the first real test of the product, not of you.
