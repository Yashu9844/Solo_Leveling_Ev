# UI Inventory / Implementation Audit

**Date:** 2026-09-08 · **Branch:** `slice-13-ship` @ `944b7a0` · **Method:** source inspection of
all 143 files in `src/`, plus a live audit of the production build (`vite preview`) driven by
Playwright at 412×915 — every route loaded, every sheet opened, every overlay dumped from the DOM.

This is a factual inventory. No judgements, no recommendations, no visual critique.
Nothing in the application was modified to produce it.

---

## 1. Complete route / page inventory

Routes are defined in exactly one place: [src/App.tsx](../src/App.tsx). There are **15 route
entries** resolving to **12 distinct rendered pages**.

| # | Route | Page | Type | Purpose | How reached | Status |
|---|---|---|---|---|---|---|
| — | *(none)* | **Splash** | Pre-router state | Boot screen while arc status resolves | Rendered by `App` before `<Routes>` when `status === 'loading'` or the 900 ms minimum has not elapsed. **Not addressable by URL.** | Implemented |
| 1 | `/start` | **Start** | Full-screen, no nav | Front door before an arc exists | Every path redirects here when no arc. Redirects to `/today` if an arc exists | Implemented |
| 2 | `/onboarding` | **Onboarding** | Full-screen, no nav | 6-step arc creation | "Begin your journey" on Start. Redirects to `/today` if an arc exists | Implemented |
| 3 | `/log/problem` | *(redirect only)* | PWA shortcut | Declared in the web manifest | Long-press app icon | **PARTIAL** — redirects to `/today?open=dsa`; nothing reads `open` (§4) |
| 4 | `/log/application` | *(redirect only)* | PWA shortcut | Declared in the web manifest | Long-press app icon | **PARTIAL** — redirects to `/today?open=career`; no effect |
| 5 | `/review` | *(redirect only)* | PWA shortcut | Declared in the web manifest | Long-press app icon | **PARTIAL** — redirects to `/today?open=review`; no effect |
| 6 | `/` (index) | *(redirect)* | — | — | Redirects to `/today` | Implemented |
| 7 | `/today` | **Today** | Main nav page | Daily command centre | Bottom nav · default landing | Implemented |
| 8 | `/progress` | **Progress** | Main nav page | Game accounting vs real-world outcomes | Bottom nav | Implemented |
| 9 | `/skills` | **Skills** | Main nav page | Mastery readout across four trees | Bottom nav | Implemented |
| 10 | `/profile` | **Profile** | Main nav page | Identity, next gate, bosses, attributes, arc controls | Bottom nav | Implemented |
| 11 | `/profile/settings` | **Settings index** | Child page (nav visible) | Four-section index | Gear icon in Profile header | Implemented |
| 12 | `/profile/settings/appearance` | **Appearance** | Child page | Theme / accent / text / density / motion / art / glow | Settings index row | Implemented |
| 13 | `/profile/settings/system` | **System** | Child page | Reminders, arc hours, device | Settings index row | Implemented |
| 14 | `/profile/settings/system/:questKey` | **Reminder editor** | Grandchild page | Edit one implementation intention | Reminder row on System | Implemented (`career` / `dsa` / `training`; any other key renders a bare header) |
| 15 | `/profile/settings/data` | **Data** | Child page | Backup, paper import, storage, integrity | Settings index row | Implemented |
| 16 | `/profile/settings/about` | **About** | Child page | Version, arc dates, reset | Settings index row | Implemented |
| 17 | `*` | *(catch-all)* | — | — | Any unknown path | Implemented — verified live: `/does-not-exist` → `/start` (no arc) / `/today` (arc) |

**Guard:** every route from #6 down sits behind `RequireArc`; with no arc they redirect to `/start`.

---

## 2. Main navigation

### Structure

```
APP
│
├── SPLASH  (900 ms minimum, no nav, not a URL)
│    └── → /start  (no arc)   |   → /today  (arc exists)
│
├── /start                              [no bottom nav]
│    └── "Begin your journey" → /onboarding
│
├── /onboarding                         [no bottom nav, step rail instead]
│    ├── 1 Framing (name)
│    ├── 2 Arc (start / end date)
│    ├── 3 Rhythm (wake, sleep, training days, steps, screen cap, apps)
│    ├── 4 Main quest
│    ├── 5 When and where  (3 implementation intentions)
│    └── 6 Baseline (height, weight, problems, alarm list + copy)
│         └── "Initialise system" → /today
│
└── APPSHELL  [bottom nav always visible]
     │
     ├── TODAY  (/today)
     │    ├── Quest detail sheet         ×6 variants (one per core quest)
     │    ├── Career log sheet           (application | substitute mode)
     │    ├── DSA log sheet
     │    ├── Build log sheet
     │    ├── Training log sheet         (session | steps mode)
     │    ├── Sleep log sheet
     │    ├── Attention log sheet
     │    ├── Learning block sheet       (System Design reveals extra fields)
     │    ├── Evening review sheet
     │    │    └── Daily report  (full-screen, tap anywhere)
     │    ├── LEVEL UP moment            (full-screen, ×1–3; banner from the 4th)
     │    ├── MASTERY toast              (from DSA / learning sheets)
     │    └── EVIDENCE ACCEPTED toast    (from build sheet)
     │
     ├── PROGRESS  (/progress)
     │    ├── SYSTEM segment   (default before Day 30)
     │    ├── REALITY segment  (default from Day 30)
     │    └── Weekly review    (full-screen overlay)
     │
     ├── SKILLS  (/skills)
     │    └── (no child routes, no sheets — one scrolling page)
     │
     └── PROFILE  (/profile)
          ├── Checkpoint screen  (full-screen overlay)
          │    ├── Day-N instruments (inline expand, not Day 14)
          │    ├── RANK ADVANCED moment
          │    └── CHECKPOINT moment  (3 self-paced steps)
          ├── BOSS CLEARED moment
          ├── Day-0 baseline instruments (inline expand)
          ├── Body metric  (inline expand)
          └── Settings  (/profile/settings)
               ├── Appearance
               ├── System
               │    └── Reminder editor  (/system/:questKey)
               ├── Data
               └── About
```

### Bottom navigation

`<nav aria-label="Primary">` — 4 items, order and labels frozen by the test contract.

| Item | Route | Icon (Phosphor) | Active rule |
|---|---|---|---|
| TODAY | `/today` | `House` | `pathname === to \|\| pathname.startsWith(to + '/')` |
| PROGRESS | `/progress` | `ChartLineUp` | same |
| SKILLS | `/skills` | `TreeStructure` | same |
| PROFILE | `/profile` | `UserCircle` | same — stays lit through all settings sub-pages |

Active state: accent colour, `weight="fill"` icon, `--glow-icon` drop-shadow, 600 font weight.
Nav is **not** `position: fixed` — it is a flex sibling of the scrolling `<main>`.

### Top navigation

No global top bar. Each page renders its own `ScreenHeader`:

| Page | Title | Left | Right |
|---|---|---|---|
| Today | `TODAY` (`sr-only` — no visible chrome at all) | — | — |
| Progress | `PROGRESS` | — | `DAY n` (mono) |
| Skills | `SKILLS` | — | — |
| Profile | `PROFILE` | — | `DAY n / 120` + gear button (`aria-label="Settings"`) |
| Settings / Appearance / System / Data / About / Reminder | screen name | Back chevron (`aria-label="Back"`) | — |

### Secondary navigation / segments

| Control | Location | Options |
|---|---|---|
| `Segmented` SYSTEM / REALITY | Progress, below header, full width | 2 |
| `Segmented` text size | Appearance | XS S M L XL |
| `Segmented` density | Appearance | Comfortable / Compact |
| `Segmented` motion | Appearance | System / Full / Reduced |
| `Segmented` art | Appearance | Full / Dim / Off |
| `Segmented` glow | Appearance | On / Off |
| Mode chips | Career sheet (application/substitute via footer link), Training sheet (Session/Steps), Build sheet (LEARN/SHIP) | 2 each |

### Navigation behaviour

| Gesture | Behaviour | Implementation |
|---|---|---|
| **Back** with a sheet/moment open | Closes the overlay, does not leave the screen | `OverlayStack` pushes a history entry on open; `popstate` closes the top overlay. Never calls `history.back()` — a programmatic close marks its entry "spent" and the next back press silently consumes it |
| **Back** on a settings sub-page | Browser back works normally; a visible Back chevron also calls `navigate()` to the parent | `ScreenHeader onBack` |
| **Back** on a tab | Returns to the previous tab (normal history) | react-router |
| **Bottom nav tap** (different tab) | Cross-fade route transition, 180 ms; target tab's saved scroll position restored | `PageTransition` + `AppShell` scroll map |
| **Bottom nav tap** (tab you are on) | Smooth-scrolls that tab back to the top | `handleTabClick` |
| **Close (✕)** in a sheet | Closes the sheet, returns focus to the trigger | `Sheet` |
| **Tap outside a sheet** (scrim) | Closes the sheet | `Sheet` scrim `onClick` |
| **Drag a sheet down** | Closes past 110 px or 520 px/s flick | framer `onDragEnd` |
| **Escape** in a sheet | Closes the sheet | `Sheet onKeyDown` |
| **Tab / Shift-Tab** in a sheet | Focus is trapped and wraps | `Sheet onKeyDown` |
| **Tap anywhere** on a full-screen Moment | Dismisses it | `Moment` root is a `role="button"` |
| **Tap anywhere** on the daily report | Dismisses it and closes the evening review | `DailyReportView` root is a `role="button"` |
| **Tap** on the CHECKPOINT moment | Advances one step; the 3rd tap dismisses | `CheckpointMoment` |
| **PWA shortcut** | Opens the app on Today with a `?open=` param that has no effect | see §4 |

---

## 3. Page-by-page UI breakdown

### 3.1 SPLASH

**PAGE:** Splash · **ROUTE:** none (pre-router) · **PURPOSE:** boot screen

**VISIBLE UI**
1. **Header** — none.
2. **Hero / artwork** — `boot` art plate, full-screen, `moment` scrim, `priority`.
3. **Status / summary** — none.
4. **Main content** — `SYSTEM` wordmark (display serif, glow, 0.34em tracking).
5. **Cards / panels** — none.
6. **Lists** — none.
7. **Charts** — **none.**
8. **Buttons / controls** — **none.** Not interactive.
9. **Bottom navigation** — absent.
10. **Other** — an animated rule that expands to 210 px; the line "Discipline creates freedom"; `data-testid="splash"`. Four-beat framer reveal (plate → wordmark → rule → creed).

