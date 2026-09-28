# 06 — UX, Design System and Wireframes

---

## 1. UX principles

**U1 — Time-to-leave is the primary UX metric.** Every screen is designed so you can finish and exit fast. There is no browsing surface, no feed, no "explore." If a screen has no exit within two taps, it's wrong.

**U2 — One primary action per screen.** Everything else is secondary or hidden.

**U3 — Thumb zone or nothing.** Primary actions live in the bottom third of the viewport. The top third is read-only.

**U4 — No typing in the daily loop.** Every daily interaction is taps, steppers and pickers. The only text input in V1 is onboarding, the optional DSA insight line, and side-quest creation.

**U5 — Progressive disclosure via level unlocks.** Onboarding is 90 seconds because most of the app doesn't exist yet at Level 1. Features appear when they become useful and when there's enough data for them to be non-noisy.

**U6 — No destructive action without undo; no undo without a ledger row.** Completing a quest is undoable for the rest of the day. Every undo writes an audit event.

**U7 — Offline is the default assumption, not a degraded mode.** There is no spinner, no "syncing," no network state in the UI at all, because there is no network. This is a genuine UX advantage of the local-first choice and it should be visible in how solid the app feels.

---

## 2. UI direction

The reference is **instrumentation**, not gaming. Think a well-made aircraft MFD, a Braun measuring device, an oscilloscope UI — dark, precise, monospaced numerals, sparse colour used only to encode state.

**Yes:** deep near-black surfaces · one accent colour · monospace for all numerals · thin rules · generous negative space · type hierarchy doing the structural work instead of cards · motion that is fast and functional.

**No:** neon glows · multiple accent colours · gradient meshes · glassmorphism · card-in-card-in-card · progress rings everywhere · particle effects · anime imagery · anything from any existing IP.

The one place a small amount of drama is allowed is the level-up and rank-advance moment — and even there it's a fast, restrained reveal, not a celebration.

---

## 3. Design system

### 3.1 Colour tokens

```
--bg              #0A0B0D    page
--surface         #131519    raised
--surface-2       #1B1E24    input, pressed
--border          #262A31    1px rules
--text            #E8EAED
--text-dim        #9BA1AA
--text-faint      #5C636D

--accent          #4DA3FF    the ONLY brand colour: XP, progress, active
--accent-dim      #2A5A8F

--state-complete  #3FBF8F    complete only
--state-pending   #5C636D    pending / incomplete — grey, never red
--state-recover   #E0A33E    recovery available
--state-alert     #D95C5C    RESERVED: data-loss and safety warnings only
```

**`--state-alert` is never used for an incomplete quest.** Red on a missed quest is a shame signal. Incomplete is grey — it reads as "not yet," which is what it is.

### 3.2 Type

```
Display / numerals   JetBrains Mono or IBM Plex Mono, tabular figures
Body / UI            Inter, or the system stack

  xl   32 / 36   600   level number, XP total
  lg   22 / 28   600   screen titles
  md   17 / 24   500   quest titles
  sm   15 / 22   400   body
  xs   13 / 18   400   labels, metadata
  xxs  11 / 16   500   uppercase, +0.08em   section labels
```

Tabular figures are non-negotiable — numbers that shift width as they change look broken, and this app is mostly numbers.

### 3.3 Space, radius, motion

```
space   4 · 8 · 12 · 16 · 24 · 32 · 48
radius  6 (controls) · 10 (surfaces) · 999 (pills). Nothing larger.
```

Motion principles: **fast, functional, interruptible.**
- Quest complete: 180ms
- XP counter roll: 400ms, ease-out
- Progress bar fill: 500ms
- Level-up reveal: 700ms, dismissible on any tap, no backdrop lock
- Screen transitions: 200ms slide
- **`prefers-reduced-motion` disables all of it.** Nothing functional depends on animation.

