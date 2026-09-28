# 02 — Platform Architecture

Type sketches below are **specifications, not implementation**. They define shape and intent so later phases can be executed without re-deciding them. Names are proposals; the invariants are not.

---

## 5. Product transformation strategy

### 5.1 The move

```
TODAY                                   TARGET
─────                                   ──────
content in types + switches      ──►    content in a versioned Blueprint (data)
domain-specific events + tables  ──►    instrument records (+ legacy adapters, kept)
6 hard-wired log sheets          ──►    instrument-type sheet registry
one person's constants           ──►    generated, calibrated, validated economy
config = import                  ──►    config = resolved per date from the event log
onboarding = fixed form          ──►    adaptive interview → generator → reveal → activation
```

### 5.2 What stays exactly as it is

The product principles P1–P8 (final/00 §6); Level = effort, Rank = evidence; the CONTROLLED/EXTERNAL split; no XP for outcomes, bodies, reviews or app opens; floors daily and targets weekly; grace, recovery, Reduced Mode, pause; "cannot fail" bosses; never-regressing rank; the day boundary and day close; Moments; the System voice rules; the design system, typography, motion, navigation, the four-tab contract; offline-first; local-first; the event log as the only source of truth.

### 5.3 What changes meaning

| Concept | Owner-specific meaning today | Platform meaning |
|---|---|---|
| Core quest | One of six fixed keys | The daily floor of one core domain (4–8 per System) |
| XP category | A fixed union member | A domain's XP **channel** (engine, guardrail or support) |
| Rank gate | SE interview-readiness checklist | Global structural conditions + each engine domain's milestone ladder + verifiable evidence |
| Attribute | Six named formulas | 3–6 formulas over instrument signals; DISCIPLINE global |
| Skill tree | DSA / Foundations / AI topic lists | Trees bound to a practice or study instrument's topic dimension |
| Boss | Four named SE milestones | 2–4 bosses, each anchored to a milestone the user declared |
| Reality tab | Problems, applications, projects | Each domain's headline metrics + evidence |

### 5.4 Product risk being managed

The failure mode the brief names is **"I configured a todo app."** It happens when configuration exposes *structure* (add task, rename, pick a colour) instead of *meaning* (what are you becoming, what proves it). This plan prevents it three ways:

1. **Structure is generated, never assembled.** The user answers questions about their life; the System builds quests, gates and attributes from them. Editing comes after the reveal.
2. **Every configurable thing is typed by an instrument.** You cannot create a quest that is "a checkbox called Learn".
3. **The UI surfaces never change shape.** A generated System renders through the same Today, Progress, Skills and Profile, with the same moments, meters and sheets.

---

## 6. Configuration philosophy

1. **Configuration changes content, never design.** Blueprints may set labels, designations, descriptions, targets, icons (from a curated set), domain hues (from a contrast-tested palette), skill trees, metrics, milestones, bosses, review prompts and message labels. Blueprints may **not** set typography, spacing, navigation, interaction patterns, motion, the visual hierarchy, accessibility behaviour or performance budgets. Those are properties of the app, not of a person.
2. **Generate, then let people edit; never ask people to author.** Every field has a generated value. No blank forms.
3. **Meaning before mechanics.** Questions are about the person ("What would convince you that you improved?"), never about the engine ("Set XP for this quest").
4. **Every number is either measured, derived or bounded.** A user-set number (target, threshold) is validated against the instrument's allowed range. A derived number (XP, caps, level coefficient) is not user-settable in Quick or Guided tiers.
5. **Configuration is evidence-neutral.** Changing the words must never change a score (enforced by the computational-hash invariant, §19).
6. **History is not editable.** You configure the future; the past is filed.
7. **The engine stays small.** New *content* is data. New *measurement capability* is a new instrument type, a code change with tests. The instrument set should grow slowly and deliberately.
8. **Nothing requires the network.** Generation, validation and presets all run offline from the bundled library.

---

## 7. System Blueprint proposal

### 7.1 Verdict

**Adopt the Blueprint abstraction, with three adjustments to the brief's sketch:**

1. **Instruments are a first-class section**, not implicit in domains. Metrics, evidence, quest criteria, skill trees, attributes and gates all reference instrument signals. Without this layer, "configurable domains" collapses back into named fields.
2. **Progression (economy, level curve, checkpoint schedule, rank schedule) is a pinned section**, generated once at arc genesis and immutable for the arc's lifetime. It is not a user-editable domain of the Blueprint.
3. **Terminology is split.** The global lexicon is app code; domain designations live on domains; the Blueprint carries only overrides.

### 7.2 Shape

```ts
interface SystemBlueprint {
  schema: 'system-blueprint/1';
  lineageId: string;              // stable for this arc's System across versions
  version: number;                // 1, 2, 3… strictly increasing
  arcId: string;
  activeFrom: string;             // local_date; set at activation, never edited
  changeClass: 'genesis' | 'cosmetic' | 'operational' | 'structural';
  provenance: {
    generator: string;            // e.g. "generator@1.3.0" or "legacy"
    libraryVersion: string;       // archetype library release used (provenance only)
    presetId?: string;
    answersDigest?: string;       // hash of the onboarding answers (answers themselves stay local, not in log)
  };

  identity:   { displayName: string; primaryObjective: string; stake?: string };
  arc:        { lengthDays: number /* 60–365; table anchors 60/90/120/180/365, others interpolated */; startDate; endDate; timezone; dayBoundaryHour; dayCloseHour; wakeTime; sleepTime };
  progression: ProgressionSection;   // pinned — §9.4
  domains:    DomainDefinition[];    // §8
  instruments: InstrumentConfig[];   // §8.3
  quests:     QuestTemplateDef[];    // §9
  metrics:    MetricDefinition[];    // §12 — non-instrument measurements (body, benchmarks, external)
  skills:     SkillTreeDef[];        // §10
  attributes: { groups: AttributeGroupDef[]; defs: AttributeDef[] };   // §11
  milestones: MilestoneDef[];        // §14
  gates:      RankGateDef[];         // §16
  bosses:     BossDef[];             // §15
  checkpoints: CheckpointDef;        // §16
  achievements: AchievementDef[];    // §15.4
  reviews:    ReviewDef;             // §17
  rules:      RuleDef[];             // §17.3
  messaging:  MessagingDef;          // §18
  vocabulary: VocabularyOverrides;   // §18.5
}
```

