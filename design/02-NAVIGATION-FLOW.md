# Navigation Flow

Every route, sheet, moment and transition in one place. This is the contract the router,
the `PageTransition` component and the back-button behaviour all implement.

Two rules govern everything below:

1. **The four tabs are the only persistent navigation.** Everything else is a child route,
   a sheet, or a moment layered above them.
2. **Depth is always reversible.** Every surface you can enter, you can leave with a
   gesture that a phone user already knows: back, swipe-down, or tap-outside.

---

## 1. Boot path

```mermaid
flowchart TD
  COLD([cold start]) --> SPLASH[Splash<br/>min 900ms, resolves arc status]
  SPLASH -->|no arc| START[/start<br/>Gold Horizon hero/]
  SPLASH -->|arc exists| TODAY[/today/]
  START -->|BEGIN YOUR JOURNEY| ONB[/onboarding<br/>6 steps/]
  ONB -->|Initialise system| TODAY
  ONB -->|back on step 1| START
```

- **Splash** is not a route. It replaces `App.tsx`'s current blank
  `status === 'loading'` div and unmounts once *both* the arc status has resolved **and**
  900 ms has elapsed — so it reads as a deliberate boot, never a flicker.
- `/start` redirects to `/today` if an arc exists. A returning user never sees it.
- `/onboarding` redirects to `/today` if an arc exists. Unchanged from today's behaviour.
- Any unknown path → `/today` when an arc exists, `/start` when it does not.

---

## 2. The tab graph

```mermaid
flowchart LR
  subgraph TABS[persistent bottom nav]
    T[TODAY] --- P[PROGRESS] --- S[SKILLS] --- PR[PROFILE]
  end
```

Switching tabs is **lateral**: no back-stack depth is added, and each tab keeps its own
scroll position. Tapping the active tab scrolls it to top.

| Tab | Route | Sub-surfaces |
|---|---|---|
| TODAY | `/today` | 8 sheets, 1 full-screen review, 6 moments |
| PROGRESS | `/progress` | SYSTEM / REALITY segmented; weekly review |
| SKILLS | `/skills` | flat lists; benchmark card |
| PROFILE | `/profile` | checkpoint, boss, data cards, **`/profile/settings`** |

---

## 3. Depth from each tab

### 3.1 TODAY — the core loop

```mermaid
flowchart TD
  TODAY[/today/] --> QR[tap a quest row]
  QR --> QDS[Quest detail sheet]
  QDS -->|Log …| LOG[domain log sheet]
  QDS -->|Mark complete| TODAY
  LOG -->|saved| TODAY
  TODAY -->|Learning block| LB[Learning block sheet]
  TODAY -->|Evening review| ER[Evening review<br/>full screen]
  TODAY -->|circle tap| XP{{XP granted}}
  XP -->|crosses a level| MOM[Level Up moment]
  MOM -->|tap anywhere| TODAY
```

The six domain log sheets are `career`, `dsa`, `build`, `training`, `sleep`, `attention`.
A quest row's circle completes directly; the row body opens the detail sheet. Those are two
separate ≥44px targets and stay that way.

### 3.2 PROFILE → SETTINGS

```mermaid
flowchart TD
  PROF[/profile/] --> SET[/profile/settings/]
  SET --> APP[Appearance]
  SET --> SYS[System]
  SET --> DATA[Data & backup]
  SET --> ABOUT[About]
  APP --> TH[Theme picker]
  APP --> AC[Accent picker]
  APP --> TS[Text size]
  PROF --> CP[Checkpoint screen]
  PROF --> BOSS[Boss detail]
```

Settings is a **child route of the profile tab**, so the bottom nav stays visible and the
frozen four-tab contract is untouched. Sub-screens are pushed routes on mobile, not modals
— they are content, not interruptions.

