# 01 — Current Architecture Audit

Everything in this file was read from the repository as it stands on 29 Sep 2026. File references are relative to the repo root. Where a claim is about behaviour, the file and function that produce it are named so it can be re-verified.

---

## 2. Current architecture audit

### 2.1 Layering as built

```
ui/        React 18 screens, sheets, moments, kit        ── imports DEFAULT_CONFIG directly (25+ files)
  │
store/     ~30 orchestration modules                     ── Dexie reads/writes + engine calls
  │                                                          appends event + writes domain row in one tx,
  │                                                          then completeQuest → rebuildProjections
db/        Dexie 'system-arc' v4, 28 tables              ── events.ts (append, idem), projections.ts
  │                                                          (full replay), domainProjections.ts (domain fold)
engine/    pure, deterministic                           ── lint-enforced: no React/Dexie/Date/Math.random
```

**Write path (typical domain log, e.g. `store/dsa.ts#logProblem`):**
append `PROBLEM_LOGGED` → write `dsa_problem` / `dsa_attempt` rows → `maybeCompleteDsaQuest` re-reads today's attempts, compares them with hard-coded thresholds (≥1 problem or ≥25 min) → `completeQuest` → append `QUEST_COMPLETED {questKey:'dsa'}` → `rebuildProjections(DEFAULT_CONFIG)` replays the entire log into `quest_template`, `quest_instance`, `xp_ledger`, `day_rollup`, `player_state`.

**Read path:** stores query tables directly and call pure engine functions with `DEFAULT_CONFIG`. Attributes, rank gates, bosses, achievements and reality metrics are all computed live on read from domain tables. Nothing is snapshotted except at checkpoint seal.

### 2.2 Strengths that must survive generalization

These are load-bearing. The plan preserves every one of them.

| Strength | Where | Why it matters for the platform |
|---|---|---|
| Pure engine, boundary enforced by lint | `eslint.config.js` (engine rules) | The generator and validator go in the same pure zone and inherit the guarantee. |
| Clock and ids injected | `store/deps.ts`, `EngineDeps` | Generation is testable and deterministic by construction. |
| Append-only log, `idem_key` uniqueness, uuidv7 | `db/events.ts` | Blueprint versions become events: syncable, exportable, replayable. |
| Deterministic composite ids | `engine/quests.ts` (`${arcId}::${key}`, `${templateId}::${date}`) | Rebuild reproduces ids. Blueprint domain ids must follow the same discipline. |
| Full rebuild on every write ("recompute, never subtract") | `db/projections.ts` | One code path from events to state. Blueprint resolution slots into it. |
| `verifyIntegrity()` diffs live vs rebuilt, domain tables included | `db/projections.ts` | Becomes the cutover gate for the owner. |
| Golden-120 snapshot + 10,000-seed fuzz | `tests/engine/golden-120.test.ts`, `fuzz.test.ts` | The regression spine. Must be *broadened* (it covers XP/streak only). |
| CONTROLLED vs EXTERNAL split | `engine/career.ts`, `engine/xp.ts` default case | Generalizes into metric controllability (D7). |
| Deterministic voice selection with fingerprint | `engine/systemVoice.ts` | Already domain-neutral. It survives nearly untouched. |
| Theme contrast test | `tests/engine/theme-contrast.test.ts` | Extends to generated domain hues. |

### 2.3 CURRENT SYSTEM MAP — all 41 subsystems

**Classification key.** *Today:* **A** already configurable · **B** partially configurable · **C** hard-coded to the current user. *Target:* **D** must become configuration-driven · **E** should remain globally fixed. Several subsystems split: the mechanism is E and the content is D.