**Hard rule: the XP feedback must render within 2 seconds of the tap, offline, on a mid-range phone.** This is a performance budget derived from the evidence on immediate rewards, and it's tested (see `09 §Testing`).

### 3.4 Components

**Quest row** — the most-used component in the app. 64px tall, full-width tap target.
```
┌────────────────────────────────────────┐
│  ○   DSA BLOCK                   +100  │   pending
│  ●   DSA BLOCK                   +100  │   complete (accent fill, strikethrough title)
│  ◐   DSA BLOCK        2/3 · 25m  +100  │   in progress
│  ↺   DSA BLOCK  recovery · 41h    +40  │   recoverable
│  ⌁   BOSS I: THE BASELINE      3 of 4  │   boss (accent border)
└────────────────────────────────────────┘
```
Tap the circle → complete. Tap the row → detail. Two distinct targets, both ≥ 44px.

**XP bar** — 4px, accent fill, no gloss, no animation while idle.
**Stat block** — label (xxs, dim, uppercase) over value (xl, mono) over delta (xs, with ▲▼).
**System message** — left accent rule, no box, no icon.

---

## 4. Navigation

**Recommendation: 4 tabs.** Your proposed 5 (Home / Quests / Progress / Skills / Profile) has a redundancy — Home *is* the quest list on any given day, so Home and Quests overlap almost entirely.

```
┌──────┬──────────┬──────────┬─────────┐
│ TODAY│ PROGRESS │  SKILLS  │ PROFILE │
└──────┴──────────┴──────────┴─────────┘
```

| Tab | Contains |
|---|---|
| **TODAY** | Daily quests, priority line, reflection. Evening review launches from here. Weekly/adaptive/revisit quests appear inline. |
| **PROGRESS** | Two sub-tabs: SYSTEM (game layer) and REALITY (evidence layer). Weekly review, checkpoints, and the arc timeline live here. |
| **SKILLS** | DSA topic mastery, AI skill tiers, career quest tree. *Read-mostly.* |
| **PROFILE** | Level, XP, rank + gate checklist, attributes, achievements, identities, metrics entry, settings, export. |

**Could it be 3?** Yes — SKILLS could fold into PROGRESS. But skill state is the thing you check *before deciding what to work on*, which is a different intent from *reviewing how it went*, and merging them would bury it. 4 tabs, and SKILLS is unlocked at Level 8 so early onboarding still shows 3.

---

## 5. Wireframes

All 21 screens from your brief. The **[V1]** / **[V2]** tag marks MVP inclusion.

---

### 5.1 Onboarding — 90 seconds, 6 screens **[V1]**

```
┌─ 1/6 ────────────────────────┐   ┌─ 2/6 ────────────────────────┐
│                               │   │  ARC                          │
│  This system will ask you     │   │                               │
│  for evidence, not effort.    │   │  Start   [ 01 Sep 2026 ▾ ]   │
│                               │   │  End     [ 29 Dec 2026 ▾ ]   │
│  It will tell you the truth   │   │          120 days             │
│  about whether four months    │   │                               │
│  changed anything.            │   │  Timezone  Asia/Kolkata       │
│                               │   │  Day rolls over at 04:00      │
│  Name  [ ______________ ]     │   │                               │
│              [ Begin ]        │   │              [ Next ]         │
└───────────────────────────────┘   └───────────────────────────────┘

┌─ 3/6 ────────────────────────┐   ┌─ 4/6 ────────────────────────┐
│  RHYTHM                       │   │  YOUR MAIN QUEST              │
│                               │   │                               │
│  Wake target   [ 06:30 ▾ ]   │   │  One sentence. What has to    │
│  Sleep target  [ 23:00 ▾ ]   │   │  be true on 29 December?      │
│                               │   │                               │
│  Training days                │   │  [ ________________________ ] │
│  [M][T][W][T][F][S][S]        │   │  [ ________________________ ] │
│                               │   │                               │
│  Screen time cap  [ 60 ▾ ]min │   │  This is the only thing the   │
│                               │   │  app will judge you against.  │
│              [ Next ]         │   │              [ Next ]         │
└───────────────────────────────┘   └───────────────────────────────┘

┌─ 5/6  THE IMPORTANT ONE ─────┐   ┌─ 6/6 ────────────────────────┐
│  WHEN AND WHERE               │   │  BASELINE                     │
│                               │   │                               │
│  Finish these two sentences.  │   │  Weight        [ ____ ] kg    │
│  They matter more than any    │   │  Problems solved so far [ _ ] │
│  other setting here.          │   │  Projects shipped       [ _ ] │
│                               │   │                               │
│  "At [07:15▾] at [my desk__]  │   │  Self-efficacy: 6 questions   │
│   I will [open the editor__]" │   │  [ Do it now ] [ Later ]      │
│                               │   │                               │
│  "At [18:30▾] at [the gym__]  │   │  All optional. All editable.  │
│   I will [change and start_]" │   │                               │
│              [ Next ]         │   │      [ Initialise system ]    │
└───────────────────────────────┘   └───────────────────────────────┘
```