### 7.3 Three layers: templates → configuration → instances

```
ARCHETYPE LIBRARY (global, ships with app, versioned by release)
  "Exam Preparation" archetype: instruments, quest template "Practice Set",
  question pack, skill-tree seeds, milestone ramp, vocabulary suggestions
        │  generator RESOLVES and COPIES values (D8) — no live references
        ▼
SYSTEM BLUEPRINT v1 (user configuration, immutable once activated)
  domain "Medical Exam Preparation" / designation "ARCANE STUDY"
  quest "PRACTICE TRIAL": practice_item.count ≥ 20 · xp 100
        │  engine GENERATES daily instances from the version in effect
        ▼
QUEST INSTANCE  "${arcId}::med-exam.core::2026-11-14"   (historical record)
  resolved against blueprint v1 → +100 XP, channel "med-exam"
```

The library can ship a better "Practice Set" template next month. That affects **new** Blueprints and anyone who explicitly re-forges. It never touches v1.

---

## 8. Domain model

### 8.1 DomainDefinition

```ts
interface DomainDefinition {
  id: string;                     // stable across versions; slug + short hash; legacy: 'career','dsa',…
  archetypeId?: string;           // provenance
  role: 'engine' | 'guardrail' | 'support';
  //   engine    — builds the outcome (legacy: CAREER, DSA, BUILD, TRAINING)
  //   guardrail — protects capacity (legacy: SLEEP, ATTENTION)
  //   support   — XP channel without a core quest (legacy: LEARN foundations, MAINT)
  name: string;                   // REALITY: "Medical exam preparation"
  designation: string;            // SYSTEM:  "ARCANE STUDY" (≤ 18 chars, uppercase)
  description: string;            // one sentence, System voice
  priority: number;               // 1 = highest; drives XP weighting, priority line, review rotation
  presentation: { icon: IconToken; hue: DomainHueToken; artSlot?: ArtToken };
  instrumentIds: string[];
  coreQuestId?: string;           // required for engine/guardrail
  channel: { id: string; cap: number };  // XP channel; legacy ids = CAREER, MIND, CRAFT, BODY…
  intention?: { allowed: boolean };      // if-then planning offered for this domain
  reviewPromptIds: string[];
  evidenceSurface?: string;       // "resume", "portfolio", "publication list" — for evidence nudges
}
```

**Counts:** 4–8 engine+guardrail domains (default 6), ≥ 1 guardrail, ≥ 2 engines, 0–3 support domains. See Q1 in §47 for why "at least 6" became "4–8, default 6".

**Legacy mapping (LEGACY_BLUEPRINT_V1):**

| Domain id | Role | Designation | Channel (cap) | Instruments |
|---|---|---|---|---|
| career | engine | ASCENSION | CAREER (140) | `career.applications` pipeline · `career.substitute` duration |
| dsa | engine | LOGIC TRIAL | MIND (200) | `dsa.problems` practice_item |
| build | engine | FORGE | CRAFT (200) | `build.sessions` duration(LEARN/SHIP) · `build.artifacts` artifact |
| training | engine | VITALITY TRIAL | BODY (150) | `training.sessions` session · `training.steps` threshold ≥ |
| sleep | guardrail | RECONSTITUTION | SLEEP (60) | `sleep.wake` time_window |
| attention | guardrail | WILL TRIAL | ATTENTION (40) | `attention.screen` threshold ≤ |
| foundations | support | (Skills: FOUNDATIONS / AI) | LEARN (75) | `foundations.blocks` study_block · `foundations.design` study_block(modes) |
| maintenance | support | MAINTENANCE | MAINT (20) | `maintenance.daily` checklist |

### 8.2 Instruments — the unit of domain independence

An **instrument type** is code: a record schema, a validation policy, a set of **signals** it computes over a date range, the grant intents it can emit, its guards, and a log-sheet component. An **instrument config** is Blueprint data: which type, labels and parameters.

| Type | Record (what one log captures) | Parameters | Signals exposed | Legacy source | Generalizes to |
|---|---|---|---|---|---|
| `practice_item` | item ref, topic, difficulty, outcome, minutes, insight? | difficulty scale `{key,label,weight}[]`; outcome labels (first-attempt / assisted / reference / unsolved); topics; SRS on/off + ladder; bonus per extra item by difficulty | `count`, `weighted_volume`, `minutes`, `first_attempt_rate{difficulty?}`, `revisit_success_rate`, `topic_mastery[topic]`, `record_first_attempt_at_top_difficulty` | DSA | MCQs, language drills, chess tactics, music etudes, case studies |
| `pipeline` | entity, subject, category, source, rationale, required-field refs | quality gate `{requiredFields, minRationaleChars, noDuplicateRationale}`; stages `{key,label,controllability}`; follow-up after N days | `submitted`, `quality_count`, `quality_rate`, `followthrough_rate`, `stage_counts` (external → display only) | Applications + career events | Sales outreach, agent queries, grants, investor outreach, publication submissions |
| `duration` | minutes, mode?, topic?, projectKey? | modes `{key,label,kind:'input'\|'output'}`; min block minutes; ratio rule | `minutes`, `mean_daily_minutes`, `mean_block_len`, `longest_block`, `mode_counts`, `input_output_ratio` | BUILD, career substitute | Deep work, practice time, writing time, study time |
| `session` | type, minutes, rpe?, sets `{name, load, reps}[]` | session types; load unit; strength estimate (Epley / none) | `count`, `minutes`, `strength_gain_pct` | Training | Gym, runs, yoga, instrument practice sessions, therapy exercises |
| `threshold` | value (numeric only) | unit; comparator `>=` / `<=`; target; bonusAt?; source hint ("from Digital Wellbeing") | `hit` (per day), `hit_days`, `mean_value`, `days_logged` | Steps, screen time | Spend ≤ budget, pages read ≥, water, words written ≥ |
| `time_window` | time HH:mm | target time; tolerance | `hit`, `hit_days`, `sd_minutes`, `mean_minutes` | Sleep wake time | Wake time, first-work-block start, bedtime |
| `artifact` | kind, title, url?, projectKey, flags | kinds `{key,label,verifiability}`; flags (e.g. hasEval, deployed, costStated); bonus XP | `count{kind}`, `projects_with{flag}`, `first_of_kind` | Shipped artifacts, resume versions | Releases, publications, launches, performances, certificates |
| `study_block` | topic, minutes, mode?, note? | topics (a skill tree); block XP; max per day; modes (studied / written_up / explained_aloud) | `blocks{topic}`, `minutes`, `mode_counts`, `topic_mastery[topic]` | Foundations, AI tiers, system design | Theory study, reading, courses |
| `checklist` | ticks per item | items `{key,label,everyNDays}` | `all_done_days` | Maintenance | Household, medication, routine care |

