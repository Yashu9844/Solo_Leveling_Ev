# 05 — Roadmap: Phases, Loops, Files, Migration, Acceptance

This file is written to be executed by Claude Code, one loop per session or less. Each loop is a vertical slice that ends in a green build and a commit. **Never start a loop with the previous loop's gates red.**

---

## 39. Detailed phase roadmap

### 39.1 How the brief's phases were reorganized

The brief's 24 suggested phases were regrouped by real dependencies found in the audit. The brief listed domain abstraction, quest templates and the Blueprint before migration. In the code, migration safety (the history re-pricing bug, the throwing reducer, the service-worker auto-update) is the precondition for everything else, and the Instrument layer is what makes the domain abstraction real.

| Brief phase | Where it lands |
|---|---|
| 0 Audit | this folder + Phase 0 (safety rails) |
| 1 Configuration architecture | Phase 1 (runtime seam) + Phase 2 (schema) |
| 2 Domain abstraction | Phase 3 (instruments) |
| 3 Quest template architecture | Phase 2 (schema) + Phase 4 (criterion evaluator) |
| 4 System Blueprint | Phase 2 |
| 5 Migration of current System | Phase 2.5 (legacy v1) + Phase 6 (cutover) |
| 6 Validation | Phase 2 |
| 7 Adaptive onboarding | Phases 10–11 |
| 8 Dynamic quest generation | Phase 4 (engine) + Phase 8 (generator) |
| 9 / 10 / 11 / 12 Skills, attributes, evidence/checkpoints, bosses/milestones | Phase 4 (evaluators) + Phase 8 (generation) |
| 13 Reviews | Phase 13 |
| 14 Messaging | Phase 12 |
| 15 Configuration-aware UI | Phase 7 |
| 16 Configuration management | Phase 14 |
| 17 Backward compatibility | Phases 1, 5, 6 (throughout) |
| 18 Fixture testing | Phase 9 (+ harnesses in 0, 4) |
| 19 Performance | Phase 15 |
| 20 Migration / rollback testing | Phases 5, 15 |
| 21 Original-user regression | Phases 0, 4, 6, 7, 16 |
| 22 New-user usability | Phase 16 |
| 23 Play Store readiness | Phase 17 |

### 39.2 Phases

| Phase | Name | Objective | User value | Owner-visible? |
|---|---|---|---|---|
| 0 | Safety rails | Make regressions impossible to miss; isolate platform builds | Owner's arc is protected | no |
| 1 | Runtime config seam | Config from the arc, not an import; forward-compatible reducer | Correct timezones for anyone; rollback safety | no |
| 2 | Blueprint schema + validator + legacy v1 | The data model and its guardrails exist and describe the owner exactly | Foundation | no |
| 3 | Instrument layer | Domain independence, characterization-tested | Foundation | no |
| 4 | Blueprint engine in shadow | A new engine proven identical to the old | Foundation | no |
| 5 | Versioning + historical integrity | History can never be re-priced | Safe editing becomes possible | no |
| 6 | Owner engine cutover | Owner runs on the Blueprint engine | none visible, by design | no (risk point) |
| 7 | Configuration-aware UI | Screens render from the Blueprint | Any System renders richly | no (pixel-identical) |
| 8 | Library + generator | Generate a System from answers | Strangers get real Systems | no |
| 9 | Persona fixtures | Prove the engine across 12 personas | Confidence | no |
| 10 | Onboarding engine + Quick | Awakening for new arcs | First-run experience | no |
| 11 | Guided + custom + Reveal + Activation | The full awakening | **First stranger-usable build** | no |
| 12 | Messaging | Voice and evidence messages are configuration-aware | The System speaks to *you* | no |
| 13 | Reviews | Domain prompts, generalized rules | Relevant reflection | no |
| 14 | Configuration management | Codex, revisions, amend at checkpoint | Systems evolve safely | yes (new entry) |
| 15 | Performance, offline, drills | Budgets, rollback proven, encryption | Speed and safety at scale | no |
| 16 | Validation | Owner regression + usability study | Evidence the product works for others | — |
| 17 | Contract + Play Store | Remove legacy branches; store audit | Public release readiness | — |

**Stop-points.** After Phase 7 (the owner gains correctness, nothing breaks) and after Phase 11 (a stranger can use it), re-decide whether to continue. Every phase before a stop-point is valuable on its own.

---

## 40. Loop-by-loop implementation plan

### 40.1 Standard loop protocol (applies to every loop below)

