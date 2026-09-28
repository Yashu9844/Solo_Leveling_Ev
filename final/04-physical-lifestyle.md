# 04 — Physical, Fuel, Attention, Maintenance

---

## 1. Hard rules

1. **No XP for weight, waist, body fat, or any body measurement. Ever.** XP attaches to training sessions and steps — actions — never to outcomes.
2. **No invented body-fat number.** Yours is unknown; it stays unknown and optional until you have a method you trust. The field ships empty with a note about measurement error.
3. **All body metrics render as 7-day rolling means with raw points behind them.** A single reading is mostly water and glycogen.
4. **No training streak.** Rest is a training variable.
5. **The app never comments on the direction of a body metric.** It renders the trend. No "great progress," no "up this week." Editorialising on a noisy number is the mechanism by which tracking apps produce a bad relationship with the scale.
6. **No target line on the weight chart**, and no BMI anywhere.

---

## 2. Baseline

```
Height        178 cm
Weight         72 kg      (Day 0, 31 Aug 2026)
Body fat      unknown     — optional, deferred
BMI           not computed, not displayed
```

At 178 cm / 72 kg the honest read is that the productive objective is **recomposition and strength**, not weight loss. The arc's physical goal is stated accordingly: *better physique and physical performance*, measured by strength, training consistency, steps, and waist trend — with weight as context, not as a target.

### Realistic 120-day expectations (17 weeks)

| | Rate | Over the arc |
|---|---|---|
| Fat loss, if in a deficit | 0.5–1.0% BW/week is the *reasonable* band; > 1% costs lean mass | — |
| **Muscle gain** (the relevant one here) | beginner 1–1.5% BW/month · intermediate 0.5–0.75% · advanced 0.25–0.4% | intermediate ≈ **+2–3 kg** lean over 4 months |
| Strength | — | **+12% aggregate est. 1RM** is a demanding but achievable arc target |

Simultaneous fat loss and muscle gain is realistic for beginners and returning trainees, slow for trained lifters. The app sets bounds at Day 0 and then does not mention the target again except at checkpoints — targets shown daily become daily judgement.

**Guard:** if you enter a body goal implying > 0.75% BW/week of change, the app refuses it and explains why, once.

---

## 3. Training

### 3.1 The TRAINING quest — 100 XP

```
Completes on EITHER a logged session OR >= 8,000 steps
Bonus +20 at >= 10,000 steps
Cue 20:15, on return to PG
```

8,000 as the floor and 10,000 as the bonus is the floor-vs-target principle again: a walk on a rest day clears the quest, and the full 10k earns the bonus.

### 3.2 Session log — 10 seconds

```
┌────────────────────────────────┐
│  LOG SESSION               ✕   │
│  Type  [Push][Pull][Legs]      │
│        [Full][Conditioning]    │
│  Time  ─ [ 65 ] +  min         │
│  RPE   ○ ○ ○ ● ○  (1–10)       │
│                                 │
│  LIFTS (optional)               │
│  Squat     [ 90 ] kg × [ 6 ]    │
│                     e1RM 108    │
│  [ + add lift ]                 │
│                                 │
│        [ Log  +100 XP ]         │
└────────────────────────────────┘
```

**The app is not a workout programmer and will not become one.** It records what happened. Programming lives wherever it already lives for you.

### 3.3 Steps

Entered once daily as a number, from whatever your phone already counts (Google Fit / Samsung Health / the phone's own counter). No health-platform integration in V1 — that's permissions, sync, and an OAuth flow for a number you can type in three seconds.

Feeds VITALITY at 0.30 weight, 100-mark at 8,000 mean.

### 3.4 Strength — the honest progress signal

3–5 key lifts, top set weight × reps, est. 1RM via Epley (`w × (1 + reps/30)`).

Strength is the fitness metric that actually tracks training quality. It is far less noisy than weight, it cannot be gamed by dehydration, and it moves on a timescale where 120 days is genuinely visible. **It is the primary physical evidence in every checkpoint and rank gate.** Weight is context.

### 3.5 Body measurements

| Metric | Cadence | Display |
|---|---|---|
| Weight | daily if you like | 7-day rolling mean + raw dots |
| Waist | weekly | trend line |
| One other girth | monthly, optional | trend line |
| Body fat % | optional, deferred | shown with a stated error band, never in a score |

---

## 4. Fuel — demoted to Maintenance

Your baseline:

```
Morning     whey · 2 eggs · 2 idlis
Afternoon   PG food + 1 egg
Night       oats · 1 egg · chapathi if available
```

**Why it's no longer a core quest:** your meals are largely determined by PG catering. The daily variance under your control is small, which makes it a poor core quest — one you'd pass ~95% of the time carries almost no information, and it was already the lowest-XP quest in v1.

It becomes a Maintenance tick: **"Ate to plan."** One tap. The plan explicitly includes **3 discretionary meals per week**, pre-budgeted, so there is no all-or-nothing cliff to fall off.

**No calorie counting, no macro tracking, no nutrition claims.** If at a checkpoint the strength and weight trends say fuel is the constraint, the checkpoint report will say so and you can decide then whether to add tracking. Not before.

---

## 5. Attention — core quest, 40 XP

```
Completes when the number from Android Digital Wellbeing <= 60 min
for the named apps (chosen at onboarding)

Numeric entry only. Never yes/no. Never an estimate.
```

Self-reported screen time correlates only weakly with logged usage and is systematically biased. One extra tap into Digital Wellbeing is the difference between a measurement and a guess.

**Tracked:** total daily minutes · named-app minutes · 7-day and 28-day trend · days under cap.
**Not tracked:** which specific content. Not the app's business.

**Anti-anxiety design:** one bad day is invisible — nothing is flagged, no message, no red. The weekly review reports the *average* and the trend. A single 3-hour day inside a good week is noise, and the app treats it as noise.

---

## 6. Maintenance — one row, 20 XP, zero pressure

```
MAINTENANCE
[ ] Bath                    daily
[ ] Ate to plan             daily
[ ] Laundry                 every 3 days — only appears when due
                            → 20 XP when all of today's items are ticked
```

Explicitly excluded from core-completion %, from every attribute, and from every rank gate. It is present so the day feels closed, and absent from everything that matters. If it ever starts feeling like homework, delete the row — nothing downstream depends on it.

---

## 7. The physical section of the REALITY tab

```
BODY

WEIGHT      7-day mean
73.4 kg     ▲ 1.4 kg since Day 0
╌╌╌╌╌╌╌╌╌╌╌╌  trend + raw dots, no target line

STRENGTH    est. 1RM
Squat     108 kg   ▲ 13
Bench      78 kg   ▲  8
Deadlift  132 kg   ▲ 17
                   aggregate ▲ 13.8%

SESSIONS    47 in 89 days
▪▪▫▪▪▫▫▪▪▪▫▪▪▫▪▪▪▫▪▫▪▪

STEPS       8,940 daily mean   ▲ from 4,100
WAIST       81.5 cm  ▼ 1.5 cm
WAKE SD     38 min   ▼ from 71
```

No commentary. No emoji. No target lines. The numbers and their direction, and nothing else.