**Why a finite set and not a DSL.** A general "define your own record schema and completion formula" language would make anti-gaming unprovable and the log sheets generic forms, which is exactly the destination the brief forbids. Nine types cover every persona in the brief (A–H, §32). Adding a tenth is a deliberate engine change with its own tests, sheet and characterization suite.

### 8.3 InstrumentConfig

```ts
interface InstrumentConfig {
  id: string;                  // stable; legacy: 'dsa.problems', …
  domainId: string;
  type: InstrumentType;
  label: string;               // REALITY: "Problems", "MCQ sets", "Applications"
  logVerb: string;             // SYSTEM action label: "Record Logic Trial", "Despatch Ascension"
  params: InstrumentParams[InstrumentType];   // typed per type, bounded by validator
  controllability: 'effort';   // instrument records are always volitional effort; see §12
  eventBinding: { kind: 'generic' } | { kind: 'legacy'; eventType: EventType };  // §21
}
```

---

## 9. Quest template model

### 9.1 QuestTemplateDef

```ts
interface QuestTemplateDef {
  id: string;                     // stable; legacy ids = legacy keys → identical instance ids
  domainId: string;
  type: 'core' | 'weekly';
  designation: string;            // SYSTEM: "LOGIC TRIAL"
  realityLabel?: string;          // REALITY override; default generated from criterion ("1 problem or 25 min")
  objective: string;              // what this quest is for, one line
  criterion: Criterion;           // full completion
  floor: Criterion;               // Reduced Mode / MVD variant (≤ criterion, validator-checked)
  xp: number;                     // generated (§9.4); not user-editable below Advanced
  bonus: BonusRule[];             // extra units, capped by the domain channel
  schedule: { kind: 'daily' } | { kind: 'weekdays'; days: Weekday[] };   // ≥ 3 days/week
  timeWindow?: { notBefore?: string; notAfter?: string };
  evidenceMode: 'self_report_allowed' | 'logged_only';
  recoverable: boolean;
  intentionAllowed: boolean;
}

type Criterion =
  | { kind: 'signal'; instrumentId: string; signal: string; comparator: '>=' | '<='; target: number; filter?: Record<string, string> }
  | { kind: 'any'; of: Criterion[] }
  | { kind: 'all'; of: Criterion[] };

interface BonusRule { instrumentId: string; per: string; amount: number; maxPerDay: number; filter?: Record<string, string> }
```

**Legacy criteria, expressed in the DSL:**

```
career   any[ career.applications.quality_count ≥ 3 , career.substitute.minutes ≥ 25 ]
dsa      any[ dsa.problems.count ≥ 1 , dsa.problems.minutes ≥ 25 ]
build    build.sessions.minutes ≥ 45            (mode required at log time — instrument guard)
training any[ training.sessions.count ≥ 1 , training.steps.value ≥ 8000 ]
sleep    sleep.wake.hit ≥ 1                      (08:30 ± 30)
attention attention.screen.hit ≥ 1               (value ≤ 60)
```

### 9.2 Completion evaluation — one function replaces six

`evaluateCriterion(criterion, daySignals) → { met: boolean; progress: 0..1; explanation: string[] }`. It is pure, it runs after every instrument record write, and it replaces `maybeCompleteCareerQuest`, `maybeCompleteDsaQuest` and the rest. `progress` finally gives the quest row a real partial meter ("2 of 3") without new per-domain code. `explanation` feeds the quest detail sheet ("Completed by: 3 quality applications").

### 9.3 Floor variants — making Reduced Mode real

Each core quest carries a `floor`. The legacy floors come from MVD (final/01 §6.1): 10 min of DSA or BUILD, 10 min of movement, wake logged. When `reduced_mode` is true, `generateQuests` emits instances whose effective criterion is `floor`. Priority: implement for new Systems at Phase 8. For the owner, it stays **off** under LEGACY_BLUEPRINT_V1 (`reducedMode.collapsesQuests: false`), because the golden master is implemented behaviour. The owner can turn it on as an approved version (§22.4).

### 9.4 Economy — generated, bounded, calibrated

The **ProgressionSection** is pinned at genesis:

```ts
interface ProgressionSection {
  dailyCoreBudget: 500;          // global constant
  dailyCap: number;              // 1.4 × budget = 700
  engineShare: 0.8;              // engines 80%, guardrails 20% (final/00 §5 thesis)
  mvdXp: 35; recoveryXp: 40; bossXp: 500; weeklyQuestXp: 200;   // global
  level: { base: 200; coefficient: number; exponent: 0.98; roundTo: 10 };  // coefficient from calibration table
  grace: { daysPer28: 4 }; reducedMode: { triggerMisses: 2; exitDays: 2; collapsesQuests: boolean };
  attributeWindowDays: 28;
  checkpointDays: number[];      // from the arc-length table (§16)
  rankSchedule: { day: number; rank: Rank }[];
}
```

**Generation rules** (legacy numbers reproduce as a check):