**Not asked at onboarding**, deferred to first use or Day 30: body fat, measurements, height, age, current/target salary, notice period, full skill inventory, target companies, resume/portfolio status, quest customisation, notification config, theme. That's ~30 fields removed from the critical path.

---

### 5.2 Home / Today **[V1]**

```
┌─────────────────────────────────────┐
│  DAY 22 · LEVEL 12 · RANK D         │  xxs, dim
│                                      │
│  Today: DSA at 07:15.                │  md, bright
│  Everything else is bonus.           │
│                                      │
│  ○  DSA BLOCK                 +100   │
│  ●  BUILD BLOCK               +100   │
│  ○  TRAINING                  +100   │
│  ●  SLEEP WINDOW               +75   │
│  ○  FUEL                       +60   │
│  ○  ATTENTION                  +65   │
│                                      │
│  ─ THIS WEEK ─────────────────────   │
│  ◐  16 problems · graphs      9/16   │
│  ◐  Ship P1 tool layer        2/3    │
│                                      │
│  ─ REVISIT (2) ───────────────────   │
│  ○  Course Schedule II         +20   │
│  ○  Coin Change                +20   │
│                                      │
│  ───────────────────────────────     │
│  "The decision was made last night.  │
│   This morning is just execution."   │
│                                      │
│         [ Evening review ]           │  appears after 20:00
├──────┬──────────┬────────┬──────────┤
│ TODAY│ PROGRESS │ SKILLS │ PROFILE  │
└──────┴──────────┴────────┴──────────┘
```

No XP bar here — it's on Profile. The 6 core quests fit above the fold on a 6" phone, which is the layout constraint that drove the "six core quests maximum" decision.

---

### 5.3 Quest detail **[V1]**

```
┌─────────────────────────────────────┐
│  ←                                   │
│  DSA BLOCK                           │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │ "At 07:15 at my desk I will     │ │  ← YOUR sentence, verbatim
│  │  open the editor."               │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ≥ 25 minutes, or 1 problem          │
│  completed.                          │
│                                      │
│  You've done this 11 of the last     │  ← mastery evidence,
│  14 days. Your last 3 graph          │    not a quote
│  problems were first-attempt.        │
│                                      │
│                                      │
│   ┌───────────────────────────────┐  │
│   │   Start 5-minute version      │  │  ← PRIMARY, not a fallback
│   └───────────────────────────────┘  │
│   ┌───────────────────────────────┐  │
│   │   Log a problem               │  │
│   └───────────────────────────────┘  │
│   ┌───────────────────────────────┐  │
│   │   Mark complete        +100   │  │
│   └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

### 5.4 Quest completion **[V1]**

Inline, no screen change, no modal. Tap the circle:

```
  ●  DSA BLOCK                  +100
     ╰─ +100 XP    ▓▓▓▓▓▓▓░░░  7/8

  "Fourth consecutive day. First-attempt
   rate on mediums now 58%."