```
PLAN      Re-read this loop + the referenced sections. Write a 5–10 line plan in the session.
DESIGN    Types/interfaces first. No behaviour change outside the loop's objective.
IMPLEMENT Smallest change that meets the objective. Engine code stays pure (lint enforces).
TEST      Add the loop's tests FIRST where it's a characterization/equivalence loop.
RUN       npm run verify            (typecheck + lint + unit + build)
          npm run test:e2e          (from Phase 0.4 onward: includes pixel baseline)
VERIFY    Gates: G1 verify green · G2 e2e green · G3 golden snapshots unchanged (unless the loop
          says otherwise, with the diff reviewed) · G4 owner fixture E1/E2 if present locally
          · G5 verifyIntegrity clean on a seeded DB
REVIEW    Diff review against: 02 §20 invariants, 03 §27.1 UI rules, 04 §36 privacy rules.
FIX       Address any regression before moving on. Never loosen a gate to pass.
COMMIT    One commit per loop: "platform(<phase>.<loop>): <objective>". Include gate results
          in the body. Update the loop checklist in this file (☐ → ☑).
```

**Manual verification** (listed per loop where relevant) happens on a real Android device per final/07 §6.3, and **only on the platform origin** until Phase 6.

---

### Phase 0 — Safety rails

| Loop | Objective | Changes | Tests / manual | Acceptance |
|---|---|---|---|---|
| ☑ 0.1 | Version control baseline | `git init`; baseline commit of the current tree; `.gitignore` += `platform-fixtures/private/` | `npm run verify` + `npm run test:e2e`; record pass counts in the commit body | the repo exists; the baseline is green or failures are recorded as pre-existing |
| ☑ 0.2 | Owner golden fixture harness | `tests/support/ownerFixture.ts` loads `platform-fixtures/private/owner-export.json` if present; `tests/engine/owner-golden.test.ts` builds projections and domain tables and compares against a **local-only** hash file | skipped in CI; runs locally | the owner's export replays with `verifyIntegrity`-equivalent output; no personal data committed |
| ☑ 0.3 | Broaden golden-120 to read models | `tests/engine/golden-read-models.test.ts`: import the seed-42 log into fake-indexeddb via `importSnapshotJson`, then snapshot for every checkpoint day and 10 sampled days: attributes, gate results, boss results, achievements, identities, reality summary, weekly review, daily report, message context and selection, transmission | new committed snapshot | the snapshot is stable across 3 runs |
| ☐ 0.4 | Pixel baseline | `tests/e2e/visual-baseline.spec.ts`: seeded synthetic legacy DB → every route, sheet and moment at 360/390/430 widths | committed baseline images | 0 diff on re-run |
| ☑ 0.5 | Platform isolation | `VITE_DB_NAME` (default `system-arc`) read by `db/db.ts`; a preview deploy config for the platform origin | manual: preview origin shows an empty DB; production unchanged | the owner origin is untouched |

### Phase 1 — Runtime config seam + forward-compatible reducer

| Loop | Objective | Changes | Tests / manual | Acceptance |
|---|---|---|---|---|
| ☑ 1.1 | Forward-compatible reducer (D11) | `engine/reduce.ts`: `KNOWN_EVENT_TYPES`; unknown types are skipped and counted in `EngineState.skipped` instead of thrown; the same in `buildDomainTables` | unit: an unknown type is skipped, known behaviour identical; golden unchanged | **ships to the owner origin and soaks ≥ 7 days before any loop writes a new event type** |
| ☑ 1.2 | Single arc accessor | `store/arc.ts#getActiveArc()`; replace every `db.arc.toCollection().first()` | existing suites | no behaviour change |
| ☑ 1.3 | Engine config from the arc | pure `engine/config.ts#engineConfigFor(arc)`; `store/SystemContext.tsx` provider + `useEngineConfig()`; UI passes the hook value instead of `DEFAULT_CONFIG`; `buildProjections` uses `arc.start_date` for template `active_from` | unit: an arc with `America/New_York` yields NY local dates; golden unchanged (owner start date = default) | the owner gets identical behaviour; a stranger gets their own timezone |
| ☑ 1.4 | Lint the seam | ESLint `no-restricted-imports` for `engine/config` `DEFAULT_CONFIG` in `src/ui/**` (allow-list: legacy onboarding until Phase 10) | lint | zero violations |
| ☑ 1.5 | New-arc timezone correctness | onboarding detects the timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); Step2 shows the detected zone instead of the literal; e2e with Playwright `timezoneId` for 3 zones | e2e | day boundary correct in 3 zones; owner unaffected (existing arc) |

### Phase 2 — Blueprint schema + validator + LEGACY_BLUEPRINT_V1