---

### 3.2 START

**PAGE:** Start · **ROUTE:** `/start` · **PURPOSE:** the front door before an arc exists

**VISIBLE UI**
1. **Header** — none. `SafeTop` spacer only.
2. **Hero / artwork** — `start-hero` plate, full-screen, `hero` scrim, `priority`, manifest zoom 1.22. Carries its own baked-in lettering, so the screen adds no tagline.
3. **Status / summary** — none.
4. **Main content** — `SYSTEM` wordmark; a gold gradient rule.
5. **Cards / panels** — none.
6. **Lists** — none.
7. **Charts** — **none.**
8. **Buttons / controls** — one: **"Begin your journey"**, `PrimaryButton tone="dawn"`, full width.
9. **Bottom navigation** — absent.
10. **Other** — `SafeTop` / `SafeBottom` insets; framer entrance on the bottom block.

---

### 3.3 ONBOARDING

**PAGE:** Onboarding · **ROUTE:** `/onboarding` · **PURPOSE:** create the arc in 6 steps

**VISIBLE UI**
1. **Header** — none. A 6-segment **step rail** (`role="progressbar"`, `aria-valuenow`) sits at the top.
2. **Hero / artwork** — `onboarding` plate with `moment` scrim on **steps 1 and 6 only**; steps 2–5 have no art.
3. **Status / summary** — the step rail; on step 2 a live **day count** in mono.
4. **Main content** — one `FramedPanel` per step, vertically centred by `my-auto`:
   - **Step 1** — "This system asks for evidence, not effort." / "It will tell you whether four months changed anything." / hairline / **Name** field (placeholder `Your name`).
   - **Step 2** — `Arc`: **Start** date, **End** date, computed day count, "Timezone Asia/Kolkata. Day rolls over at 04:00."
   - **Step 3** — `Rhythm`: **Wake** time, **Sleep** time (2-col grid), "Day closes at 03:00.", **Training days** chip toggle (Mon–Sun), **Steps target** stepper, **Screen cap** stepper (min), **Apps to watch** chip toggle (Instagram, YouTube, X / Twitter, Reddit, TikTok).
   - **Step 4** — `Main quest`: one prompt line + a 4-row textarea (placeholder "This is the only thing the app judges you against.").
   - **Step 5** — `When and where` + "Finish these. They matter more than any other setting here." Three intention blocks (Career, DSA, Training), each three labelled rows on a fixed 48 px prefix column: **At** \[time\] / **at** \[place\] / **I will** \[first action\].
   - **Step 6** — `Baseline`: **Height (cm)** and **Weight (kg)** (2-col), a body-fat note, **Problems solved so far (optional)**, then a **"Three phone alarms"** card listing the two intention times plus "23:30 — Evening review. 25 seconds." in mono, with a **Copy times** button.
5. **Cards / panels** — the `FramedPanel` step container; the alarms card on step 6; three accent-ruled intention blocks on step 5.
6. **Lists** — the 3-item alarm list.
7. **Charts** — **none** (the step rail is a progress indicator, not a chart).
8. **Buttons / controls** — pinned footer: **Back** (`SecondaryButton`, steps 2–6) and **Begin** (step 1) / **Next** (steps 2–5) / **Initialise system** (step 6). Plus **Copy times**.
9. **Bottom navigation** — absent.
10. **Other** — inline `role="alert"` error line ("Could not save — try again."); `Next` is disabled until each step's own validation passes (step 1 needs a name, step 4 a main quest, step 5 all six place/action fields).

---

### 3.4 TODAY

**PAGE:** Today · **ROUTE:** `/today` · **PURPOSE:** the daily loop

**VISIBLE UI**
1. **Header** — no visible header. `<h1 class="sr-only">TODAY</h1>` only; the identity block below is the de-facto header.
2. **Hero / artwork** — `today` plate as a **corner bleed**: 210×170 px, top-right, `mix-blend-lighten`, 50 % opacity, radial mask fade, no scrim.
3. **Status / summary area** (the identity block)
   - `DAY nn` (display serif, zero-padded)
   - `RANK X` (label + display serif letter)
   - `LV n` + **XP meter** (`data-testid="xp-bar-fill"`) + `xpIntoLevel / xpForNext` in mono, wrapped in `role="status" aria-live="polite"`
   - Streak line: `n% (7d) · n% (28d) · streak n` — hidden when all three are 0
4. **Main content** — six quest rows (see §8), then the secondary blocks.
5. **Cards / panels** (all conditional except maintenance)
   - **Level-up banner** — `LEVEL nn → nn`, shown for the 4th level-up onward, auto-clears after 6 s
   - **Reduced-mode line** — "Reduced to the floor for two days. The arc continues." (amber rule)
   - **Recovery card** (`data-testid="recovery-card"`) — yesterday's count, missed quest titles, a "worth less than…" line, an optional 4-chip *What got in the way?* selector, and a **Recovery quest · +40 XP** button
   - **Day-closed line** — "Day closed. Next day begins at 04:00."
   - **Priority line** — accent left rule, e.g. "Today: CAREER at 08:35."
   - **System line** (`data-testid="system-line"`) — italic reflection / system message beneath it
   - **Maintenance card** (`data-testid="maintenance-card"`) — `MAINT` label + pills: Bath, Ate to plan, and Laundry only when due
   - **Weekly quest card** (`data-testid="weekly-quest-progress"`) — "This week" label, description, `progress/target` in mono, "— complete! +200 XP" when just completed
   - **Notice** — `role="status"`, "Could not save — try again.", auto-clears after 3 s
6. **Lists**
   - The six core quest rows
   - **Revisits due** (`data-testid="revisits-due"`) — "Revisit · +20 XP each" label, then one row per problem with **Solved** / **Unsolved** buttons
7. **Charts / graphs** — one **XP meter bar**. No time-series, no history chart.
8. **Buttons / controls** — 6 × row-open, 6 × complete circle, up to 3 maintenance pills, **Learning block · +25 XP**, revisit Solved/Unsolved pairs, recovery claim + 4 reason chips, **Evening review · 25 seconds** (hidden once reviewed).
9. **Bottom navigation** — present.
10. **Other** — a `visibilitychange`/`focus` listener re-reads the date so the screen cannot go stale across the 04:00 rollover.

---

### 3.5 PROGRESS — SYSTEM

**PAGE:** Progress (SYSTEM) · **ROUTE:** `/progress` · **PURPOSE:** the game's own accounting

**VISIBLE UI**
1. **Header** — `PROGRESS` + `DAY n` trailing.
2. **Hero / artwork** — `progress` plate inside the level card, 210 px, `hero` scrim, focal 50 % 28 %.
3. **Status / summary** — the level card: `LV n` (glow, mono) left, `RANK X` (display serif) right, an **XP meter**, then `xpIntoLevel / xpForNext` and `total` in mono.
4. **Main content** — segmented control, level card, streak line, weekly-review entry, attribute bars.
5. **Cards / panels** — the level card (hairline border over art).
6. **Lists** — attribute bars in four labelled groups: **MIND** (Discipline, Depth, Problem Solving), **CRAFT** (Engineering), **CAREER** (Momentum), **BODY** (Vitality). `data-testid="attribute-bars"`.
7. **Charts / graphs** — **7 meter bars** (1 XP + 6 attributes). No trend lines, no history.
8. **Buttons / controls** — `SYSTEM` / `REALITY` segmented; **Weekly review** (`SecondaryButton`).
9. **Bottom navigation** — present.
10. **Other** — streak line in mono: `n% (7d) · n% (28d) · streak n`.

---

### 3.6 PROGRESS — REALITY

**PAGE:** Progress (REALITY) · **ROUTE:** `/progress` (segment) · **PURPOSE:** real-world outcomes

Default segment **from Day 30** — verified live at simulated Day 35 (`aria-pressed`: SYSTEM=false, REALITY=true).

**VISIBLE UI**
1. **Header** — same as SYSTEM.
2. **Hero / artwork** — **none.**
3. **Status / summary** — none beyond the table.
4. **Main content** — `CONTROLLED` section label; caption "Cumulative and all-time. Everything here started at zero."; a `Day 0` / `Now` column head; then 8 rows.
5. **Cards / panels** — none; rows are hairline-separated.
6. **Lists** — the 8-row table (`data-testid="reality-tab"`):

| Row | Day 0 | Now |
|---|---|---|
| Problems | `0` | count of non-revisit DSA attempts |
| First-attempt M | `—` | % of medium attempts solved first try, or `—` |
| Public projects | `0` | artifacts of kind `project` |
| Evals | `0` | artifacts of kind `eval` |
| Applications | `0` | application count |
| Quality rate | `—` | quality-pass rate, or `—` |
| Follow-through | `—` | follow-through rate, or `—` |
| Foundations Fluent+ | `0 / 9` | `n / 9` fluent-or-retained |

7. **Charts / graphs** — **none.** A two-column table only.
8. **Buttons / controls** — the segmented control only. The rows are not interactive.
9. **Bottom navigation** — present.
10. **Other** — a `Now` value is accent-coloured only when it differs from its Day-0 value.

---

### 3.7 SKILLS

**PAGE:** Skills · **ROUTE:** `/skills` · **PURPOSE:** mastery readout

**VISIBLE UI**
1. **Header** — `SKILLS`, no trailing control.
2. **Hero / artwork** — `skills` plate as a 132 px band, `band` scrim.
3. **Status / summary** — two counts on the band: **DSA topics** `n / 9`, **Foundations** `n / 9`.
4. **Main content** — five sections.
5. **Cards / panels** — one `FramedPanel` (the interview benchmark) — the only frame on the screen.
6. **Lists**
   - **DSA** — 9 topic rows: Arrays, Strings, Hashing, Two Pointers, Sliding Window, Stacks, Trees, Graphs, DP
   - **SE Foundations** — 9 topic rows: Operating Systems, Networking, Databases, Distributed Systems, Concurrency, Backend Engineering, System Design, Performance, Production Architecture
   - **AI / Agentic tiers** — 4 tier headings with 21 chips total (Tier 0: 8, Tier 1: 5, Tier 2: 5, Tier 3: 3). Static reference text
   - **Career tree** — 7 data rows: Software engineering → foundations, AI / Agentic → tiers, Projects → artifacts, Resume → versions, Applications, Interviews, Offer