1. Engines share 400, guardrails 100. Within a group, weight by priority (1st 1.2, 2nd 1.1, 3rd 1.0, 4th 0.9…). Round to 10 and fix the sum with the largest-remainder method. Clamp each core quest to [30, 150]. *(Legacy: 4 equal engines → 100 each; guardrails 60/40 by priority.)*
2. Channel cap = core XP × headroom by instrument mix: guardrail 1.0; pipeline 1.4; session+threshold 1.5; practice_item or duration+artifact 2.0. *(Legacy: 140/200/200/150/60/40 ✓.)*
3. **First-unit dominance:** any bonus unit ≤ 40% of the quest's XP, and the channel headroom (cap − XP) ≤ the smallest engine core XP. *(Legacy: max headroom 100 ≤ 100 ✓.)* This encodes "showing up across all domains always beats grinding one".
4. Support channels: study_block cap = 3 × block XP (75); checklist cap = its XP (20).
5. Level coefficient: looked up from a calibration table keyed by arc length. It is produced by a TS port of `final/xp-simulation.py` (60 seeds, fixed RNG) solving for the terminus level at 85% completion. The terminus target is 40 at 120 days and scales with √(length/120): 60 d → 28, 90 d → 35, 180 d → 49, 365 d → 70. A test re-runs the simulation and asserts the table. *(Legacy: 120 d → 84 ✓.)*

---

## 10. Skill model

```ts
interface SkillTreeDef {
  id: string; domainId: string; instrumentId: string;   // the practice_item or study_block that provides evidence
  name: string; designation: string;                    // "Anatomy" / "ARCANE FOUNDATIONS"
  nodes: { id: string; name: string; tier?: string; dependsOn?: string[] }[];   // ≤ 30 nodes
  policy:
    | { kind: 'practice_rate'; appliedAt: 3; fluent: { minAttempts: 5; minRate: 0.6; minAboveEasiest: 2 }; retainedGapDays: 21; allowRegression: true }
    | { kind: 'block_count'; introducedAt: 1; appliedAt: 3; fluentAt: 5; retainedGapDays: 21 };
}
```

- **Mastery states are global:** unseen → introduced → applied → fluent → retained. Only thresholds are parameters, within bounds.
- Dependencies are **visual only** (dimmed until the parent is ≥ introduced). They never block logging, because blocking effort for structural reasons violates P5.
- A node maps 1:1 to an instrument topic. The log sheet's topic chips come from the tree, so the Skills screen and logging can never drift apart. (Today `DSA_TOPICS` was promoted into the engine specifically to avoid that drift. This generalizes the same fix.)
- **Legacy:** trees `dsa` (9 topics, practice_rate), `foundations` (9, block_count), `ai` (21, block_count, same instrument as foundations). The Skills "career" tab is not a skill tree. It becomes a **milestone panel** (§14), which is what it already is: counts of applications, resumes, interviews and artifacts.
- The unused `skill_node` / `skill_state` tables are left untouched. Trees live in the Blueprint; mastery is computed live, as today.

---

## 11. Attribute model

```ts
interface AttributeGroupDef { id: string; heading: string; tagline: string; layout: 'body' | 'mind' | 'craft'; icon: IconToken }
interface AttributeDef {
  id: string; name: string; groupId: string; description: string;
  combine: 'sum' | 'product';
  terms: { id: string; label: string; weight: number; signal: SignalRef;
           transform: { kind: 'ratio'; denominator: number } | { kind: 'rate' } | { kind: 'inverse_ratio'; denominator: number } }[];
}
```

Inputs → formula → normalization → display → evidence relationship:

1. **Inputs** are `SignalRef`s over the 28-day window, excluding paused days (current behaviour).
2. **Formula:** each term is transformed and clamped to [0,1]. `sum` uses weights that sum to 1; `product` has unweighted factors (legacy DEPTH).
3. **Normalization:** ×100, 0–100. Denominators are "what a strong 28 days looks like" and come from the archetype, bounded by the validator.
4. **Display:** the existing components breakdown. Each term shows its label, its raw value, its contribution and its denominator, so the weekly review can say *why*: "PROBLEM SOLVING −6: first-attempt rate 58% → 44%".
5. **Evidence relationship:** attribute terms may use **effort** and **performance** signals only, never **external** or **body** (validator rule A3).

**Global vs configurable:**

- **DISCIPLINE is global.** 0.40·MVD days + 0.60 split across guardrail domains' hit days by their XP share. Legacy pins its exact 0.35/0.25.
- **One attribute per engine domain** (or per pair of related engines), generated from the archetype's attribute template. Total 3–6.
- **Not every metric becomes an attribute.** The validator warns when a domain contributes to more than 2 attributes, and errors when one signal is used by more than 2 attributes (double counting).

**Legacy:** DISCIPLINE, DEPTH, PROBLEM_SOLVING, ENGINEERING, MOMENTUM, VITALITY with the exact formulas from `engine/attributes.ts`. Groups Mind/Craft/Career/Body map to the three existing detail layouts; Career currently shares one, and that is preserved.

---

## 12. Metric model

```ts
interface MetricDefinition {
  id: string; label: string; unit: string; domainId?: string;
  kind: 'effort' | 'performance' | 'external' | 'body';
  source: { instrumentId: string; signal: string } | { manual: true; cadence: 'checkpoint' | 'weekly' | 'any' };
  direction: 'higher_better' | 'lower_better' | 'band';
  recordable: boolean;            // eligible for "personal record" messages
  headline: boolean;              // shown on REALITY tab and checkpoint comparison
}
```

**Kinds** are the platform's formalization of P2 and the CONTROLLED/EXTERNAL split (D7):

| Kind | Meaning | XP source? | Rank gate? | Attribute? | Messages? | Legacy examples |
|---|---|---|---|---|---|---|
| effort | a volitional action you took | ✅ | ✅ | ✅ | ✅ | problems logged, applications, minutes, sessions, wake time, screen time |
| performance | a skill *you* demonstrated | ❌ | ✅ | ✅ | ✅ (positive trends only) | first-attempt rate, est. 1RM gain, benchmark passed, mock score |
| external | a decision by someone else | ❌ | ❌ | ❌ | never negative | responses, calls, interviews, offers |
| body | body composition | ❌ | ❌ | ❌ | never on direction | weight, waist, body fat |

Instruments emit effort signals plus derived performance signals. Manual metrics (body measurements, a mock exam score, revenue for a founder) are logged through a generic metric sheet. **Revenue is `external`**: customers decide it. The founder's controlled counterpart is outreach via `pipeline` and shipping via `artifact` (see persona D in §32).

`SignalRef` — the one way anything reads a number:

```ts
type SignalRef = { source: 'instrument'; instrumentId: string; signal: string; aggregate: Aggregate; filter?: Record<string,string> }
               | { source: 'metric'; metricId: string; aggregate: Aggregate }
               | { source: 'global'; signal: 'mvd_days' | 'core_completion' | 'bosses_cleared' | 'checkpoints_sealed' | 'grace_used' };
type Aggregate = 'day' | 'total' | 'window_14' | 'window_28' | 'rate_28' | 'mean_28' | 'sd_28' | 'mastery_count_at_least:<state>' | 'latest';
```

---

## 13. Evidence model

Evidence is what makes Rank mean something. The platform keeps the original standard, **externally verifiable but fully controllable**, and makes it a ladder so every domain can meet it:

| Verifiability | Meaning | Examples | Can satisfy a rank gate "evidence" slot? |
|---|---|---|---|
| `public_url` | A stranger can open it | repo, deployment, published write-up, public performance video | ✅ strongest |
| `recorded` | A dated artefact exists that you could show | recorded mock interview, mock-exam score sheet, training log with loads | ✅ |
| `self_cert` | You attest to a defined, checkable event | benchmark passed, cost-per-task measured | ✅ only for its own named condition, and never the *only* evidence at a gate |
| `count` | A logged volume of controlled actions | 240 problems, 280 applications | ✅ as a count condition |

**Validator rule E1:** every rank gate from C upward must include at least one condition with verifiability `public_url` or `recorded`. *(Legacy C: "AI feature committed to a public repo" ✓.)*
**Validator rule E2:** no gate condition may reference an `external` or `body` metric.

For domains with no natural public artefact (sleep, attention), evidence lives at A/S as guardrail consistency conditions (wake SD, screen-time mean), exactly as in legacy A and S.

---

## 14. Milestone model

```ts
interface MilestoneDef {
  id: string; domainId: string; label: string;              // "Mock exam ≥ 70%", "First paying customer"
  condition: GateCondition;                                  // reuses the gate condition shape
  ladder?: { checkpointIndex: 1|2|3|4; threshold: number }[]; // for count/rate milestones: C, B, A, S targets
  anchorsBoss?: string;                                      // this milestone is a boss's reason to exist
  declaredBy: 'user' | 'archetype' | 'legacy';
}
```

- **Ladders come from one question:** "What would a successful arc look like in [domain]?" That answer is the S target. The C/B/A targets use the standard ramp **[0.23, 0.53, 0.82, 1.0]**, derived from the legacy ladders (problems 55/130/200/240, applications 70/150/230/280, sessions 12/28/42/55). They are then adjusted by baseline: a user who starts at 50 problems doesn't get "55 by Day 30".
- **The validator checks feasibility:** a ladder target must be reachable at 85% completion of the core floor plus a plausible bonus rate (per-instrument max daily rate × days × 0.85). "1000 problems in 120 days on a 1-problem floor" gets a warning with the implied daily rate.
- **User-declared milestones** ("first paying customer", "first public release") are boolean evidence milestones. They are the raw material for bosses.

---

## 15. Boss model

```ts
interface BossDef {
  id: string; title: string;                  // "FIRST CUSTOMER"
  anchorMilestoneId: string;                  // REQUIRED — no boss without a real-world milestone
  windowStartDay: number; windowEndDay: number;   // display window; opens at start, never closes (current rule)
  conditions: GateCondition[];                // checklist
  gatesRank?: Rank;                           // e.g. Boss I required for B
}
```

### 15.1 Generation

- Count by arc length: 60 d → 2, 90 d → 3, 120 d+ → 4.
- Windows at ≈ 21% / 42% / 62% / 83% of the arc (legacy 25 / 50 / 75 / 100 of 120 ✓), each ending before the checkpoint it gates.
- **Each boss is anchored to a user-declared or archetype milestone.** Its checklist bundles that milestone with the ladder targets due in that window, plus the preceding checkpoint seal where relevant (legacy Boss I: "Day-30 checkpoint sealed").
- **Titles** come from the anchor: "FIRST MOCK EXAM", "12-WEEK CONSISTENCY TRIAL", "FIRST PUBLIC RELEASE".
- **A title may never claim an external outcome** (rule B5). "FIRST CUSTOMER" and "FIRST INTERVIEW LOOP" depend on other people, so clearing a boss with those names would either be a lie or would gate rank on the market. The generator splits them in two:
  - the **boss** becomes the controlled counterpart: "THE OFFER STANDS" (pricing page live at a public URL + 50 qualified outreaches + 10 demos offered), or "INTERVIEW READY" (benchmark passed + 4 recorded mocks);
  - the external event becomes an **external milestone** on the REALITY panel. It is recorded and celebrated with a Moment if it happens, and it never gates anything. This is the CONTROLLED/EXTERNAL split from final/02 §1 applied to bosses.

### 15.2 Rules

- **B1** — every boss has an anchor milestone. A boss is never generated because it sounds cool.
- **B2** — no boss condition references external or body metrics.
- **B3** — cannot be failed; the window opens and never closes (current `evaluateBoss` semantics).
- **B4** — 500 XP BOSS grant, uncapped, once per boss (idem key `boss:${arcId}:${bossId}`).
- **B5** — boss titles never name an external outcome; external anchors become external milestones.

### 15.3 Legacy

Four bosses pinned verbatim: FIRST EVIDENCE, STRONG ENGINEERING BASE, AI ENGINEER, INTERVIEW READY, with their exact conditions and labels.

### 15.4 Achievements and identities

**Global achievements** (every System): First Move, Two Weeks, Return, Regular (only when a `time_window` guardrail exists), The Arc.
**Global identities:** Consistent (60 MVD days in 90), Someone Who Keeps Promises (80% if-then firing).
**Domain-derived** achievements and identities come from archetype templates ("Century" = 100 items on a practice_item, "Shipped" = first public_url artifact, "Someone Who Trains" = 40 sessions). Legacy pins all 13 exactly.

---

## 16. Checkpoint model (and rank gates)

### 16.1 Schedule (global table, not user-editable)

