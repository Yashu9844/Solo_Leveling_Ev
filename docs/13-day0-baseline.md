# 13 — Day 0 Baseline & Paper Protocol

**Use this on Sunday 31 August 2026 (baseline) and from Monday 1 September (daily log).**

The arc starts on schedule. The app arrives around Day 14. Everything here maps 1:1 to the schema in `07`, so the paper log imports cleanly.

**Practical suggestion:** keep it in a single spreadsheet or a plain notes file with the columns below. Don't build anything.

---

## Part 1 — Day 0 baseline (do this once, 31 August)

### Arc

```
Start date            2026-09-01
End date              2026-12-29        (120 days)
Timezone              Asia/Kolkata
Day rolls over at     04:00

Main quest (one sentence, dated, falsifiable):
  _______________________________________________________
  _______________________________________________________

Stake — what have you committed, to whom? (optional)
  _______________________________________________________

The one human who will see your checkpoint reports:
  _______________________________________________________
```

### Implementation intentions — the highest-value thing on this page

For each core quest: **time · place · the first physical action.** Be concrete. "Study more" is not a plan; "at 07:15, at my desk, open the editor before opening the browser" is.

```
DSA        "At ______ at __________________ I will _______________________"
BUILD      "At ______ at __________________ I will _______________________"
TRAINING   "At ______ at __________________ I will _______________________"
SLEEP      "At ______ I will _______________________________________________"
ATTENTION  "When I ____________________ I will ____________________________"
```

### Rhythm and thresholds

```
Wake target        ______      Sleep target        ______
Training days      M T W T F S S   (circle)
Screen-time cap    ______ min/day, on these apps: _______________________
Fuel plan          _____________________________________________________
                   Discretionary meals allowed per week: ____ (suggest 3)
Deep block minimum ______ min (suggest 25)
```

### Body baseline

```
Weight (morning, empty, same conditions)        ______ kg
Waist (navel, relaxed)                          ______ cm
One other girth (specify): ______               ______ cm
Body fat %, if you have a method (optional)     ______   method: ________

Estimated 1RM — top set weight × reps, three lifts:
  ____________  ______ kg × ____ reps   → e1RM ______
  ____________  ______ kg × ____ reps   → e1RM ______
  ____________  ______ kg × ____ reps   → e1RM ______
     (Epley: e1RM = w × (1 + reps/30))

Training experience    beginner / returning / intermediate / advanced
Current sessions/week  ______

Goal rate check: a safe target is ≤ 0.75% of bodyweight per week.
  0.75% of ______ kg = ______ kg/week × 17 weeks = ______ kg over the arc.
  My stated body goal for Day 120: __________________________________
```

### Career and skills baseline

```
Current role                    ______________________  YoE ______
Target role                     ______________________
Job-search status   not looking / passive / active / urgent

DSA problems solved, lifetime (honest estimate)      ______
Topics you'd call Fluent today: ________________________________________
Topics you'd call Retained today (still solid after a month away):
                                ________________________________________

AI/agent projects shipped publicly                    ______
Projects with an actual eval suite                    ______
Repos with a README a stranger could run              ______

Resume        none / outdated / current / tailored variants
Portfolio     none / repos only / with READMEs / with a site
Profile       none / outdated / current

Applications sent in the last 90 days                 ______
Interviews in the last 90 days                        ______
```

### Lifestyle baseline

```
Screen time, daily average — READ IT OFF THE PHONE, don't estimate
  (iOS: Settings → Screen Time. Android: Settings → Digital Wellbeing)
  Last 7 days average               ______ h ______ m
  Top 3 apps: ______________  ______________  ______________

Typical wake time over the last week (7 values, actual not intended):
  ___:___  ___:___  ___:___  ___:___  ___:___  ___:___  ___:___
  → mean ______   → standard deviation ______ min

Typical sleep time                  ______
Nights per week you eat off-plan    ______
```

### Instruments — answer honestly, don't optimise

**Self-efficacy (0–100).** How confident are you *right now* that you could:

```
1. Solve an unseen medium DSA problem in 25 min in front of an interviewer   ____
2. Explain your last project's architecture to a senior engineer for 10 min  ____
3. Design an evaluation suite for an agent from a blank file                 ____
4. Complete your planned training session on a day you don't feel like it    ____
5. Hold your wake time within 30 min for the next 14 days                    ____
6. Apply to 5 roles above your current level this week                       ____
                                                       COMPOSITE (mean) ____
```

