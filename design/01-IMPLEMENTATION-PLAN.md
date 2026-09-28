# Frontend Redesign — Implementation Plan & Loop State

Read first: `design/00-DESIGN-SYSTEM.md` (the *what*),
`design/02-NAVIGATION-FLOW.md` (the *where*), `design/03-SETTINGS-AND-THEMING.md`
(the *configurable*). This file is the *order*, and it is **live state**: the loop reads
it, does the first unchecked task, and ticks it.

- **Branch:** `frontend-redesign`
- **Baseline:** typecheck ✓ · lint ✓ · 47 test files / 358 unit tests ✓
- **Commits:** one task = one commit, prefixed `design(pN.M):`

---

## Loop protocol

1. Check `C:\Users\yashwanth\Desktop\system-app\project\assests_high_res` for new files.
   If any: classify each per design system §2.4, add manifest lines, run `npm run art`,
   commit as `design(art): <slots>`. This never blocks the current task.
2. Open this file. Find the **first unchecked** `- [ ]` task.
3. Implement exactly that task. No scope creep into later tasks.
4. Run its gate:
   - **Fast** (every task): `npm run typecheck && npm run lint && npm run test`
   - **Full** (⛓ tasks): fast **plus** `npm run test:e2e`
5. Red → fix forward in the same iteration. Never tick on a red gate. A *deliberate* copy
   change updates its spec in the same commit and says so in the commit body.
6. Commit, tick the box, append a **Log** row, stop the iteration.

**Stop when** every box is ticked → write `## Handover` → end the loop.

**Escalate instead of guessing only if** a gate is red for reasons unrelated to the current
task and the fix would change engine/store behaviour, or a task would require deleting a
`data-testid` or asserted string that design system §10 freezes.

---

## Phase 0 — Foundations

- [x] **0.1** Branch. Deps: `framer-motion@^11`, `@phosphor-icons/react@^2.1`,
      `@fontsource/{inter,cormorant-garamond,jetbrains-mono}`; devDep `sharp`.
- [x] **0.2** `src/ui/tokens.css` → the **three-layer theme-able** token system
      (design system §3, settings §3): structural `:root`, five `[data-theme]` blocks,
      and the `[data-text-scale]` / `[data-density]` / `[data-art]` modifier blocks.
      Keep every v1 token name as an alias. Extend `tailwind.config.js` with the ramps,
      three font families, the `--type-scale`-aware type scale, cut sizes and glows.
      Record measured contrast per theme in comments. Gate: fast.
- [x] **0.3** `src/index.css`: `.cut-sm/.cut-md/.cut-lg`, `.glow-text`, `.no-scrollbar`,
      `.hairline`, focus-visible ring, `@keyframes pulse-glow / shimmer-sweep / ring-pop`.
      Wire the three font families in `main.tsx` (enumerated weights only). Gate: fast.
- [x] **0.4** Settings foundation: typed schema + `localStorage` codec at
      `src/store/settings.ts`, `SettingsProvider` + `useSettings()`, the inline bootstrap
      in `index.html`, and `<MotionConfig>` driven by the motion setting. No UI yet —
      just the mechanism, with unit tests for the codec's defaults and migration.
      Gate: fast.
- [x] **0.5** Art pipeline: `design/art.manifest.json` (slot → `{source, mood, focal}`
      per design system §2.5), `scripts/import-art.mjs`, `npm run art`. Run it over all
      current images. Generate typed `src/assets/art/index.ts`; unfilled slots export a
      procedural gradient. Gate: fast.
- [x] **0.6** `vite.config.ts`: `webp` in PWA `globPatterns`,
      `maximumFileSizeToCacheInBytes` sized to the largest art file, precache ≤ 3 MB.
      ⛓ Gate: full — proves the redesign starts from green.

## Phase 1 — The kit (`src/ui/kit/`)

- [x] **1.1** `ScreenShell`, `SafeTop` (real insets — **no fake status bar**),
      `PageTransition` implementing the per-edge grammar in nav flow §4. Gate: fast.
- [x] **1.2** `ScreenHeader`, `SectionLabel`, `Panel`, `FramedPanel`, `QuoteCard`.
      Gate: fast.
- [x] **1.3** `PrimaryButton`, `SecondaryButton`, `QuietButton`, `IconTile`. All ≥44px at
      every text scale and density, forwarding `aria-*`, `disabled`, `data-testid`.
      Gate: fast.
- [x] **1.4** `MeterBar`, `SegmentBar`, `StatTile`, `Segmented`. Gate: fast.
- [x] **1.5** `Sheet` base: scrim, `max-h-[86dvh]`, drag-to-dismiss, focus trap, `Esc`,
      scroll lock, `role="dialog"`, focus restore, safe-area footer. Gate: fast.
      *Back-button dismissal moved to 2.3:* one app-level overlay-history owner is the
      right shape, because a sheet pushing its own entry would double-push whenever a
      sheet opens from another sheet.
- [x] **1.6** `ArtLayer` (LQIP → srcset, `aria-hidden`, theme-aware scrim,
      `--art-opacity`, gradient fallback) and `Moment` base. Gate: fast.

## Phase 2 — Navigation architecture

- [x] **2.1** Router restructure: the three PWA shortcut redirects (§6) resolved to
      `/today?open=<target>`, plus the unknown-path rules. Gate: fast.
      *Two deferrals, both to avoid premature routes:* `/start` becomes the no-arc entry
      in **3.2**, when the screen exists — introducing the redirect earlier would break
      every e2e helper for two tasks with nothing to show for it. `/profile/settings/*`
      lands in **10.2**, since a nested route to a screen that does not exist is not
      structure, it is a stub.
