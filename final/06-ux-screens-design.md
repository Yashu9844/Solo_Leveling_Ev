# 06 — UX, Navigation, V1 Screens, Wireframes, Design System

---

## 1. UX principles

**U1** — Time-to-leave is the primary UX metric. Median session 45 s. Any single interaction over 20 s is a bug.
**U2** — One primary action per screen.
**U3** — Thumb zone or nothing. Primary actions in the bottom third; top third is read-only.
**U4** — No typing in the daily loop, except the one-line "why this role" and the optional DSA insight.
**U5** — Progressive disclosure via level unlocks. Onboarding is 90 s because most of the app doesn't exist yet at Level 1.
**U6** — Every completion is undoable for the rest of the day; every undo writes an audit event.
**U7** — Offline is the default, not a degraded mode. No spinners, no sync state, no network indicator — there is no network.
**U8** — Six moments get real weight. Everything else stays quiet.

---

## 2. Navigation — 4 tabs

```
┌───────┬──────────┬────────┬─────────┐
│ TODAY │ PROGRESS │ SKILLS │ PROFILE │
└───────┴──────────┴────────┴─────────┘
```

| Tab | Contents | Unlocked |
|---|---|---|
| **TODAY** | Core quests, weekly quests, revisits, maintenance, priority line, reflection, evening review entry | L1 |
| **PROGRESS** | `SYSTEM` sub-tab (level, XP, rank, attributes, streak) · `REALITY` sub-tab (career funnel, DSA, body, lifestyle) · weekly review · checkpoints | L1 (REALITY default from Day 30) |
| **SKILLS** | DSA topics · SE foundations · AI tiers · career tree | L10 |
| **PROFILE** | Level/rank + gate checklist, attributes, achievements, identities, metrics entry, **data safety**, settings, export | L1 |

Three tabs until L10. SKILLS is separate from PROGRESS because "what should I work on" is a different intent from "how did it go," and merging them buries the first.

---

## 3. V1 screen list — 12, not 21

Your §32 is right: don't build 21 screens because the brief listed 21.

| # | Screen | Why it's in V1 |
|---|---|---|
| 1 | **Onboarding** (6 steps) | Can't start without it |
| 2 | **Today** | The core loop |
| 3 | **Quest sheet** (one component, 6 variants) | Completion + if-then + 5-min version |
| 4 | **DSA log sheet** | Highest-frequency logging |
| 5 | **Career log sheet** | Application entry + quality gate |
| 6 | **Training log sheet** | Session + steps + lifts |
| 7 | **Learning block sheet** | SE foundations, 4-second entry |
| 8 | **Evening review + daily report** | Where the correlations surface |
| 9 | **Weekly review** | The screen that redirects the week |
| 10 | **Progress** (SYSTEM / REALITY) | Game vs real, never merged |
| 11 | **Skills** | DSA · foundations · AI tiers, flat lists |
| 12 | **Profile** (+ settings, data safety, export) | Rank gates, attributes, backup |
| 13 | **Checkpoint** (entry → report) | The most important screen in the product |

Plus the **Moments overlay** — not a screen, a layer.

**Cut from V1:** interactive skill-tree graph (flat lists carry the same information) · career tree visualisation · achievement gallery (a list on Profile suffices) · reflection editor (delete-only; edit the seed file) · separate notification-settings screen (3 fields inside Settings — **superseded**: the redesign builds a full settings layer at `/profile/settings`, per `design/03-SETTINGS-AND-THEMING.md`) · separate attributes screen (inline expansion on Profile) · body-measurement detail screen (inside REALITY).

---

## 4. Design system

> **Superseded by `design/00-DESIGN-SYSTEM.md` (2026-09).** The token names and
> values below are v1. The redesign replaced them with a three-layer system —
> structural tokens, five themes keyed off `[data-theme]`, then user modifiers for
> text scale, density, motion and art — living in `src/ui/tokens.css`. The intent of
> this section is unchanged and every rule in it still holds; only the names moved.
> §4.1's `--bg / --border / --text / --text-dim / --text-faint / --accent-dim` were
> kept as aliases through the migration and deleted in task 12.5.
>
> **§4.1's "dark-only" line is overruled.** The user asked for a fully configurable
> appearance layer. There are five themes now, one of them light. The reasoning that
> produced "dark-only" is still respected: the default is dark, four of the five are
> dark, and the light theme is opt-in rather than system-following, because this app
> is opened at 08:30 and 02:00. See `design/03-SETTINGS-AND-THEMING.md`.