| # | Subsystem | Where it lives | What it does today | Today | Target | Notes |
|---|---|---|---|---|---|---|
| 1 | User onboarding | `ui/onboarding/*` (6 steps), `store/onboarding.ts#initialiseArc` | Identity → Arc → Rhythm → Directive → Triggers → Baseline. If-then intentions only for career/dsa/training. Baseline: height, weight, body fat, problems solved so far. | C | D | **6 captured answers are never read** (wakeTime, sleepTime, stepsTarget, screenCapMinutes, trainingDays, attentionApps → `profile.settings`, unused). |
| 2 | Arc configuration | `ARC_STARTED`, `arc` row, `Step2Arc.tsx` | Start/end dates chosen. Timezone and boundary hours come from `DEFAULT_CONFIG`; Step2 renders the literal text "Asia/Kolkata · day rolls at 04:00". | B | D | Arc length is implicitly 120 everywhere downstream (see #36, #38). |
| 3 | Daily quests | `engine/quests.ts` (`CORE_QUEST_KEYS`, `CORE_QUEST_TITLES`, `CORE_QUEST_CRITERIA`) | Six fixed templates; `generateQuests` itself is generic. | C | D | Generation is generic; the template set is not. |
| 4 | Quest types | `QuestType` union | `core` is generated. `weekly` lives in its own table. `recovery` is an event. `adaptive`/`revisit`/`boss`/`side` are declared but unused as templates. | B | E (taxonomy) + D (content) | Keep the taxonomy global. |
| 5 | Quest completion | `store/quests.ts#completeQuest` + `maybeComplete*` in `store/{career,dsa,build,training,lifestyle}.ts` | Generic event + rebuild, but each domain re-declares its threshold (`SLEEP_TOLERANCE_MINUTES = 30`, `ATTENTION_LIMIT_MINUTES = 60`, 8000 steps, 3 apps / 25 min, 1 problem / 25 min, 45 min). `template.criterion` is declared but **never evaluated**. Manual tap completes any quest. | C | D | Needs a generic `evaluateCriterion(criterion, daySignals)`. The manual tap needs an explicit per-quest evidence mode. |
| 6 | XP sources | `engine/xp.ts#baseGrantsFor` (switch on 10 event types) | Core completion, recovery, revisit, ship, learning block, system design, steps bonus, boss, weekly, maintenance. | C | D | Instruments declare their grant sources. |
| 7 | XP caps | `engine/xp.ts#applyCaps`, `config.categoryCaps`, `dailyCap` | Category cap, then daily cap; BONUS/BOSS exempt. | B | E (mechanism) + D (categories) | A category becomes "a domain's XP channel". |
| 8 | Level calculation | `engine/level.ts`, `config.level` | `req(n) = round10(200 + 84·n^0.98)`. Level 40 at 85% over 120 days. | A | E (calibrated per arc, pinned) | The coefficient must be re-solved for other arc lengths (§9). |
| 9 | Rank calculation | `engine/rank.ts#conditionsFor` (switch on day), `store/checkpoint.ts#computeGateEvidence` | E→S at days 14/30/60/90/120; 33 SE-specific evidence fields; literal thresholds; never regresses. | C | E (letters, schedule shape, never-regress, D-gate) + D (gate contents) | `playerState.rank` is still hard-coded `'E'` in `db/projections.ts`; rank is read from sealed checkpoints instead. |
| 10 | Attributes | `engine/attributes.ts#attributesFrom`, `store/attributes.ts` | 6 fixed formulas, groups Mind/Craft/Career/Body, 28-day window, components exposed. | C | D (formula DSL) + E (DISCIPLINE, window rules) | Formula weights are hard-coded "structural" constants. |
| 11 | Skills | `store/skills.ts`, `engine/dsa.ts#DSA_TOPICS`, `engine/foundations.ts#FOUNDATION_TOPICS`, `AI_TIER_TOPICS` (21) | Three topic lists plus a career "tree" of counts. `skill_node` / `skill_state` tables are **declared but unused**. | C | D | The schema already anticipated data-driven trees; nothing uses it. |
| 12 | Mastery | `engine/dsa.ts#masteryFor`, `engine/foundations.ts#foundationMasteryFor` | Global 5 states; two transition policies (practice-rate; block-count). AI topics reuse the block-count policy. | B | E (states) + D (policy parameters) | Skills.tsx labels Retained as "MONARCH S-RANK", which collides with Rank vocabulary. |
| 13 | Career system | `engine/career.ts`, `store/career.ts`, `LogApplicationSheet.tsx` | Quality gate (company, role, resume, why ≥15 chars, not duplicate), funnel, follow-through, substitute work, resume versions. | C | D → `pipeline` instrument | The richest anti-gaming logic in the app. Preserve it as instrument behaviour. |
| 14 | DSA system | `engine/dsa.ts`, `engine/srs.ts`, `store/dsa.ts` | Difficulty weights, outcomes, SRS ladder [3,10,30,90], first-attempt rate, weakest-topic weekly quest. | C | D → `practice_item` instrument | It generalizes to MCQs, language drills, chess puzzles, music etudes. |
| 15 | AI engineering system | `store/build.ts`, `engine/build.ts`, artifacts, `AI_TIER_TOPICS` | BUILD 45 min with LEARN/SHIP mode, 3:1 ratio rule, artifact kinds, eval suites, deployments, cost-per-task. | C | D → `duration`(modes) + `artifact` + `study_block` | The LEARN/SHIP ratio generalizes to "input vs output" modes. |
| 16 | Training system | `store/training.ts`, `engine/training.ts` | Session with lifts, Epley 1RM; steps ≥8000 complete, ≥10000 bonus. | C | D → `session` + `threshold` | The interview benchmark is also stored here (`metric_sample.kind = 'interview_benchmark'`), a cross-domain leak. |
| 17 | Sleep system | `engine/sleep.ts`, `store/lifestyle.ts#logSleep` | Wake within ±30 min of `config.wakeTargetTime` (08:30). | C | D → `time_window` | Onboarding's wakeTime answer is ignored. |
| 18 | Fuel system | `engine/maintenance.ts`, `MaintenanceCard.tsx` | Demoted to Maintenance: bath, fuel, laundry every 3 days → 20 XP all-done. | C | D → `checklist` instrument (optional) | PG-catering-specific rationale (final/00 C1). |
| 19 | Attention system | `store/lifestyle.ts#logScreentime` | Numeric screen time ≤ 60 → complete. | C | D → `threshold` (≤) | Onboarding's screenCap and attentionApps are ignored. |
| 20 | Evidence system | artifacts (url), resume versions, benchmark self-cert, gate conditions | "Externally verifiable but fully controllable" (final/00 C3). | B | D | Becomes an explicit verifiability ladder (§13). |
| 21 | Checkpoints | `store/checkpoint.ts`, `CheckpointScreen.tsx` | Days 0/14/30/60/90/120; GateEvidence snapshot; 7 fixed comparison rows; instruments: self-efficacy (6 SE items, e.g. "Solve an unseen medium DSA problem…"), automaticity 4, enjoyment 3 (DSA / Building / Training); export-before-seal. | C | E (schedule shape, export-before-seal, seal semantics) + D (rows, items) | |
| 22 | Bosses | `engine/boss.ts`, `store/boss.ts`, `BossList.tsx` | 4 fixed bosses, windows from days 25/50/75/100, conditions switch, 500 XP uncapped, player-initiated clear, cannot fail. | C | E (mechanism) + D (content) | |
| 23 | Achievements & identities | `engine/achievements.ts` | 8 achievements + 5 identities with domain thresholds. | C | split | First Move, Two Weeks, Return, Regular*, The Arc, Consistent, Keeps Promises are global; Century, Shipped, In Public, Problem Solver, Builder, Trains are domain-derived. |
| 24 | Reviews | `ui/review/EveningReview.tsx`, `WeeklyReview.tsx`, `store/review.ts`, `store/weeklyReview.ts`, `engine/weeklyReview.ts` | Evening: energy, focus, blocker, slept-at, tomorrow priority (only career/dsa/build/training). Weekly: attribute deltas, bottleneck, rules, weekly quest proposal, resume nudge, sleep→DSA correlation. | B | E (universal) + D (domain prompts, rules) | |
| 25 | Recovery | `store/recovery.ts`, `QUEST_RECOVERED` | 48 h window, 40 XP BONUS, diagnostic reason; 3× "wrong time" in 14 days → proposal. | A (generic) | E | |
| 26 | Reduced Mode | `engine/streak.ts#streakFrom` | Derived: 2 misses → on; 2 MVD hits → off. **Displayed only; the quest set does not collapse to the floor.** | B | E + implement | The generic engine needs per-template floor variants to honour final/01 §6.4. |
| 27 | Evidence messages | `engine/messages.ts` (P1–P5), `store/messages.ts` | P1: first hard problem first-attempt, longest deep block, first deployment. P2: first-attempt-M trend, wake SD trend. P3: DSA-by-sleep correlation. P4/P5 generic. | C | D (signal templates) | |
| 28 | Quote / message engine | `engine/systemVoice.ts`, `engine/voicePack.ts` (≈290 lines), `engine/reflections.ts` (64), `public/voice/*.mp3` | Voice: tiered, phased, banded, fingerprinted, mostly domain-neutral. **Pre-rendered audio** keyed by line id. Reflections have categories incl. career/training/study; `max_day: 120`. | B | D (count-word variants, archetype tagging) + E (voice rules) | Literals: "ALL SIX CONDITIONS", "SIX CONDITIONS ARE OPEN", "FIVE OF SIX" (`coreTotal === 6`), "BEGINS AT 04:00", "YOUR NEXT ASCENSION". |
| 29 | Settings | `store/settings.ts` (localStorage), `SystemScreen.tsx` (reminders) | Device prefs (theme, accent, text, density, motion, art, glow, voice). Reminder editor keyed by career/dsa/training with hard-coded labels. | B | E (device prefs) + D (reminders) | |
| 30 | Themes | `ui/tokens.css`, `store/settings.ts` | 5 themes, 6 accents, contrast-tested. | A | E | Configuration must not control design. Domain hues come from a curated, tested palette. |
| 31 | Data export / import | `store/checkpoint.ts#exportSnapshotJson/importSnapshotJson`, `engine/paperImport.ts` | JSON `{schema_v:1, events, arc, profile, checkpoints}`; import replays and rebuilds all tables. Paper CSV with fixed columns dsa/bld/trn/slp/fue/att. | B | E (+ blueprint), paper CSV stays legacy-only | Export is plaintext; the final/07 §9 optional encryption is not implemented. |
| 32 | IndexedDB | `db/schema.ts`, `db/db.ts` | Dexie v1→v4 additive; 28 tables, 12 domain-specific. | C | E (generic tables) + legacy tables retained | |
| 33 | Event ledger | `engine/types.ts#EventType`, `engine/reduce.ts` | 31 types (17 domain-specific). The reducer **throws** on unknown types. | B | E (envelope) + D (instrument records) | The throwing reducer is a rollback hazard (D11). |
| 34 | PWA | `vite.config.ts` (vite-plugin-pwa), `ui/routing/shortcuts.ts` | Manifest shortcuts: "Log problem", "Log application", "Evening review" — static, per-origin. | C | D (generic targets) | A manifest cannot be per-user. Shortcuts become "Log primary quest" / "Log evidence" / "Review", resolved at runtime. |
| 35 | Offline behaviour | Workbox precache; no network after load | Fully offline. | A | E | Generation must be offline too (bundled library, no LLM). |
| 36 | Timezone / day boundaries | `engine/time.ts` (correct and generic) | Callers pass `DEFAULT_CONFIG.arc.timezone` rather than the arc's. `phaseFor` bounds are fixed minutes (MORNING 04:00–11:00…). Day close 03:00. | B | D | Must derive from the arc row + the user's sleep rhythm. |
| 37 | Tests | `tests/engine` (55 files), `tests/e2e` (32 specs) | Golden-120 (XP/streak/ledger only), 10k fuzz, per-engine unit tests; e2e seeds via real onboarding. | B | E + persona fixtures | Nothing snapshots rank, attributes, bosses, achievements or messages yet. |
| 38 | Current UI assumptions | see §3.4 | Six rows; "Six of six"; `DAY n / 120` in 3 screens; three bespoke attribute detail routes; Skills tabs dsa/foundations/ai/career; six log sheets each with its own boolean state in `Today.tsx`. | C | D | |
| 39 | Hard-coded domain assumptions | see §3.1 | | C | D | |
| 40 | Hard-coded labels | see §3.2 | | C | D | |
| 41 | Hard-coded formulas | see §3.3 | | C | D / E | |

---

## 3. Current hard-coded assumptions

This is what would break if the original developer disappeared and a stranger installed the app tomorrow. Each item is tagged **[S]** if it silently produces *wrong behaviour* for a stranger (worse than merely irrelevant content) and **[I]** if it produces *irrelevant content*.

### 3.1 Domain assumptions (closed sets in code)

| Assumption | Location | Tag |
|---|---|---|
| The six quests are career, dsa, build, training, sleep, attention | `engine/types.ts#CoreQuestKey`, `engine/quests.ts#CORE_QUEST_KEYS` | I |
| XP categories CAREER/MIND/CRAFT/BODY/SLEEP/ATTENTION/LEARN/MAINT | `engine/types.ts#XpCategory`, `engine/config.ts#categoryCaps`, `engine/xp.ts#emptyDayState` | I |
| 31 event types, 17 domain-specific, each with its own payload and table | `engine/types.ts`, `db/schema.ts`, `db/domainProjections.ts` | I |
| Rank gate reads 33 SE fields | `engine/rank.ts#GateEvidence`, `store/checkpoint.ts#computeGateEvidence` | I |
| Boss conditions read 21 SE fields; Boss II names six CS topics | `engine/boss.ts#BossEvidence`, `BOSS_II_TOPICS` | I |
| Attributes read DSA/applications/sessions/wake SD | `engine/attributes.ts#AttributeInputs` | I |
| Attribute groups Mind/Craft/Career/Body, and three detail routes | `engine/attributes.ts#ATTRIBUTE_GROUPS`, `App.tsx` routes `attributes/{body,mind,craft}` | I |
| DSA topics (9), foundation topics (9), AI topics (21) | `engine/dsa.ts`, `engine/foundations.ts`, `store/skills.ts` | I |
| `MetricSampleRow.kind` union includes `interview_benchmark` | `db/schema.ts` | I |
| `SkillNodeRow.domain: 'dsa' \| 'foundations' \| 'ai'` | `db/schema.ts` | I |
| `ArtifactRow.kind` software-only (feature/eval/project/deployment/writeup/resume/portfolio) | `db/schema.ts` | I |
| If-then intentions only for career/dsa/training | `store/plan.ts#INTENTION_KEYS`, `store/achievements.ts#IF_THEN_KEYS`, onboarding | I |
| Evening review priority limited to four keys | `EveningReview.tsx#PRIORITY_OPTIONS` | I |
| Weekly quest proposal is DSA weakest-topic or ship | `engine/weeklyQuest.ts` | I |
| Weekly correlation is sleep → DSA first-attempt | `engine/weeklyReview.ts#sleepDsaCorrelation` | I |
| Resume nudge after shipping | `engine/weeklyReview.ts#resumeNudgeFor` | I |
| Rule LEARN_SHIP_RATIO reads `BUILD_SESSION_LOGGED` | `engine/rules.ts` | I |
| Checkpoint instruments: DSA-worded self-efficacy; enjoyment = DSA / Building / Training | `ui/components/InstrumentSliders.tsx`, `store/checkpoint.ts#Enjoyment` | I |
| Paper import columns dsa/bld/trn/slp/fue/att | `engine/paperImport.ts` | I (legacy-only) |
| PWA shortcuts "Log problem" / "Log application" | `vite.config.ts`, `ui/routing/shortcuts.ts` | I |

### 3.2 Hard-coded labels, copy, icons, colours, artwork

| Item | Location |
|---|---|
| Quest designations ASCENSION, LOGIC TRIAL, FORGE, VITALITY TRIAL, RECONSTITUTION, WILL TRIAL | `engine/quests.ts#CORE_QUEST_TITLES` |
| Row summaries and criterion text per key ("3 despatches / 25m focus", "sync window 08:00–09:00") | `ui/today/criterionText.ts` |
| Log action labels ("Despatch Ascension", "Record Logic Trial", "Forge Construct"…) | `ui/screens/Today.tsx#domainLogFor` |
| Quest icons (Briefcase, Code, …) and per-domain colour themes | `ui/today/QuestRow.tsx#QUEST_ICON`, `DOMAIN_THEME` |
| Reminder labels Career/DSA/Training | `ui/settings/SystemScreen.tsx#QUEST_LABELS` |
| Evening review priority labels | `ui/review/EveningReview.tsx#PRIORITY_LABELS` |
| Priority line fixed order and the literal "Six of six. Day closed." | `ui/today/priorityLine.ts` |
| Achievement and identity labels | `engine/achievements.ts` |
| Boss titles FIRST EVIDENCE / STRONG ENGINEERING BASE / AI ENGINEER / INTERVIEW READY | `engine/boss.ts#BOSSES` |
| Mastery badge "MONARCH S-RANK" for Retained, "AWAKENED" for Introduced | `ui/screens/Skills.tsx#MASTERY_BADGE_STYLE` |
| Level unlock lines ("Career funnel view", "DSA spaced revisits") | `ui/moments/levelUnlocks.ts` |
| Voice literals "SIX", "04:00", "ASCENSION" | `engine/voicePack.ts` |
| Onboarding literal "Asia/Kolkata · day rolls at 04:00"; defaults 08:35 / 22:00 / 20:15; height 178; weight 72 | `Step2Arc.tsx`, `Onboarding.tsx#initialForm` |
| Art slot `training` (domain-specific plate) | `design/art.manifest.json` |

### 3.3 Hard-coded formulas and numbers

| Formula / number | Location | Target |
|---|---|---|
| Core XP 100/100/100/100/60/40, caps 140/200/200/150/60/40/75/20, daily 700, MVD 35, recovery 40, boss 500, weekly 200, revisit 20, ship 50, block 25, steps bonus 20 @10k, maintenance 20 | `engine/config.ts` | Legacy blueprint pins them; the generator derives them (§9) |
| Level `200 + 84·n^0.98`, round 10 | `engine/config.ts` | E, calibrated per arc length |
| Grace 4 per 28, Reduced Mode 2/2, attribute window 28 | `engine/config.ts` | E |
| SRS [3,10,30,90], hint 3, editorial 2, unsolved 1, max 3 revisits/day, retained gap 21 | `engine/config.ts` | Instrument parameters (`practice_item`) |
| Difficulty weights E1/M2/H3.5 | `engine/dsa.ts` | Instrument parameters |
| Mastery thresholds (3 → applied; 5 + 60% + 2 medium-plus → fluent; 21 days → retained) | `engine/dsa.ts`, `engine/foundations.ts` | Mastery policy parameters |
| Six attribute formulas and their denominators (150 deep min, 45 block len, 110 weighted problems, 24 mastery pts, 6 shipped, 70 applications, 16 sessions, 8000 steps, 90 wake SD) | `engine/attributes.ts` | Attribute DSL |
| Rank thresholds 55/130/200/240 problems, 70/150/230/280 applications, 12/28/42/55 sessions, … | `engine/rank.ts` | Gate DSL, generated from milestone ladders |
| Boss windows 25/50/75/100 | `engine/boss.ts` | Fractions of arc length |
| Checkpoint days 14/30/60/90/120 | `engine/rank.ts`, `store/checkpoint.ts`, `store/systemMessage.ts`, `ui/screens/Profile.tsx` (4 copies) | Derived from arc length (§16) |
| Arc length 120 | `Progress.tsx`, `Skills.tsx`, `Profile.tsx`, `StreakGrid.tsx`, `reflections.ts` | From the arc row |
| Quality gate: why-line ≥ 15 chars, not a duplicate | `engine/career.ts` | `pipeline` instrument parameter |
| LEARN:SHIP > 3:1 over 14 days; 3× wrong-time in 14 days | `engine/build.ts`, `engine/rules.ts` | Rule parameters |
| Weekly quest stretch ×1.5, floor 10 | `engine/weeklyQuest.ts` | Proposal policy parameters |
| Voice phases MORNING 04–11, MIDDAY 11–14, AFTERNOON 14–18, EVENING 18–22 | `engine/systemVoice.ts#PHASE_BOUNDS` | Relative to the user's day boundary and wake time |
| Progress bands 21/50/65/80 % | `engine/systemVoice.ts#bandFor` | E |

### 3.4 UI assumptions

1. **Six rows.** `Today.tsx` keeps six independent `useState` booleans for six sheets and a `switch` over six keys. Quest count is fixed by construction, not by data.
2. **Six log sheets bound to keys**, not to measurement types. A second `practice_item`-style domain would need a second copy of `LogProblemSheet`.
3. **Arc length 120** appears in `DayMeta`, `StreakGrid`, Progress, Skills and Profile.
4. **Three attribute detail screens** (`BodyDetailScreen` 554 lines, `MindDetailScreen`, `CraftDetailScreen`) exist as routes named after the owner's groupings.
5. **Skills screen tabs** are dsa / foundations / ai / career, each with bespoke data fetching.
6. **Progress REALITY tab** renders `store/reality.ts#RealitySummary`: problems, first-attempt M, public projects, evals, applications, quality rate, follow-through, foundations fluent.
7. **Runtime config is imported, not provided.** There is no React context or store for the active configuration.

### 3.5 Silent-wrong-behaviour list [S] — what breaks for a stranger *today*

These are bugs for any second user, independent of personalization. Phase 1 fixes them.

1. **Wrong day boundaries outside IST.** `localDate(now, DEFAULT_CONFIG.arc.timezone, …)` is used across components, while the arc row holds the real timezone.
2. **Template `active_from` from `DEFAULT_CONFIG.arc.startDate` during every rebuild** (`buildProjections` → `generateCoreQuestTemplates(…, config)`). An arc starting before 2026-09-01 generates no quests on its early days until the next rebuild.
3. **Onboarding answers ignored.** A user who says "wake 06:30, screen cap 90" is scored against 08:30 and 60.
4. **Day close hard-wired at 03:00.** A night-shift worker's day is sealed mid-shift.
5. **Voice phases are IST office-day assumptions.** "MORNING" starts at 04:00 regardless of when the user wakes.
6. **History re-pricing on config change** (Executive summary finding 1).

---

## 4. Domain dependency map

Arrows read "depends on". A **bold** node carries a current-user domain assumption. Anything that depends on a bold node inherits its coupling.

```
                         ┌───────────────────────────── ui/screens/Today.tsx ──────────────────────────────┐
                         │  **domainLogFor switch** ─► 6 sheets: **LogApplication** **LogProblem**        │
                         │  **LogBuildSession** **LogTraining** **LogSleep** **LogAttention**              │
                         │  QuestRow ─► **QUEST_ICON / DOMAIN_THEME**   criterionText ─► **ROW_SUMMARY**   │
                         │  priorityLine ─► **CORE_ORDER**   SystemTransmission ─► store/systemMessage     │
                         └──────────────┬───────────────────────────────┬──────────────────────────────────┘
                                        │                               │
          ui/screens/Progress ─► **store/reality** (DSA, apps, artifacts, foundations)
                                 AttributeBars ─► **store/attributes** ─► **engine/attributes (6 formulas)**
                                 WeeklyReview ─► **store/weeklyReview** ─► **engine/weeklyReview** (sleep→DSA,
                                                                           resume nudge) + **engine/rules**
          ui/screens/Skills ─► **store/skills** ─► **engine/dsa** **engine/foundations** **AI_TIER_TOPICS**
          ui/screens/Profile ─► **CHECKPOINT_DAYS** ─► **store/checkpoint.computeGateEvidence** ─► **engine/rank**
                                BossList ─► **store/boss** ─► **engine/boss**
                                AchievementsList ─► **store/achievements** ─► **engine/achievements**
          ui/review/EveningReview ─► **PRIORITY_OPTIONS**
          ui/settings/SystemScreen ─► **INTENTION_KEYS**
          ui/onboarding/* ─► **career/dsa/training intentions**, **baseline(problems)**, DEFAULT_CONFIG.arc

  store/{career,dsa,build,training,lifestyle} ─► **maybeComplete* (thresholds)** ─► store/quests.completeQuest
                                                                                  │
                        db/projections.buildProjections ◄─────────────────────────┘
                          ├─► engine/reduce.applyEvents        (generic; **throws on unknown types**)
                          ├─► **engine/quests.generateCoreQuestTemplates(config)**  ◄── re-prices history
                          ├─► engine/quests.generateQuests      (generic)
                          ├─► **engine/xp.computeDayLedger** ─► **baseGrantsFor switch** ─► **config.coreQuests**
                          ├─► engine/level.levelFor             (generic)
                          └─► engine/streak.streakFrom          (generic)
  db/domainProjections.buildDomainTables ─► **12 domain tables**, **careerEventKindToStatus**, **srs.nextReview**

  store/systemMessage ─► engine/systemVoice (generic) + **CHECKPOINT_DAYS** + voicePack (**"SIX"**, **"04:00"**)
  store/messages ─► **engine/messages P1–P3** (hard problem, deep block, deployment, first-attempt M, wake SD)
```

**Generic already (keep as-is, re-parameterize only):** `engine/time.ts`, `engine/level.ts`, `engine/streak.ts`, `engine/xp.ts#applyCaps` / `computeDayLedger`, `engine/quests.ts#generateQuests`, `engine/systemVoice.ts` selection, `engine/srs.ts#nextReview`, `engine/ifThen.ts`, `engine/csv.ts`, the whole `ui/kit/*`, `ui/moments/*` (apart from copy), `store/recovery.ts`, `store/pause.ts`, `store/streak.ts`, `store/settings.ts`.

---

## The critical product question — are LEVEL, RANK, XP, ATTRIBUTE, SKILL, BOSS and CHECKPOINT truly domain-independent?

| Model | Mechanism domain-independent? | Content domain-independent? | What is coupled | How to decouple |
|---|---|---|---|---|
| **XP** | Yes. Caps, exemptions and chronological application are generic. | No | Grant sources are a switch over domain event types; categories are a closed union; values are constants. | Instruments emit **grant intents** `{channel: domainId, amount, reason, kind: 'core'\|'bonus'\|'uncapped'}`. The channel is the domain; caps come from the Blueprint's economy section. `baseGrantsFor` becomes a lookup, not a switch. |
| **Level** | Yes | Yes (in shape) | Only the calibration: 84 was solved for 120 days and a 500 XP/day budget. | Keep the formula family. Solve the coefficient at generation from arc length and budget with a TS port of `xp-simulation.py`, and pin it in the Blueprint for the arc's lifetime. |
| **Rank** | Mostly. Never-regress, all-conditions-met and next-gate display are generic. | No | `GateEvidence` is a 33-field SE struct; the `conditionsFor` switch is keyed on the literal days 14/30/60/90/120. | Gate = list of `GateCondition { signalRef, aggregate, comparator, threshold, label }` evaluated by one generic evaluator. The schedule is derived from arc length. The D-gate stays global. |
| **Attribute** | Partly. The weighted, clamped, ×100, components-exposed shape is generic. | No | Six formulas are code; inputs are domain aggregates. | Attribute DSL over instrument **signals**. DEPTH needs `combine: 'product'`; the others need `'sum'`. |
| **Skill / Mastery** | States yes; transitions are two separate implementations. | No | Topic lists are constants; the career "tree" is ad-hoc counts. | Skill trees become Blueprint data bound to an instrument's topic dimension, with a mastery **policy** (`practice_rate` or `block_count`) plus parameters. |
| **Boss** | Yes (window start, cannot fail, player-initiated, 500 uncapped). | No | `BossEvidence` struct, titles and windows. | Boss = `{anchorMilestoneId, windowStartDay, conditions: GateCondition[]}`. The same evaluator as rank. |
| **Checkpoint** | Yes (seal, export-before-seal, snapshot, compare). | No | Schedule literals, 7 comparison rows, SE-worded instruments. | Comparison rows are generated from each domain's headline metrics. Instruments get per-domain item text from archetypes. |

**Conclusion.** Every model can become domain-independent without changing what it *means*. The decoupling is always the same move: **replace a struct of named domain fields with a list of references to instrument signals, evaluated by one generic function.** No model needs a new concept. Each needs its evidence source abstracted. That is why the Instrument layer (Phase 3) and the shadow engine (Phase 4) come before any UI or onboarding work.