- [x] **2.2** Transition grammar wired: `AnimatePresence` keyed on pathname, per-edge
      direction (lateral fade vs hierarchical push), tab scroll-position retention,
      tap-active-tab-to-top. Gate: fast.
- [x] **2.3** Back-button contract (§5): **an app-level `OverlayStack`** owns one history
      entry per open overlay (moved here from 1.5 — a single owner avoids double-pushes
      when a sheet opens from a sheet); sheets and moments register with it;
      onboarding steps map to history; a tab root exits. New
      `tests/e2e/navigation.spec.ts` covering every row of the §5 table. ⛓ Gate: full.

## Phase 3 — Boot: Splash → Start

- [x] **3.1** `Splash` replacing the blank loading div: wordmark, hairline sweep, 900 ms
      minimum, reduced-motion path. Gate: fast.
- [x] **3.2** `Start` at `/start`: full-bleed `start-hero` (Gold Horizon) under a 4-stop
      scrim, wordmark, `BEGIN YOUR JOURNEY`. **The plate carries its own tagline — add no
      competing copy** (design system §2.4 rule 4). Gate: fast.
- [x] **3.3** `tests/e2e/helpers.ts` gains the one sanctioned click. New
      `tests/e2e/boot.spec.ts`: splash appears then clears; `/start` with no arc; `/start`
      redirects with an arc; a returning user never sees Start. ⛓ Gate: full.

## Phase 4 — Shell & navigation chrome

- [x] **4.1** `AppShell`: `ScreenShell` + phosphor bottom nav, active `accent-mid` +
      `fill`, safe-area bottom. **Frozen:** `role="navigation"`, `aria-label="Primary"`,
      link names `TODAY PROGRESS SKILLS PROFILE`. Gate: fast.
- [x] **4.2** Every screen onto `ScreenHeader` with its frozen `h1`. ⛓ Gate: full
      (`smoke.spec.ts` is the exact contract).

## Phase 5 — Onboarding

- [x] **5.1** Chrome: `ScreenShell`, `onboarding` art on steps 1 and 6, a 6-segment step
      rail replacing the bare `1/6`, `FramedPanel` per step, footer pinned above the safe
      area. Gate: fast.
- [x] **5.2** Steps 1–3. Keep placeholder `Your name`, buttons `Begin` / `Next` verbatim.
      Gate: fast.
- [x] **5.3** Steps 4–6. Keep the main-quest placeholder and `Initialise system` verbatim.
      Step 5 is the product's most important screen — `FramedPanel` + accent rule.
      Gate: fast.
- [x] **5.4** ⛓ Gate: full (`onboarding.spec.ts`). Phase 5 complete.

## Phase 6 — Today

- [x] **6.1** Header: `today` art bleeding top-right at `mix-blend-lighten` under a
      directional scrim; `DAY nn` display type; LEVEL / XP `MeterBar` / RANK panel; streak
      in mono. Preserve `data-testid="xp-bar-fill"`.
      **Hard budget:** core-loop.spec asserts all six quest rows are reachable without
      scrolling at 412x915. `final/06` §5.2 calls that the constraint capping the core set
      at six, so the hero must fit inside it — Today carries no title bar for the same
      reason. Gate: fast.
- [x] **6.2** `QuestRow`: `IconTile` per key, title + `ROW_SUMMARY`, mono XP, glowing
      accent circle on complete. **Frozen:** two ≥44px targets, `Complete X`/`Undo X`,
      `aria-pressed`, `quest-row-<key>` and `-open`, the state glyphs. Gate: fast.
- [x] **6.3** Secondary blocks as `Panel`s: weekly quest, revisits, `MaintenanceCard`,
      learning block, evening-review entry. Gate: fast.
- [x] **6.4** Status surfaces: recovery card (`--state-recover`, never red, no quote),
      day-closed banner (string frozen), level-up inline banner, system line, notice.
      Gate: fast.
- [x] **6.5** ⛓ Gate: full. **tap→XP measured over 6 runs: 106/109/111/117/122/124 ms,
      median 117, budget 300.** Phase 6 complete.

## Phase 7 — Sheets

- [x] **7.1** `QuestDetailSheet` on `Sheet`. If-then sentence in a `FramedPanel`. Stays
      quote-free. Gate: fast.
- [x] **7.2** `LogApplicationSheet`, `LogProblemSheet`, `LogBuildSessionSheet`.
      Gate: fast.
- [x] **7.3** `LogTrainingSheet` (uses `training` art), `LogSleepSheet`,
      `LogAttentionSheet`, `LearningBlockSheet`. Gate: fast.
- [x] **7.4** ⛓ Gate: full. **80/80 on two consecutive runs.** Phase 7 complete.

## Phase 8 — Progress & Skills

- [x] **8.1** Progress chrome + SYSTEM: `Segmented`, a `progress`-art level card,
      `AttributeBars` under MIND / CRAFT / CAREER / BODY, weekly-review entry. Gate: fast.
- [x] **8.2** REALITY: a real Day-0 → Now two-column table, mono tabular, label truncates
      and value never does. Preserve `data-testid="reality-tab"`. Gate: fast.
- [x] **8.3** Skills: `skills` header band, `SegmentBar` rows for DSA and Foundations, AI
      tiers as chip clusters, career tree as data rows, benchmark as a `FramedPanel`.
      Gate: fast.
- [x] **8.4** ⛓ Gate: full — **80/80.** Phase 8 complete.

## Phase 9 — Profile, Checkpoint, Reviews