### 4.1 Tokens

```css
:root {
  --bg:            #0A0B0D;
  --surface:       #131519;
  --surface-2:     #1B1E24;
  --border:        #262A31;

  --text:          #E8EAED;
  --text-dim:      #9BA1AA;
  --text-faint:    #5C636D;

  --accent:        #4DA3FF;   /* the ONLY brand colour */
  --accent-dim:    #2A5A8F;

  --state-complete:#3FBF8F;
  --state-pending: #5C636D;   /* grey, never red */
  --state-recover: #E0A33E;
  --state-alert:   #D95C5C;   /* RESERVED: data-loss + safety warnings only */

  --radius-sm: 6px; --radius-md: 10px; --radius-pill: 999px;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px;
  --sp-6:24px; --sp-8:32px; --sp-12:48px;
}
```

**`--state-alert` never marks an incomplete quest.** Red on a missed quest is a shame signal. Incomplete is grey — "not yet," which is accurate.

Dark-only. A light theme is not in V1 and probably never; this app is opened at 08:30 and 02:00.

### 4.2 Type

```
Numerals / display   JetBrains Mono, tabular figures (font-variant-numeric: tabular-nums)
UI / body            Inter, or the system stack

xl    32/36  600   level numbers, XP totals, Moments
lg    22/28  600   screen titles
md    17/24  500   quest titles
sm    15/22  400   body
xs    13/18  400   labels, metadata
xxs   11/16  500   uppercase +0.08em — section labels
```

Tabular figures are non-negotiable. Numbers that shift width as they change look broken, and this app is mostly numbers.

### 4.3 Motion

```
quest complete      180ms
XP counter roll     400ms ease-out
progress bar        500ms
screen transition   200ms slide
Moments             see 05 §2.3
```

**Hard budget: tap → XP feedback rendered in under 300 ms, offline.** This is a product requirement derived from the evidence on immediate rewards, and it is a Playwright assertion, not an aspiration.

`prefers-reduced-motion` disables all motion and haptics. Nothing functional depends on animation.

### 4.4 Core components

**Quest row** — 64px, full-width tap target, two distinct targets (circle = complete, row = detail), both ≥ 44px.

```
○  CAREER        3 applications          +100     pending
●  CAREER        4 logged                +140     complete (accent fill)
◐  DSA           2 of 3 · 34m            +100     in progress
↺  BUILD         recovery · 41h left      +40     recoverable
⌁  BOSS I · FIRST EVIDENCE        4 of 5          boss (accent border)
```

**XP bar** — 4px, accent fill, no gloss, static when idle.
**Stat block** — xxs dim uppercase label / xl mono value / xs delta with ▲▼.
**System message** — left accent rule, no box, no icon.
**Log sheet** — bottom sheet, 60% height, chips + steppers, one primary button.

Every state has a **shape** as well as a colour (○ ● ◐ ↺ ⌁) so nothing is colour-only.

---

## 5. Wireframes

### 5.1 Onboarding — 6 steps, 90 seconds