```

Row fills accent, XP counter rolls (400ms), bar advances, one System Message appears below and fades after 6 seconds. Total elapsed: under 2 seconds to first feedback. **Undo available by tapping the filled circle again, for the rest of the day.**

---

### 5.5 DSA problem log **[V1]** — 7-second target

```
┌─────────────────────────────────────┐
│  LOG PROBLEM                     ✕   │
│                                      │
│  [ Course Schedule II____________ ]  │
│                                      │
│  Topic    [Graphs][DP][Trees][+]     │  chips, last-used first
│  Level    [ E ][ M ][ H ]            │
│                                      │
│  Outcome                             │
│  [ First attempt ]  ← primary        │
│  [ Hint ] [ Editorial ] [ Unsolved ] │
│                                      │
│  Time     ─  [ 25 ] +   min          │
│                                      │
│  Insight (optional)                  │
│  [ _____________________________ ]   │
│                                      │
│           [ Log  +25 XP ]            │
└─────────────────────────────────────┘
```

---

### 5.6 Level-up **[V1]**

```
┌─────────────────────────────────────┐
│                                      │
│                                      │
│              LEVEL                   │
│                12                    │   xl mono, accent
│                                      │
│    Reached on your 4th consecutive   │
│         training day.                │
│                                      │
│    ─────────────────────────────     │
│    UNLOCKED · Weekly review          │
│                                      │
│         tap anywhere to continue     │
└─────────────────────────────────────┘
```

700ms. Dismissible anywhere. From the third level-up onward it degrades to an inline banner on Today — a full-screen reveal for a routine event trains you to discount it.

---

### 5.7 Profile **[V1]**

```
┌─────────────────────────────────────┐
│  YASHAVANTH                          │
│                                      │
│      LEVEL 12         RANK D         │
│   ▓▓▓▓░░░░░░░░  410 / 910 to L13     │
│                    total XP  6,540   │
│                                      │
│  ⓘ Rank D → C requires 4 conditions. │  ← tappable, always visible
│    You meet 2. Checkpoint: Day 30.   │
│                                      │
│  ─ MIND ──────────────────────────   │
│  DISCIPLINE      ▓▓▓▓▓▓▓░░░    72    │
│  DEPTH           ▓▓▓▓▓▓░░░░    61    │
│  PROBLEM SOLVING ▓▓▓▓▓░░░░░    54    │
│  ─ CRAFT ─────────────────────────   │
│  CRAFT           ▓▓▓▓▓▓░░░░    63    │
│  ─ BODY ──────────────────────────   │
│  VITALITY        ▓▓▓▓▓▓▓▓░░    78    │
│                                      │
│  tap any attribute for its formula   │
│                                      │
│  ─ ACHIEVEMENTS ─── 3 of 8 ───────   │
│  ● First Move  ● Two Weeks  ● Return │
│                                      │
│  ─ IDENTITIES ────────────────────   │
│  (none yet — earned at milestones)   │
│                                      │
│  Metrics · Settings · Export data    │
└─────────────────────────────────────┘
```

---

### 5.8 Attribute detail **[V1]**

```
┌─────────────────────────────────────┐
│  ←  PROBLEM SOLVING            54    │
│                                      │
│  ▁▂▃▃▄▄▅▅▅▆▆▆▇  28-day trend        │
│                                      │
│  HOW THIS IS CALCULATED              │
│                                      │
│   0.45 × min(1, weighted problems    │
│               in 28d ÷ 60)           │
│        = 0.45 × (48/60) = 0.36       │
│                                      │
│   0.35 × first-attempt rate,         │
│          mediums                     │
│        = 0.35 × 0.41   = 0.14        │
│                                      │
│   0.20 × revisit success rate        │
│        = 0.20 × 0.20   = 0.04        │
│                                      │
│   TOTAL = 0.54  →  54                │
│                                      │
│  Biggest lever: first-attempt rate   │
│  on mediums (currently 41%).         │
└─────────────────────────────────────┘
```

This screen is the antidote to "meaningless decorative numbers." It converts a score into an instruction.

---

### 5.9 Skills — DSA tree **[V1, simplified]** / **[V2, full]**

```
┌─────────────────────────────────────┐
│  DSA                    148 problems │
│                                      │
│  Arrays          ▰▰▰▰▰  Retained     │
│  Strings         ▰▰▰▰▱  Fluent       │
│  Hashing         ▰▰▰▰▰  Retained     │
│  Two pointers    ▰▰▰▱▱  Applied      │
│  Stacks          ▰▰▰▰▱  Fluent       │
│  Trees           ▰▰▰▱▱  Applied      │
│  Graphs          ▰▰▱▱▱  Introduced   │  ⚠ 31% first-attempt
│  DP              ▰▱▱▱▱  Introduced   │
│  Union-Find      ▱▱▱▱▱  Unseen       │
│                                      │
│  ⚠ Trees: Fluent, last touched 24d   │
│    ago. Revisit scheduled.           │
└─────────────────────────────────────┘
```

**V1 simplification:** the 5 mastery states are computed and displayed, but there is no interactive tree graph — that's a lot of build effort for a read-mostly screen. A flat list conveys the same information.

### 5.10 Skills — AI tiers **[V1, simplified]**

```
┌─────────────────────────────────────┐
│  AI ENGINEERING                      │
│                                      │
│  TIER 0 · TABLE STAKES        6/8    │
│  ● prompting  ● structured out       │
│  ● tool calling  ● embeddings        │
│  ● RAG basics  ● vector stores       │
│  ○ caching economics  ○ model landscape│
│                                      │
│  TIER 1 · DIFFERENTIATORS     2/5    │
│  ● agent orchestration               │
│  ● context engineering               │
│  ○ EVALUATION DESIGN  ← highest value│
│  ○ MCP  ○ cost & latency             │
│                                      │
│  TIER 2 · PRODUCTION          0/4    │
│  TIER 3 · FRONTIER            0/4    │
│                                      │
│  SHIPPED                             │
│  P1 agent-tools    ✓ 2 evals         │
│  P2 rag-memory     ◐ in progress     │
└─────────────────────────────────────┘
```

### 5.11 Career tree **[V2]** — V1 uses a flat checklist under SKILLS.

### 5.12 Fitness **[V1]**

```
┌─────────────────────────────────────┐
│  BODY                                │
│                                      │
│  WEIGHT     7-day mean               │
│  76.9 kg    ▼ 1.5 kg over 30 days    │
│  ╌╌╌╌╌╌╌╌╌╌╌╌  trend line + raw dots │
│                                      │
│  STRENGTH   est. 1RM                 │
│  Squat    112 kg   ▲ 17              │
│  Bench     82 kg   ▲  7              │
│  Deadlift 140 kg   ▲ 15              │
│                                      │
│  SESSIONS   41 in 89 days            │
│  ▪▪▫▪▪▫▫▪▪▪▫▪▪▫▪▪▪▫▪▫▪▪              │
│                                      │
│  WAKE-TIME SD    38 min  ▼ from 71   │
│                                      │
│  [ Log session ]  [ Log weight ]     │
└─────────────────────────────────────┘
```

Note there is no commentary on the weight direction, and no target line drawn on the chart. Both are deliberate — see `04 §4.1`.

### 5.13 Daily review **[V1]** — see `05 §5`.
### 5.14 Weekly review **[V1]** — see `05 §6`.

### 5.15 Checkpoint **[V1]** — the most important screen in the app

```
┌─────────────────────────────────────┐
│  CHECKPOINT · DAY 30                 │
│                                      │
│  Enter real numbers. This is the     │
│  only place the app checks whether   │
│  anything actually changed.          │
│                                      │
│  Weight (today)      [ 77.1 ] kg     │
│  Squat 1RM est.      [  105 ] kg     │
│  Problems logged        61 (auto)    │
│  First-attempt, M      41% (auto)    │
│  Projects public     [    1 ]        │
│  Applications sent   [    0 ]        │
│  Interviews          [    0 ]        │
│  Screen time avg     [ 1:22 ]        │
│                                      │
│  Self-efficacy (6 q)   [ Answer ]    │
│  Automaticity (4 q)    [ Answer ]    │
│  Enjoyment (3 q)       [ Answer ]    │
│                                      │
│         [ Seal checkpoint ]          │
└─────────────────────────────────────┘

                  ↓

