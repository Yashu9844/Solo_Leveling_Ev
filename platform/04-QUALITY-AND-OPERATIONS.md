# 04 — Quality and Operations

---

## 31. Test architecture

### 31.1 Layers

| Layer | What | Tooling | Introduced |
|---|---|---|---|
| L0 | The existing 55 engine test files and 32 Playwright specs. **They stay green, untouched, through Phase 6.** From Phase 7 they encode the owner's UI and may only change with a pixel-equivalent replacement. | vitest, playwright | existing |
| L1 | **Characterization tests**: each legacy function vs its instrument-based replacement over fuzz corpora (e.g. `masteryFor` vs `practice_rate` policy with legacy params; `funnelFrom` vs pipeline signals; `attributesFrom` vs the attribute DSL with legacy defs) | vitest + fast-check | Phase 3 |
| L2 | **Blueprint unit tests**: every validator code has a failing fixture and a passing fixture; every generator stage has unit tests; calibration table re-simulated and asserted | vitest | Phases 2, 8 |
| L3 | **Equivalence harness**: E1 projections, E2 read models, E3 pixels (02 §22.2) | vitest; playwright `toHaveScreenshot` | Phases 4, 6, 7 |
| L4 | **Persona fixture suites** (§32) | vitest | Phase 9 |
| L5 | **Property / invariant tests** (§31.2) | fast-check (already a dev dependency; `tests/engine/property-placeholder.test.ts` exists) | Phases 2–9 |
| L6 | **E2E journeys**: Quick / Guided / Custom onboarding per persona; a legacy-owner journey; amend-at-checkpoint | playwright, mobile viewport | Phases 10–14 |
| L7 | **Migration and rollback drills** (§38) | playwright with persistent browser contexts | Phase 15 |
| L8 | **Performance benchmarks** with budgets enforced in CI (§33) | vitest bench | Phase 15 |

### 31.2 Invariants