```
┌─ 1/6 ─────────────────────┐  ┌─ 2/6 ─────────────────────┐
│  This system asks for      │  │  ARC                      │
│  evidence, not effort.     │  │  Start  [01 Sep 2026 ▾]   │
│                            │  │  End    [29 Dec 2026 ▾]   │
│  It will tell you whether  │  │         120 days          │
│  four months changed       │  │  Timezone  Asia/Kolkata   │
│  anything.                 │  │  Day rolls over at 04:00  │
│  Name [______________]     │  │                           │
│              [ Begin ]     │  │             [ Next ]      │
└────────────────────────────┘  └───────────────────────────┘

┌─ 3/6 ─────────────────────┐  ┌─ 4/6 ─────────────────────┐
│  RHYTHM                    │  │  MAIN QUEST               │
│  Wake target   [08:30 ▾]   │  │  One sentence. What has   │
│  Sleep target  [02:00 ▾]   │  │  to be true on 29 Dec?    │
│  Day closes at 03:00       │  │  [____________________]   │
│                            │  │  [____________________]   │
│  Training days             │  │                           │
│  [M][T][W][T][F][S][S]     │  │  This is the only thing   │
│  Steps target  [8000 ▾]    │  │  the app judges you       │
│  Screen cap    [60 ▾] min  │  │  against.                 │
│  Apps: [pick from list]    │  │             [ Next ]      │
│              [ Next ]      │  └───────────────────────────┘
└────────────────────────────┘

┌─ 5/6  THE IMPORTANT ONE ──┐  ┌─ 6/6 ─────────────────────┐
│  WHEN AND WHERE            │  │  BASELINE                 │
│  Finish these. They matter │  │  Height  [178] cm         │
│  more than any other       │  │  Weight  [ 72] kg         │
│  setting here.             │  │  Body fat — skip for now  │
│                            │  │  Problems solved so far[_]│
│  "At [08:35▾] at [my desk] │  │                           │
│   I will [open the job     │  │  Self-efficacy · 6 items  │
│   board before anything]"  │  │  [ Answer now ] [ Later ] │
│                            │  │                           │
│  "At [22:00▾] at [my desk] │  │  Then: 3 phone alarms     │
│   I will [open the editor]"│  │  [ Set up alarms ]        │
│                            │  │                           │
│  "At [20:15▾] at [the gym] │  │   [ Initialise system ]   │
│   I will [change & start]" │  └───────────────────────────┘
│              [ Next ]      │
└────────────────────────────┘
```

**Not asked at onboarding** — deferred to first use or Day 30: body fat, waist, age, current/target salary (never), full skill inventory, target companies, resume/portfolio status, quest customisation, theme. ~30 fields off the critical path.

### 5.2 Today

```
┌─────────────────────────────────────┐
│  DAY 22 · LEVEL 13 · RANK D         │
│                                      │
│  Today: applications at 08:35,       │
│  then DSA at 22:00.                  │
│                                      │
│  ○  CAREER      3 applications +100  │
│  ○  DSA         1 problem/25m  +100  │
│  ●  BUILD       45 min         +100  │
│  ○  TRAINING    session or 8k  +100  │
│  ●  SLEEP       woke 08:42      +60  │
│  ○  ATTENTION   ≤ 60 min        +40  │
│                                      │
│  ─ THIS WEEK ─────────────────────   │
│  ◐  18 problems, graphs      11/18   │
│  ◐  Ship P1 eval harness       1/2   │
│                                      │
│  ─ REVISIT (2) ───────────────────   │
│  ○  Course Schedule II          +20  │
│  ○  Coin Change                 +20  │
│                                      │
│  ─ MAINTENANCE ───────────────────   │
│  ○  Bath  ○ Fuel  ○ Laundry     +20  │
│                                      │
│  ───────────────────────────────     │
│  "The decision was made last night.  │
│   This morning is execution."        │
│                                      │
│        [ Evening review ]            │  after 22:00
├───────┬──────────┬────────┬─────────┤
│ TODAY │ PROGRESS │ SKILLS │ PROFILE │
└───────┴──────────┴────────┴─────────┘
```

Six core quests fit above the fold on a 6" Android screen. That constraint is what caps the core set at six.

### 5.3 Quest sheet — BUILD variant

```
┌─────────────────────────────────────┐
│  ←   BUILD                           │
│  ┌─────────────────────────────────┐ │
│  │ "At 23:00 at my desk I will      │ │  ← your sentence
│  │  open the project."               │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ≥ 45 minutes. Tag the mode.         │
│                                      │
│  Last 14 days: 11 LEARN · 2 SHIP     │  ← the enforcement signal
│  Learning without shipping produces  │
│  no evidence. This week: SHIP.       │
│                                      │
│   ┌───────────────────────────────┐  │
│   │   Start 10-minute version     │  │  ← PRIMARY, not a fallback
│   └───────────────────────────────┘  │
│   MODE   [ LEARN ]  [ SHIP ]         │  ← required
│   Time   ─ [ 45 ] +  min             │
│   ┌───────────────────────────────┐  │
│   │   Log  +100 XP                │  │
│   └───────────────────────────────┘  │
│   [ + shipped unit  +50 ]            │
└─────────────────────────────────────┘
```