| Arc length | D | C | B | A | S |
|---|---|---|---|---|---|
| 60 | 14 | 25 | 40 | 50 | 60 |
| 90 | 14 | 30 | 50 | 70 | 90 |
| **120** | **14** | **30** | **60** | **90** | **120** ← legacy |
| 180 | 14 | 45 | 90 | 135 | 180 |
| 365 | 14 | 90 | 180 | 270 | 365 |

Day 0 is always the baseline checkpoint. The **D gate is global** (MVD consistency ≥ 70% over 14 days; effort-only, so early rank is reachable).

**Non-anchor lengths** (e.g. an arc aligned to an exam date 94 days away):

- D = 14.
- C/B/A are interpolated from the two nearest anchors as fractions of length, rounded to whole days.
- Consecutive checkpoints must be at least 10 days apart.
- S = the length.
- The level coefficient is interpolated the same way, and a test asserts that interpolation stays within ±1 terminus level of a direct simulation.

### 16.2 RankGateDef

```ts
interface RankGateDef { rank: Rank; day: number; conditions: GateCondition[] }
interface GateCondition {
  id: string;
  label: string;                  // template: "{value} problems (need {threshold})"
  signal: SignalRef;
  comparator: '>=' | '<=' | 'between';
  threshold: number | [number, number];
  verifiability: 'public_url' | 'recorded' | 'self_cert' | 'count' | 'structural';
}
```

**Composition by the generator:**

```
gate(C|B|A|S) =   global:  core completion (C ≥ 60%, B ≥ 65%, A ≥ 65%, S within 60–85% band)
                + per engine domain: its milestone ladder threshold for this checkpoint
                + ≥ 1 public_url|recorded evidence condition               (rule E1)
                + A/S: each guardrail's consistency condition
                + B: Boss I cleared · A: Bosses I–II · S: all bosses + arc sealed and exported
```

### 16.3 Evaluation and snapshot