7. **Charts / graphs** — **18 five-segment mastery bars** (`SegmentBar`, `role="img"` with the state as its label). No percentages anywhere, per the ordinal model. No trees drawn — "career tree" is a flat label/value list.
8. **Buttons / controls** — only two on the whole screen: **Passed** and **Not yet** in the benchmark panel. Topic rows are **not** interactive; there is no skill detail screen.
9. **Bottom navigation** — present.
10. **Other** — the state word ("introduced", "fluent"…) is printed beside a bar only once a topic is touched; benchmark shows `✓ Passed.` / `Not yet passed.` plus a dated attempt history list.

---

### 3.8 PROFILE

**PAGE:** Profile · **ROUTE:** `/profile` · **PURPOSE:** identity, the next gate, bosses, arc controls

**VISIBLE UI**
1. **Header** — `PROFILE` + `DAY n / 120` + a gear button to Settings.
2. **Hero / artwork** — no plate on the hero itself. The **boss band** carries `boss` art when a window is open, `boss-throne` when locked.
3. **Status / summary** — the hero `Panel`: `MAIN QUEST` label, the user's own sentence in display serif, hairline, then `LV n` / `RANK X`, an **XP meter**, `xpIntoLevel / xpForNext to Ln+1` and `total`.
4. **Main content** — hero → next gate → bosses → attributes → baseline → body metric → arc pause.
5. **Cards / panels**
   - **The next gate** — a `FramedPanel` (accent, or **dawn when due**): "THE NEXT GATE" / "Next checkpoint: Day 14" / "9 days away — open the checklist". Whole panel is one button
   - **Boss card** — locked: name + "Opens Day 25 · n days away". Open: boss-red edge, `BOSS I · FIRST EVIDENCE`, `Days 25-35 · n of 5 met`, a shape-coded condition checklist, and a **Clear boss · +500 XP** button (disabled until every condition is met)
   - **Day-0 baseline** — collapsed row "Complete Day-0 baseline"; expands inline to 13 sliders
   - **Body metric** — collapsed row "Log body metric"; expands inline to a metric picker + stepper + Log
   - **Arc pause** — "Illness, travel, a work crisis. One tap, up to 7 days." with **1d / 3d / 7d**; when paused, amber edge + "Paused. No quests generate. Zero penalty." + **Resume now**
   - **Dev only** — a dashed red-fenced **Reset arc** block, `import.meta.env.DEV` only (never in a build)
6. **Lists** — `boss-list`, `achievements-list` (achievements + identities as chips; **renders nothing until something is earned** — verified absent on a fresh arc), `attribute-bars` (the same 6 bars as Progress).
7. **Charts / graphs** — 1 XP meter + 6 attribute meters. No history, no timeline.
8. **Buttons / controls** — Settings gear, next-gate panel, boss clear, baseline expand, body-metric expand, 1d/3d/7d, Resume now.
9. **Bottom navigation** — present.
10. **Other** — attribute bars are read-only; the boss condition list uses filled/hollow squares.

---

### 3.9 SETTINGS INDEX

**PAGE:** Settings · **ROUTE:** `/profile/settings`

1. **Header** — `SETTINGS` + Back. 2. **Artwork** — **none** (0 art layers, by design). 3. **Summary** — none.
4. **Main content** — one `APPLICATION` group. 5. **Cards** — one grouped-list card.
6. **Lists** — 4 rows, each with a leading icon, label, description, chevron:

| Row | Description | Trailing value |
|---|---|---|
| Appearance | Theme, accent, text size, motion | current theme (+ accent when not "theme default") |
| System | Reminders, the day's hours, this device | — |
| Data | Backup, paper import, storage, integrity | — |
| About | Version, arc dates, reset | — |

7. **Charts** — **none.** 8. **Controls** — the 4 rows + Back. 9. **Bottom nav** — present.
10. **Other** — a footnote explaining that appearance settings are device-local, plus a mono summary line (`Text scale M · comfortable · system motion · art full`).

---

### 3.10 APPEARANCE

**PAGE:** Appearance · **ROUTE:** `/profile/settings/appearance`

1. **Header** — `APPEARANCE` + Back. 2. **Artwork** — none.
3. **Status / summary** — the **live preview**, `position: sticky` at the top: a section label, a miniature CAREER quest row (icon tile, title, "3 applications", `+100`, a filled completion circle), an XP meter at 62 %, and a line of display serif. The serif line is hidden below 640 px of viewport height.
4. **Main content** — five groups. 5. **Cards** — five grouped-list cards, two of them `role="radiogroup"`.
6. **Lists** — Theme (5 rows, `role="radio"` + check) · Accent (6 rows with a colour swatch + check).
7. **Charts** — one meter bar inside the preview. No data charts.
8. **Controls** — 11 choice rows + 5 `Segmented` controls (text size ×5, density ×2, motion ×3, art ×3, glow ×2).
9. **Bottom nav** — present.
10. **Other** — three explanatory footnotes (no-green rationale, whole-scale rationale, art rationale).

---

### 3.11 SYSTEM

**PAGE:** System · **ROUTE:** `/profile/settings/system`

1. **Header** — `SYSTEM` + Back. 2. **Artwork** — none. 3. **Summary** — none.
4/5/6. **Groups and lists**
   - **Reminders** — 3 rows (`reminder-career`, `reminder-dsa`, `reminder-training`), each showing "at \<place\>, \<action\>" as description and the time as trailing value, with a chevron. Footnote explains changes are recorded as amendments.
   - **The day** — 3 read-only rows: **Day begins** `04:00`, **Day closes** `03:00` (+ explanation), **Time zone** `Asia/Kolkata`. Footnote explains why these are fixed.
   - **This device** — one non-interactive **Offline** row.
   - **Install card** — rendered outside the groups; **only appears when the browser fires `beforeinstallprompt`** (absent in Chromium during the live audit).
7. **Charts** — **none.** 8. **Controls** — 3 reminder rows + Back. 9. **Bottom nav** — present.

---

### 3.12 REMINDER EDITOR

**PAGE:** Reminder editor · **ROUTE:** `/profile/settings/system/:questKey`

1. **Header** — the quest name (`CAREER` / `DSA` / `TRAINING`) + Back.
2. **Artwork** — none. 3. **Summary** — the sentence read back whole in display serif: *"At 08:35 at my desk I will open the job board before anything."*, updating live as you type.
4. **Main content** — three fields: **Time** (`input[type=time]`), **Place**, **First action**.
5–7. No cards, no lists, **no charts**.
8. **Controls** — **Save amendment** (`PrimaryButton`, disabled until place and action are non-empty) + Back.
9. **Bottom nav** — present. 10. `data-testid="reminder-screen"`.

---

### 3.13 DATA

**PAGE:** Data · **ROUTE:** `/profile/settings/data`

1. **Header** — `DATA` + Back. 2. **Artwork** — none. 3. **Summary** — the backup status line.
4/5/6. **Cards and groups**
   - **Data safety** (`backup-card`) — status line (`backup-status`, e.g. "Never backed up — arc started 4 days ago"; turns `--state-alert` at ≥14 days), **Export backup**, **Import backup**, a hidden file input, and on file select an inline **red-bordered confirmation** (`import-confirm`) naming the file and event count with **Cancel** / **Replace and import**
   - **Paper log import** (`paper-import-card`) — **Import daily log CSV**, **Import DSA log CSV**, two hidden file inputs, and an inline **preview** (`paper-import-preview`) showing rows parsed, a skipped-row error list, and **Cancel** / **Import n**
   - **Storage** — "Used on this device", approximate `usage / quota` in mono. Renders only if `navigator.storage.estimate()` resolves (present in the live audit)
   - **Integrity** — a **Verify integrity** action row (no chevron), and on completion an inline `integrity-report` reading "Clean — the rebuild matches the live tables exactly." or a discrepancy list
7. **Charts** — **none.** 8. **Controls** — 6 buttons + 3 file inputs + Back. 9. **Bottom nav** — present.

---

### 3.14 ABOUT

**PAGE:** About · **ROUTE:** `/profile/settings/about`

1. **Header** — `ABOUT` + Back. 2. **Artwork** — none. 3. **Summary** — none.
4/5/6. **Groups**
   - **This build** — **Version** (`0.0.1`, injected from `package.json` at build time), **Storage** ("on this device only")
   - **This arc** — **Started**, **Ends**, **Day** `n / 120`, **Time zone** — all mono, all read-only
   - **Danger** (`--state-alert` card) — **Reset arc** row; tapping replaces it inline with a confirmation: "Delete this arc and everything logged in it?", "n days of record, starting YYYY-MM-DD. This cannot be undone.", **Keep it** / **Delete arc**
7. **Charts** — **none.** 8. **Controls** — reset row → 2 confirm buttons + Back. 9. **Bottom nav** — present.

---

## 4. Interaction inventory

