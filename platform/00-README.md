# SYSTEM → Personalized System Platform — Architecture Plan

**Status:** Audit + plan only. No application code, schema, or UI was changed to produce this.
**Date:** 29 Sep 2026
**Audience:** the product owner, and the Claude Code sessions that will execute the roadmap.
**Precedence:** `final/` remains the specification of the *original* System. This folder specifies how that System becomes the first of many. Where this folder and `final/` disagree about the owner's arc, `final/` wins: the owner's System is the golden master.

| File | Sections |
|---|---|
| `00-README.md` | 1 Executive summary · key decisions · 48 Recommended order |
| `01-AUDIT.md` | 2 Current architecture audit (system map, 41 subsystems classified) · 3 Hard-coded assumptions · 4 Domain dependency map · the critical domain-independence question |
| `02-ARCHITECTURE.md` | 5–22 Strategy, philosophy, Blueprint, domain / quest / skill / attribute / metric / evidence / milestone / boss / checkpoint / review / message models, versioning, historical integrity, migration, owner compatibility |
| `03-EXPERIENCE.md` | 23–30 Adaptive onboarding, validation, default blueprints, custom domains, UI architecture, configuration UX, generation pipeline, anti-gaming |
| `04-QUALITY-AND-OPERATIONS.md` | 31–38, 46, 47 Tests, fixtures, performance, offline, cloud boundary, security & privacy, failure modes, rollback, risks, open questions |
| `05-ROADMAP.md` | 39–45 Phases, loop-by-loop plan, files that change, new modules, DB migration plan, acceptance criteria, Definition of Done |

---

## 1. Executive summary

### What the audit found

**The mechanics are already mostly domain-independent. The content is welded into the types.**

Most of the engine's *machinery* would survive a stranger installing the app tomorrow. That includes the category-cap → daily-cap XP pipeline, the uncapped frequency-limited BONUS/BOSS grants, the level curve, streak / grace / Reduced Mode / pause / recovery, "recompute, never subtract" projections, rank-never-regresses, bosses that cannot be failed, and the System voice's tier resolution and fingerprinting. None of it knows what DSA is.

The *content* is a different story. It is encoded in closed TypeScript unions and `switch` statements, not data:

- `CoreQuestKey = 'career' | 'dsa' | 'build' | 'training' | 'sleep' | 'attention'`
- `XpCategory` (10 fixed values), `Attribute` (6), `BossId` (`'I'…'IV'`), `AchievementId` (8), `IdentityId` (5)
- `GateEvidence`: 33 fields, every one of them specific to software-engineering interview preparation
- 31 event types, 17 of them domain-specific (`PROBLEM_LOGGED`, `APPLICATION_LOGGED`, `BUILD_SESSION_LOGGED`, …), backed by 12 domain-specific Dexie tables
- per-domain `maybeComplete*` functions in six store modules, each re-declaring its own completion thresholds

You can't make that configurable by adding fields around it. The coupling runs through the type system.

**Three findings matter more than everything else in this plan.**

1. **History is not version-safe today.** `db/projections.ts#buildProjections` regenerates quest templates from whatever config is loaded, and `QUEST_COMPLETED` records only `questKey`. Change DSA from 100 XP to 80 XP and every past day is silently re-priced: the level changes retroactively, as do past caps, and potentially past rank gates. The same applies to gate thresholds, attribute formulas and boss conditions, which are all computed live from current code. Configurability built on top of this would corrupt history the first time anyone edited anything. **Fixing this is Phase 5 and a prerequisite for every editing feature.**