| Loop | Objective | Changes | Tests | Acceptance |
|---|---|---|---|---|
| ☑ 2.1 | Schema + hashing | `src/blueprint/schema.ts` (02 §7–18 types); `src/blueprint/hash.ts` (canonical JSON; computational vs presentation field partition) | property: key order doesn't change the hash; I13 on random mutations | types compile; hashes stable |
| ☑ 2.2 | Instrument catalogue (declarative) | `src/instruments/catalog.ts`: per type — params bounds, record schema, signal names and kinds (effort/performance), minimums | unit | every legacy signal referenced by later loops exists |
| ☐ 2.3 | Validator part 1 | `src/blueprint/validate.ts`: V-ARC, V-DOM, V-REF, V-VOC, V-INS | a failing + passing fixture per code | catalogue codes implemented |
| ☐ 2.4 | Validator part 2 | V-QST, V-XP, V-MET, V-GATE, V-BOSS, V-ATT, V-SKL, V-MSG | same | same |
| ☐ 2.5 | Transition validator | `validateTransition` (V-TRN-01…05); change-class computation from hashes + field diff | unit + property | class computed, never declared |
| ☐ 2.6 | LEGACY_BLUEPRINT_V1 | `src/blueprint/legacy/legacyV1.ts`, transcribing config.ts, quests.ts titles and criteria, criterionText, QuestRow icons and themes, rank gates (exact labels), bosses, attributes, achievements, identities, topic lists, checkpoint rows and instruments, rules, reflections filter, voice literals, and the 02 §22.1 deviations | **fidelity test** cross-checks every value against the live constants; validator clean (legacy-only exemptions allowed only when `provenance.generator === 'legacy'` and each is listed with a reason) | legacy v1 = the owner's System, as data |

### Phase 3 — Instrument layer

Each loop implements an instrument type (`src/instruments/types/<type>.ts`: record validation, signals over a date range, grant intents, guards) and a **characterization suite** against the legacy function over fast-check corpora.

| Loop | Instrument(s) | Characterized against | Acceptance |
|---|---|---|---|
| ☑ 3.1 | framework + `SignalSnapshot` builder (global signals: MVD days, core completion, bosses, checkpoints) | `db/projections.ts#buildDayOutcomes`, `consistencyOver` | identical outputs |
| ☑ 3.2 | `practice_item` (+ SRS, `practice_rate` mastery, weighted volume, first-attempt rate) | `engine/dsa.ts`, `engine/srs.ts`, `store/mastery.ts` | 10k-case equality |
| ☑ 3.3 | `pipeline` (quality gate, funnel, follow-through, substitute share, stage mapping) | `engine/career.ts` | equality |
| ☑ 3.4 | `duration` (modes, ratio rule) + `artifact` (kinds, flags, verifiability) | `engine/build.ts`, `engine/rules.ts` LEARN_SHIP, artifact queries in `store/checkpoint.ts` | equality |
| ☑ 3.5 | `session` (Epley, strength gain) + `threshold` + `time_window` (hit, SD) | `engine/training.ts`, `engine/sleep.ts`, `store/lifestyle.ts`, wake SD in `store/attributes.ts` | equality |
| ☐ 3.6 | `study_block` (`block_count` mastery, modes) + `checklist` (everyNDays) | `engine/foundations.ts`, `engine/maintenance.ts` | equality |
| ☐ 3.7 | Legacy upcasters + write adapters | every legacy domain event → InstrumentRecord; records derived from events equal records derived from `buildDomainTables` rows | equality on golden + fuzz + owner |

### Phase 4 — Blueprint-driven engine in shadow

| Loop | Objective | Parity target | Acceptance |
|---|---|---|---|
| ☐ 4.1 | `evaluateCriterion` + `explainCriterion` | on every day of every corpus, `met` ⇔ the legacy `maybeComplete*` firing condition | 100% agreement |
| ☐ 4.2 | Grant resolution + channel caps → `computeDayLedgerV2` | `computeDayLedger` rows (amount, category, reason, capped_from) | E1 on the ledger |
| ☐ 4.3 | `buildProjectionsV2(events, versions, deps)` | all 5 cache tables | E1 deep-equal |
| ☐ 4.4 | Attribute DSL evaluator | `attributesFrom` + `store/attributes.ts` inputs | E2 |
| ☐ 4.5 | Gate evaluator | `evaluateGates` labels, values and met for days 14/30/60/90/120 | E2 |
| ☐ 4.6 | Boss, achievement and identity evaluators | `evaluateBoss`, `achievementsFrom`, `identitiesFrom` | E2 |
| ☐ 4.7 | Checkpoint comparison, reality summary, weekly review, message context | `checkpointComparison`, `getRealitySummary`, `getWeeklyReview`, `computeMessageContext`, `buildSystemMessageContext` | E2 |
| ☐ 4.8 | Shadow harness | `scripts/shadow-equivalence.mjs` / `npm run shadow`: E1+E2 over golden, a 1,000-seed fuzz sample, the owner fixture; a readable report | clean report, committed as a CI job (owner part local) |

### Phase 5 — Versioning + historical integrity