- [x] **9.1** Profile chrome + `LevelSummary` hero + `CheckpointRow` (*"the app's most
      important sentence"* — strongest non-Moment treatment on the screen) + `BossList`
      (`boss` / `boss-throne` art, the **only** place `--boss` red appears) +
      `AchievementsList`. Gate: fast.
- [x] **9.2** Data cards: `BackupCard`, `PaperImportCard`, `InstallCard`,
      `BodyMetricsCard`, arc pause, dev-only blocks quarantined in `--state-alert`.
      Gate: fast.
- [x] **9.3** `CheckpointScreen` + `CheckpointInstrumentsCard` + `InstrumentSliders`.
      The report is a **Gold Horizon** surface (`checkpoint` art) — it is the screen that
      says something real changed. Rank gates as ✓/✗ shapes. Gate: fast.
- [x] **9.4** `EveningReview` (Blue, `review` art) and `WeeklyReview` (Blue, with a Gold
      distance-travelled block). Closing `QuoteCard` on the evening review only.
      Gate: fast.
- [x] **9.5** ⛓ Gate: full — **80/80.** Phase 9 complete.

## Phase 10 — Settings & theming

The new configurable layer. `design/03-SETTINGS-AND-THEMING.md` is the spec.

- [x] **10.1** `SettingsList` / `SettingsGroup` / `SettingsRow` kit primitives —
      56px rows, leading icon, trailing value, chevron, inline `Segmented` variant.
      No art, no glow. Gate: fast.
- [x] **10.2** `/profile/settings` shell + routing. Appearance and About ship complete;
      **System and Data rows are added in 10.5 with their screens** — a row that pushes
      to an empty screen is worse than no row. Gate: fast.
- [x] **10.3** Appearance: theme picker with the **live preview panel**, accent picker,
      text size, density, motion, art intensity, glow. All apply instantly. Gate: fast.
- [x] **10.4** Implement the five themes in `tokens.css` to the §5 bar: measured contrast
      recorded per theme, states still shape-coded, theme-aware `ArtLayer` scrims.
      Gate: fast.
- [x] **10.5** System group (reminder times — real, via `PLAN_AMENDED` — plus the arc's
      read-only hours) and Data group (backup / paper-import / storage / integrity moved
      off Profile). **Review times and week start are absent, not stubbed:** the engine
      has no such concepts. About shipped in 10.2. Gate: fast + the three moved specs.
- [x] **10.6** New `tests/e2e/settings.spec.ts`: each theme applies and persists across
      reload; text scale XL doesn't overflow at 320px; motion=reduced kills animation;
      art=off falls back to gradients; settings survive `resetArc`. ⛓ Gate: full —
      **85/85.** Phase 10 complete.

## Phase 11 — Moments

- [x] **11.1** `LevelUpMoment` (Blue) and `RankAdvancedMoment` (**Gold** — evidence) on the
      `Moment` base. Keep existing phase timings, haptics and reduced-motion path exactly.
      Gate: fast.
- [x] **11.2** `BossClearedMoment` (Boss), `MasteryMoment`, `EvidenceAcceptedMoment`,
      `CheckpointMoment` (Gold). Gate: fast.
- [x] **11.3** ⛓ Gate: full — **85/85.** Phase 11 complete.

## Phase 12 — Responsiveness & polish

- [x] **12.1** `playwright.config.ts`: projects for `320×568`, `360×640`, `430×932`,
      `768×1024`, `1280×800` alongside Pixel 7. New `tests/e2e/responsive.spec.ts`: every
      route × every viewport — no horizontal scroll, every interactive element ≥44×44, no
      clipped text, nav never overlaps content. Run the worst case too: 320px × text scale
      XL. Gate: fast (this spec is expected to fail here; 12.2 fixes it).
- [x] **12.2** Green at all six viewports **and** all five themes. ⛓ Gate: full —
      **103/103.**
- [x] **12.3** A11y: motion setting honoured everywhere; focus ring on every control;
      per-theme contrast audit; `aria-live` on XP; art layers `aria-hidden`. Gate: fast.
- [x] **12.4** Performance. **Measured: JS 220.76 KB gz (cap 320), art 1,619 KB
      (cap 1,638), precache 921 KB (cap 3,072), tap→XP green on 3 consecutive runs.**
      The art budget is enforced by `npm run art`, which fails the build over it.
- [x] **12.5** Stragglers migrated and **the v1 aliases are gone** — from `tokens.css`
      and from `tailwind.config.js`, with nothing left referencing either.
      ⛓ Gate: full — **103/103.** Phase 12 complete.

## Phase 13 — Close out

- [x] **13.1** Docs: superseded-by pointers in `final/06` §4 and §6, refresh the design
      docs with anything learned, document `npm run art` for future uploads. Gate: fast.
- [x] **13.2** Final ⛓ full gate on a clean tree — **typecheck · lint · 49 files /
      437 unit · 103/103 e2e.** Handover written below, with 20 screenshots at 360×640 in
      `design/handover/`. **All 60 tasks complete.**

---

## The bar

Stated by the user on 2026-09-06, and it outranks speed on every task:

> Get the finest award-winning mobile application UI. It should look like the
> finest designer would have designed it — the buttons, the quest rows, the
> whole thing — and everything should match the Solo Leveling vibe. Mobile-first
> responsiveness, always.

The original complaint was never that the UI was broken. It was that it was
"simple and basic". So **a task is not done when its gate goes green** — it is
done when the surface would look at home in a design showcase. Push past the
first working version. Both this bar and the frozen test contract in design
system §10 are required; neither may be traded for the other.

---

## Standing rules

- **Kill the preview server after every screenshot run.** Orphaned `vite preview`
  processes accumulate across iterations and compete for CPU with the e2e suite. Twelve
  of them once pushed the 300 ms tap→XP budget to 332 ms and produced a failure that
  looked like a regression and was not.

- **New art mid-flight is expected** — classify, manifest, `npm run art`, separate commit.
- Never edit `src/engine/` or `src/store/` except where a task says to (0.4 adds
  `store/settings.ts`; 10.5 moves cards between screens). This is a rendering change.
- Never delete a `data-testid`. Never `git push` or open a PR.
- Prefer refactoring onto a kit primitive over rewriting a component.
- Settings never enter the event log (settings doc §2).

---

## Log

| # | Task | Note |
|---|---|---|
| — | plan v1 | baseline green: 47 files / 358 tests |
| 0.1 | deps | framer-motion 11.18.2, phosphor 2.1.10, 3 font families, sharp. Gate green. |
| 0.2 | tokens | Three-layer theme-able token system: 5 themes (arc/dawn/abyss/contrast/daylight), text-scale/density/art modifiers, v1 aliases retained. Tailwind wraps every size in calc(* --type-scale) and uses unitless leading so text size scales the whole scale. Build 19.6KB CSS, all 5 themes present. Gate green. |
| 0.3 | global css | Utilities (.cut-*, .glow-text, .hairline, .no-scrollbar, .art-layer), focus-visible ring, keyframes, 3-state motion (reduced/full/system). 8 latin-subset font files, 192KB. Found and fixed: woff2 was missing from the PWA globPatterns, so fonts would NOT have been precached — an offline launch would have silently fallen back to system fonts. Precache 12→20 entries, 698KB. Gate green. |
| 0.4 | settings | Pure codec (parse/serialize/applyToRoot) + SettingsProvider + pre-paint bootstrap in index.html + MotionRoot. 13 new tests, 358->371. Caught two colour clashes: dawn's accent and --state-recover were both amber, and a warm user accent would hit the same collision on cool themes; states now swing opposite the accent's temperature. Accent palette excludes green because a completed quest circle fills with accent and --state-complete is green. Gate green. |
| 0.5 | art | All 20 plates reviewed and classified; 16 slots filled, 0 on gradient fallback. 2.2MB on disk, largest file 154KB. Budget guard fired at first run (2544KB) and forced a quality retune — then the total cap itself was corrected: per-file is the real budget (= per-screen weight), total is a sanity ceiling, since art will be runtime-cached not precached. 4 boss plates parked in overflow. |
| 0.6 | pwa | Art excluded from precache; CacheFirst runtime rule instead. Precache holds at 20 entries / 702KB. FULL GATE GREEN: 62/62 e2e. Known intermittent: reflections.spec:20 and weekly-review.spec:44 (both recovery-card, 10s timeout) failed once under parallel load then passed 12/12 isolated and 62/62 in-suite. weekly-review:44 also fails on the untouched baseline, so it is pre-existing. Watch, do not chase. |
| 1.1 | kit: shell | ScreenShell (dvh, radial ground, 430px device frame >=640px), SafeTop/SafeBottom (real insets, no fake status bar), PageTransition (4 edges: lateral/forward/back/boot). Kit barrel added. Gate green. |
| 1.2 | kit: panels | Panel draws its border as a two-layer clip so the bevel keeps a 1px edge (a plain border+clip-path leaves the diagonals bare). FramedPanel = corner brackets + inset glow, tone accent/dawn/boss. ScreenHeader carries the frozen h1 contract. SectionLabel, QuoteCard. Gate green. |
| 1.3 | kit: buttons | Primary/Secondary/Quiet + IconTile. Sized by explicit min-height, not padding, so text-scale XS (0.88x) cannot shrink a button under the 44px target. Tones accent/dawn/boss. Native button props forwarded (aria, disabled, data-testid); framer-motion's conflicting drag/animation handlers omitted from the type. Gate green. |
| 1.4 | kit: meters | MeterBar animates via CSS width transition, not framer-motion — e2e regexes `width: N%` out of the inline style and a JS animation would publish unparseable px values. Segmented keeps plain <button> + aria-pressed because 6 specs select it with getByRole('button'). Added --on-accent per theme: 4 dark themes need a dark label on their light accent, daylight needs a light one. SegmentBar (5-state mastery, never a percentage), StatTile. Gate green. |
| 1.5 | kit: sheet | Three dismissals (Close button, scrim, downward drag past 110px or a 520px/s flick), focus trap + restore, Esc, scroll lock, role=dialog, safe-area footer. Renders the frozen aria-label="Close" itself so all 8 sheets inherit it. Back-button dismissal deliberately deferred to 2.3 as an app-level owner. Gate green. |
| 1.6 | kit: art + moment | ArtLayer: 6 scrim presets built with color-mix against --void so a theme change re-tints the scrim; inline LQIP paints frame 1; --art-opacity gates every plate at once; gradient fallback for unfilled slots. Moment base keeps role=button + /Level up/ label (frozen by xp.spec). Phase 1 complete. NOTE: art still absent from dist because no screen imports the kit yet — verified naturally at 3.1. Gate green. |
| 2.1 | routing | The 3 PWA shortcuts declared in the manifest since Slice 1 were never handled — they fell through to the catch-all and landed on a bare Today with no sheet open. Now resolve to /today?open=<target> (Today consumes it in 6.3). /start deferred to 3.2 and /profile/settings to 10.2 to avoid premature routes. Gate green. |
| 2.2 | transitions | Route content is now opacity-only. The first version slid/scaled the entering screen and blew the hard 300ms tap-to-XP budget at 597ms (5/5 fail) — a moving screen means moving buttons, so the first tap queues behind the animation. Hierarchy moves to overlays instead. Also: per-tab scroll retention, tap-active-tab-to-top, edge derivation from route depth. No AnimatePresence on routes (mode="wait" would put mounting behind an animation). Full e2e 61/62, sole failure the known reflections flake (8/8 in isolation). |
| 2.3 | back + overlays | OverlayStackProvider owns one history entry per overlay; Sheet and Moment register. New navigation.spec (10 tests). Fixed the scroll-restore bug it exposed: screens load from IndexedDB, so restoring before content arrives clamps to 0 — now re-applies via ResizeObserver until reachable. ALSO FIXED THE LONG-RUNNING FLAKE: both recovery-card tests jumped the clock before Day 1's async quest generation had landed, so there was nothing to recover. FULL SUITE GREEN 72/72. |
| 3.1 | splash | First screen to render art. Four-beat reveal (plate/wordmark/rule/creed), 900ms minimum held only on cold start. ART PIPELINE VERIFIED END TO END: 32 hashed webp in dist, 0 in precache (runtime-cached as designed). Bundle 194KB gz vs 320KB budget; all 16 inlined LQIPs total just 3KB. E2E 72/72 with the splash in every boot path (suite 53s -> 1.1m, the expected cost). |
| 3.2 | start | Gold Horizon front door. Screenshotting it caught two bugs code review would not have: PrimaryButton rendered as a solid slab (translucent inner fill over a solid border layer — affected every primary button), and the plate's marginal text was sliced in half by cover-cropping. Fixed both; added ArtLayer zoom. Route added but `/` still points at /onboarding — 3.3 flips it with the helper change so every commit stays green. |
| 3.3 | boot path | /start is now the no-arc landing for every route, shortcut and unknown path. One sanctioned helper click added. New boot.spec (6 tests). Two existing specs updated for the deliberate behaviour change (onboarding's fresh-boot destination, backup's post-wipe destination) — both now assert Start, which is the correct first-run state. Phase 3 complete. FULL SUITE 78/78. |
| 4.1 | shell + nav | Phosphor bottom nav (House/ChartLineUp/TreeStructure/UserCircle), active glow + fill weight, whileTap 0.88. AppShell now sits in ScreenShell so the desktop device frame applies app-wide. Caught a real layout bug the screenshot missed but the scroll tests found: ScreenShell used min-h-dvh, so the document scrolled instead of main and the bottom nav would scroll away on any long screen. Now h-dvh. Full e2e 78/78. |
| 4.2 | headers | ScreenHeader on all four screens; SafeTop moved into the shell so the notch inset never scrolls. Progress's sub-tab switch became the header's right slot. core-loop caught a real regression: a visible TODAY title pushed the 6th quest row below the fold, breaking final/06 §5.2's above-the-fold rule. Today keeps a screen-reader-only heading — the spec's own wireframe has no title bar there, its identity is the DAY/LEVEL/RANK line. Budget noted on task 6.1. Phase 4 complete. 78/78. |
| 5.1 | onboarding chrome | 6-segment step rail replaces the bare "3/6", FramedPanel per step, footer pinned above the safe area, art bookending steps 1 and 6. Screenshot caught two composition problems: the quiet scrim buried the plate into murk (now moment), and top-aligning a short panel left a large dead zone (art steps now centre, form steps stay top-aligned so they scroll). Gate green + onboarding/boot e2e 12/12. |
| 5.2 | onboarding 1-3 | Added Field/TextInput/TextArea/StepTitle to the kit (the log sheets in phase 7 need them too). Step 1's premise line set in display serif over the art; step 2's day count as a mono figure; step 3's wake/sleep paired. Replaced justify-center with my-auto on the panel — auto margins centre short steps and collapse on tall ones, where justify-center would clip an overflowing step's top. Gate green + onboarding e2e 6/6. |
| 5.3 | onboarding 4-6 | Step 5 (final/06's "THE IMPORTANT ONE") gets an accent rule per intention. The inline sentence layout looked right on paper and failed on a phone — the time picker squeezed "my desk" to "my d" at 390px and orphaned the word "at" at 320px; now one clause per row on a fixed prefix column. Step 6's alarm times set in mono tabular since the user is about to copy them. Gate green + onboarding e2e 6/6. |
| 5.4 | phase 5 gate | 78/78. The 300ms budget failed at 332ms first — traced to twelve orphaned vite preview servers left running by my own screenshot runs, competing for CPU with the suite. Killed them; clean re-run passed. Added a standing rule to kill previews. Phase 5 complete. |
| 6.1 | today hero | DAY nn in display serif, RANK opposite, LV + MeterBar + xp on one row, streak in mono. Art is a corner bleed masked radially — under mix-blend-lighten the scrim's dark stops vanish, so the bright streaks were being cut in a hard rectangle. The hero cost 30px and core-loop's zero-overflow assertion caught it exactly; reclaimed by trimming 8 margins rather than shrinking the hero's idea. 78/78. |
| 6.2 | quest rows | Domain IconTile leads (Briefcase/Code/Cpu/Barbell/MoonStars/Eye), completion circle moved to the right where a thumb rests. Complete = filled disc in a solid glowing ring, pending = empty ring: shape as well as colour, per final/06 §7. Tile also lights on complete, so state is legible from the left column too. Zero overflow on the real Pixel 7 descriptor with rows completed; holds at 320px with nothing truncated. |
| 6.3 | today blocks | Maintenance, learning block, weekly quest, revisits and the evening-review entry all on cut-corner surfaces with SectionLabel headers; evening review accented as the day's closing action. Kept the two footer buttons at the 44px floor rather than the kit's 46px — Today measures to zero overflow and those 4px are not available. Zero overflow re-verified on the Pixel 7 descriptor. |
| 6.4 | today status | Recovery card amber + intact + no quote; day-closed, reduced-mode, level-up banner and system line all on the left-rule treatment. Found and fixed TWO real bugs: route content was stuck at opacity 0 whenever rAF was starved (framer-motion -> CSS animation), and the resulting persistent stacking context made every full-screen overlay paint UNDER the bottom nav, which silently swallowed taps (14 e2e failures). main now z-10, nav z-0. 78/78. |
| 6.5 | phase 6 gate | 78/78. tap->XP measured across 6 clean runs on the Pixel 7 descriptor: median 117ms, worst 124ms, budget 300ms — 2.4x headroom, so the earlier 332ms really was machine contention and not the app. Phase 6 complete: Today is done. |
| 7.1 | quest sheet | Sheet now portals to document.body — structurally prevents the stacking-context trap that cost 14 failures in 6.4, rather than relying on z-index discipline. QuestDetailSheet migrated: the user's if-then sentence quoted back verbatim in a FramedPanel, criterion text, Log X secondary, Mark complete pinned. Stays quote-free per final/06 §5.3. |
| 7.2 | log sheets 1-3 | Career, DSA and build sheets migrated onto the kit Sheet. Found a DESTRUCTIVE bug: OverlayStack popped history on programmatic close, but history.back() is async while pushState is not, so a sheet opened from a sheet consumed the wrong entry — two rounds unwound past the app to about:blank (white screen). Rewritten to never call back(); spent entries are consumed on the next popstate. Two regression tests added. Also portalled the in-sheet Moments, and reverted a curly apostrophe that broke an asserted string. 80/80. |
| 7.3 | log sheets 4-7 | All eight sheets now on the kit Sheet. Training gets the only art band (its evidence is physical). Fixed the flakiness the migration exposed: the Sheet's framer-driven y:100%->0 entrance left it parked OFF-SCREEN when rAF was starved, while still counting as visible — so taps landed on nothing and a different sheet test failed each run. Entrance is now CSS; framer keeps only the drag. Also capped Playwright workers to 4: the 300ms budget was measuring 16-core contention (310-332ms) while the app measures 106-127ms idle. 80/80 twice consecutively. |
| 7.4 | phase 7 gate | 80/80 twice. Promoted the CSS-vs-JS animation rule into design system §5.1 with the three failures that taught it. Fixed the last recovery-card race: streak.spec reloaded after seeing only the OPTIMISTIC toggle, so the confirmed rebuildProjections write could lose the race — now polls IndexedDB via the helper that exists for exactly this. Phase 7 complete: all eight sheets. |
| 8.1 | progress + system | Level card on the progress plate (LV, XP meter, RANK together — this is the screen where effort-vs-evidence matters). Segmented moved BELOW the header: at 320px a fixed-width switch and the title arrive at the same pixel and neither can shrink. AttributeBars regrouped with MeterBar; labels now WRAP rather than truncate — "PROBLEM SOL…" had lost the only thing identifying its row, and truncation only worsens at larger text scales. |
| 8.2 | reality | Day-0 column added and it needed no new state: every figure here counts things that did not exist before the arc, so Day 0 is zero by construction, and a rate over zero attempts is undefined — a dash, not a zero. NOW goes accent only once it has moved off its Day-0 value, so the screen answers "what is actually different" at a glance. Number columns narrowed to 44/58px after 320px truncated "Foundations Fluen…"; the arc day moved into the header, which removed a stray line above the table. |
| 8.3 | skills | `skills` band with two ordinal counts (never a percentage — final/03 §1). Mastery rows print the state word only once a topic is touched: eighteen rows shouting UNSEEN buried the one line that mattered, and the empty bar already says it. The word's width is intrinsic, not a fixed column, because "INTRODUCED" is nearly twice "FLUENT" and a column sized for the longest steals from every topic name. Benchmark is the screen's only FramedPanel — it is the only thing here you can do. |
| 8.4 | phase 8 gate | 80/80 e2e, first run, no retries. |
| 9.1 | profile | Hero opens with the main quest — the one sentence the arc is measured against — then LV / XP / RANK. The next gate is the screen's only FramedPanel and turns Gold when due. BossList gained a locked state on the `boss-throne` plate: it rendered nothing at all before Day 25, which wasted the one thing bosses are for. Boss conditions are shape-coded, not colour-coded. Achievements became chips; a dot-joined sentence read as one long clause. |
| 9.2 | data cards | All five on `Panel` with kit buttons. Two colour rules made explicit in code: the import confirmation keeps `--state-alert` because it really does destroy data, and a paused arc takes the recovery amber instead, because a pause is a state and not a warning. Dev blocks quarantined behind a dashed alert fence — shape as well as colour, so the boundary survives a colour-blind read. |
| 9.3 | checkpoint | The app's Gold Horizon surface: `checkpoint` plate, DAY n in dawn, the verdict in the screen's only frame. Gate conditions are filled/hollow squares carrying a tick or a cross, so shape and colour say the same thing. Portalled and given a top safe-area inset — the close button sat under the notch. Range inputs styled from MeterBar's tokens; the instrument titles are sentences, so they had to stop being SectionLabels, which ran a full sentence off the right edge. |
| 9.4 | reviews | Evening review on `Sheet`; its daily report is the app's one sanctioned QuoteCard. Weekly review carries a single Gold block — the week-over-week deltas, the only evidence on an effort screen. **Found a real Panel bug here:** `className` landed on the inner element, so every card's margin opened *inside* its border and a max-width left the border colour showing as a band. Split into `className` (outer) / `bodyClassName` (inner) and fixed all 13 call sites. |
| 9.5 | phase 9 gate | 80/80 e2e after the Panel split — the change touched every card in the app. |
| 10.1 | settings kit | Grouped-list primitives. 56px is a floor, not a height — at text-scale XL a two-line row is taller and a fixed height would clip it. A row carrying a control is not itself tappable: nesting a button inside a button breaks both the tap target and the accessibility tree. No glow anywhere in the file. |
| 10.2 | settings shell | Child routes of the profile tab, so the nav stays lit — needed a prefix match on the tab, not equality. `SettingsRow` gained a `selected` mode: a chevron promises tapping goes somewhere, and a theme row goes nowhere, so those get a check and a radiogroup instead. Shipped only the two sections that exist; System and Data arrive in 10.5 with their screens. |
| 10.3 | live preview | Sticky, not fixed — fixed escapes the scroll container and lands on the bottom nav. Shows the four things every setting touches: section label, quest row, meter, display serif. Its quote line drops under 640px of height, where pinned it was taking half a 320x568 screen at text scale XL and competing with the list it exists to serve. |
| 10.4 | five themes | Swept all five themes x four screens x {390/M, 320/XL} with a scripted overflow check. **Two real bugs:** `SectionLabel` was `shrink-0`, so a long label could not wrap and pushed Skills 16px past a 320px screen at XL; and the plates are all dark illustrations, which on the light theme read as ink blots — added `--art-theme-scale`, multiplied with the user's art setting so "dim" cannot come out brighter than "full". Also found the nav's hardcoded icon glow, the one glow the no-glow themes could not turn off. |
| 10.5 | system + data | Reminders edit the real implementation intentions through `PLAN_AMENDED`, the event that existed for exactly this and had no caller after onboarding. The arc's hours are shown read-only: every streak and checkpoint was computed against them. Review times and week start are omitted — the evening review has no time gate and the weekly review measures a rolling seven days, so those knobs would change nothing. Data cards moved off Profile; three specs moved with them under §10's sanctioned-exception rule, behind one `openDataSettings` helper. |
| 10.6 | settings spec | Five tests, 85/85 overall. The overflow test drives the real 320px viewport rather than trusting a screenshot, and waits on the nav — a cold load re-runs the splash hold, and a fixed timeout measures the splash. Motion asserts a parsed number, not Chromium's `1e-05s` string. |
| 11.1 | level-up + rank | Both on the `Moment` frame. `Moment` is portalled and z-60 now — it can fire from a sheet or the checkpoint screen, both already portalled. Reduced motion reads the app's motion setting first, then the OS: Moments suppress haptics and a JS phase machine, which CSS cannot do for them. **Plate zoom moved into the manifest**, so a plate carrying its own lettering cannot be cropped mid-word by whichever screen uses it next. |
| 11.2 | the other four | MASTERY and EVIDENCE ACCEPTED share a new `ToastMoment` so the quiet half of the vocabulary cannot drift; EVIDENCE goes Gold, since something now exists in the world. CHECKPOINT is Gold and self-paced, with the same tick/cross squares as the checkpoint screen's gate. BOSS CLEARED keeps boss red on the Gold `boss-cleared` plate — the one place the two moods meet, noted in the file. |
| 11.3 | phase 11 gate | 85/85. |
| 12.1 | responsive spec | Six viewports x nine routes x two text scales, auditing four rules in one pass. The extra five projects run **only** this spec — behaviour does not change with width, and running all 85 tests six times would cost ten minutes a gate to re-prove the same facts. Came back with exactly one real failure across the whole matrix. |
| 12.2 | responsive fixes | One real defect in the whole matrix: the maintenance chips were 24px. Making them 44px pushed the sixth quest row below the fold and broke §5.2's budget, so they are 44px with 10px of negative margin — the margin box still occupies 24px of the strip while the thumb lands on the full height. Added a themes-lay-out-identically test; it stamps the attribute and navigates by tapping, because twenty cold loads spent most of a minute re-watching the splash. |
| 12.3 | a11y | **The focus ring was invisible on most of the app** — `clip-path` clips an outline, and nearly every control wears a bevel; drawn as an inset pseudo-element it survives, and inherits the bevel for free. XP figure is now a polite live region. The per-theme contrast audit became a test that recomputes the ratios instead of trusting the comments: it found daylight's floor at 4.37:1 against a comment claiming 4.6, and eighteen other comments that understated the truth. |
| 12.4 | budgets | Art was 2,220 KB against a 1,600 KB budget. The 960w variant was 23% wider than the largest thing the app can draw — it is a 430px column at every breakpoint — and width costs area, so 880w gave back a third of the weight for pixels no screen was using; quality did the rest. `MAX_TOTAL_BYTES` is now the real budget rather than a 4 MB sanity ceiling, so the build fails if a future plate breaks it. |
| 12.5 | stragglers | The five leftover components moved onto v2 tokens; `ChipToggle` and `SingleChipSelect` now share one chip treatment, since they are one control with different arity and matched before only by coincidence. `DotPicker` keeps filled-vs-hollow glyphs so the choice survives the colour being removed. v1 aliases deleted from both files after grepping every `var()` and every class name for references. |
| 13.1 | docs | Superseded-by pointers on `final/06` §4 (tokens + the dark-only line), §6 (430px column, no left rail) and §3's settings cut. Design system §2.6 rewritten to the real numbers and given the add-art recipe; §8's matrix now names the projects that exist; §9.5 is new — six traps that each cost a real bug, written down so the next change does not re-find them. |
| — | plan v2 | User added: configurable settings/theming, explicit nav flowchart, mood-based art assignment. Saw all 11 plates — split into Blue Arc (effort) / Gold Horizon (evidence) / Boss. Added docs 02 and 03; replanned to 13 phases, 60 tasks. |

---

## Handover

The frontend redesign is complete. Every box above is ticked, and the final gate on a
clean tree is green: **typecheck · lint · 49 files / 437 unit tests · 103/103 e2e across
six viewport projects**, in 90 commits on `slice-13-ship`.

### What changed

The app did the same things before this work and does the same things after it. Nothing in
the engine, the event log, the projections or the XP maths was touched. What changed is
every surface it draws.

- **A visual language, not a coat of paint.** `design/00-DESIGN-SYSTEM.md` is the source:
  two art moods (Blue Arc for effort, Gold Horizon for evidence, Boss red for one
  component), a three-layer token system, a bevelled panel shape, one type scale, and a
  copy voice. `src/ui/kit/` is that language as components — nineteen of them, and every
  screen is now assembled from them rather than from ad-hoc class strings.
- **A front door.** Splash → Start → onboarding, with a real hero plate and a stated
  navigation grammar (`design/02-NAVIGATION-FLOW.md`): lateral moves cross-fade,
  hierarchical moves push, and back never leaves the app by surprise.
- **Sixteen art plates**, classified by mood and assigned to slots, with a pipeline
  (`npm run art`) that encodes, budgets and regenerates a typed index. Every slot has a
  procedural gradient fallback, so the app looks finished with the art switched off — and
  it can be, from Settings.
- **A settings and theming layer that did not exist.** `/profile/settings` with five
  themes, six accents, five text scales, density, motion, art intensity and glow, all
  applying instantly, plus a live preview pinned while you choose. Reminders edit the real
  implementation intentions. Data and integrity moved off Profile.
- **The Moments got their frame.** All six now share one portalled, themed base, with
  their original timings, haptics and reduced-motion paths intact.

### The five screens, at 360×640, default theme

| | | |
|---|---|---|
| ![Splash](handover/01-splash.webp) | ![Start](handover/02-start.webp) | ![Onboarding](handover/03-onboarding.webp) |
| Splash | Start | Onboarding |
| ![Today](handover/04-today.webp) | ![Quest detail](handover/05-quest-detail.webp) | ![Log sheet](handover/06-log-sheet.webp) |
| Today | Quest detail | A log sheet |
| ![Progress SYSTEM](handover/07-progress-system.webp) | ![Progress REALITY](handover/08-progress-reality.webp) | ![Skills](handover/09-skills.webp) |
| Progress · SYSTEM | Progress · REALITY | Skills |
| ![Profile](handover/10-profile.webp) | ![Checkpoint](handover/11-checkpoint.webp) | ![Settings](handover/12-settings.webp) |
| Profile | Checkpoint | Settings |
| ![Appearance](handover/13-appearance.webp) | ![System](handover/14-system.webp) | ![Data](handover/15-data.webp) |
| Appearance | System | Data |
| ![About](handover/16-about.webp) | ![Weekly review](handover/17-weekly-review.webp) | ![Evening review](handover/18-evening-review.webp) |
| About | Weekly review | Evening review |
| ![Daily report](handover/19-daily-report.webp) | ![Level up](handover/20-level-up.webp) | |
| Daily report | LEVEL UP Moment | |

360×640 is the design target, not the largest phone: Today's sixth quest row sits just
below the fold there. The above-the-fold budget `final/06` §5.2 sets — and
`core-loop.spec` enforces — is 412×915, where all six are reachable without scrolling.

### Art: what is filled, and how to add more

**All 16 slots are filled.** Nothing is on the gradient fallback. The library is 1,619 KB
against a 1,638 KB cap, largest single file 112 KB.

Ten further plates are classified and parked in `design/art.manifest.json`'s `overflow`
block — mostly boss and blue variants — so a later screen can claim one without
re-reviewing the folder.

To add art:

1. Drop the source PNG in the folder `sourceDir` names
   (`C:/Users/yashwanth/Desktop/system-app/project/assests_high_res`).
2. Add or edit a slot in `design/art.manifest.json`:
   `{ "source": "<filename>.png", "mood": "blue|gold|boss", "focal": "50% 40%",
   "text": true, "zoom": 1.3, "note": "…" }` — `text` if the plate carries its own
   lettering, `zoom` if that lettering needs cropping out of a phone column.
3. `npm run art`.

That regenerates `src/assets/art/index.ts` and fails loudly if any file exceeds 170 KB or
the library exceeds 1.6 MB. **No component changes** — `ArtLayer` reads the slot, and the
crop scale belongs to the plate rather than the screen using it.

### What was deliberately not built

- **Review times, weekly-review day, week-start.** `design/03` §1 listed them; the engine
  has no such concepts. The evening review has no time gate, and the weekly review measures
  a rolling seven days ending today. A control that changes nothing is not configuration.
- **The arc's day-boundary hours are read-only.** Every streak, rollup and checkpoint in
  the record was computed against them, so moving them would rewrite what past days meant.
  The System screen shows them with that reason on screen.
- **A left rail at ≥1024px** (`final/06` §6). The app is a 430px column at every width;
  one nav, one muscle memory.

### Where to look

| | |
|---|---|
| `design/00-DESIGN-SYSTEM.md` | The visual language. §5.1 and §9.5 are the two sections worth reading before changing anything. |
| `design/02-NAVIGATION-FLOW.md` | Route graph, transition grammar, back-button contract. |
| `design/03-SETTINGS-AND-THEMING.md` | What is configurable, where it is stored, and why settings are not events. |
| `src/ui/kit/` | The component vocabulary. Start here, not in a screen. |
| `src/ui/tokens.css` | Three layers: structural, five themes, user modifiers. Every ink value carries its measured contrast ratio, and `tests/engine/theme-contrast.test.ts` checks that the ratio is true. |
| `tests/e2e/responsive.spec.ts` | The layout rules as assertions, across six viewports and five themes. |

### The two things most likely to bite next

1. **`clip-path` clips outlines.** Anything with a `cut-*` class needs the inset
   pseudo-element focus ring, not `outline`. This silently removed the focus ring from
   most of the app until 12.3.
2. **Anything whose final state matters animates in CSS, never in JavaScript**
   (§5.1). This cost three separate bugs — an invisible screen, an off-screen sheet, and
   an untappable button — before it was written down.