2. **Runtime configuration is a compile-time constant.** `DEFAULT_CONFIG` is imported directly by 25+ UI and store files. The timezone (`Asia/Kolkata`), the day boundary (04:00), the day close (03:00) and the arc start date (`2026-09-01`, used as every template's `active_from` during rebuild) are baked in. A stranger in New York gets Kolkata day boundaries.
   Worse, onboarding *already* collects six answers that change nothing: wake target, sleep time, steps target, screen-time cap, training days and attention apps. They are written to `profile.settings` and never read; the engine uses `config.wakeTargetTime = '08:30'` and store constants 60 / 8000. That is exactly the "configuration theatre" this platform must not scale up.

3. **Two specified behaviours exist only as display.** Reduced Mode is derived and shown as a banner, but the quest set does not collapse to the floor (final/01 §6.4). Level unlocks are listed on the level-up moment but gate nothing. The generalized engine should implement both properly (via per-template *floor variants* and a feature-unlock table) rather than copy the gap into every future user's System.

### What this plan proposes

**ONE ENGINE → MANY SYSTEMS**, built from five parts:

| Part | Nature | Owns |
|---|---|---|
| **Instruments** | Code. A finite, reviewed, tested set of measurement capabilities (`practice_item`, `pipeline`, `duration`, `session`, `threshold`, `time_window`, `artifact`, `study_block`, `checklist`). | *How* reality is measured, what signals it produces, what completion can mean. |
| **System Blueprint** | Data. One immutable, versioned JSON document per arc version, carried in the event log. | *What* this person's System is: domains, quests, metrics, skills, attributes, gates, bosses, reviews, vocabulary. |
| **Archetype Library** | Data shipped with the app, versioned by release. | Curated domain archetypes, question packs, presets. The raw material generation draws from. |
| **Generator** | Pure, deterministic function. | `generateBlueprint(answers, library, clockless inputs) → BlueprintDraft`. |
| **Validator** | Pure function. | Refuses to activate anything unmeasurable, unbalanced, ungameable-by-design or historically unsafe. |

The engine never learns what "DSA" means. It knows that the owner's Legacy Blueprint declares a `practice_item` instrument, designated **LOGIC TRIAL**, whose items have difficulty weights E 1 / M 2 / H 3.5 and a first-attempt-rate signal. A medical student's Blueprint declares the same instrument type as **ARCANE STUDY**, with MCQ topics Anatomy / Physiology / Pathology. Same code, same tests, different System.

**The owner migrates by doing nothing.** An arc with no `BLUEPRINT_ACTIVATED` event is interpreted through `LEGACY_BLUEPRINT_V1`, a hand-authored fixture that reproduces today's constants, labels, gates, bosses, attributes and messages exactly. There are no data writes and no re-onboarding. Equivalence is proven in shadow mode against the golden-120 snapshot, 10,000 fuzz seeds and the owner's own exported event log before the runtime switches over.

### Timing warning — read before starting Phase 0

The configured arc runs from 1 Sep 2026 to 29 Dec 2026. If it started on schedule, **today is about Day 29**: the Day-30 checkpoint is due and Boss I's window is open. The owner's data lives in one IndexedDB on one phone, and the service worker updates the installed PWA from its origin. So:

- Platform builds ship to a **separate origin (or at minimum a separate Dexie database name)** until Phase 6 cutover is proven on the owner's exported log.
- **Never deploy a DB-touching build to the owner's origin within 3 days of a checkpoint** (Days 30, 60, 90, 120).
- The owner exports a backup immediately before every cutover step. The export → wipe → import round trip is already implemented and must be rehearsed first.

### What this plan does not build

Accounts, a backend, sync, social features, or LLM-generated Systems. The layer boundaries (§35) keep all of them possible later without touching the engine. The event envelope (uuidv7 + `idem_key`) is already replication-friendly, and Blueprint versions are events, so they would sync for free.

---

## Key architectural decisions

Each is argued in full in the section referenced.

| # | Decision | Why | § |
|---|---|---|---|
| D1 | **The Blueprint is one versioned document, not 12 normalized tables.** Stored as `blueprint_version` rows, and carried in full in a `BLUEPRINT_ACTIVATED` event. | It is read, validated, diffed and versioned as a unit. Dexie enforces no foreign keys, so normalization would buy bookkeeping and no integrity. It also keeps "the event log alone is a complete backup" true. | 7, 19, 43 |
| D2 | **Instruments are the unit of domain independence.** Domains are data; instrument types are code. | This gives real decoupling instead of configuration fields around coupled code. The set is finite and testable, which is what keeps anti-gaming guarantees provable. | 8, 12 |
| D3 | **Every computation resolves configuration by the version in effect on the event's `local_date`.** New events are stamped with `blueprintVersionId`. | This makes historical reports reproducible and turns "editing XP re-prices history" into an impossible state. | 19, 20 |
| D4 | **Implicit legacy.** No `BLUEPRINT_ACTIVATED` means `LEGACY_BLUEPRINT_V1`. | There is zero-write migration for the owner, and rollback is "deploy the previous build". | 21, 22 |
| D5 | **Progression is global and calibrated, not user-editable.** The core day budget is 500 XP and the daily cap 700. The level-curve coefficient is solved from arc length so that 85% completion reaches the terminus level. | It protects Level = effort and keeps XP comparable and ungameable. Users choose *relative* weights, not absolute XP. | 9, 30 |
| D6 | **Three change classes.** *Cosmetic* changes apply immediately, *operational* changes at the next day boundary, and *structural* changes at the next checkpoint (generalizing the existing `locked_until_checkpoint`). | Configurability cannot become a way to re-price the current day or dodge a gate. | 19, 30 |
| D7 | **Controllability is a first-class metric property** (`controlled` / `external` / `body`), enforced by the validator. | P2 and the CONTROLLED/EXTERNAL split currently live in comments and one test. They become a type-checked, validated rule for every user. | 11, 12, 30 |
| D8 | **Blueprints embed resolved values.** Library references are provenance only. | The library can evolve with app releases without mutating anyone's System. | 7, 25 |
| D9 | **Rank letters (E→S), the "never regress" rule and the D-gate are global.** Gate *contents* are configurable within rules. | Rank = evidence has to mean the same thing for everyone. | 9, 16 |
| D10 | **No free-text behaviours.** Every quest is an instrument plus a number; the label is cosmetic. | This is the structural answer to "learn something" — the System never has to judge prose. | 24, 26 |
| D11 | **A forward-compatible reducer ships before any new event type is written.** | The current reducer throws on unknown types. Without this, any rollback after a new event is written crashes the old build. | 38 |
| D12 | **4–8 core domains, default 6, at least one guardrail.** | The brief asks for "at least 6". The product thesis (4 engines + 2 guardrails, P4 floors) and docs/10 A7 argue for a hard ceiling. See Open Question Q1. | 8, 24 |

---

## 48. Recommended implementation order

The full dependency reasoning is in `05-ROADMAP.md §39`. In short:

```
0  Safety rails ─ git, owner golden master, broader snapshot, separate origin
1  Runtime config seam + forward-compatible reducer        (owner: no change)
2  Blueprint schema + validator + LEGACY_BLUEPRINT_V1      (pure, unused)
3  Instrument layer — characterization-tested vs legacy     (pure, unused)
4  Blueprint-driven engine in SHADOW — equivalence harness  (owner: no change)
5  Versioning + historical integrity                        (additive schema)
6  Engine cutover for owner behind flag  ◄── first owner-visible risk point
7  Presentation registry — UI reads the Blueprint           (pixel-identical for owner)
8  Archetype library + presets + generator
9  Persona fixtures + property tests
10 Adaptive onboarding engine + Quick Awakening
11 Guided tier + custom domain builder + Reveal + Activation ◄── first stranger-usable build
12 Configurable System messaging
13 Configurable reviews + generalized rules
14 Configuration management (editing, staging, history)
15 Performance, offline, migration/rollback drills
16 Owner regression validation + new-user usability study
17 Contract (remove legacy branches) + Play Store readiness audit
```

The ordering principle: **nothing the owner can see changes until the engine underneath is proven identical (Phases 0–6), and nothing a stranger can see ships until generation, validation and versioning are all real (Phases 8–11).** The UI work in Phase 7 comes before onboarding because a generated System that renders through six hard-coded rows isn't a generated System.

**Blocking prerequisites:**

- The working directory is **not a git repository**. Loop 0.1 is `git init` plus a baseline commit, because every loop ends in a commit checkpoint.
- The owner must export a current backup (Data → Export) to a location outside the repo. It becomes the private golden-master fixture. It must never be committed (see §36).