| Loop | Objective | Changes | Tests | Acceptance |
|---|---|---|---|---|
| ☐ 5.1 | Dexie v5 (additive) + connection safety | `SCHEMA_V5_ADDITIONS` (§43); `db.on('versionchange')` close+reload; `blocked` copy | upgrade test v4 → v5 on fake-indexeddb with a seeded v4 DB | existing data intact; new tables empty |
| ☐ 5.2 | `BLUEPRINT_ACTIVATED` + resolver | event type + payload; reducer folds versions with H9 re-validation; `versionFor(date)`; implicit legacy | unit + property | no events → legacy v1 everywhere |
| ☐ 5.3 | New event payloads | `QUEST_COMPLETED` schema_v 2 (domainId, questDefId, blueprintVersion; questKey kept); `INSTRUMENT_RECORDED`; read-side upcast of v1 | unit | mixed v1/v2 logs fold identically |
| ☐ 5.4 | Multi-version projections | `buildProjectionsV2` resolves per date; ledger `blueprint_version` | H2, H3, H6 property tests with random version histories | invariants hold over 1,000 histories |
| ☐ 5.5 | Integrity suite | I3, I4, I7, I8, I13, I16, I18 | property | all green |
| ☐ 5.6 | Export / import v2 | export `schema_v: 2` (events already carry versions; add `blueprint_versions` for readability); import accepts v1 and v2 | round trip | an export of a multi-version log reproduces all tables |

### Phase 6 — Owner engine cutover (flag `ENGINE_V2`)

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 6.1 | Write path: store functions resolve the version and call the V2 engine; `maybeComplete*` replaced by `evaluateCriterion`; legacy instruments write legacy events through write adapters | with the flag on, all L0 suites green; E1 on golden/fuzz/owner |
| ☐ 6.2 | Read path: attributes, checkpoint, boss, achievements, reality, weekly, messages via the V2 evaluators | E2 green with the flag on |
| ☐ 6.3 | Flag-on soak on the platform origin with the owner's imported export | `verifyIntegrity` clean daily for 7 days of the owner's real use on a second device, or of replayed activity |
| ☐ 6.4 | **Cutover** following 02 §22.3: export → date check (not within ±3 days of a checkpoint) → deploy flag-on to the owner's origin → owner runs Verify integrity | the owner confirms Today, Progress, Skills and Profile look and behave the same |
| ☐ 6.5 | 7-day post-cutover soak + decision record in `platform/decisions/0001-cutover.md` | clean integrity checks; rollback plan still valid |

### Phase 7 — Presentation registry and configuration-aware UI

The E3 pixel baseline from 0.4 must stay at 0 diff for the legacy Blueprint through every loop in this phase.

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 7.1 | `SystemProvider` exposes the Blueprint; `presentDomain`; curated icon and hue token sets; `theme-contrast.test.ts` extended to 8 domain hues × 5 themes | tokens pass contrast; legacy hues = the current `DOMAIN_THEME` |
| ☐ 7.2 | Extract `PracticeItemSheet` (from LogProblemSheet) and `PipelineSheet` (from LogApplicationSheet) into `ui/instruments/*`; registry | E3 0 diff; dsa and career e2e green |
| ☐ 7.3 | Extract `DurationSheet`, `ArtifactSheet`, `SessionSheet` | same |
| ☐ 7.4 | Extract `ThresholdSheet`, `TimeWindowSheet`, `StudyBlockSheet`, `ChecklistCard`; new `MetricSheet` | same |
| ☐ 7.5 | Today: `openSheet` state; rows from `presentDomain` + `evaluateCriterion` progress; priority line from Blueprint priority; count words | same |
| ☐ 7.6 | Progress SYSTEM/REALITY from the Blueprint; `/attributes/:groupId` with layout variants; legacy routes redirect | same |
| ☐ 7.7 | Skills from trees + milestone panels; benchmark as a self_cert metric card | same |
| ☐ 7.8 | Profile, checkpoint screen, bosses, achievements, evening-review priority options, settings reminders, PWA shortcut aliases (`/log/primary`, `/log/evidence`; legacy paths kept) | same |
| ☐ 7.9 | Lint: no legacy domain-key literals in `src/ui/**` outside `ui/instruments/legacy`; `DEFAULT_CONFIG` import ban without allow-list (except legacy onboarding) | zero violations; a second (synthetic) Blueprint renders on every screen without errors — manual review of rich rendering |