| Element | Location | Action | Result | Backed by |
|---|---|---|---|---|
| Quest completion circle | Today ×6 | tap | Optimistic toggle + XP, then `completeQuest`/`undoQuest`, projection rebuild, may fire LEVEL UP | **REAL** |
| Quest row body | Today ×6 | tap | Opens quest detail sheet | **REAL** |
| "Mark complete" / "Undo" | Quest detail sheet | tap | Same as the circle, then closes | **REAL** |
| Domain log button | Quest detail sheet | tap | Closes detail, opens that domain's log sheet | **REAL** |
| Maintenance pills (Bath / Ate to plan / Laundry) | Today | tap | Auto-saves `logMaintenance`, no submit; refreshes XP | **REAL** |
| Learning block button | Today | tap | Opens the learning block sheet | **REAL** |
| Revisit **Solved** / **Unsolved** | Today | tap | `logRevisit` (+20 XP), removes the row | **REAL** |
| Recovery reason chip | Today | tap | Selects an optional reason | **REAL** (feeds `WRONG_TIME_PATTERN`) |
| Recovery quest button | Today | tap | `claimRecovery` (+40 XP), card disappears | **REAL** |
| Evening review entry | Today | tap | Opens the evening review sheet | **REAL** |
| SYSTEM / REALITY | Progress | tap | Swaps the sub-view (no navigation) | **REAL** |
| Weekly review | Progress | tap | Opens the weekly review overlay | **REAL** |
| **Passed** / **Not yet** | Skills | tap | `logInterviewBenchmark`, updates status + history | **REAL** |
| DSA / Foundations topic rows | Skills | — | **Not interactive.** No detail screen | n/a |
| AI tier chips | Skills | — | **Not interactive.** Static reference | n/a |
| Career tree rows | Skills | — | **Not interactive.** Read-only rollup | n/a |
| Settings gear | Profile | tap | → `/profile/settings` | **REAL** |
| Next-gate panel | Profile | tap | Opens the checkpoint screen | **REAL** |
| Clear boss | Profile | tap | `clearBoss` (+500 XP) → BOSS CLEARED moment. Disabled until all conditions met | **REAL** |
| Complete Day-0 baseline | Profile | tap | Expands 13 sliders inline (no sheet) | **REAL** |
| Log body metric | Profile | tap | Expands metric picker + stepper inline | **REAL** |
| 1d / 3d / 7d | Profile | tap | `pauseArc` | **REAL** |
| Resume now | Profile | tap | `resumeArc` | **REAL** |
| 4 settings rows | Settings | tap | Navigate to the sub-page | **REAL** |
| 5 theme rows | Appearance | tap | Stamps `data-theme` + persists to `localStorage`; applies instantly | **REAL** |
| 6 accent rows | Appearance | tap | Sets `--accent-user` (or clears it) | **REAL** |
| Text size / density / motion / art / glow | Appearance | tap | Stamps the matching root attribute, applies instantly, persists | **REAL** |
| 3 reminder rows | System | tap | → reminder editor | **REAL** |
| Save amendment | Reminder editor | tap | Appends `PLAN_AMENDED`, rebuilds projections, navigates back | **REAL** |
| Export backup | Data / Weekly review | tap | Serialises the DB, triggers a download, updates last-export | **REAL** |
| Import backup | Data | tap → file → confirm | Replaces the whole DB, reloads the app | **REAL** |
| Import daily / DSA log CSV | Data | tap → file → confirm | Parses, previews errors, writes real events | **REAL** |
| Verify integrity | Data | tap | Rebuilds projections in memory and diffs; writes nothing | **REAL** |
| Reset arc | About | tap ×2 | Deletes all events + projections, → `/onboarding` | **REAL** |
| Copy times | Onboarding step 6 | tap | `navigator.clipboard.writeText`, label flips to "Copied" for 2 s | **REAL** |
| Deep work timer **Start / Stop** | DSA, Build, Learning sheets | tap | Stopwatch + Screen Wake Lock; **Stop** writes the elapsed minutes into the Minutes stepper | **REAL** |
| **PWA shortcuts** | Launcher long-press | tap | Navigates to `/today?open=dsa\|career\|review` — **and nothing else happens** | **PARTIAL** — verified live: `dialogOpen: false` for all three. `OPEN_PARAM` / `parseOpenTarget` have no consumer anywhere in `src/ui/` |

---

## 5. Sheets / modals / overlays

### 5.1 Bottom sheets — 9

All built on `kit/Sheet`: portalled to `<body>`, `role="dialog" aria-modal="true"`, scrim, drag handle, focus trap, scroll lock, `aria-label="Close"` ✕, CSS entrance animation.

| # | Name | Trigger | Content | Actions | Result | Close |
|---|---|---|---|---|---|---|
| 1 | **Quest detail** ×6 | Tap a quest row body | The user's if-then sentence in a `FramedPanel` (when present) + the criterion sentence | Domain log button, Mark complete / Undo | Completes the quest or hands off to a log sheet | ✕ · scrim · drag · Esc · back |
| 2 | **Log application** | CAREER detail, or Career quest | Company, Role, Category (5 chips), Source (5 chips), Resume version `<select>` + "+ New", Why line (≥15 chars) | Log application · Substitute career work instead | Writes the application, runs the quality gate; shows "Logged." or the didn't-pass notice; may auto-complete CAREER | as above |
| 2b | **Substitute work** (same sheet, second mode) | "Substitute career work instead" | Kind (6 chips), Minutes | Log substitute work · Log an application instead | Writes substitute work | as above |
| 3 | **Log problem** | DSA detail | Problem, Topic (9 chips), Difficulty (E/M/H), Outcome (4 chips), Minutes stepper, deep-work timer, Insight | Log problem | Writes the attempt; may fire MASTERY | as above |
| 4 | **Log build session** | BUILD detail | Mode (LEARN/SHIP), Project, Minutes, deep-work timer; on SHIP: Shipped title, Evidence kind (5 chips), and for `project` a "cost per task stated" checkbox | Log session | Writes the session; may fire EVIDENCE ACCEPTED | as above |
| 5 | **Log training** | TRAINING detail | `training` art band (the only log sheet with a plate); Mode (Session/Steps); Session → Type (5 chips), Minutes, RPE; Steps → Steps stepper | Log session / Log steps | Writes session or steps | as above |
| 6 | **Log sleep** | SLEEP detail | Wake time, Sleep time (optional) | Log wake time | Writes the sleep record | as above |
| 7 | **Log screen time** | ATTENTION detail | Explanatory line, Minutes stepper | Log screen time | Writes screentime | as above |
| 8 | **Learning block** | "Learning block · +25 XP" on Today | Topic (9 chips); System Design additionally reveals System, Mode (3 chips), Artifact URL; Minutes, deep-work timer, Note | Log · +25 XP | Writes a block or a system-design study; may fire MASTERY | as above |
| 9 | **Evening review** | "Evening review · 25 seconds" | Energy dots (1–5), Focus dots (1–5), What got in the way (5 chips), Tomorrow's one priority (4 chips), Slept at | Complete day (disabled until a blocker is chosen) | Writes the review, then replaces itself with the daily report | as above |

### 5.2 Full-screen overlays — 3

| Name | Trigger | Content | Actions | Result | Close |
|---|---|---|---|---|---|
| **Checkpoint screen** (`checkpoint-screen`) | Next-gate panel on Profile | `checkpoint` art hero + `DAY n`; verdict in a gold `FramedPanel`; "The gate" checklist (✓/✗ squares); instruments card (Day 0/30/60/90/120 only — **not Day 14**); export prompt | Export · Seal checkpoint (disabled until exported) | Seals the checkpoint; may fire RANK ADVANCED then CHECKPOINT | ✕ · back |
| **Weekly review** (`weekly-review`) | Progress → Weekly review | `SYSTEM EVALUATION`; a gold `review-weekly` band with **XP this week** and **Deep work** + week-over-week delta arrows; "The week" (Career, DSA, Build, Learn, Training); IMPROVED / DECLINED / BOTTLENECK; sleep-DSA insight; Next week — proposed; weekly quest (active or proposal); Data safety | Accept weekly quest · Export backup · Accept | Records the week reviewed; may accept a weekly quest | ✕ · back |
| **Daily report** | Submitting the evening review | `review` art + quiet scrim; DAILY REPORT · DAY n; a panel with XP, Core quests, Arc streak, Strongest, Weakest; a `QuoteCard` with the system message; "tap anywhere" | tap anywhere | Dismisses and closes the review | tap · back |

### 5.3 Moments — 6

| Name | Trigger | Type | Timing | Content | Dismiss |
|---|---|---|---|---|---|
| **LEVEL UP** | Crossing a level boundary, occurrences 1–3 | Full-screen, Blue, `level-up` plate | 700 ms, 3 phases, haptic `[12,40,24]` | "Level" / `01 → 02` / rule / optional UNLOCKED line | tap anywhere |
| *(level-up banner)* | 4th level-up onward | Inline on Today | 6 s auto-clear | `LEVEL nn → nn` | auto |
| **RANK ADVANCED** | Sealing a checkpoint that advances rank | Full-screen, Gold, `rank` plate | 1100 ms, haptic ×5 | "Rank advanced" / `E → D` in display serif / "Evidence cleared a gate. This one is not XP." | tap |
| **CHECKPOINT** | Sealing a checkpoint with improvement | Full-screen, Gold, `checkpoint` plate, **self-paced** | no timer | Step 0: `SEALED` or `E → D`. Step 1: vs-previous comparison rows. Step 2: verdict + ✓/✗ gate list | tap ×3 |
| **BOSS CLEARED** | Clearing a boss | Full-screen, boss-red frame on the Gold `boss-cleared` plate | 1100 ms, 3 phases | "Boss cleared" / `BOSS I` / rule / title | tap |
| **MASTERY** | A genuine mastery advance from the DSA or learning sheet | Bottom toast (`ToastMoment`), accent | 600 ms in, auto-dismiss at 900 ms | `MASTERY  Operating Systems → Introduced` | tap or auto |
| **EVIDENCE ACCEPTED** | Logging a shipped artefact in the build sheet | Bottom toast, **Gold** | 600 ms / 900 ms | `EVIDENCE ACCEPTED  feature · <title>` | tap or auto |

### 5.4 Inline expansions and confirmations — 5

Not overlays: these expand in place on the page.

| Name | Location | Trigger | Content | Actions |
|---|---|---|---|---|
| **Day-0 baseline instruments** | Profile | "Complete Day-0 baseline" | Header + **13 range sliders** (6 self-efficacy 0–100, 4 automaticity 1–7, 3 enjoyment 0–10) | Save baseline · ✕ |
| **Checkpoint instruments** | Checkpoint screen (not Day 14) | "Record Day n instruments" | The same 13 sliders | Save · ✕ |
| **Body metric** | Profile | "Log body metric" | Metric chips (Weight kg / Waist cm / Body fat %), stepper | Log · ✕ · "Saved." |
| **Import confirmation** | Data | Selecting a backup file | "Replace ALL current data with …(n events)?" in a red-bordered box | Cancel · Replace and import |
| **Paper import preview** | Data | Selecting a CSV | Rows parsed, skipped-row errors (first 10) | Cancel · Import n |
| **Reset confirmation** | About | "Reset arc" | "Delete this arc and everything logged in it?" + day count | Keep it · Delete arc |

### 5.5 Notifications

One pattern only: the Today **notice** (`role="status"`, "Could not save — try again.", 3 s auto-clear). There is no toast system, no push notification, no in-app notification centre.

---

## 6. Data displayed in the UI