┌─────────────────────────────────────┐
│  DAY 30 REPORT                       │
│                                      │
│  vs DAY 0                            │
│  Weight        78.4 → 77.1  −1.3 kg  │
│  Squat 1RM        95 → 105   +10 kg  │
│  Problems          0 → 61             │
│  Projects          0 → 1              │
│  Applications      0 → 0        ⚠     │
│  Wake-time SD     71 → 47   −24 min  │
│  Self-efficacy    38 → 54       +16  │
│                                      │
│  RANK D → C                          │
│  ✓ Completion 68%   ✓ 61 problems    │
│  ✓ 14 sessions      ✓ 1 feature      │
│  RANK ADVANCED TO C                  │
│                                      │
│  ─────────────────────────────────   │
│  Month 1 built capability and made   │
│  no market contact. Applications: 0. │
│  Rank A at Day 90 requires an        │
│  external event. Start now.          │
│                                      │
│         [ Plan days 31–60 ]          │
└─────────────────────────────────────┘
```

That closing paragraph is generated by a rule, not a model, and it is the sentence the entire product exists to be able to say.

### 5.16 Achievements **[V1]** — a list on Profile, not a screen.
### 5.17 Boss quest **[V1]**

```
┌─────────────────────────────────────┐
│  BOSS I · THE BASELINE               │
│  Window: Day 25–32 · 4 days left     │
│                                      │
│  ✓  60 problems logged        61/60  │
│  ✓  12 training sessions      14/12  │
│  ✓  1 feature committed         1/1  │
│  ○  Day-30 checkpoint entered        │
│                                      │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  3 of 4        │
│                                      │
│  Clearing opens the Rank C gate.     │
│  Reward you set: "New keyboard."     │
│                                      │
│  Missing the window is not a         │
│  failure. It reopens at Day 60.      │
└─────────────────────────────────────┘
```

### 5.18 Settings **[V1]** — arc dates, targets, quest amendment (locked between checkpoints), export/import, delete all, theme (one), reduced motion, app-time stats.
### 5.19 Notification settings **[V1, minimal]** — three times + a "regenerate alarm file" button. That's the whole screen, given §3 of `05`.
### 5.20 Message system **[V1, minimal]** — a list of reflections with a delete button per line. No editor, no categories UI, no analytics.
### 5.21 Long-term progress **[V1]** — the REALITY tab, per `04 §7`.

---

## 6. Responsive behaviour

**Mobile (< 640px)** — the design target. Single column, bottom tabs, everything thumb-reachable.

**Tablet / desktop (≥ 640px)** — do *not* build a different app. Two changes only:
1. Content column capped at 560px and centred. The app stays a column; it does not become a dashboard.
2. Bottom tabs move to a left rail at ≥ 1024px.

Resisting the urge to build a "real desktop dashboard" is a scope decision worth defending: you'll use this on your phone 95% of the time, and a desktop dashboard is a week of work serving 5% of sessions.

---

## 7. Accessibility

Contrast ≥ 4.5:1 for body text (the palette is built for this) · 44px minimum touch targets · `prefers-reduced-motion` fully honoured · no colour-only state encoding (every state has a shape: ○ ● ◐ ↺) · dynamic type up to 200% without breakage · semantic landmarks and live regions for XP updates.