### Phase 8 — Archetype library + generator

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 8.1 | Library skeleton: `src/library/{index,lexicon,icons,hues,calibration}.ts`; TS port of `final/xp-simulation.py`; calibration table asserted (120 d → 84) | simulation test reproduces the final/01 §3 table within ±1 level |
| ☐ 8.2 | Generator S1–S5 (normalize → archetypes → domains/instruments → quests → economy/progression) | legacy-shaped answers → economy 100/100/100/100/60/40, caps 140/200/200/150/60/40 |
| ☐ 8.3 | Generator S6–S10 (metrics, milestones, skills, attributes, gates, bosses; B5) | ladders monotonic; bosses anchored; gates satisfy E1/E2 |
| ☐ 8.4 | Generator S11–S14 (checkpoint items, reviews, rules, messaging labels, presentation, hash + validate) | determinism + totality property (I11) |
| ☐ 8.5 | Archetype content batch 1: software-practice, career-pipeline, deep-build, strength-movement, sleep-regularity, attention-control, exam-prep, reading | each archetype reviewed for voice and richness (checklist in 03 §25.2) |
| ☐ 8.6 | Batch 2: remaining archetypes + `custom:<type>` | same |
| ☐ 8.7 | Presets + "never empty" property (I17); SOFTWARE ENGINEER vs legacy diff documented by a snapshot test | I17 green |
| ☐ 8.8 | Floor collapse in Reduced Mode + level-unlock gating (feature table) for generated Systems; `collapsesQuests: false` for legacy | persona lapsing profile shows the collapse; legacy golden unchanged |

### Phase 9 — Persona fixtures + property tests

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 9.1 | `personaEventLog(blueprint, seed, profile)` generator | deterministic; drives every instrument type |
| ☐ 9.2 | Persona suites P1–P3 (04 §32.2 table) | all assertions green |
| ☐ 9.3 | Persona suites P4–P7 | same |
| ☐ 9.4 | Edge personas X1–X4 (min, max, night shift, DST) | I19 green |
| ☐ 9.5 | Wire the full I1–I20 suite; nightly full-seed job, PR sampled job | CI time within budget (PR ≤ current + 3 min) |

### Phase 10 — Adaptive onboarding engine + Quick Awakening

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 10.1 | Pure question engine: predicates, `nextQuestion`, draft reducer, question budget | unit + property: every path terminates; ineligible answers retained but inert |
| ☐ 10.2 | Question content: stages 1–13 + packs for batch-1 archetypes | content review against the voice rules |
| ☐ 10.3 | Generic renderers in the existing console shell (`InitSpine`, `StepConsole`, dial hero, if-then hero) | visual review on device; reduced-motion pass |
| ☐ 10.4 | Quick tier end to end: answers → generate → minimal Reveal → activation transaction (`ARC_STARTED` + `BLUEPRINT_ACTIVATED` + Day-0 checkpoint); flag `NEW_ONBOARDING` for new arcs only | e2e per preset: Today shows the generated quests; ≤ 2 min scripted |
| ☐ 10.5 | Draft persistence and resume; the draft is deleted at activation and by "delete everything" | kill-and-resume e2e |

### Phase 11 — Guided + custom domains + Reveal + Activation

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 11.1 | Guided stages, echo lines, exam-date alignment | e2e P2 aligns the arc to the exam date |
| ☐ 11.2 | Custom domain flow (03 §26) | e2e P7 builds five custom domains; validator clean |
| ☐ 11.3 | Reveal Moment + Codex cards + Adjust sheets + pinning + provenance lines | pinned fields survive re-generation (property) |
| ☐ 11.4 | Activation UX: issues in System voice, one-tap fixes, acknowledgement | invalid drafts cannot activate (e2e) |
| ☐ 11.5 | Full journeys P1–P7 through the UI; **stop-point review** | written go/no-go in `platform/decisions/0002-stranger-build.md` |

### Phase 12 — Configurable System messaging

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 12.1 | Evidence message templates driven by signals (P1–P3); eligibility bans (body, external, forecasts) | I20; persona message tests; legacy E2 unchanged |
| ☐ 12.2 | Voice: `{COUNT}` lines with pre-rendered FOUR–EIGHT variants; time-free / boundary variants; `requiresDesignation`; `npm run voice` for the new clips | F11 test; legacy lines and audio ids unchanged |
| ☐ 12.3 | Phase bounds relative to the wake time; checkpoint days from the Blueprint; reflections tagged by archetype theme; day ranges as arc fractions | night-shift persona receives MORNING lines after waking; legacy E2 unchanged |

### Phase 13 — Configurable reviews

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 13.1 | Evening review: priority options = core domains; one rotating domain prompt (off in legacy); `REVIEW_COMPLETED.domainPrompt` | still ≤ 5 taps + 1; zero XP |
| ☐ 13.2 | Weekly review: generalized rules, proposals per instrument, correlation, evidence nudge | legacy output identical; personas get relevant proposals |
| ☐ 13.3 | Checkpoint instruments from the Blueprint (self-efficacy and enjoyment items) | legacy items identical |

### Phase 14 — Configuration management

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 14.1 | System Codex view + revision timeline (Profile → Settings → System → Blueprint) | reads any version; diffs in plain words |
| ☐ 14.2 | Staged drafts; computed change class; activation timing; calibration week | V-TRN enforced in the UI and in the writer |
| ☐ 14.3 | "Amend the System" step in the checkpoint flow (structural versions activate at seal + 1) | e2e: amend at Day 30 → v2 from Day 31; Day ≤ 30 unchanged |
| ☐ 14.4 | Advanced builder (bounded weights, thresholds, params, milestones) | the validator bounds every control; no raw XP editing |
| ☐ 14.5 | Owner opt-in offers (02 §22.4) presented at the owner's next checkpoint | the owner can accept or decline each; declining changes nothing |