No motivational quote here — competence evidence outperforms it at the point of action.

### 5.4 Career log sheet

```
┌─────────────────────────────────────┐
│  LOG APPLICATION                 ✕   │
│  Company  [____________________]     │
│  Role     [____________________]     │
│  Category [Backend][AI][Fullstack]   │
│  Source   [Board][Referral][Site]    │
│  Resume   [ v2 — AI-weighted ▾ ]     │  required
│                                      │
│  Why this role?                      │  required, ≥15 chars,
│  [________________________________]  │  dedupe-checked
│                                      │
│         [ Log  +100 XP ]             │
│  ─────────────────────────────────   │
│  [ Substitute career work instead ]  │
└─────────────────────────────────────┘
```

### 5.5 Progress — REALITY sub-tab

```
┌─────────────────────────────────────┐
│  PROGRESS      [SYSTEM] [REALITY]    │
│                                      │
│  ─ CONTROLLED ────────────────────   │
│              Day 0      Now          │
│  Problems        0      148          │
│  First-attempt M —      58%          │
│  Public projects 0        2          │
│  Evals           0        3          │
│  Applications    0      162          │
│  Follow-through  —      76%          │
│  Foundations     0      4 Fluent     │
│  Sessions        0       47          │
│  Est.1RM agg     —    +13.8%         │
│  Wake SD    71 min   38 min          │
│  Screen    2h40m     1h05m           │
│                                      │
│  ─ EXTERNAL ──────────────────────   │
│  not scored · not gated · market      │
│  feedback only                        │
│  Responses  14   (8.9%)              │
│  Calls       9   (5.7%)              │
│  Loops       3   (1.9%)              │
│  Offers      0                       │
│                                      │
│  Backend responds at 12.7%,          │
│  fullstack at 3.2%. Consider         │
│  shifting targeting.                 │
└─────────────────────────────────────┘
```

REALITY is the **default** sub-tab from Day 30. Small decision, large effect: the app's default answer to "how am I doing?" becomes the real one.

### 5.6 Profile

```
┌─────────────────────────────────────┐
│  YASHAVANTH                          │
│      LEVEL 13         RANK D         │
│   ▓▓▓▓▓▓▓░░░  760 / 1,240 to L14     │
│                    total XP  9,460   │
│                                      │
│  ⓘ Rank D → C: 6 conditions, you     │
│    meet 4. Checkpoint Day 30 (8d).   │
│                                      │
│  ─ MIND ──────────────────────────   │
│  DISCIPLINE      ▓▓▓▓▓▓▓░░░  72      │
│  DEPTH           ▓▓▓▓▓▓░░░░  61      │
│  PROBLEM SOLVING ▓▓▓▓▓░░░░░  54      │
│  ─ CRAFT ─────────────────────────   │
│  ENGINEERING     ▓▓▓▓▓▓░░░░  63      │
│  ─ CAREER ────────────────────────   │
│  MOMENTUM        ▓▓▓▓▓▓▓░░░  70      │
│  ─ BODY ──────────────────────────   │
│  VITALITY        ▓▓▓▓▓▓▓▓░░  78      │
│    tap any attribute for its formula │
│                                      │
│  ─ ACHIEVEMENTS ── 3 of 8 ────────   │
│  ● First Move ● Two Weeks ● Return   │
│                                      │
│  ─ DATA SAFETY ───────────────────   │
│  Last backup: 3 days ago             │
│  [ EXPORT BACKUP ]                   │
│  Next recommended: Sunday            │
│                                      │
│  Metrics · Settings · Import         │
└─────────────────────────────────────┘
```

### 5.7 Attribute detail (inline expansion)

