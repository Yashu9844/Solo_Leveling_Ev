# 05 — Motivation, Moments, Notifications

---

## 1. Two content systems, different budgets

| | **System Message** | **Reflection** |
|---|---|---|
| Source | Generated from your event log at runtime | Authored, ~150 lines in a table |
| Content | Facts about your state | A framing |
| Example | "Three weeks ago this topic needed hints. Today: two first-attempt." | "The decision was made last night. This morning is execution." |
| Value | **High** — competence evidence | Moderate — texture |
| Frequency | Many per day | Max 1/day |

**Investment follows value: build the generator properly, keep the library small.** Most apps do the reverse, which is why their motivation reads like a fortune cookie. Your §19 says exactly this and it's right.

### 1.1 System Message generator

Deterministic templates, ranked by **specificity**; highest applicable wins.

```
P1  Personal record / first occurrence
    "First hard problem first-attempt."
    "Longest deep block yet: 84 minutes."
    "First deployment reachable from outside your machine."

P2  Trend with numbers
    "First-attempt on mediums: 58% over 14 days, up from 31%."
    "Graphs needed hints three weeks ago. Last two: unaided."
    "Wake SD down to 38 min. Four weeks ago: 71."

P3  Correlation from your own data
    "DSA first-attempt after a hit sleep window: 71%. After a miss: 44%."
    "Backend applications respond at 12.7%. Fullstack at 3.2%."

P4  Consistency fact
    "11 of the last 14 days had a deep block."

P5  Neutral status
    "4 of 6 complete."
```

Rules: one number-heavy sentence at a time · **never comment on a body metric's direction** · never compare to another person · never project forward (projections belong on Progress where they can show error bars) · never mention an external outcome negatively.

### 1.2 Reflection library — ~150 original lines

**12 categories:** discipline · focus · career · setbacks · consistency · self-efficacy · training · study · procrastination · courage · identity · long-horizon.