### Phase 15 — Performance, offline, drills, encryption

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 15.1 | Bench suite; synthetic 365-day X2 log; budgets in CI (04 §33.3) | budgets met or 15.2 triggered |
| ☐ 15.2 | Incremental rebuild (only if needed); `verifyIntegrity` as the oracle | equality with full rebuild on all corpora |
| ☐ 15.3 | Dexie downgrade verification; rollback-build procedure; automated rollback drill (04 §38) | drill green |
| ☐ 15.4 | Offline e2e (onboarding with network disabled); bundle check for network calls | zero network after load |
| ☐ 15.5 | Export encryption (AES-GCM + PBKDF2), optional, with the import path | round trip; wrong passphrase rejected cleanly |

### Phase 16 — Validation

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 16.1 | Owner regression validation: E1/E2/E3 on the owner's current export; walkthrough checklist; 30-day integrity log | written sign-off by the owner |
| ☐ 16.2 | New-user usability study: 6–8 participants spanning P1–P7; think-aloud through Quick and Guided; measures: time to activation, % who adjust ≥ 1 card, % who describe it as "a todo app" (target 0) vs "built for me", comprehension of designations, 7-day floor completion | findings logged; library copy iterated; public-release go/no-go |

### Phase 17 — Contract + Play Store readiness