There is one evaluator, `evaluateGate(def, signals) → GateResult` (same output shape as today's `evaluateGates`). **At seal, the full GateResult (labels, values, thresholds, met), the Blueprint version id and the comparison rows are written to the checkpoint row** (it already stores `gates`, `controlled`, `external`). Past checkpoints are always displayed from the snapshot, never re-evaluated.

### 16.4 Comparison rows and instruments

- **Comparison rows:** each domain's `headline` metrics (effort + performance), baseline vs now, with direction-aware `improved`. This generalizes `checkpointComparison`'s seven fixed rows. The Moment rule stays: it fires only with improvement.
- **Self-efficacy instrument:** 6 items. Two are global ("Keep a daily floor for two weeks during a hard week", "Return after a missed day without a lapse becoming a streak") and four come from the top engine domains' archetypes ("Solve an unseen medium problem in 25 minutes…" is the legacy text). **Enjoyment:** one 0–10 item per engine domain, up to four. **Automaticity:** 4 global items, unchanged.

---

## 17. Review model

### 17.1 Daily (evening) review — keep the 25-second budget

| Part | Content | Source |
|---|---|---|
| Universal | energy (1–5) · focus (1–5) · blocker chip (time / tired / wrong time / didn't want to / nothing) · tomorrow's priority (options = core domains by designation) | global |
| Conditional universal | "slept at" — only if a `time_window` guardrail on sleep exists | global, gated |
| **One domain prompt** | chips only, no typing; chosen deterministically: a domain that missed today → the weekly bottleneck's domain → rotate by priority | Blueprint `reviews.domainPrompts` |

Domain prompt examples from archetypes: Exam: "What topic caused the most errors?" (chips = tree nodes). Fitness: "What limited today's session?" (time / energy / pain / motivation / nothing). Business: "What blocked progress?" (build / sell / admin / waiting on others). Career: "Where did the pipeline stall?" (finding roles / tailoring / follow-ups / nothing).

Answers are stored in `REVIEW_COMPLETED.payload.domainPrompt = {promptId, answer}`, an additive optional field. **Reviews still grant zero XP.**

### 17.2 Weekly review

Universal: attribute deltas (improved, declined, bottleneck), grace used, completion %, backup prompt. Then, from the Blueprint: generalized rules (§17.3), one weekly-quest proposal per proposing instrument (the user accepts at most one), one correlation insight, and one evidence nudge (the resume nudge generalized: "You shipped 3 artifacts this week. Does your {evidenceSurface} say so?", only when a domain declares an evidence surface).

### 17.3 Rules (generalized)

| Rule | Applies to | Legacy instance |
|---|---|---|
| `MODE_RATIO` | `duration` with input/output modes | LEARN_SHIP_RATIO (> 3:1, 14 d) |
| `WRONG_TIME` | global | 3× wrong_time in 14 d |
| `SUBSTITUTE_SHARE` | domain with pipeline + substitute duration | `engine/career.ts#substituteShare` (computed, not yet a rule) |
| `LOW_CONVERSION` | pipeline with ≥ 40 items and < 5% first-stage response | final/00 §4.2 (specified, not implemented) |
| `WEAKEST_TOPIC` | practice_item | weekly quest proposal |

Only the two rules that fire today are enabled in LEGACY_BLUEPRINT_V1.

---

## 18. System message model

### 18.1 Three registers, kept separate (as today)

| Register | Today | Platform change |
|---|---|---|
| **Transmission** (System voice, capitals) | `engine/systemVoice.ts` + `voicePack.ts`; tiered, phased, banded, fingerprinted; **pre-rendered audio** | Context gains `coreTotal`-aware count words; phases derive from the arc's boundary and the user's wake time; checkpoint days come from the Blueprint. The library stays static. |
| **Evidence messages** (P1–P5) | `engine/messages.ts`; SE-specific signals | Signal-driven templates (§18.2) |
| **Reflections** | 64 lines, categories, day ranges ≤ 120 | Lines tagged with archetype themes; day ranges become arc fractions |

### 18.2 Evidence message templates

| Tier | Template | Eligible signals |
|---|---|---|
| P1 personal record | "LONGEST {label} YET: {value} {unit}." / archetype-provided first-of-kind lines | `recordable` effort/performance signals; `first_of_kind` artifacts; top-difficulty first attempt |
| P2 trend | "{Label}: {current} over 14 days, up from {previous}." | effort/performance with direction; improvements only; minimum sample 3 |
| P3 correlation | "{Signal} after a hit {guardrail} window: {a}%. After a miss: {b}%." | guardrail hit × next-day engine performance signal; minimum sample 5 per bucket |
| P4 consistency | unchanged | global |
| P5 status | unchanged | global |

Hard bans carried from final/05 §1.1 become **validator-enforced eligibility**, not author discipline: no body signals, no external negatives, no forecasts, no comparisons with people. A startup founder therefore cannot receive "DSA progress is low", because no template references a domain that isn't in their Blueprint, and no template names a domain at all except through `{label}` resolved from their own Blueprint.

### 18.3 Voice pack and pre-rendered audio

The voice pack must stay a static library, because its audio is rendered at build time (`scripts/generate-voice-pack.mjs` → `public/voice/*.mp3`). So:

- **No domain names in voice lines, ever.** Domain-aware sentences are text-only (evidence messages).
- **Count-word variants:** the ~4 lines that say SIX become `{COUNT}` lines with pre-rendered variants for FOUR…EIGHT (`cleared-003@6` keeps its current id and audio for 6). That is about 20 new clips.
- **Time literal:** "THE NEXT BEGINS AT 04:00" becomes a boundary-hour variant set (03–06) or is rewritten time-free. Legacy keeps the 04:00 line.
- **Vocabulary-bound lines** ("YOUR NEXT ASCENSION BEGINS NOW") get `requiresDesignation: 'ASCENSION'` and are eligible only when a domain carries that designation.

### 18.4 Message context

`SystemMessageContext` gains nothing domain-specific. It already reads `xpTarget = Σ core XP` and `coreTotal` from data. Its three current literals (checkpoint days, phase bounds, "SIX") move to Blueprint- or arc-derived values.

### 18.5 Terminology

```
GLOBAL LEXICON (code, fixed)    QUEST · LEVEL · RANK · GATE · BOSS · CHECKPOINT · EVIDENCE · MASTERY
                                TRANSMISSION · ARC · RECOVERY · REDUCED MODE · mastery state names
DOMAIN VOCABULARY (Blueprint)   designation (FORGE), logVerb (Forge Construct), realityLabel, tree designations
USER OVERRIDES (Blueprint)      any designation / verb, validated
```

**Rules:**

- A designation is ≤ 18 characters and uppercase.
- It may not be a global lexicon word, and it must be unique within the System.
- It is **always rendered with its reality label in secondary text** ("FORGE · 45 min build work"). Mystery never costs usability.
- Archetypes offer 3–5 designations each, in the existing register: TRIAL, FORGE, ASCENSION, RECONSTITUTION, WILL, VITALITY, ARCANE, GATE.
- Open item for the owner: the Skills screen labels Retained as "MONARCH S-RANK", which collides with Rank. Legacy keeps it until the owner decides (§47 Q6).

---

## 19. Configuration versioning

### 19.1 Lifecycle

```
DRAFT ──validate──► VALID ──activate──► ACTIVE ──(next version's activeFrom)──► SUPERSEDED
 (local only,        (validator     (BLUEPRINT_ACTIVATED event carries the full document;
  not in the log)     clean)          blueprint_version row cached; immutable)
```

### 19.2 Change classes (D6)

Each version carries two hashes: `computationalHash` (instruments, criteria, economy, gates, attributes, bosses, milestones, rules) and `presentationHash` (labels, designations, icons, hues, descriptions, prompts' wording). The class is **computed from the diff, not chosen by the user**.

| Class | What changed | Takes effect | Guard |
|---|---|---|---|
| cosmetic | presentationHash only | immediately (activeFrom = today) | computationalHash must equal the predecessor's |
| operational | targets within a band (±25%), schedules, intentions, time windows, review prompts, skill-tree nodes added | next day boundary | cannot alter today's evaluation |
| structural | add/retire a domain, instrument params beyond the band, XP weights, gates, bosses, attribute formulas | at the next checkpoint seal (activeFrom = seal date + 1) | generalizes `locked_until_checkpoint`; the checkpoint flow gains an **"Amend the System"** step, fitting final/00 §4.1's "the Day-30 checkpoint offers a concrete amendment" |
| (never) | progression section, arc timezone after Day 1, past dates | — | rejected |

**Calibration week:** during arc days 1–7, structural changes are allowed with activeFrom = tomorrow. Onboarding guesses are forgiven while history is still short. After Day 7, the checkpoint rule applies.

### 19.3 Identity across versions

- A domain id is stable through renames and re-prioritization.
- **Changing a domain's instrument type is a new domain.** The old one retires and keeps its history under its id.
- Retiring a domain means it is absent from the new version. Its records, mastery and past gates remain readable through old versions.
- The per-day `core_total` comes from the version in effect that day (already how `coreTotalOn` works per date).
- **New arc ≠ new version.** Student → exam prep → career is a new arc with a new genesis Blueprint (§35 notes that multi-arc storage is future work, but `arc_id` already scopes every event).

### 19.4 Resolution

`versionFor(localDate)` returns the latest version with `activeFrom ≤ localDate`. Versions are sorted once per rebuild, so a lookup is a binary search. **Retroactive activation is impossible:** the writer rejects `activeFrom < today`, and the reducer ignores (and reports) any such event from a malformed import.

---

## 20. Historical integrity

| # | Invariant | Mechanism | Test |
|---|---|---|---|
| H1 | The event log is append-only and immutable | existing | existing |
| H2 | Every computation for date D uses `versionFor(D)` | resolver threaded through XP, criteria, gates, attributes, bosses | property: activate v2 with different XP; days < v2.activeFrom unchanged |
| H3 | Instance ids are stable | `${arcId}::${questDefId}::${date}`; legacy questDefIds = legacy keys | owner log: all existing `QUEST_COMPLETED.instanceId`s resolve |
| H4 | Library evolution never changes an active Blueprint | resolved values embedded (D8) | change a library template; the existing blueprint's computationalHash is unchanged |
| H5 | Sealed checkpoints are never re-evaluated | GateResult snapshot at seal | seal, then change gates in v2; the displayed past gate is identical |
| H6 | Every XP grant is explainable | ledger row stores `blueprint_version`, `reason`, `channel`; event carries `blueprintVersion` | export, rebuild in isolation: identical ledger |
| H7 | Rank never regresses across versions | `evaluateGate` returns the previous rank on failure (existing) plus rank read from sealed rows | property |
| H8 | Reports are reproducible | rebuild is deterministic; projections for dates ≤ D are unaffected by events with local_date > D (except same-day undo and recovery claims, which land on the claim date) | property over random logs with random version activations |
| H9 | Invalid configuration can never become active | the activation writer calls the validator; the reducer re-validates BLUEPRINT_ACTIVATED on replay and ignores invalid ones (reported) | fuzz invalid blueprints |
| H10 | Cosmetic changes never change computations | the computationalHash guard | property: random label mutations → identical projections |

**What a historical event carries.** For new events: `QUEST_COMPLETED` schema_v 2 adds `domainId`, `questDefId` and `blueprintVersion` (legacy `questKey` kept). `INSTRUMENT_RECORDED` carries `instrumentId`, `instrumentType`, `blueprintVersion` and the record. Together with the version document in the log, that answers *what happened, under which configuration, why XP was awarded, what quest existed, which domain it belonged to, and what rules were active* for any past event, from the export alone.

---

## 21. Data migration strategy

### 21.1 Principle: implicit legacy, zero writes (D4)

```
arc has BLUEPRINT_ACTIVATED events?  ── no ──►  versions = [LEGACY_BLUEPRINT_V1 @ arc.start_date]
                                     ── yes ──►  versions = those events (a legacy arc may later
                                                 adopt an explicit v2 derived from legacy v1)
```

`LEGACY_BLUEPRINT_V1` is a **code fixture** (`src/blueprint/legacy/legacyV1.ts`), not a stored row. The owner's database gains no rows for migration. Rollback means deploying the previous build.

### 21.2 Legacy events stay legacy

- Existing domain event types (`PROBLEM_LOGGED`, `APPLICATION_LOGGED`, …) are **never rewritten**. The instrument layer reads them through **upcasters**: pure `legacyEvent → InstrumentRecord` adapters keyed by `instrument.eventBinding`.
- **Legacy instruments keep *writing* legacy event types** (write adapters) for the rest of the owner's current arc. Mixed logs never occur for the owner, and an old build can always read the owner's log. Generic `INSTRUMENT_RECORDED` is used only by generated (non-legacy) instruments, and by the owner from their next arc onward.
- The 12 legacy domain tables stay, populated exactly as today, because `verifyIntegrity` diffs them. New instruments use one generic table, `instrument_record`.

### 21.3 Expand → migrate → contract

| Step | Phase | Reversible? |
|---|---|---|
| Expand: forward-compatible reducer (skip + report unknown future event types) | 1 | ✅ |
| Expand: additive Dexie v5 (`blueprint_version`, `instrument_record`, `ledger.blueprint_version`) | 5 | ✅ (additive; old code ignores new tables) |
| Migrate: runtime switches to the blueprint engine, reading LEGACY_BLUEPRINT_V1 | 6 | ✅ flag |
| Migrate: UI reads the Blueprint | 7 | ✅ flag per surface |
| Contract: delete the legacy engine code paths | 17 | ❌, only after the owner's arc is sealed or after 30 days of clean `verifyIntegrity` |

---

## 22. Original-user compatibility strategy

### 22.1 The golden master is implemented behaviour, not the spec

LEGACY_BLUEPRINT_V1 reproduces what the code **does**, including these deviations from `final/`. They are recorded here so no one "fixes" them during migration:

| Implemented behaviour | Spec says | Legacy V1 keeps |
|---|---|---|
| `player_state.rank` hard-coded `'E'`; displayed rank read from sealed checkpoints | rank on player state | ✅ |
| MVD = "≥ 1 core completion on an opened day" | 10 min DSA/BUILD + 10 min movement + wake logged | ✅ |
| No +10 XP per extra quality application | final/01 §1.1 bonus | ✅ |
| No per-difficulty bonus for extra DSA problems (only revisits 20) | +15/+25/+40 | ✅ |
| Reduced Mode shown, quests not collapsed | collapse to MVD | ✅ (`collapsesQuests: false`) |
| Level unlocks displayed, not enforced | progressive disclosure | ✅ |
| Onboarding rhythm answers ignored | — | ✅ (08:30 / 60 / 8000 pinned) |

Any change to these is a **separate, owner-approved version** (§22.4). It is never a side effect of generalization.

### 22.2 Equivalence levels (all must pass before cutover)

| Level | Compares | Corpus | Pass criterion |
|---|---|---|---|
| **E1 Projection** | the 5 cache tables + 12 domain tables | golden-120, 10,000 fuzz seeds, the owner's exported log | deep-equal JSON (ids, amounts, categories, reasons, capped_from) |
| **E2 Read models** | attributes, gate results (labels + values + met), bosses, achievements, identities, reality summary, weekly review, daily report, message context and selection, transmission | every day of golden-120 and of the owner's log | deep-equal |
| **E3 Pixels** | every route, sheet and moment | seeded legacy DB, 3 viewports | Playwright screenshot diff 0 (anti-aliasing tolerance ≤ 0.1%) |

Channel ids for legacy domains are the legacy category names (CAREER, MIND, …). So `xp_ledger.category` values, and therefore E1, are unchanged.

### 22.3 Cutover protocol for the owner

1. Owner exports a backup. The file is copied to the private fixture location (never committed).
2. Shadow build (separate origin) imports the export, runs E1/E2 and reports.
3. `verifyIntegrity` is clean on the imported copy.
4. The deploy happens on a date that is not within ±3 days of a checkpoint.
5. After the deploy the owner runs Data → Verify integrity (dev action surfaced for this). A 7-day soak with a daily integrity check follows.
6. The flag stays reversible until Phase 17.

### 22.4 Owner opt-ins (after cutover, never automatic)

Once the owner's System is Blueprint-driven, the fixes above become **offers at the next checkpoint's "Amend the System" step**, e.g.:

- honour the onboarding wake target
- make Reduced Mode collapse quests
- enable the application / problem bonuses the spec describes

Each is a structural version the owner can accept or decline. That is the platform working for its first user.