```
┌─────────────────────────────────────┐
│  PROBLEM SOLVING              54     │
│  ▁▂▃▃▄▄▅▅▅▆▆▆▇   28-day trend       │
│                                      │
│  HOW THIS IS CALCULATED              │
│   0.45 × min(1, weighted/110)        │
│        = 0.45 × (88/110)  = 0.36     │
│   0.35 × first-attempt, mediums      │
│        = 0.35 × 0.41      = 0.14     │
│   0.20 × revisit success rate        │
│        = 0.20 × 0.20      = 0.04     │
│                     TOTAL   0.54 → 54│
│                                      │
│  Biggest lever: first-attempt rate   │
│  on mediums (currently 41%).         │
└─────────────────────────────────────┘
```

This screen is the antidote to "meaningless decorative numbers." It converts a score into an instruction.

### 5.8 Checkpoint

```
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│  CHECKPOINT · DAY 30                 │   │  DAY 30 REPORT                       │
│  Enter real numbers. This is the     │   │  vs DAY 0                            │
│  only place the app checks whether   │   │  Weight       72.0 → 73.1  +1.1 kg   │
│  anything changed.                   │   │  Squat 1RM      90 → 100    +10 kg   │
│                                      │   │  Problems        0 → 61              │
│  Weight        [ 73.1 ] kg           │   │  First-attempt M —  → 41%            │
│  Waist         [ 82.0 ] cm           │   │  Public repos    0 → 1               │
│  Squat 1RM     [  100 ] kg           │   │  Applications    0 → 74              │
│  Bench 1RM     [   72 ] kg           │   │  Foundations     0 → 3 Introduced    │
│  Deadlift 1RM  [  125 ] kg           │   │  Wake SD    71 → 47 min              │
│  Steps avg     [ 8940 ]              │   │  Self-efficacy  38 → 54    +16       │
│  Problems         61  (auto)         │   │                                      │
│  Applications     74  (auto)         │   │  RANK D → C                          │
│  Public repos  [    1 ]              │   │  ✓ Completion 68%  ✓ 61 problems     │
│  Screen avg    [ 1:22 ]              │   │  ✓ 14 sessions     ✓ 1 public repo   │
│                                      │   │  ✓ 74 applications ✓ 3 foundations   │
│  Self-efficacy (6)   [ Answer ]      │   │  ══ RANK ADVANCED TO C ══            │
│  Automaticity  (4)   [ Answer ]      │   │                                      │
│  Enjoyment     (3)   [ Answer ]      │   │  ─────────────────────────────────   │
│                                      │   │  Month 1 built capability and made   │
│  ⚠ Export required to seal           │   │  contact. 74 applications, 4         │
│  [ EXPORT ] then [ Seal checkpoint ] │   │  responses (5.4%). Response rate is  │
└─────────────────────────────────────┘   │  the constraint, not volume. Month 2 │
                                           │  target: resume v2 + external review.│
                                           │       [ Plan days 31–60 ]            │
                                           └─────────────────────────────────────┘
```

That closing paragraph is rule-generated, and it is the sentence the whole product exists to be able to say.

---

## 6. Responsive

> **Superseded by `design/00-DESIGN-SYSTEM.md` §8 (2026-09).** Two changes, both
> narrowing: the content column is capped at 430px rather than 560px, because the
> app is a phone app and a 560px column of phone-sized components reads as a
> stretched phone; and the tabs stay at the bottom at every width instead of moving
> to a left rail at 1024px — one nav, one muscle memory, and a bottom bar is not
> wrong on a desktop that is only ever showing a 430px column anyway.
>
> Enforced by `tests/e2e/responsive.spec.ts`, which runs six viewports from 320x568
> to 1280x800 and asserts no horizontal scroll, 44px targets, no clipped text and no
> nav-over-content, at both the default text scale and XL.

**Android phone (< 640px)** is the design target. Single column, bottom tabs.
**≥ 640px:** content column capped at 560px, centred. The app stays a column.
**≥ 1024px:** tabs move to a left rail. That is the entire desktop adaptation.

No desktop dashboard. It's a week of work for 5% of sessions.

---

## 7. Accessibility

Contrast ≥ 4.5:1 for body text · 44px minimum touch targets · `prefers-reduced-motion` fully honoured · every state has a shape, not just a colour · dynamic type to 200% without breakage · semantic landmarks · `aria-live` on XP updates.