| Loop | Objective | Acceptance |
|---|---|---|
| ☐ 17.1 | Contract: delete the legacy engine paths and `ENGINE_V2` flag branches **only** after the 04 §38 condition. Keep LEGACY_BLUEPRINT_V1, upcasters and legacy write adapters forever (the owner's history depends on them). | L0–L8 green; owner golden unchanged |
| ☐ 17.2 | Play Store audit: TWA (Bubblewrap) + `assetlinks.json`; target SDK; Data Safety (no data collected); content rating (16+); privacy policy; accessibility audit (TalkBack, text scale xl); crash-free sessions on 3 devices; **IP review**: the store listing, name, icon and art must not use Solo Leveling names, characters or copyrighted art ("Monarch", "Shadow" and the generated art plates reviewed) | written audit with every item passed or waived with a reason |

---

## 41. Files and components likely to change

| Area | Files | Phase |
|---|---|---|
| Engine types | `src/engine/types.ts` (EventType union additions; widen `CoreQuestKey`/`XpCategory` usage to ids; payload v2) | 1, 5 |
| Engine | `reduce.ts` (forward-compat, BLUEPRINT_ACTIVATED fold), `config.ts` (`engineConfigFor`), `xp.ts` (V2 ledger alongside), `quests.ts` (templates from the Blueprint; legacy kept until 17), `rank.ts` / `boss.ts` / `attributes.ts` / `achievements.ts` (legacy retained until 17; evaluators move to `blueprint/`), `messages.ts`, `systemVoice.ts`, `voicePack.ts`, `reflections.ts`, `weeklyReview.ts`, `weeklyQuest.ts`, `rules.ts` | 1, 4, 12, 13 |
| DB | `src/db/schema.ts`, `db.ts` (v5, handlers, DB name), `projections.ts` (V2 path, `arc.start_date`), `domainProjections.ts` (forward-compat), `events.ts` | 0, 1, 5, 6 |
| Store | every module that imports `DEFAULT_CONFIG` or calls `maybeComplete*`: `quests.ts`, `career.ts`, `dsa.ts`, `build.ts`, `training.ts`, `lifestyle.ts`, `attributes.ts`, `checkpoint.ts`, `boss.ts`, `achievements.ts`, `skills.ts`, `mastery.ts`, `reality.ts`, `messages.ts`, `systemMessage.ts`, `review.ts`, `weeklyReview.ts`, `weeklyQuest.ts`, `plan.ts`, `onboarding.ts`, `paperImport.ts` (legacy-only), `useSystemStore.ts` | 1, 6, 12–14 |
| UI | `App.tsx` (routes), `ui/screens/{Today,Progress,Skills,Profile,*DetailScreen}.tsx`, `ui/today/{QuestRow,QuestDetailSheet,criterionText,priorityLine,SystemTransmission}.tsx`, all log sheets (extracted → `ui/instruments/`), `ui/components/{AttributeBars,StreakGrid,BossList,AchievementsList,CheckpointInstrumentsCard,InstrumentSliders,BackupCard}.tsx`, `ui/review/*`, `ui/settings/SystemScreen.tsx`, `ui/moments/levelUnlocks.ts`, `ui/routing/shortcuts.ts`, `ui/onboarding/*` (reused shell) | 1, 7, 10–14 |
| Build / config | `vite.config.ts` (shortcuts, registerType policy), `eslint.config.js` (new rules), `.gitignore`, `scripts/generate-voice-pack.mjs` (variants) | 0, 1, 7, 12 |
| Tests | `tests/engine/support/randomEventLog.ts` (persona generalization), golden tests, e2e helpers (seed via Blueprint) | 0, 9 |

## 42. New modules and files likely required

```
platform/                                   this plan + decisions/NNNN-*.md records
platform-fixtures/private/                  gitignored owner export(s)
src/blueprint/
  schema.ts  hash.ts  validate.ts  transition.ts  resolve.ts (versionFor, implicit legacy)
  evaluate/{criterion,gate,attribute,boss,achievement,comparison,messages}.ts
  engine/{ledger,projections}.ts            V2 XP + projections
  legacy/legacyV1.ts  legacy/deviations.md
src/instruments/
  catalog.ts  framework.ts  snapshot.ts
  types/{practiceItem,pipeline,duration,session,threshold,timeWindow,artifact,studyBlock,checklist}.ts
  legacy/{upcasters,writeAdapters}.ts
src/library/
  index.ts lexicon.ts icons.ts hues.ts calibration.ts
  archetypes/*.ts  presets/*.ts  questions/{stages,packs/*}.ts
src/generator/
  generate.ts  stages/s01-normalize.ts … s14-validate.ts  economy.ts  ladders.ts
src/onboarding/                              pure interview engine
  predicates.ts  nextQuestion.ts  draft.ts
store/SystemContext.tsx  store/arc.ts  store/blueprint.ts (activate, stage, history)  store/instruments.ts (record writes)
ui/instruments/{registry.ts, *Sheet.tsx, legacy/}
ui/presentation/{domain.ts, tokens.ts, countWords.ts}
ui/awakening/{Interview.tsx, renderers/*, Reveal.tsx, Codex.tsx, Activation.tsx}
ui/settings/BlueprintScreen.tsx  ui/checkpoint/AmendStep.tsx
scripts/shadow-equivalence.mjs
tests/fixtures/personas/*.ts  tests/blueprint/*  tests/instruments/*  tests/generator/*  tests/onboarding/*
tests/e2e/{visual-baseline,awakening-*,amend,rollback-drill}.spec.ts
```

---

## 43. Database migration plan

### 43.1 Dexie v5 — additive only

```ts
export const SCHEMA_V5_ADDITIONS = {
  // Cache of BLUEPRINT_ACTIVATED events — rebuildable from the log, like every projection.
  blueprint_version: 'id, lineage_id, version, active_from, arc_id',
  // Records for generic (non-legacy) instruments. Legacy instruments keep their 12 tables.
  instrument_record: 'id, instrument_id, domain_id, local_date, event_id, [instrument_id+local_date]',
} as const;
// Optional new fields (no index change, no migration needed — Dexie doesn't validate fields):
//   xp_ledger.blueprint_version?: number
//   day_rollup.blueprint_version?: number
//   checkpoint.blueprint_version?: number   (snapshot of the version gates were evaluated under)
```

```ts
interface BlueprintVersionRow { id: string /* `${lineageId}@${version}` */; lineage_id; arc_id; version; active_from; change_class; computational_hash; presentation_hash; event_id; blueprint: SystemBlueprint }
interface InstrumentRecordRow { id: string /* = event id */; instrument_id; domain_id; local_date; event_id; blueprint_version: number; record: Record<string, unknown> }
```

- **No `.upgrade()` function is needed.** There are no data transforms. The implicit-legacy rule means existing arcs need no rows.
- `blueprint_version` and `instrument_record` are **projections** (rebuilt from events), so `rebuildProjections` / `buildDomainTables` / `verifyIntegrity` extend to cover them.

### 43.2 Event catalogue additions

| Type | Payload | Idem key | XP |
|---|---|---|---|
| `BLUEPRINT_ACTIVATED` | `{ blueprint: SystemBlueprint }` (activeFrom, version and changeClass inside) | `blueprint:${lineageId}:${version}` | none |
| `INSTRUMENT_RECORDED` | `{ instrumentId, instrumentType, domainId, blueprintVersion, record }` | `instrument:${id}` | via instrument grant intents |
| `QUEST_COMPLETED` (schema_v 2) | v1 fields + `domainId, questDefId, blueprintVersion` | unchanged scheme | unchanged |
| `REVIEW_COMPLETED` (additive) | + optional `domainPrompt: { promptId, answer }` | unchanged | none |
| `METRIC_RECORDED` (reused) | manual metrics use `kind = metricId` | unchanged | none |

### 43.3 Order of operations (maps to the loops)

1. **1.1** forward-compat reducer → soak ≥ 7 days on the owner origin.
2. **5.1** v5 schema + handlers → ships to the platform origin only.
3. **5.2–5.6** new events are written only on the platform origin.
4. **6.4** cutover: the owner origin gets v5 + `ENGINE_V2`. The owner's log still contains **no** new event types (legacy write adapters). The first new event the owner ever writes is an opt-in version at a checkpoint (14.5).
5. **17.1** contract: code removal only, no schema removal. Legacy tables remain forever, because the owner's history reads through them.

### 43.4 Export format

- `schema_v: 2`: `{ exported_at, schema_v, events, arc, profile, checkpoints, blueprint_versions }`. The last field is informational, because the versions are in `events`.
- Import accepts v1 (implicit legacy) and v2.
- Encrypted exports (15.5) wrap the same JSON.

---

## 44. Acceptance criteria for every phase

| Phase | Acceptance criteria (all must hold) |
|---|---|
| 0 | Repo under git; baseline green or failures recorded; golden read-model snapshot committed; pixel baseline committed; owner fixture harness works locally and is absent from git; platform origin isolated by DB name |
| 1 | No `DEFAULT_CONFIG` in `ui/` (except the legacy onboarding allow-list); unknown events skipped not thrown, soaked 7 days; 3-timezone e2e green; golden and pixel baselines unchanged |
| 2 | Blueprint types; every validator code has pass/fail fixtures; transition classes computed; LEGACY_BLUEPRINT_V1 passes the fidelity test against the live constants |
| 3 | All nine instrument types implemented; each characterization suite shows equality with the legacy function on ≥ 10,000 generated cases; upcasters match `buildDomainTables` on golden, fuzz and owner |
| 4 | `npm run shadow` reports E1 and E2 clean on golden-120, a 1,000-seed fuzz sample and the owner export |
| 5 | Dexie v5 upgrade preserves a seeded v4 DB byte-for-byte in existing tables; I3/I4/I7/I8/I13/I16/I18 green; multi-version export round trip exact |
| 6 | Owner runs on `ENGINE_V2`; `verifyIntegrity` clean daily for 7 days; owner confirms no visible change; decision record written |
| 7 | E3 pixel diff 0 for legacy across all routes, sheets and moments; a synthetic non-legacy Blueprint renders every screen; lint forbids domain literals in `ui/` |
| 8 | Generator deterministic and total; calibration reproduces final/01 §3; every preset validates with 0 errors; I17 green; Reduced Mode collapse works for generated Systems |
| 9 | 12 persona suites green; I1–I20 green; CI time within budget |
| 10 | Quick Awakening produces a valid, non-empty System in ≤ 2 minutes (scripted) for every preset; draft resumes after an app kill; no raw answers in the event log |
| 11 | P1–P7 journeys pass through the UI; invalid drafts cannot activate; pinned edits survive re-generation; go/no-go recorded |
| 12 | No message mentions an absent domain (I20); voice count is correct for 4–8 domains; legacy messages unchanged |
| 13 | Evening review ≤ 6 taps, zero XP; weekly review relevant per persona; legacy unchanged |
| 14 | Change classes enforced; structural changes only at seals or in calibration week; history view correct; owner opt-ins offered, not applied |
| 15 | Performance budgets met on a real mid-range Android; rollback drill green; offline onboarding works; export encryption round trips |
| 16 | Owner sign-off; usability study with 0 participants calling it a "todo app" or a documented plan to fix it |
| 17 | Legacy branches removed without owner golden change; Play Store audit complete; IP review passed |

## 45. Definition of Done

**A loop is done when:**

1. The objective is met and nothing outside it changed.
2. Tests were added (characterization or equivalence tests first, where the loop says so).
3. `npm run verify` and `npm run test:e2e` are green.
4. The golden, read-model and pixel baselines are unchanged, or the diff was reviewed and the loop explicitly allowed it.
5. The owner fixture's E1/E2 are green locally when present.
6. Engine purity is intact (lint) and no personal data is committed.
7. There is a single commit with gate results in the body, and the checklist in §40 is updated.

**A phase is done when:** all its loops are done, its §44 acceptance criteria hold, the manual device verification is complete (where listed), and any decision it required is recorded under `platform/decisions/`.

**The platform is done when:**

- **ONE ENGINE:** there are no domain-specific branches in `engine/`, `blueprint/` or `ui/` outside legacy adapters and instrument types.
- **MANY SYSTEMS:** the 12 personas plus every preset generate, validate, render and progress through a full arc in simulation.
- **THE GOLDEN MASTER HOLDS:** the owner's System produces the same quests, XP, level, rank, attributes, evidence, checkpoints, bosses, reviews and messaging as before, proven by E1/E2/E3 and signed off by the owner.
- **HISTORY IS SAFE:** I1–I20 hold.
- **IT FEELS BUILT FOR THEM:** a stranger completes the awakening and describes the result as their System, not a configured todo list (Phase 16 evidence).