**As built**, the sections are `appearance`, `system` (with `system/:questKey` for editing
one implementation intention), `data` and `about`. Appearance turned out not to need
pushed pickers: every one of its controls fits inline under a pinned live preview, and a
push per setting would have put a navigation between you and seeing what you changed.

One thing this required: `AppShell` matched the active tab by string equality, so PROFILE
went dark the moment you opened settings. It is a **prefix** match — `pathname === tab.to ||
pathname.startsWith(tab.to + '/')` — or the nav contradicts the route hierarchy it is
supposed to express.

---

## 4. Transition grammar

Direction encodes relationship. The user should be able to feel where they are without
reading.

| Edge | Motion | Duration |
|---|---|---|
| Splash → Start / Today | cross-fade | 320 ms |
| Start → Onboarding | push left, hero parallaxes at 0.4× | 320 ms |
| Onboarding step → step | push left / right, step rail advances | 260 ms |
| Tab → Tab (lateral) | cross-fade, no movement | 180 ms |
| Tab → child route (Settings, Checkpoint) | overlay pushes left; tab content cross-fades | 220 ms |
| Child → parent (back) | overlay pushes right; tab content cross-fades | 180 ms |
| Any → Sheet | scrim fades, sheet springs up from below | 300 ms spring |
| Sheet → dismissed | drag-follow, then settle down | follows gesture |
| Any → Moment | scrim to full black, panel `ring-pop` | 260 + 240 + 200 ms |
| Moment → dismissed | fade out | 200 ms |

Lateral moves never travel horizontally; hierarchical moves always do. That single rule is
what makes the app feel navigable rather than merely animated.

**Route *content* never translates or scales — only overlays move.** This is not a
stylistic preference; it was measured. An earlier version slid and scaled the entering
screen, which reads beautifully and cost 597 ms against the app's hard 300 ms tap-to-XP
budget: while a screen is moving its buttons are moving, so the first tap after arriving
waits out the animation before it can land. `final/06` §4.3 requires that nothing
functional depend on animation, and the core loop's primary action is as functional as it
gets. Hierarchy is therefore carried by things layered *above* the content — sheets
springing up, pushed screens sliding in — where nothing time-critical sits underneath.

At `[data-motion="reduced"]` every row above collapses to an instant state change with a
120 ms opacity fade, and nothing else.

---

## 5. Back-button and gesture contract

The app is an installed PWA, so hardware/gesture back must behave:

| Context | Back does |
|---|---|
| Sheet open | closes the sheet, stays on the screen |
| Moment showing | dismisses the moment |
| `/profile/settings/*` sub-picker | returns to Settings |
| `/profile/settings` | returns to `/profile` |
| A tab root | leaves the app (does **not** cycle tabs) |
| `/onboarding` step > 1 | previous step |
| `/onboarding` step 1 | `/start` |

Sheets and moments push a history entry so back closes them instead of leaving the screen.
This is the single most common PWA navigation bug and it is explicitly in scope.

---

## 6. Entry points that bypass the tabs

`vite.config.ts` already declares three PWA shortcuts. They must resolve to real
destinations rather than 404 into the fallback:

| Shortcut | Declared URL | Resolves to |
|---|---|---|
| Log problem | `/log/problem` | `/today` with the DSA log sheet open |
| Log application | `/log/application` | `/today` with the career log sheet open |
| Evening review | `/review` | `/today` with the evening review open |

Each redirects to `/start` when no arc exists.

---

## 7. Where art appears along the path

Mood follows meaning (`design/00-DESIGN-SYSTEM.md` §2):

```
Splash        Blue    boot
Start         Gold    start-hero          ← the promise
Onboarding    Blue    onboarding
Today         Blue    today (corner bleed)
Level Up      Blue    level-up            ← effort rewarded
Rank Advanced Gold    rank                ← evidence accepted
Checkpoint    Gold    checkpoint          ← the report
Boss          Boss    boss / boss-throne
Progress      Blue    progress
Skills        Blue    skills
Settings      none    flat, quiet — a settings screen is not a stage
```