### Player data
Level · total XP · XP into level · XP for next level · rank letter · arc day number · arc length (120) · arc start date · arc end date · timezone · main quest text · 7-day consistency % · 28-day consistency % · arc streak · reduced-mode flag.
*(The user's **name** is collected in onboarding and stored, but is never displayed anywhere in the UI.)*

### Quest data
Quest title · domain icon · row summary ("3 applications") · criterion sentence · XP value · actual XP granted · "capped" marker · completion state · day-closed disabled state · implementation intention (time / place / first action) · priority line · six core keys (career, dsa, build, training, sleep, attention).

### Progress data
XP meter % · 6 attribute values 0–100 in 4 groups · REALITY 8-row Day-0/Now table · streak line.

### Skill data
9 DSA topics × mastery state · 9 foundation topics × mastery state · counts of touched topics · 21 AI-tier item names across 4 tiers · career-tree rollup (foundations n/9, artifacts by kind, resume versions, applications + quality count, interviews, offers) · interview benchmark pass state + dated attempt history.

### Career data
Company · role · role category · source · resume version list · why-line · quality-gate pass/fail · application count · quality application count · substitute-work kind and minutes · follow-through rate · quality rate.

### Fitness / lifestyle data
Training type · minutes · RPE · steps · wake time · sleep time · screen-time minutes · maintenance flags (bath / fuel / laundry) · body metric kind and value.

### DSA data
Problem title · topic · difficulty (E/M/H) · outcome (first attempt / hint / editorial / unsolved) · minutes · insight · revisits due with title · first-attempt-medium rate · problem count.

### Checkpoint / rank data
Next checkpoint day · days until · verdict sentence · gate conditions with met/unmet · sealed state · rank after · export-verified state · vs-previous comparison rows.

### Boss data
Boss id (I–IV) · title · window start/end day · conditions with met/unmet · met count · cleared state · days until the window opens.

### Review data
Energy · focus · blocker · tomorrow's priority · slept-at · daily report (XP, core n/m, arc streak, strongest, weakest, system message) · weekly metrics this week and last (XP, deep-work minutes, applications, quality applications, problems, build sessions, learn blocks, training sessions, mean steps) · improved/declined attributes · bottleneck · rule proposals · resume nudge · sleep-DSA correlation · weekly quest description/progress/target/XP · backup status.

### Achievements
8 achievements (First Move, Two Weeks, Century, Shipped, Return, Regular, In Public, The Arc) and 5 identities (Problem Solver, Builder, Consistent, Someone Who Trains, Someone Who Keeps Promises) — **earned items only**; the component renders nothing when none are earned.

### Settings data
Theme · accent · text scale · density · motion · art intensity · glow · app version · storage used/quota · arc hours · three reminder times/places/actions.

---

## 7. Charts / graphs / visualisations

There are **no conventional charts anywhere in the application** — no line graphs, no bar charts, no pie charts, no sparklines, no timelines, no drawn trees, no heatmaps. Every visualisation is a bar, a segment strip, or a table.

| # | Visualisation | Where | Represents | Data | Real? | Interactive | Range |
|---|---|---|---|---|---|---|---|
| 1 | **XP meter** (`MeterBar`) | Today, Progress SYSTEM, Profile | Progress to the next level | `xpIntoLevel / xpForNext` from the XP ledger | REAL | No | Current level only |
| 2 | **Attribute meters** ×6 | Progress SYSTEM, Profile | Each attribute 0–100 | `getAttributes` | REAL | No | Rolling 28 days |
| 3 | **Mastery segment bars** ×18 | Skills | Ordinal mastery per topic | `getDsaTopicMastery` / `getFoundationTopicMastery` | REAL | No | All-time |
| 4 | **REALITY table** | Progress REALITY | Day 0 → Now on 8 measures | `getRealitySummary` | REAL | No | Cumulative all-time |
| 5 | **Career tree rows** | Skills | 7-branch rollup | live table counts | REAL | No | All-time |
| 6 | **Boss condition checklist** | Profile | 5 conditions met/unmet | `getBossStatus` | REAL | No | Boss window |
| 7 | **Checkpoint gate checklist** | Checkpoint screen, CHECKPOINT moment | Rank-gate conditions | `computeGateEvidence` | REAL | No | As of today |
| 8 | **Weekly delta arrows** | Weekly review | Week-over-week movement | this week vs last week | REAL | No | 7 vs 7 days |
| 9 | **Vs-previous comparison rows** | CHECKPOINT moment step 1 | Change since the last checkpoint | `getCheckpointComparison` | REAL | No | Checkpoint to checkpoint |
| 10 | **Step rail** | Onboarding | Step n of 6 | local state | REAL | No | n/a |
| 11 | **Instrument sliders** ×13 | Baseline / checkpoint instruments | Self-report input | local → event log | REAL | **Yes** (input) | Point in time |
| 12 | **Dot pickers** ×2 | Evening review | Energy / focus 1–5 | local → event log | REAL | **Yes** (input) | Today |
| 13 | **Preview meter** | Appearance | Nothing — a sample at a fixed 62 % | hardcoded | **STATIC** | No | n/a |

**Pages with no charts at all:** Splash, Start, Onboarding (rail only), Progress REALITY, Settings index, System, Reminder editor, Data, About, and every log sheet except the two input widgets above.

---

## 8. Quest system UI

### Where quests appear
Only on **Today**. There is no quest list on any other screen, no history view, no calendar.

### Categories
Six core quest keys, fixed: `career` (100 XP, CAREER), `dsa` (100, MIND), `build` (100, CRAFT), `training` (100, BODY), `sleep` (60, SLEEP), `attention` (40, ATTENTION) — 500 XP/day from core.
Non-core surfaces on Today: **learning block** (+25, not a quest), **revisits** (+20 each), **weekly quest** (+200), **recovery quest** (+40), **maintenance** (+20 category cap).

### States rendered
| State | Appearance |
|---|---|
| Available | Hollow ring, pending grey, XP in `--faint` |
| Complete | Filled disc inside a lit accent ring, glow; XP in accent; icon tile "active" |
| Capped | XP followed by a small "capped" marker |
| Day closed | Whole row at 40 % opacity, both buttons `disabled` (verified live) |
| Missed (yesterday) | Not shown on the row — surfaces as the recovery card |
| Locked | **Not implemented.** No quest is ever locked in the UI |

### Quest row anatomy
`data-testid="quest-row-<key>"`, min-height 64 px, two ≥44 px targets:
icon tile → title → row summary → mono XP → completion circle (`aria-label="Complete X"` / `"Undo X"`, `aria-pressed`).

### Quest detail
Title, the user's if-then sentence framed and quoted (career/dsa/training only), the criterion sentence, an optional domain-log button, and Mark complete / Undo. **Deliberately quote-free.**

### Editing / undo
- **Undo:** yes — tapping a completed circle reverses it and removes the XP.
- **Editing a quest:** no. Titles, criteria and XP are generated from config and are not editable.
- **Editing the intention:** yes, but from Settings → System → reminder, not from the quest.
- **Filters / grouping / sorting:** none. Fixed order, always all six.

### Complete flow

```
VIEW      six rows on Today, ordered by key, each showing title + criterion summary + XP
  ↓
OPEN      tap the row body → detail sheet (if-then sentence + full criterion)
  ↓
ACT       either  (a) "Mark complete"                    → manual completion
          or      (b) the domain log button               → log sheet with real fields
  ↓
COMPLETE  optimistic circle fill + optimistic XP (<300 ms), then the real write:
          completeQuest → event appended → projections rebuilt
          (a logged domain action may auto-complete the quest instead)
  ↓
XP        XP meter animates; the mono figure is announced via aria-live;
          the row's XP turns accent and may show "capped"
  ↓
RESULT    priority line advances to the next incomplete quest;
          crossing a level boundary fires LEVEL UP (1st–3rd) or an inline banner (4th+);
          a mastery advance or a shipped artefact fires its own toast
```

---

## 9. Progress / level / rank UI

| Concept | Where it appears | What the user can do |
|---|---|---|
| **XP** | Today identity block (meter + mono figure, `aria-live`), per-row XP, Progress level card, Profile hero, weekly review | Earn it. Never edit it |
| **Level** | `LV n` on Today, Progress, Profile; `01 → 02` in the LEVEL UP moment | View only |
| **Level progression** | XP meter ×3 screens + `xpIntoLevel / xpForNext` | View only |
| **Level unlocks** | Printed on the LEVEL UP moment as "UNLOCKED · …" | **Display only — not enforced.** No screen or feature is gated by level anywhere in the UI |
| **Rank** | `RANK X` on Today, Progress SYSTEM, Profile hero | View only |
| **Rank progression** | Checkpoint screen verdict + gate checklist; RANK ADVANCED moment | Seal a checkpoint |
| **Attributes** | 6 bars in 4 groups, on **both** Progress SYSTEM and Profile | View only. Not editable, no drill-down |
| **Streaks** | Mono line on Today and Progress SYSTEM: `n% (7d) · n% (28d) · streak n`; reduced-mode line on Today | View. Claim a recovery quest |
| **Progress (real-world)** | Progress REALITY 8-row table | View only |
| **Evidence** | Skills career tree, REALITY table, boss conditions, checkpoint gate, EVIDENCE ACCEPTED toast | Generate it by logging |
| **Checkpoints** | The next-gate `FramedPanel` on Profile → full checkpoint screen | Export, then seal |
| **Achievements** | Chips on Profile (`achievements-list`) — 8 achievements + 5 identities, **earned only** | View only. No locked-item grid |
| **Milestones** | Bosses (§13) and checkpoints. No separate milestone UI | — |

---

## 10. Skills UI

| Element | Present | Detail |
|---|---|---|
| Skill categories | Yes | 4 sections: DSA, SE Foundations, AI / Agentic tiers, Career tree |
| Skill list | Yes | 9 DSA + 9 foundations = 18 tracked topics |
| Skill levels | Yes | 5 ordinal mastery states: unseen → introduced → applied → fluent → retained |
| Skill progress | Yes | A 5-segment bar per topic, plus the state word once touched |
| Skill trees | **No drawn tree.** "Career tree" is a 7-row flat label/value list | |
| DSA | Yes | 9 topics with live mastery |
| AI | **Static reference only** | 21 hardcoded item names in 4 tiers; no tracking, no state, not interactive |
| Career | Yes | 7-row rollup of real tables |
| Foundations | Yes | 9 topics with live mastery |
| Mastery indicators | Yes | Segment bar + state word + the two band counts |
| Benchmark card | Yes | The screen's only `FramedPanel`: criterion text, pass state, Passed / Not yet, dated history |
| Skill detail screens | **None** | No topic is tappable |
| Interactions | **Two buttons on the entire screen** | Passed / Not yet |

---

## 11. Profile UI

| Element | Present | Detail |
|---|---|---|
| Player identity | Partial | The **main quest sentence** is the hero. The user's **name is never shown** |
| Level | Yes | `LV n` + XP meter + `x / y to Ln+1` + total |
| Rank | Yes | `RANK X` in display serif |
| Attributes | Yes | The same 6 bars as Progress |
| Achievements | Yes | Chips, earned-only; identities styled louder. Hidden entirely when nothing is earned |
| Checkpoint | Yes | The next-gate `FramedPanel`, turning gold when due → checkpoint screen |
| Bosses | Yes | Band art + either the open boss card with its checklist, or the locked "opens Day 25" card |
| Body / fitness | Partial | **Log body metric** (weight / waist / body fat) writes real data. **No body history, no chart, no 1RM anywhere** |
| Career info | **Not on Profile** | Career data lives on Skills (career tree) and Progress REALITY |
| Settings | Yes | Gear icon in the header → `/profile/settings` |
| Other | Yes | Day-0 baseline instruments; arc pause 1d/3d/7d + resume; a dev-only reset block that never ships |

---

## 12. Daily / weekly review UI

### Evening review → daily report

```
Today: "Evening review · 25 seconds"   (hidden once today's review exists)
  ↓  bottom sheet "Day n · Evening"
     Energy    ● ○ ○ ○ ○      (5 dots, default 3)
     Focus     ● ○ ○ ○ ○      (5 dots, default 3)
     What got in the way?      Time · Tired · Wrong time · Didn't want to · Nothing   [required]
     Tomorrow's one priority   Career · DSA · Build · Train                            [optional]
     Slept at                  time input (default 02:00)
  ↓  "Complete day"  (disabled until a blocker is chosen)
  ↓  completeEveningReview → getDailyReport
  ↓  FULL-SCREEN DAILY REPORT
     DAILY REPORT · DAY n
     XP            100
     Core quests   1 / 6
     Arc streak    1 day
     Strongest     CAREER — 1st consecutive day        (own line, sans)
     Weakest       ATTENTION — 5 misses in 5           (own line, sans)
     QuoteCard: the system message, attributed "— SYSTEM"
     "tap anywhere"
  ↓  tap → dismissed; the Today entry is gone and stays gone across reloads
```

### Weekly review

```
Progress → "Weekly review"
  ↓  full-screen "SYSTEM EVALUATION"
     [gold band, review-weekly art]  XP this week ▲n   ·   Deep work ▲n m
     THE WEEK    Career 0 applications (0 quality) · DSA 0 problems ·
                 Build 0 sessions · Learn 0 blocks · Training 0 sessions · steps 0/day
     IMPROVED / DECLINED / BOTTLENECK  (attribute names)
     [sleep-DSA insight panel]         only when missed nights > 0
     NEXT WEEK — PROPOSED              rule proposals + resume nudge
     WEEKLY QUEST                      active progress, or a proposal with
                                       "Accept weekly quest · +200 XP"
     DATA SAFETY                       backup status + "Export backup"
     [Accept]
  ↓  Accept → recordWeekReviewed (carrying the accepted quest, if any) → closes
```

**Review questions asked:** energy, focus, blocker, tomorrow's priority, slept-at. Five inputs, no free text — matching the "no typing" constraint.
**System messages:** the Today reflection line (`system-line`) and the daily report quote, both drawn from `engine/messages.ts` / `engine/reflections.ts`; shown reflections are recorded so they do not repeat.

---

## 13. Boss UI

Everything boss-related lives in one component on Profile (`data-testid="boss-list"`).

| Element | Implemented | Detail |
|---|---|---|
| Boss list | Yes | 4 bosses defined: I FIRST EVIDENCE (days 25–35), II STRONG ENGINEERING BASE (50–70), III AI ENGINEER (75–95), IV INTERVIEW READY (100–120) |
| Boss detail | **No separate screen** | Everything is inline on the card |
| Locked state | Yes | Before any window opens: `boss-throne` art + "BOSS I · FIRST EVIDENCE" + "Opens Day 25 · 20 days away" |
| Requirements | Yes | Verified live at Day 35: 5 conditions listed — "0 problems (need 55)", "0 training sessions (need 12)", "0 quality applications (need 70)", "AI feature in a public repo with a README", "Day-30 checkpoint sealed" |
| Progress | Yes | "Days 25-35 · n of 5 met" + a filled/hollow square per condition |
| Challenge action | Yes | "Clear boss · +500 XP", `disabled` until every condition is met |
| Cleared state | Yes | "✓ BOSS I · …", card edge drops from boss-red to hairline, the button disappears |
| Rewards | Yes | +500 XP, stated on the button |
| Evidence | Yes | Conditions are computed from real tables via `getBossStatus` |
| Animation / moment | Yes | BOSS CLEARED full-screen moment on success |
| Filtering | Only open-or-cleared bosses are listed; if none, the next locked one is shown instead | |

---

## 14. Settings UI

### APPEARANCE — `/profile/settings/appearance`

| Setting | Current default | Options | On change |
|---|---|---|---|
| **Theme** | `arc` | Arc · Dawn · Abyss · High contrast · Daylight | Stamps `data-theme` on `<html>`, persists to `localStorage['system.settings.v1']`, repaints instantly, survives reload via the inline bootstrap in `index.html` |
| **Accent** | `theme` (follows the theme) | Theme default · Mana blue · Monarch violet · Frost · Ember · Gold (**no green**, by design) | Sets or clears `--accent-user`; also stamps `data-accent`, which swings `--state-recover` cool for the two warm accents |
| **Text size** | `m` | XS 0.88 · S 0.94 · M 1.0 · L 1.12 · XL 1.25 | Stamps `data-text-scale`, which drives `--type-scale` — multiplies the **whole** type scale |
| **Density** | `comfortable` | Comfortable · Compact | Stamps `data-density`; compact sets `--gutter: 18px`, `--row-min: 56px` |
| **Motion** | `system` | System · Full · Reduced | Stamps `data-motion`; read by `index.css`, by `MotionConfig` (framer), and by the Moments' own check (which also governs haptics) |
| **Art intensity** | `full` | Full · Dim · Off | Stamps `data-art`; sets `--art-opacity` to 1 / 0.45 / 0. Off also nulls the glow tokens |
| **Glow** | `on` | On · Off | Stamps `data-glow`; off nulls `--glow-*` |

All apply on tap. **There is no Save button anywhere in settings.**

### SYSTEM — `/profile/settings/system`

| Setting | Current value | Options | On change |
|---|---|---|---|
| **Career reminder** | from onboarding, e.g. `08:35 / my desk / open the job board before anything` | Free text + time | Appends `PLAN_AMENDED`, rebuilds projections; the new sentence appears in the quest detail sheet |
| **DSA reminder** | e.g. `22:00` | same | same |
| **Training reminder** | e.g. `20:15` | same | same |
| **Day begins** | `04:00` | **Read-only** | — |
| **Day closes** | `03:00` | **Read-only** | — |
| **Time zone** | `Asia/Kolkata` | **Read-only** | — |
| **Offline** | informational row | none | — |
| **Install this as an app** | only when `beforeinstallprompt` fired | Install | Calls the browser prompt |

### DATA — `/profile/settings/data`

| Setting / action | Value | What happens |
|---|---|---|
| Backup status | "Never backed up — arc started n days ago" / "Last backup: today" | Turns `--state-alert` at ≥14 days |
| Export backup | — | Downloads a JSON snapshot, records `last_export_at` |
| Import backup | — | File picker → inline red confirmation → replaces the entire DB → reloads |
| Import daily log CSV | — | File picker → preview with parse errors → writes real events |
| Import DSA log CSV | — | same |
| Storage used | e.g. `2.6 MB / 3.00 GB` | Read-only; row absent if the browser refuses to answer |
| Verify integrity | — | Rebuilds projections in memory, diffs against stored, prints clean/discrepancies. Writes nothing |

### ABOUT — `/profile/settings/about`

| Item | Value | Editable |
|---|---|---|
| Version | `0.0.1` (from `package.json` at build time) | No |
| Storage | "on this device only" | No |
| Started / Ends / Day / Time zone | from the arc row | No |
| **Reset arc** | — | Two taps → deletes every event and projection → `/onboarding`. Appearance settings survive |

---

## 15. Art / visual assets per page

16 slots declared, **15 used, 1 unused**. All 16 encoded at 440 w / 880 w webp with inline LQIP.

| Page / surface | Slot | Treatment |
|---|---|---|
| Splash | `boot` | Full-screen, `moment` scrim, priority |
| Start | `start-hero` | Full-screen, `hero` scrim, priority, zoom 1.22 |
| Onboarding steps 1 & 6 | `onboarding` | Full-screen, `moment` scrim |
| Today | `today` | **Corner bleed** — 210×170 top-right, `mix-blend-lighten`, 50 % opacity, radial mask, no scrim |
| Progress SYSTEM | `progress` | Card background, 210 px, `hero` scrim |
| Progress REALITY | — | **No art** |
| Skills | `skills` | 132 px band, `band` scrim |
| Profile — boss band | `boss` (window open) / `boss-throne` (locked) | 104 px band, `band` scrim |
| Profile — elsewhere | — | **No art** |
| Checkpoint screen | `checkpoint` | 220 px hero, `hero` scrim, priority |
| CHECKPOINT moment | `checkpoint` | Full-screen, `moment` scrim |
| LEVEL UP moment | `level-up` | Full-screen, `moment` scrim, zoom 1.6 |
| RANK ADVANCED moment | `rank` | Full-screen, `moment` scrim, zoom 1.5 |
| BOSS CLEARED moment | `boss-cleared` | Full-screen, `moment` scrim, zoom 1.45 |
| Weekly review | `review-weekly` | 150 px gold band, `band` scrim, zoom 1.5 |
| Daily report | `review` | Full-screen, `quiet` scrim |
| Training log sheet | `training` | 110 px band inside the sheet — the only log sheet with art |
| All settings pages | — | **No art, no glow** (0 art layers, verified live) |
| MASTERY / EVIDENCE toasts | — | No art |
| **`quote`** | — | **Declared, encoded, and referenced by no component** |

**Icons:** Phosphor React throughout — `House`, `ChartLineUp`, `TreeStructure`, `UserCircle` (nav); `Briefcase`, `Code`, `Cpu`, `Barbell`, `MoonStars`, `Eye` (quest rows); `PaintBrush`, `SlidersHorizontal`, `Database`, `Info`, `GearSix`, `CaretLeft`, `CaretRight`, `Check` (settings/chrome).
**Fonts:** Inter (400/500/600), Cormorant Garamond (300/400/500), JetBrains Mono (400/500) — latin subsets, self-hosted, precached.
**Other imagery:** none. No avatars, no illustrations beyond the 16 plates, no logos.

---

## 16. Responsive / mobile UI

| Breakpoint | Behaviour |
|---|---|
| **< 360 px** | `--gutter` tightens to 18 px regardless of density |
| **< 640 px (mobile)** | Full-bleed single column on the app ground. `h-dvh`, never `vh`. Bottom nav is a flex sibling of the scrolling `<main>`, not fixed. Safe-area insets top and bottom |
| **≥ 640 px (`sm:`)** | The column becomes a **centred 430 px device frame**: `max-w-shell` (430 px), `min(880px, 92dvh)` tall, 40 px radius, hairline border, drop shadow, on a radial-gradient page ground |
| **≥ 1024 px (desktop)** | **No further change.** Same 430 px frame. `final/06`'s left rail at ≥1024 px is explicitly dropped |

- **Mobile navigation:** bottom tab bar, always visible, including inside settings sub-pages.
- **Desktop layout:** the phone frame, centred. No sidebar, no multi-column, no dashboard.
- **Sheets:** always bottom sheets, `max-h-86dvh`, capped at `max-w-shell` so they match the frame width on desktop.
- **Full-screen pages:** Splash, Start, Onboarding have no bottom nav; overlays cover the frame, not the browser window.
- **Components that change layout by width:** only the gutter (below 360 px) and the shell frame (at 640 px). No component reflows, no columns collapse, no navigation changes shape.
- **Density setting** additionally changes `--gutter` and `--row-min` independently of width.
- **Verified:** `tests/e2e/responsive.spec.ts` runs 6 viewports (320×568, 360×640, 412×915, 430×932, 768×1024, 1280×800) × 9 routes × 2 text scales, plus all 5 themes on the 4 tabs — asserting no horizontal scroll, 44 px targets, no clipped text, and no nav-over-content. 103/103 passing.

---

## 17. Empty / loading / error / locked states

| State | Where | What the user sees |
|---|---|---|
| **Loading — boot** | App root | The Splash screen, minimum 900 ms |
| **Loading — screen data** | Today, Progress, Skills, Profile | `return null` until the first IndexedDB read resolves — **a blank area, no skeleton, no spinner** |
| **Loading — weekly review** | Weekly review overlay | "Loading…" text |
| **Loading — action in flight** | Every log sheet, boss clear, checkpoint seal, reset | The button's own label changes: "Logging…", "Clearing…", "Sealing…", "Saving…", "Exporting…", "Importing…", "Verifying…", "Resetting…", "Initialising…" |
| **Empty — no quests** | Today priority line | "No quests today." / "Arc begins YYYY-MM-DD." / "Arc complete. See your report." |
| **Empty — all complete** | Today priority line | "Six of six. Day closed." |
| **Empty — no achievements** | Profile | The whole `achievements-list` component renders nothing (verified live) |
| **Empty — no bosses open** | Profile | Falls back to the next locked boss on the throne plate |
| **Empty — no revisits / no weekly quest** | Today | Those blocks are simply absent |
| **Empty — zero data** | Progress REALITY, weekly review, Skills | Real zeros and em-dashes (`0`, `—`, `0 / 9`), never "no data yet" copy |
| **Empty — no streak** | Today | The streak line is hidden when all three values are 0 |
| **Error — write failed** | Today | `role="status"` notice: "Could not save — try again.", optimistic state rolled back, 3 s auto-clear |
| **Error — onboarding failed** | Onboarding | `role="alert"`: "Could not save — try again." |
| **Error — bad JSON** | Data | "That file is not valid JSON." |
| **Error — import failed** | Data | The validation message, or "Could not import — try again." |
| **Error — CSV rows skipped** | Data | Up to 10 error lines in `--state-alert`, plus "…and n more" |
| **Error — seal failed** | Checkpoint | The thrown message, or "Could not seal." |
| **Error — integrity dirty** | Data | A discrepancy list instead of "Clean" |
| **Locked — boss** | Profile | Name + "Opens Day 25 · n days away", dim, no action |
| **Locked — seal** | Checkpoint | "Seal checkpoint" disabled + "Export required to seal — a rank you cannot prove later is not evidence." |
| **Locked — boss clear** | Profile | Button disabled until n of n conditions are met |
| **Locked — by level** | **Nowhere.** Level unlocks are printed on the LEVEL UP moment but never enforced | |
| **Completed — quest** | Today | Filled disc, lit ring, glow, accent XP |
| **Completed — checkpoint** | Checkpoint | "Sealed. Rank X." in gold, actions replaced |
| **Completed — benchmark** | Skills | "✓ Passed." in glowing accent |
| **Failed — quality gate** | Career sheet | Amber-ruled panel: "Logged, but the quality gate didn't pass — this one earns 0 XP. Flagged for the weekly review." |
| **Recovery** | Today | The amber recovery card (never red), with an optional reason and a claim button |
| **Reduced mode** | Today | "Reduced to the floor for two days. The arc continues." |
| **Disabled — day closed** | Today | Every quest row at 40 % opacity, both buttons disabled, plus the banner (verified live) |
| **Disabled — paused arc** | Profile | Amber-edged card, "Paused. No quests generate. Zero penalty.", Resume now |
| **First-time user** | `/start` → onboarding | The Start screen and the 6-step flow |
| **Returning user** | Splash → `/today` | Straight to Today; each tab restores its own scroll position |

---

## 18. Real vs mock vs placeholder

| Feature | Location | Status | Evidence |
|---|---|---|---|
| Quest completion / undo | Today | **REAL** | `completeQuest` / `undoQuest` → event append → `rebuildProjections` |
| XP, level, level-up detection | Today, Progress, Profile | **REAL** | Summed from `xp_ledger`; `levelFor()` recomputed after every write |
| XP category caps / "capped" marker | Today | **REAL** | `getDayXpByInstance` returns `cappedFrom` |
| Rank | Today, Progress, Profile | **REAL** | `getCurrentRank()` reads the sealed-checkpoint table |
| *(`player_state.rank` column)* | projection only | **DEAD FIELD** | Hardcoded `'E'` in `projections.ts:303`; **no UI reads it** — every screen calls `getCurrentRank()` |
| Streak / consistency / reduced mode | Today, Progress | **REAL** | `getStreakState` |
| Recovery card + claim | Today | **REAL** | `getRecoverableDay` / `claimRecovery` |
| Recovery reason chip | Today | **REAL** | Feeds `WRONG_TIME_PATTERN` in `engine/rules.ts` |
| Priority line | Today | **REAL** | Derived from live templates + instances |
| Reflection / system line | Today | **REAL** | `getTodaySystemLine`, shown reflections recorded |
| Maintenance pills | Today | **REAL** | `logMaintenance`, auto-saved |
| Weekly quest card | Today | **REAL** | `getActiveWeeklyQuest` |
| Revisits due | Today | **REAL** | `getRevisitsDue` / `logRevisit`, SRS-scheduled |
| Learning block | Sheet | **REAL** | `logLearningBlock` / `logSystemDesignStudy` |
| DSA logging + mastery | Sheet | **REAL** | `logProblem`, mastery diffed before/after |
| Career logging + quality gate | Sheet | **REAL** | `logApplication` returns the real pass/fail |
| Resume versions | Career sheet | **REAL** | `getResumeVersions` / `createResumeVersion` |
| Substitute career work | Career sheet | **REAL** | `logSubstituteWork` |
| Build session + ship bonus | Sheet | **REAL** | `logBuildSession`, artifact row written |
| Training session / steps | Sheet | **REAL** | `logTrainingSession` / `logSteps` |
| Sleep / screen time | Sheets | **REAL** | `logSleep` / `logScreentime` |
| Deep work timer | 3 sheets | **REAL** | Stopwatch + Screen Wake Lock; writes minutes into the form |
| Evening review + daily report | Sheet → overlay | **REAL** | `completeEveningReview` / `getDailyReport` |
| Weekly review (all figures) | Overlay | **REAL** | `getWeeklyReview`; this-week vs last-week from real tables |
| Weekly quest proposal / accept | Weekly review | **REAL** | `acceptWeeklyQuest` / `recordWeekReviewed` |
| Rule proposals, resume nudge, sleep-DSA insight | Weekly review | **REAL** | `engine/rules.ts` + `engine/weeklyReview.ts` |
| Attributes ×6 | Progress, Profile | **REAL** | `getAttributes`, 28-day rolling |
| REALITY table | Progress | **REAL** | `getRealitySummary`; the Day-0 column is `0`/`—` **by construction**, not stored |
| Skills DSA / foundations mastery | Skills | **REAL** | `getDsaSkillsOverview` / `getFoundationSkillsOverview` |
| Skills career tree | Skills | **REAL** | `getCareerTreeOverview`, live table counts |
| **Skills AI tiers** | Skills | **STATIC** | 21 hardcoded strings in `Skills.tsx`; no data model, no state, not interactive (matches the spec's "flat reference list") |
| Interview benchmark | Skills | **REAL** | `logInterviewBenchmark` + real history |
| Checkpoint report / gate / seal | Overlay | **REAL** | `getCheckpointReport` / `sealCheckpoint` |
| Checkpoint instruments (13 sliders) | Inline | **REAL** | `saveCheckpointInstruments` |
| Boss list, conditions, clear | Profile | **REAL** | `getBossStatus` / `clearBoss`; verified live at Day 35 |
| Achievements + identities | Profile | **REAL** | `getAchievementsReport` from real evidence |
| Body metric | Profile | **REAL** | `logBodyMetric` |
| Arc pause / resume | Profile | **REAL** | `pauseArc` / `resumeArc` |
| Backup export / import | Data | **REAL** | Round-trip covered by `backup.spec` |
| Paper CSV import | Data | **REAL** | Parses and writes real events |
| Storage estimate | Data | **REAL** | `navigator.storage.estimate()` |
| Verify integrity | Data | **REAL** | `verifyIntegrity()` |
| Reset arc | About | **REAL** | `resetArc()` |
| App version | About | **REAL** | Injected from `package.json` at build time |
| All 7 appearance settings | Appearance | **REAL** | localStorage + root attributes + pre-paint bootstrap |
| Reminder amendment | System | **REAL** | `PLAN_AMENDED` → projections rebuilt |
| Theme live preview | Appearance | **REAL chrome, STATIC data** | Renders live tokens; the quest row, `+100` and 62 % meter are hardcoded sample content |
| **PWA app shortcuts** | Launcher | **PARTIAL** | The three manifest shortcuts resolve to `/today?open=…`, but `OPEN_PARAM` / `parseOpenTarget` have **zero consumers** in `src/ui/`. Verified live: no sheet opens for any of the three |
| **Level-based unlocks** | LEVEL UP moment | **DISPLAY ONLY** | `LEVEL_UNLOCKS` is printed as "UNLOCKED · …"; no `level >=` check exists anywhere in `src/ui/` |
| Install card | System | **REAL but rarely visible** | Returns `null` unless the browser fires `beforeinstallprompt` |
| Dev reset block | Profile | **REAL, dev-only** | `import.meta.env.DEV` — never present in a build |

**No feature in the application renders fabricated or sample data as if it were the user's**, apart from the Appearance preview, which is explicitly a sample.

---

## 19. Complete feature → UI mapping

### TODAY
View the day number, level, XP, rank, streak · complete a quest · undo a quest · open a quest's detail · read the criterion · read your own if-then sentence · log the day's maintenance · log a learning block · log a spaced revisit (solved/unsolved) · claim a recovery quest · state what got in the way · view weekly quest progress · start the evening review · read the priority line and the system reflection.

### QUESTS
Complete · undo · inspect · log the underlying real-world action through six domain sheets · time a deep-work session · see actual vs capped XP.
*Cannot:* create, edit, delete, reorder, filter or schedule a quest.

### PROGRESS
Switch SYSTEM ↔ REALITY · view level, XP, rank, streak · view six attributes · view the Day-0 → Now table · open the weekly review.

### SKILLS
View DSA mastery ×9 · view foundations mastery ×9 · read the AI tier reference · view the career-tree rollup · record an interview-benchmark attempt (pass / not yet) · view benchmark history.

### PROFILE
Read your main quest · view level, XP, rank · view attributes · view earned achievements and identities · see the next rank gate and open it · see the current or next boss and its conditions · clear a boss · complete the Day-0 baseline instruments · log a body metric · pause the arc 1/3/7 days · resume early · open settings.

### REVIEWS
Complete the evening review (5 inputs) · read the daily report · open the weekly review · read week-over-week deltas · read improved/declined/bottleneck · read rule proposals and the resume nudge · accept a weekly quest · export a backup from the review · accept the week.

### BOSSES
See which boss is next and when it opens · see all conditions and how many are met · clear a boss when every condition is met · see the BOSS CLEARED moment · see a cleared boss's history.

### CHECKPOINTS
Open the next gate · read the verdict sentence · read the ✓/✗ gate checklist · export (required) · seal · record the checkpoint instruments · see RANK ADVANCED and the 3-step CHECKPOINT report.

### SETTINGS
Change theme, accent, text size, density, motion, art intensity, glow · preview changes live · edit the three reminders · read the arc's fixed hours · export a backup · import a backup · import paper CSV logs · check storage · verify data integrity · read the version and arc dates · reset the arc.

### OTHER
Create an arc through 6 onboarding steps · copy the three alarm times to the clipboard · install the app (when the browser offers it) · use the whole app offline.

---

## 20. UI screen map

```
APP
│
├── SPLASH                                  (pre-router, 900 ms min, boot art)
│
├── START  /start                           (no nav · start-hero art)
│    └── Begin your journey → ONBOARDING
│
├── ONBOARDING  /onboarding                 (no nav · onboarding art on steps 1 & 6)
│    ├── 1 Framing (name)
│    ├── 2 Arc (dates, day count)
│    ├── 3 Rhythm (wake, sleep, training days, steps, screen cap, apps)
│    ├── 4 Main quest
│    ├── 5 When and where (3 implementation intentions)
│    └── 6 Baseline (height, weight, problems, alarms, copy times)
│
├── TODAY  /today                           (today art, corner bleed)
│    ├── Quest detail sheet  ×6
│    │    ├── Career log sheet ──── Substitute work mode
│    │    ├── DSA log sheet ─────── MASTERY toast
│    │    ├── Build log sheet ───── EVIDENCE ACCEPTED toast
│    │    ├── Training log sheet ── Session | Steps mode  (training art)
│    │    ├── Sleep log sheet
│    │    └── Attention log sheet
│    ├── Learning block sheet ───── MASTERY toast
│    ├── Evening review sheet
│    │    └── Daily report        (full-screen · review art · QuoteCard)
│    ├── LEVEL UP moment          (full-screen · level-up art · 1st–3rd)
│    │    └── level-up banner      (inline, 4th onward)
│    ├── Recovery card            (conditional)
│    ├── Weekly quest card        (conditional)
│    ├── Revisits due             (conditional)
│    └── Maintenance card
│
├── PROGRESS  /progress
│    ├── SYSTEM   level card (progress art) · streak · 6 attribute bars
│    ├── REALITY  Day-0 → Now table  (default from Day 30)
│    └── Weekly review            (full-screen · review-weekly art)
│
├── SKILLS  /skills                         (skills art band)
│    ├── DSA ×9
│    ├── SE Foundations ×9
│    ├── AI / Agentic tiers ×4  (static)
│    ├── Career tree ×7
│    └── Interview-readiness benchmark
│
└── PROFILE  /profile
     ├── Main quest hero · LV · RANK · XP meter
     ├── The next gate → CHECKPOINT SCREEN   (checkpoint art)
     │      ├── Day-N instruments (inline, not Day 14)
     │      ├── RANK ADVANCED moment          (rank art)
     │      └── CHECKPOINT moment  step 0 → 1 → 2
     ├── Bosses  (boss / boss-throne art)
     │      └── BOSS CLEARED moment           (boss-cleared art)
     ├── Achievements + identities  (earned only)
     ├── Attribute bars ×6
     ├── Day-0 baseline instruments  (inline, 13 sliders)
     ├── Body metric                 (inline)
     ├── Arc pause  1d / 3d / 7d · Resume now
     ├── [dev only] Reset arc
     └── SETTINGS  /profile/settings
          ├── APPEARANCE  /appearance
          │     └── live preview · theme ×5 · accent ×6 · text ×5 ·
          │        density ×2 · motion ×3 · art ×3 · glow ×2
          ├── SYSTEM  /system
          │     ├── Reminder editor  /system/:questKey  (career|dsa|training)
          │     ├── The day  (read-only ×3)
          │     └── This device · install card (conditional)
          ├── DATA  /data
          │     ├── Backup  → import confirmation (inline)
          │     ├── Paper import → preview (inline)
          │     ├── Storage
          │     └── Verify integrity → report (inline)
          └── ABOUT  /about
                ├── This build · This arc
                └── Reset arc → confirmation (inline)
```

---

## 21. Final summary

**A. Main pages — 4**
Today · Progress · Skills · Profile.

**B. Child pages — 8**
Start · Onboarding · Settings index · Appearance · System · Reminder editor · Data · About.
(Plus Splash, which is a pre-router state rather than a page, and 3 redirect-only shortcut routes.)

**C. Sheets — 9**
Quest detail (6 content variants) · Career log (2 modes) · DSA log · Build log · Training log (2 modes) · Sleep log · Attention log · Learning block · Evening review.

**D. Modals / dialogs / full-screen overlays — 3 + 6 inline confirmations**
Overlays: Checkpoint screen · Weekly review · Daily report.
Inline (not overlays): Day-0 instruments · Checkpoint instruments · Body metric · Import confirmation · Paper import preview · Reset confirmation.

**E. Special moments — 6 (+1 degraded form)**
LEVEL UP · RANK ADVANCED · BOSS CLEARED · CHECKPOINT (3 steps) · MASTERY toast · EVIDENCE ACCEPTED toast. Plus the inline level-up banner from the 4th level-up onward.

**F. Major features exposed through the UI — 34**
Arc creation · quest completion · quest undo · quest detail · career logging · substitute career work · resume versions · DSA logging · spaced revisits · build logging · artifact shipping · training logging · steps logging · sleep logging · screen-time logging · maintenance · learning blocks · system-design study · deep-work timer · evening review · daily report · weekly review · weekly quests · recovery quests · attributes · skills mastery · career tree · interview benchmark · checkpoints · rank gates · bosses · achievements · body metrics · arc pause · backup/restore · paper import · integrity check · settings and theming · reminder amendment · arc reset.

**G. Fully functional — everything above except the four entries in H–J.**

**H. Partial — 1**
- **PWA app shortcuts.** All three manifest shortcuts navigate to `/today?open=<target>`; no code reads the parameter, so no sheet opens. Verified live on all three.

**I. Mocked — 0**
No feature displays fabricated user data. The only static content is the Appearance preview's sample row and meter, which is explicitly a sample, and the Skills AI-tier list, which the spec defines as a reference list rather than tracked data.

**J. UI present but no functionality — 2**
- **Level unlock lines.** `LEVEL_UNLOCKS` is displayed on the LEVEL UP moment as "UNLOCKED · Weekly quests" etc., but no screen, tab or feature is gated by level anywhere in `src/ui/`.
- **`quote` art slot.** Declared in the manifest, encoded at both widths, shipped in the bundle, referenced by no component.

**K. Documented in the product/design docs but not represented in the UI**

| # | Documented | Source | Current state |
|---|---|---|---|
| 1 | **REALITY "EXTERNAL" block** — Responses, Calls, Loops, Offers + a response-rate-by-category insight | `final/06` §5.5 | **Absent from the UI.** `funnelFrom()` computes all four numbers and `getRealitySummary` calls it, but reads only `qualityPassRate`; the funnel figures are discarded |
| 2 | **REALITY physical/lifestyle rows** — Sessions, Est. 1RM aggregate, Wake SD, Screen time | `final/06` §5.5 | **Absent.** The REALITY table has 8 rows, none of them physical |
| 3 | **Per-lift logging and estimated 1RM** | `final/04` §2; `engine/training.ts` `estimate1RM`, `TrainingSessionRow.lifts` | **No UI entry point.** The training sheet collects type, minutes, RPE, steps — never a lift, weight or rep count |
| 4 | **Application status progression** (responded → call → interview → offer) and follow-ups | `engine/career.ts`, `store/career.ts` `logCareerEvent` / `logFollowup` | **No UI caller** for either function. An application can be created but never advanced |
| 5 | **Level-gated tabs** — "SKILLS unlocked at L10", "three tabs until L10", weekly quests at L3, boss quests at L15 | `final/06` §2; `levelUnlocks.ts` | **Not enforced.** All four tabs and every feature are available from Day 1 |
| 6 | **Checkpoints reachable from PROGRESS** | `final/06` §2 (PROGRESS contents include "checkpoints") | Checkpoint is reachable **only** from Profile |
| 7 | **Quest "5-min version"** (minimum viable day) | `final/06` §3 screen list; `config.mvdXp = 35` | **No MVD affordance in the UI.** The engine models it; the quest sheet offers only "Mark complete" |
| 8 | **Body-measurement history / metric series** | `store/training.ts` `getMetricSeries` | Function exists with **no UI caller**. Metrics can be logged but never reviewed |
| 9 | **User's name** | Collected in onboarding step 1, persisted | Never displayed on any screen |
| 10 | **Reminder times as actual alarms/notifications** | `final/06`; onboarding step 6 | The app **prints the times and copies them to the clipboard** for manual entry into a Clock app. No notification API is used anywhere |

---

*End of inventory. No application code was modified in producing this report.*