**5 tones:** direct · calm · challenging · reflective · celebratory.
*Cut from your 8:* **aggressive** (at 08:30 on a bad day it's the mechanism that turns this into a shame machine) and **urgent** (nothing in a 120-day arc is urgent today; manufactured urgency is dishonest). *Encouraging* folds into *calm*.

```ts
reflection {
  id, text, category, tone,
  context[],        // MORNING | PRE_DEEP | POST_COMPLETE | POST_LAPSE
                    // | EVENING | LEVEL_UP | BOSS | CHECKPOINT
  min_day, max_day, // Day-3 lines ≠ Day-90 lines
  cooldown_days,    // default 21
  times_shown, last_shown_at, weight
}
```

No `author`, no `source`, no `copyright_status` — everything is original. No `effectiveness` field: you can't measure it without an experiment you'll never run, and a fake score is worse than none. `weight` is your taste, honestly labelled.

**Selection:** cooldown respected · context must match · day range must bracket · **after a lapse, only `setbacks` category and only `calm`/`reflective` tone** · **if a P1/P2/P3 System Message is available, show that instead.** Evidence beats exhortation whenever evidence exists.

**Hard bans in the library and the generator:** nothing implying sleep is optional or rest is weakness · no "no days off" / "no excuses" · no body-shape or appearance claim · no comparison to other people · no negative identity claim ("you're being lazy") · no manufactured urgency · no guilt about the app itself · nothing negative about an external outcome.

**Calibration samples** (subject to your review before ship):

> *Morning:* "The decision was made last night. This morning is execution."
> *Pre-deep-work:* "Forty-five minutes. You can stop after that and it still counts."
> *Post-lapse:* "Yesterday is data, not a verdict. What's the first ten minutes today?"
> *Post-completion:* "Fourth time this week you did it when you didn't want to."
> *Evening, partial:* "Four of six. That's a day that happened, not a day that failed."
> *Career, low response rate:* "The applications are controllable. The replies aren't. Keep the first, stop scoring yourself on the second."

---

## 2. Moments — the satisfaction layer

Your §29 is correct: v1 drifted into scientific-dashboard territory. The fix is not more decoration everywhere — it's **six defined moments that get real weight, with everything else staying quiet so those six land.**

### 2.1 The six

| Moment | Trigger | Weight |
|---|---|---|
| **LEVEL UP** | Level increases | Full-screen, 700 ms |
| **BOSS CLEARED** | All boss conditions met | Full-screen, 1100 ms — the heaviest |
| **MASTERY** | A topic advances state | Card overlay, 600 ms |
| **EVIDENCE ACCEPTED** | A public artefact logged (repo, deploy, write-up) | Card overlay, 600 ms |
| **RANK ADVANCED** | A rank gate passes at a checkpoint | Full-screen, 1100 ms |
| **CHECKPOINT** | Checkpoint sealed with improvement | Sequence, self-paced |

### 2.2 Visual language

Monospace numerals · one accent (`#4DA3FF`) · deep near-black ground · thin rules · **no colour beyond the accent, no gradients, no particles, no glow, no sound by default.**

The drama comes from **negative space, scale, and timing** — a large number alone on a black field, a single accent rule sweeping once — not from effects. Think a well-made instrument acknowledging a threshold, not a game celebrating.

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│                                  │   │                                  │
│                                  │   │        BOSS CLEARED              │
│           LEVEL                  │   │                                  │
│         06 → 07                  │   │       AI ENGINEER                │
│                                  │   │                                  │
│    ────────────────────          │   │   ────────────────────           │
│    ENGINEERING  +1 MASTERY       │   │   EVIDENCE ACCEPTED              │
│                                  │   │   repo · evals · deployed        │
│    UNLOCKED · Career funnel      │   │   · write-up                     │
│                                  │   │                                  │
│                                  │   │   NEXT: PRODUCTION ARCHITECTURE  │
│      tap anywhere                │   │                                  │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

### 2.3 Motion and haptics

```
LEVEL UP        accent rule sweeps L→R 260ms
                → number cross-fades with a 6px rise, 240ms
                → unlock line fades in, 200ms   [total 700ms]
                haptic: navigator.vibrate([12, 40, 24])

BOSS / RANK     ground darkens 200ms → rule sweeps 300ms
                → title 250ms → evidence lines stagger 3×120ms
                → next-line 180ms              [total 1100ms]
                haptic: navigator.vibrate([18, 60, 18, 60, 40])

MASTERY /       card rises 12px + fades, 300ms; segment bar fills 300ms
EVIDENCE        haptic: navigator.vibrate(20)
```

Vibration API is supported on Android Chrome — one of the concrete benefits of the Android-first decision.

**Rules:** dismissible on any tap, always · never blocks input · **degrades after the third occurrence of the same type** (level-ups 4+ become an inline banner — escalating celebration for a routine event trains you to discount it) · `prefers-reduced-motion` disables all motion and haptics while keeping the content.

**Boss and Rank moments never degrade.** They happen four and five times in the arc; they earn full weight every time.

---

## 3. Notification strategy — Android

### 3.1 Platform reality

Even on Android, **reliable scheduled local notifications do not exist for a PWA.** The Notification Triggers API ran as a Chrome origin trial and never shipped, and there is no standardised replacement. Web Push works but needs a server, which V1 does not have. Periodic Background Sync is Chromium-only, gated on install and engagement heuristics, and not dependable for a fixed daily time.

### 3.2 The solution: OS alarms

Onboarding generates three reminders and walks you through adding them to your phone's Clock app (and offers a `.ics` download as an alternative). **The alarm labels are your own implementation-intention sentences**, verbatim:

```
08:35   "At my desk, before anything else: open the job board."
22:00   "At my desk: open the editor."          ← your DSA if-then sentence
23:30   "Evening review — 25 seconds."
```

Compared to a push stack: identical reliability, no server, no VAPID keys, no subscription lifecycle, works if the app is closed for a week, and ~2 hours of build instead of ~2 days. It cannot carry dynamic content — and the dynamic content belongs on the screen you're about to open.

A notification whose text is *your own if-then sentence*, delivered by a system alarm you can't swipe away on autopilot, is very likely more effective than a generic push.

### 3.3 In-app notifications

Only for immediate feedback while the app is open — Moments. Never for reminders.

**In-app catch-up nudge:** when you open the app and a cue time has passed with its quest incomplete, Today shows one quiet line: *"BUILD cue was 3 hours ago."* No push, no badge, no red.

### 3.4 Policy (applies to the alarms, and to push if it's ever added)

- **Hard cap: 3 scheduled per day.**
- **Escalation is downward only.** A slot ignored twice goes quiet and the weekly review asks whether to move or drop it. The inverse of what engagement-optimised apps do.
- **Never notify about:** a missed quest · a streak at risk · not having opened the app · anything in quiet hours (03:00–08:00).
- **Copy is specific:** "22:00 — DSA. Open the editor." Never "Time to be productive!"

Your §23 asks for no shame-based notifications. The design goes further: **there is no notification whose trigger is a failure.** Nothing bad happening can cause your phone to buzz.

### 3.5 Adaptive timing

A `GROUP BY`, not machine learning: bucket completions by hour, compare rates, and if one bucket beats another by > 20 points over ≥ 14 days, propose the change **at the weekly review**. The app observes; you decide. That preserves autonomy, which is what actually matters for motivation quality.

---

## 4. Morning experience

Five seconds to know what matters, then close.

```
┌─────────────────────────────────┐
│  DAY 22 · LEVEL 13 · RANK D     │
│                                  │
│  Today: applications at 08:35,   │  ← THE priority, one sentence
│  then DSA at 22:00.              │
│                                  │
│  ○ CAREER      3 applications    │
│  ○ DSA         1 problem / 25m   │
│  ○ BUILD       45 min            │
│  ○ TRAINING    session or 8k     │
│  ○ SLEEP       woke 08:42  ✓     │
│  ○ ATTENTION   ≤ 60 min          │
│                                  │
│  ─────────────────────────────   │
│  "The decision was made last     │
│   night. This morning is         │
│   execution."                     │
└─────────────────────────────────┘
```

Absent by design: XP bar (on Profile) · weekly progress · main-quest progress · attribute summary · quick-action grid · achievements · anything animated.

The priority line is computed: the highest-value quest that is most at risk given your completion history for that slot, or that is blocking a weekly quest.

---

## 5. Evening review — 25 seconds, 5 taps, no typing

```
┌─────────────────────────────────┐
│  DAY 22 · EVENING               │
│  Energy   ○ ○ ● ○ ○             │
│  Focus    ○ ● ○ ○ ○             │
│  What got in the way?            │
│  [Time][Tired][Wrong time]       │
│  [Didn't want to][Nothing]       │
│  Tomorrow's one priority:        │
│  [Career][DSA][Build][Train]     │
│  Slept at: [ 02:10 ▾ ]           │
│        [ Complete day ]          │
└─────────────────────────────────┘
```

Then the report — the actual reward for reviewing:

```
DAILY REPORT · DAY 22

XP                    555
Core quests         5 / 6
Arc streak       21 days
Deep work         2h 40m
Applications           4     (3 quality)
Problems               3     (1 first-attempt M)
Strongest       Career — 4th consecutive day
Weakest         Attention — 3 misses in 7

"DSA first-attempt after a hit sleep window: 71%.
 After a miss: 44%. Nineteen days of data."
```

**No free-text journalling in V1.** An empty text box at 23:30 is the most reliable way to make someone stop completing reviews. The only free text in the daily loop is the optional one-line DSA insight and the required "why this role" on applications.

---

## 6. Weekly review — 3 minutes, ends in decisions

```
SYSTEM EVALUATION · WEEK 4 (Days 22–28)

COMPLETION          74%  ▲ from 68%
XP                3,610
Deep work        16h 20m  ▲ 2h 10m
App time             52s/day    ✓ under 90s guardrail
──────────────────────────────────────
CAREER      22 applications (19 quality)  ·  6 follow-ups
            response rate 7.1% (11 of 154 lifetime)
DSA         17 problems (5E 10M 2H) · first-attempt M 52% ▲ from 44%
BUILD       6 sessions · learn:ship 4:2 ✓ · 2 features shipped
LEARN       9 blocks · OS → Applied, Networking → Introduced
TRAINING    4 sessions · steps 8,940/day
SLEEP       4/7 in window ▼ from 6/7
ATTENTION   6/7 under cap
──────────────────────────────────────
IMPROVED    Problem solving · Momentum
DECLINED    Discipline (sleep window)
BOTTLENECK  Sleep window

  Late on 3 nights, all 3 after BUILD ran past 02:30.
  Your DSA first-attempt rate after a missed window is
  27 points lower.

NEXT WEEK — proposed
  → Hard-stop BUILD at 01:45
  → Weekly quest: 18 problems, graph focus (31% first-attempt, weakest)
  → Weekly quest: ship P1 eval harness
  → Resume: you shipped 2 features. Does v2 say so?

        [ Accept ]        [ Adjust ]
```

Two buttons. Most weeks you accept in one tap. **The system proposes, you dispose** — you never author quests from scratch weekly, because that is the "app becomes the task" failure mode.