**Automaticity (1–7).** "I do this without having to consciously remember or decide."

```
Waking at my target time  ____   Training  ____
Daily study               ____   Sleeping at my target time  ____
```

**Enjoyment (0–10).** "How much do I enjoy this, independent of its usefulness?"

```
DSA ____    Building/AI ____    Training ____
```

### The lapse plan — write this now, while you're calm

You will miss days. The plan you write on a good day is worth ten times the plan you'd write on a bad one.

```
When I miss a day, I will:
  1. Not do this: ______________________________________________
     (e.g. "not try to make it up by doubling tomorrow")
  2. Do this instead: __________________________________________
     (e.g. "hit the floor: 10 min study, 10 min walk, log sleep")

My Minimum Viable Day is:
  ______ min of study/build  +  ______ min of movement  +  log sleep

If I miss two days in a row, I will drop to the floor only, for two days,
and I will not treat that as a failure.                        signed ______
```

### Four boss rewards

```
Boss I  (Day ~30)  ______________________________________________
Boss II (Day ~60)  ______________________________________________
Boss III(Day ~90)  ______________________________________________
Boss IV (Day 120)  ______________________________________________
```

---

## Part 2 — Daily paper log (1 Sept onward)

One row per day. These columns import directly.

```
date       | dsa | bld | trn | slp | fue | att | wake  | sleep | scrn | energy | focus | blocker | note
2026-09-01 |  1  |  1  |  1  |  1  |  0  |  1  | 06:34 | 23:10 |  47  |   3    |   4   |  fuel   |
```

- `dsa bld trn slp fue att` — 1 = complete, 0 = not, **m = floor/minimum version**
- `scrn` — minutes, **read off the phone**
- `energy` / `focus` — 1–5
- `blocker` — `time` / `tired` / `wrongtime` / `didntwant` / `none`

### DSA problem log

```
date       | problem              | topic  | diff | outcome | min | insight
2026-09-01 | Course Schedule II   | graphs |  M   | hint    | 34  | topo sort via indegree
```
`outcome` ∈ `first` / `hint` / `editorial` / `unsolved`

**Manual revisit scheduling while on paper** — write the revisit date in a separate column:
```
first → +3 days (then +10, +30, +90)
hint → +3 days       editorial → +2 days       unsolved → +1 day
```

### Training log
```
date | type | min | rpe | lifts (name w×r)
```

### Weekly (Sunday, 5 minutes)
```
week | completion% | xp-ish | problems (E/M/H) | first-attempt M% | sessions
     | weight 7d mean | sleep-window hits | screen avg | bottleneck
     | next week's 3 targets
```

### Evidence log — every entry here is worth more than a week of XP
```
date | kind | detail | url
2026-09-14 | feature | tool-calling layer, 12 tests | github.com/...
2026-09-22 | eval    | 20-case golden set, 85% pass | github.com/...
2026-10-03 | applied | Company X, Senior BE         |
```

---

## Part 3 — The first week

Deliberately reduced. Days 1–7 target **the floor plus one deep block**, not six quests. Establishing that you show up at all beats a perfect week you can't repeat, and the level curve is designed to reward Day 1 and Day 2 anyway.

```
Day 1   MVD + one DSA block.        Do not try to hit all six.
Day 2   MVD + one DSA block.
Day 3   Add the build block.
Day 4   Add training.
Day 5   Add sleep window.
Day 6   Add fuel + attention. Full six for the first time.
Day 7   Full six. First weekly review. Write down what was hardest.
```

If Day 6 goes badly, you have learned something important about the quest set at a cost of one day, and you can adjust before it's locked in the app. That is worth more than a clean week.

---

## Part 4 — Checkpoint reminders

Set these four now, as repeating calendar events:

```
Wed 30 Sep 2026, 20:00   CHECKPOINT — Day 30
Fri 30 Oct 2026, 20:00   CHECKPOINT — Day 60
Sun 29 Nov 2026, 20:00   CHECKPOINT — Day 90
Tue 29 Dec 2026, 20:00   CHECKPOINT — Day 120 · Arc report
```

And the three daily alarms, labelled with your own if-then sentences:

```
06:45 daily   SYSTEM — read today's priority
07:15 daily   [your DSA if-then sentence, verbatim]
22:30 daily   Evening review — 25 seconds
```

Set them tonight. They're the mechanism, and they work whether or not the app exists yet.