Each invariant is one fast-check property. Generators produce Blueprints (from random Quick/Guided answers), event logs (driven by the Blueprint's instruments, §32.3) and version histories (random cosmetic, operational and structural amendments at legal times).

| # | Invariant | Property form |
|---|---|---|
| I1 | Renaming a domain or designation never changes XP | mutate presentation fields → the ledger is deep-equal |
| I2 | Changing icon, hue or designation never changes evidence, gates, attributes or bosses | mutate presentation → all read models deep-equal |
| I3 | Removing a future quest template never changes historical quests | a new version without quest q, active tomorrow → every instance and ledger row before tomorrow is unchanged |
| I4 | Changing configuration never mutates historical events | log bytes before activation == prefix of the log after activation |
| I5 | XP only ever comes from valid configured sources | every ledger row's reason resolves to a criterion, bonus rule or global grant in `versionFor(row.local_date)` |
| I6 | Rank stays evidence-driven | randomize external and body metrics → gate results unchanged |
| I7 | Historical reports are reproducible | `build(log) == build(log)`; for any cut date D, projections for dates ≤ D from `build(prefix)` equal those from `build(full)` (modulo the documented same-day undo / claim-date recovery) |
| I8 | Invalid configurations cannot become active | a mutated invalid Blueprint → activation throws; a forged `BLUEPRINT_ACTIVATED` in the log is ignored on replay |
| I9 | Level is a pure function of total XP; total XP never decreases except by same-day undo | existing fuzz property, extended |
| I10 | Daily XP ≤ dailyCap + uncapped grants; channel XP ≤ its cap | existing, per channel |
| I11 | The generator is deterministic and total | same answers → deep-equal; never throws |
| I12 | Legacy equivalence | E1 and E2 over golden-120 plus 10,000 seeds |
| I13 | Cosmetic versions keep computationalHash | for any cosmetic diff |
| I14 | Budget | generated core XP sums to 500 |
| I15 | First-unit dominance | for any two engine domains a, b: xp(b.core) ≥ headroom(a) |
| I16 | Checkpoint snapshots are immutable | seal, then amend gates → the displayed past gate is unchanged |
| I17 | Never empty | every Quick-reachable answer set → a Blueprint with zero validator errors |
| I18 | Instance ids are stable for continuing quests across versions | same questDefId → same instance id per date |
| I19 | Time correctness | localDate, isDayClosed and phase for random instants across `America/New_York` (DST), `Australia/Lord_Howe` (30-min DST), `Asia/Kathmandu` (+5:45), `Pacific/Kiritimati` (+14), and a night-shift boundary (10:00) |
| I20 | Messages never mention a domain absent from the Blueprint | every rendered message string's labels ⊆ the Blueprint's labels |

---

## 32. Fixture strategy

### 32.1 Personas

Each persona is a file `tests/fixtures/personas/<id>.ts` exporting `answers` (DraftState), `expect` (the assertions table below), and an activity profile.

| # | Persona | Domains (priority order) | Guardrails | Arc | What it stresses |
|---|---|---|---|---|---|
| P0 | **LEGACY OWNER** | LEGACY_BLUEPRINT_V1 | — | 120 | golden master; E1/E2/E3 |
| P1 | Software engineer (not the owner) | software-practice · deep-build · career-pipeline · strength-movement | sleep, attention | 120 | nearest analogue to legacy; documents the legacy/generated diff |
| P2 | Medical student | exam-prep (Anatomy, Physiology, Pathology, Pharmacology, Microbiology) · reading · strength-movement · relationships | sleep, attention | aligned to exam date (e.g. 150) | non-anchor arc length; practice_item as MCQ; mock score as a performance metric |
| P3 | Fitness-focused | strength-movement · endurance · health-routine · reading | sleep | 90 | body metrics logged → never XP / gate / message; 1 guardrail; 60-day-anchor calibration |
| P4 | Entrepreneur | business-building · deep-build · writing · strength-movement | sleep, attention | 120 | revenue as external; B5 ("FIRST CUSTOMER" → "THE OFFER STANDS"); pipeline outreach |
| P5 | Competitive-exam student | exam-prep (Physics) · exam-prep (Mathematics) · reading · strength-movement | sleep, attention | 180 | two domains of the same archetype (V-DOM-03 must *not* fire: different topics) |
| P6 | Creative | creative-practice · writing · public-speaking · strength-movement | sleep, attention | 90 | artifact public_url evidence; input/output mode ratio rule |
| P7 | Fully custom | 5 custom domains (checklist, time_window, threshold ≤, pipeline, practice_item) | 1 custom guardrail | 365 | every instrument via the custom flow; Advanced edits; 365-day calibration |
| X1 | Minimum System | 2 engines + 1 guardrail + 1 more (4 core) | 1 | 60 | lower bounds |
| X2 | Maximum System | 8 core + 3 support | 2 | 120 | upper bounds, performance |
| X3 | Night shift | P1 domains, sleep 08:00, boundary 10:00 | sleep | 90 | I19; voice phases relative to wake |
| X4 | DST traveller | P3 in `America/New_York` across the Nov DST change | sleep | 90 | I19 |

### 32.2 Assertions per persona

For each persona the suite asserts:

- **onboarding configuration** — the answers produce the expected DraftState and the expected question path (adaptive eligibility)
- **generated domains** — ids, roles, designations, channels and caps as a reviewed snapshot
- **generated quests** — criteria, floors, schedules, XP (sum 500)
- **XP** — a scripted 7-day log produces the expected per-day ledger, including cap trimming
- **daily progress** — `evaluateCriterion` progress values across the scripted days
- **attributes** — 3–6 defs; values after 28 scripted days; components explain the numbers
- **skills** — trees and mastery transitions under the scripted log
- **evidence** — verifiability of gate conditions; E1 satisfied
- **checkpoints** — schedule matches the length table; comparison rows are headline metrics only
- **bosses** — anchored; windows before their gated checkpoints; titles pass B5
- **reviews** — universal + domain prompt rotation; the priority options equal the core domains
- **messages** — P1–P3 eligible templates only mention this persona's labels (I20); no body or external phrasing
- **historical integrity** — a scripted operational amendment at Day 10 and a structural amendment at the first checkpoint; I3 / I4 / I7 hold

### 32.3 Blueprint-driven activity generator

`personaEventLog(blueprint, seed, profile)` generalizes `tests/engine/support/randomEventLog.ts`. It drives each instrument with plausible records rather than raw `QUEST_COMPLETED` toggles. Profiles:

- `steady` — ≈ 85% floors
- `lapsing` — two-day gaps every ~10 days, which exercises Reduced Mode and recovery
- `burst` — grinding one domain, which exercises caps and the headroom rule
- `adversarial` — minimum records, duplicate rationale, cap probing

The same seed always yields the same log (mulberry32, as today).

### 32.4 The owner's real log

- It stays **private**: stored under `platform-fixtures/private/` (gitignored), loaded only when present, and skipped with a notice otherwise.
- CI runs on golden-120 and fuzz. The owner's log runs locally before every cutover-relevant commit (Phases 4, 6, 7, 17).
- No screenshot, snapshot or log line derived from it is ever committed.

---

## 33. Performance considerations

### 33.1 Current profile

Every write triggers `rebuildProjections`: a full replay of the log, then clearing and bulk-adding 5 tables in one transaction. The owner generates roughly 15–25 events per day (≈ 2,500 per 120-day arc). That was the right call at that scale (final/07 §4.7).

### 33.2 Platform load

- An 8-domain, 365-day System at ~30 events per day is ≈ 11,000 events.
- Resolving the Blueprint version per event adds O(log V), with V ≤ ~20 versions.
- Signal computation for gates and attributes currently scans whole domain tables on every read. The generic `instrument_record` table adds a compound index `[instrument_id+local_date]`.

### 33.3 Budgets (enforced in Phase 15; measured on a mid-range Android, not a desktop)

| Operation | Budget (p95) | Notes |
|---|---|---|
| Full rebuild @ 12k events | < 150 ms compute, < 300 ms including IndexedDB writes | beyond this, switch to incremental (below) |
| Quest completion tap → row updated | < 200 ms | today's perceived latency must not regress |
| Today first paint after boot | ≤ current + 10% | Blueprint parsed once, memoized by version id |
| `generateBlueprint` | < 20 ms | |
| `validateBlueprint` | < 10 ms | runs on every Reveal adjust |
| Gate + attribute evaluation | < 50 ms | one `SignalSnapshot` per read, shared by gates, attributes, bosses, messages |
| Onboarding + library chunk | lazy-loaded; not on the Today critical path | code-split; still precached for offline |

### 33.4 Incremental rebuild (only if budgets fail)

The XP ledger is per-day and caps reset daily, so per-day ledgers can be cached by `(local_date, versionId, digest of that day's XP-relevant events)` and only dirty days recomputed. The streak fold over day outcomes is linear and cheap. Rows are written as a diff instead of clear-and-bulk-add. `verifyIntegrity` stays a full rebuild, which makes it the oracle for the incremental path.

---

## 34. Offline / PWA implications

1. **Generation and validation are fully offline.** The library ships in the bundle and is precached. There is no LLM and no fetch.
2. **Service-worker update mode is a deployment hazard.** `vite.config.ts` uses `registerType: 'autoUpdate'` with `skipWaiting` and `clientsClaim`, so **any deploy to the owner's origin reaches the owner's phone on the next open.** Consequences:
   - Platform builds go to a **separate origin** until the Phase 6 cutover (00-README).
   - Before the first Dexie version bump (v5, Phase 5), add a `db.on('versionchange')` handler that closes the connection and reloads, and a `blocked` handler with user-visible copy. No handler exists today.
   - Consider switching the owner's origin to `registerType: 'prompt'` for builds that contain a Dexie version bump, so an upgrade never lands mid-log.
3. **Storage.** `navigator.storage.persist()` is already requested (`main.tsx`). Blueprint versions add roughly 30–60 KB each, which is negligible.
4. **Manifest shortcuts are per-origin, not per-user.** They become generic targets resolved at runtime (03 §27.3). Old shortcut URLs are kept as permanent aliases, because installed WebAPKs refresh their manifest lazily.
5. **Multiple tabs.** The Dexie `versionchange` handling above also covers a desktop tab left open during an upgrade.
6. **Play Store packaging** (Phase 17). A Trusted Web Activity (Bubblewrap) runs the same origin in Chrome, so storage is shared with the installed PWA on that origin. The TWA must point at the production origin *after* cutover, never at a preview origin.

---

## 35. Future cloud / multi-user boundary

### 35.1 Layers — the boundary this plan establishes, without building beyond it

```
PRESENTATION        ui/ (screens, sheets, moments, kit, registries)
SYSTEM EXPERIENCE   ui/onboarding interview, Reveal, Codex; store/ orchestration
PROGRESSION ENGINE  engine/ (xp, level, streak, gates, bosses, attributes, messages) — pure
CONFIGURATION       blueprint/ (schema, validator, generator, resolver) + library/ — pure
DOMAIN MODEL        instruments/ (types, signals, upcasters) — pure
EVENT / LEDGER      db/events + reducer + projections — the only source of truth
PERSISTENCE         Dexie adapter behind ports: EventStore, ProjectionStore, BlueprintStore
─────────────────── boundary ───────────────────────────────────────────────────────────
ACCOUNT / CLOUD     (future) auth, sync adapter, backup service — knows nothing about domains
```

### 35.2 Rules that keep the future cheap

- No engine or Blueprint module references user identity, device or network.
- Every query is scoped by `arcId`. Today about 15 call sites use `db.arc.toCollection().first()`. Phase 1 replaces them with one `getActiveArc()`, still single-arc underneath.
- Blueprint versions are events, so a sync layer replicating the event log by `idem_key` (uuidv7-ordered) replicates Systems for free.
- **One known replication hazard, not solved now:** quest toggle idem keys use a per-device sequence count (`quest-complete:${instanceId}:${seq}`). Two devices toggling offline could collide. A future sync design must address it (e.g. device id in the key). It is recorded here so it isn't discovered later.
- Multi-arc storage (new arc = new genesis Blueprint; Level continuity across arcs, final/01 §3) is designed for (every event has `arc_id`) but not built. See Q5.

---

## 36. Security and privacy implications

| Concern | Change from today | Response |
|---|---|---|
| Data sensitivity rises | Health, finance, relationships and faith domains become possible | Local-only stays absolute: no analytics, no telemetry, no network after load (final/07 §9 CSP) |
| Onboarding answers | New free-text and personal detail | Stored only in a local draft, deleted at activation. The log carries the Blueprint and an `answersDigest`, never raw answers. "Delete everything" also clears the draft and `localStorage`. |
| Export files | Now contain the Blueprint (goals, domains) | **Implement the optional export encryption** already specified (WebCrypto AES-GCM + PBKDF2, final/07 §9) before any public release. It is not implemented today. |
| Owner's golden fixture | Real personal data in the dev workflow | `platform-fixtures/private/` is gitignored; tests skip when absent; nothing derived from it is committed |
| Body and health harm | Strangers may pick weight-centric goals | Body metrics are never XP, gates or directional messages (existing P2, now validator-enforced). Health archetypes offer **no** calorie-deficit or weight-loss quests. Overtraining and sleep-sacrifice guardrails are on by default (docs/10 A8, A9, A10). |
| Quantifying relationships and spiritual practice | docs/02: quantification can reduce enjoyment (B-grade evidence) | These archetypes default to gentle instruments (checklist, count ≥ 1) with no public-evidence requirement, and the Reveal says so. See Q13. |
| Minors | Play Store audiences | No age collection by default; target a 16+ content rating; revisit before any Families-programme listing (Q11) |
| Play Store Data Safety | — | "No data collected / no data shared" is truthful only while there is zero network I/O. Keep it that way, and add a CI check that the production bundle contains no `fetch(`/`XMLHttpRequest` outside the service worker. |

---

## 37. Failure modes

| # | Failure | Symptom | Prevention | Detection | Recovery |
|---|---|---|---|---|---|
| F1 | Owner's history re-priced | Level or rank changes after a deploy | H2 + E1 gate before cutover | `verifyIntegrity`, E1 on the owner log | flag off; redeploy previous build (§38) |
| F2 | Rollback crashes on unknown events | Old build can't hydrate | D11 forward-compatible reducer shipped first (Phase 1) | rollback drill | — |
| F3 | Dexie upgrade blocked or old build can't open v5 | Blank app, `VersionError` | `versionchange` handler; rollback builds declare the current schema (§38) | drill | rollback build |
| F4 | Invalid Blueprint via import | Engine throws or nonsense values | H9 re-validation on replay | import report | the import rejects that version |
| F5 | Generated Systems feel generic | Users say "todo app"; they edit everything | archetype richness review; Reveal ceremony; persona review | usability study (Phase 16) | library content iteration, no engine change |
| F6 | Configuration becomes the activity | Time in app ↑ (docs/10 A3/A11) | change classes; structural edits only at checkpoints; no edit badges or rewards | median app time > 4 min/day = SYSTEM FAILURE (final/00 §2) | reduce the Codex surface |
| F7 | Too many domains → cascade of misses | Completion < 50% | 8-domain cap; feasibility warning (V-QST-06); floors; Reduced Mode collapse | weekly review | amend at checkpoint |
| F8 | Timezone / DST errors | Wrong day, broken streaks | I19; runtime config from the arc (Phase 1) | property tests | fix + rebuild (history is recomputed correctly because the log holds instants) |
| F9 | Library update changes a user's System | Behaviour shifts after an app update | D8 embedded values; H4 test | H4 | — |
| F10 | Performance regression on large logs | Laggy taps | budgets in CI (Phase 15) | bench | incremental rebuild (§33.4) |
| F11 | Voice states the wrong count ("SIX" for a 5-domain System) | Lie in the System voice | count-word variants; a test that no count literal is eligible when `coreTotal` differs | voice test | — |
| F12 | Messages about irrelevant domains | "DSA progress is low" for a founder | I20; label-only templates | persona message tests | — |
| F13 | A boss claims an external outcome | "FIRST CUSTOMER" cleared with no customer | B5 | persona P4 | — |
| F14 | Cutover near a checkpoint disrupts the owner | Seal fails, or a gate differs on seal day | deploy window rule (±3 days); export first | calendar check in the cutover loop | rollback |
| F15 | Two versions claim the same day | Ambiguous resolution | one version per `activeFrom`; deterministic resolver; V-TRN-01 | property | — |
| F16 | Onboarding abandonment | Drop-off mid-interview | Quick tier; resumable draft | usability study | — |
| F17 | Legacy code paths rot after cutover | Dead code drifts from tests | Contract phase (17); lint rules | coverage | — |
| F18 | Jargon hurts usability | Users can't tell what FORGE means | the reality label always rendered; lexicon rules | usability study | copy iteration |

---

## 38. Rollback strategy

1. **Every phase is flag-guarded or additive.** Flags live in a build-time constant plus a dev-only override. None of them are user settings.
2. **Forward-compatible reducer first (Phase 1).** Unknown event types with `schema_v` above the build's known max are skipped and counted, not thrown. It ships and soaks **before** any build writes `BLUEPRINT_ACTIVATED`, `INSTRUMENT_RECORDED` or `QUEST_COMPLETED v2`.
3. **Schema changes are additive only** (new tables and optional fields; nothing re-indexed or removed) until Phase 17.
4. **Dexie downgrade hazard.** IndexedDB will not open a database whose on-disk version is higher than the requested one. Whether Dexie 4.0.x tolerates this must be **verified in Loop 15.3**, not assumed. Either way, the policy is that **a rollback build is the previous code with the current schema declarations** (unused tables declared), so rolling back never means opening a v5 database with v4 code.
5. **The owner exports before every cutover step**, and the export → wipe → import path is rehearsed on the shadow origin first.
6. **Rollback drill (Phase 15, repeated before Phase 17):**
   - install build N on a persistent browser profile;
   - onboard (or import the owner fixture), then write every new event type;
   - install rollback build N−1: it boots, renders legacy data, ignores unknown events, and `verifyIntegrity` is clean for known tables;
   - roll forward to N: nothing is lost and E1 holds.
7. **Contract (Phase 17) is the only irreversible step.** It happens only after (a) the owner's arc is sealed, *or* (b) 30 consecutive days of clean daily `verifyIntegrity` on the owner's device post-cutover, whichever the owner chooses.

---

## 46. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Disrupting the owner's live arc** (Day ~29 of 120) | medium | severe | separate origin; shadow equivalence; deploy windows; export-first; flags |
| Scope: this is a platform rewrite beneath a working product | high | high | vertical slices; Phases 0–7 deliver only equivalence and seams; stop-points after 7 and 11 to re-decide |
| Nine instrument types turn out to be insufficient | medium | medium | persona coverage test; a tenth type is a contained engine change; custom flow maps onto existing types |
| Generated Systems feel generic despite everything | medium | high | library content is the product: budget real writing time per archetype; usability study gates the public release |
| Complexity cost with no second user yet | medium | medium | owner benefits first (timezone fix, real config, opt-in fixes); decide at the Phase 11 stop-point whether to continue to Play Store |
| Pixel-equivalence (E3) is brittle | high | low | tolerance thresholds; fonts self-hosted already; screenshot on a fixed-viewport CI browser |
| Voice pack variants need TTS generation (cost, voice consistency) | medium | low | ≈ 20 clips; same script (`npm run voice`); text fallback exists |
| Dexie version or IndexedDB edge cases on older Android | low | high | drill on a real device (final/07 §6.3 protocol) |
| Single maintainer; long plan | high | medium | each loop is independently shippable and documented; the plan tolerates stopping after any phase |
| Play Store policy (health claims, data safety, content rating) | medium | medium | no health claims; zero network; Phase 17 audit |
| i18n: the System voice is English capitals; the lexicon is English-specific | certain (if global) | medium (later) | out of scope; all copy already centralised in voicePack, lexicon, library — keep it that way |
| Test runtime growth (10k fuzz × personas) | high | low | fuzz seeds scaled per suite; a nightly full run; PR runs sample |

---

## 47. Open architectural questions

Each has a recommendation, so work can proceed if the owner doesn't answer, and names who decides.

| # | Question | Recommendation | Decides |
|---|---|---|---|
| Q1 | The brief asks for "at least 6 domains". The product thesis (4 engines + 2 guardrails; floors are sacred) and docs/10 A7 (burnout) argue for a ceiling. | **4–8 core domains, default 6, ≥ 1 guardrail, + up to 3 support.** Six remains the recommended shape and the Quick default. | owner |
| Q2 | Arc lengths: allow < 60 days (a 30-day trial)? | No for rank arcs: E→S needs evidence accumulation. A future "trial arc" without rank could be a separate mode. | owner |
| Q3 | Reduced Mode collapse and level-unlock gating for **new** users (spec'd, not implemented)? | Yes, on by default for generated Systems; offered to the owner as an opt-in. | owner |
| Q4 | Which owner opt-ins (02 §22.4), and at which checkpoint? | Offer at Day 60: wake-target honoured, Reduced Mode collapse, extra-unit bonuses. | owner |
| Q5 | Level continuity across arcs, and when multi-arc storage is built | Level continues (final/01 §3). Build multi-arc after Phase 17; the data model is ready. | owner |
| Q6 | The Skills label "MONARCH S-RANK" for Retained collides with Rank S | Rename to RETAINED in the global lexicon for new Systems; the owner decides for legacy. | owner |
| Q7 | Manual tap-to-complete (self-report) for generated Systems | Keep (P6: Level accepts self-report) but log the source; rank never reads ticks. Offer `logged_only` per quest in Advanced. | owner |
| Q8 | Where the separate platform origin lives (host, preview URLs) | Use the existing host's preview deployments with a distinct Dexie DB name as a second safety. | owner |
| Q9 | Voice variants: TTS provider, cost, matching the existing voice | Reuse `scripts/generate-voice-pack.mjs` and its provider; generate only the ≈ 20 count/time variants. | owner |
| Q10 | Localization | Out of scope; keep all copy centralised. | owner |
| Q11 | Collect an age range? | No by default; target a 16+ rating. | owner |
| Q12 | Present presets as RPG "classes"? | Areas first; after generation the Reveal *names* the detected shape ("CLASS DETECTED: CREATOR") without forcing a choice. It keeps the mystery and avoids a menu. | owner + design |
| Q13 | Quantifying relationships and spiritual practice | Allowed, gentle defaults, no public-evidence requirement, an explicit note on the Reveal. | owner |
| Q14 | Revenue and other external metrics: display only? | Yes: an external panel plus external milestones with Moments, never scored (B5, V-MET-01). | owner |
| Q15 | Paper-log CSV import for new users | Legacy-only; a generic CSV import of instrument records can come later. | owner |
| Q16 | Export encryption before public release | Yes, required before Phase 17's store listing. | owner |
| Q17 | Should the owner's *next* arc start as a generated Blueprint (from SOFTWARE ENGINEER + edits) or as an explicit adoption of LEGACY v1? | Adoption of legacy v1 as an explicit genesis, then amend. It preserves continuity of terminology and calibration. | owner |
