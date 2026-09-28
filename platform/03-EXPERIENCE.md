# 03 — Experience: Onboarding, Validation, Generation, UI

---

## 23. Adaptive onboarding architecture

### 23.1 What it replaces, and what it keeps

The current onboarding (`ui/onboarding/*`) already solved the *visual* problem of making forms feel like a System coming online. It has a spine of named nodes (`InitSpine`), each step is a live console (`StepConsole`), each step has one hero, the ground is animated in CSS only, and it respects reduced motion. **All of that is kept.** What changes is the *content engine* behind it: the fixed six-step form becomes an interview whose questions depend on earlier answers, and whose output is a Blueprint rather than an `OnboardingInput`.

### 23.2 Engine

```
QuestionDef ──eligibility(draft)──► next question ──answer──► DraftState ──► nextQuestion(draft) …
                                                                │
                                          generateBlueprint(draft, library) ──► Reveal ──► Activate
```

```ts
interface QuestionDef {
  id: string;
  stage: StageId;
  tier: 'quick' | 'guided';           // advanced configuration is post-activation (§28.5)
  heading: string;                    // System voice, capitals: "WHAT ARE YOU HERE TO CHANGE?"
  subline?: string;                   // plain language
  kind: 'multi_card' | 'rank' | 'single_card' | 'action_card' | 'number' | 'time' | 'date' | 'text_short' | 'dial';
  options?: OptionDef[] | { from: DraftPath; map: string };   // static, or computed from the draft
  eligibility: Predicate;             // JSON predicate over DraftState — serializable and testable
  writes: DraftPath;
  default: DefaultRule;               // computed from the draft (e.g. floor = 1/3 of good-day target)
  bounds?: { min?: number; max?: number; step?: number };
  echo?: string;                      // the System's one-line acknowledgement template
  archetypeId?: string;               // set for archetype question packs
}

type Predicate =
  | { has: DraftPath; value?: string } | { eq: [DraftPath, unknown] } | { gte: [DraftPath, number] }
  | { and: Predicate[] } | { or: Predicate[] } | { not: Predicate };
```

- `nextQuestion(draft, questions, tier)` is **pure**. It returns the first eligible, unanswered question in stage order, then pack order, then domain priority.
- Going back and changing an answer re-evaluates eligibility downstream. Answers to questions that became ineligible are **retained but inert**, so toggling an area off and on again doesn't lose work.
- The draft is persisted **locally only** (a `onboarding_draft` key; resumable after an app kill). Raw answers never enter the event log. Only the Blueprint and an `answersDigest` do, because answers can contain health, finance and relationship detail the Blueprint doesn't need (§36).
- **Question budget:** Guided ≤ 4 questions per area, Quick ≤ 1. The engine enforces this, not the content authors.

### 23.3 Stages — the emotional sequence

| # | Stage (spine node) | Heading | Kind / hero | Quick? | Output |
|---|---|---|---|---|---|
| 0 | AWAKENING | (existing Splash → Start) | — | ✅ | — |
| 1 | DESIGNATION | WHAT SHOULD THE SYSTEM CALL YOU? | text | ✅ | identity.displayName |
| 2 | INTENT | WHAT ARE YOU HERE TO CHANGE? | multi_card: Career · Knowledge · Body · Discipline · Business · Health · Creativity · Relationships · Financial stability · Craft · Custom | ✅ | areas (3–8) |
| 3 | HIERARCHY | WHAT MATTERS MOST? | rank (tap in order) | ✅ | priorities; top = primary |
| 4 | RESOLUTION | per area: "KNOWLEDGE — FOR WHAT?" (exam · language · a field of study · reading) | single_card | 1 per area | archetype per area |
| 5 | MEASURE | per domain: WHAT ACTION PROVES PROGRESS? → HOW MUCH ON A HARD DAY? → ON A GOOD DAY? → WHAT WOULD CONVINCE YOU THAT YOU IMPROVED? | action_card · number · number · single_card+number | defaults | instrument, floor, criterion, success target, evidence |
| 6 | GUARDRAILS | WHAT PROTECTS YOUR CAPACITY? (sleep window · attention · recovery routine) | multi_card, ≥ 1 | default: sleep + attention | guardrail domains |
| 7 | RHYTHM | WHEN DOES YOUR DAY BEGIN AND END? · HOW MUCH TIME IS YOURS? | dial (existing 24-hour hero) · number | wake/sleep only | arc.wakeTime/sleepTime → boundary & close; daily available minutes |
| 8 | ARC | HOW LONG IS THIS ARC? · WHEN DOES IT BEGIN? · STATE THE MAIN QUEST. | single_card 60/90/120/180/365 or "align to a date" · date · text | length only | arc, identity.primaryObjective |
| 9 | TRIGGERS | WHEN AND WHERE? (if-then for the top 3 engines, existing hero) | time + place + first action | ❌ | intentions |
| 10 | BASELINE | WHERE DO YOU START? (only metrics the Blueprint will track) | numbers | ❌ | Day-0 metrics |
| 11 | SYNTHESIS | THE SYSTEM HAS ENOUGH INFORMATION. → GENERATING SYSTEM | choreographed reveal of real computed sections | ✅ | BlueprintDraft |
| 12 | REVEAL | SYSTEM AWAKENED | cards: domains · quests · attributes · skills · checkpoints · bosses; each has "Adjust" | ✅ | edits (pinned fields) |
| 13 | ACTIVATION | BIND THE SYSTEM | validator result in System voice; one primary action | ✅ | `ARC_STARTED` + `BLUEPRINT_ACTIVATED` (one transaction) |

**"The System understands me" comes from echoes, not flattery.** After each answer, one line reflects the answer back in the System register, using the user's own facts:

> REGISTERED. KNOWLEDGE: MEDICAL LICENSING EXAM. 94 DAYS TO THE EXAM DATE.
> THE ARC WILL END ON IT.

- An exam archetype asks for the exam date and offers to align the arc's end to it. Any length from 60 to 365 is allowed: checkpoints and calibration interpolate between the table anchors (§16.1, §9.4).
- An echo never praises and never predicts. It follows the voice rules (design/04 §25).

### 23.4 Configuration tiers

| Tier | Who | Asks | Time budget | Everything else |
|---|---|---|---|---|
| **1 · QUICK AWAKENING** | wants to start now | stages 1, 2, 3, 7 (wake/sleep), 8 (length) | ≤ 2 min, ≈ 12 taps + name | archetype defaults; preset if the areas match one |
| **2 · GUIDED** | default path | all stages, ≤ 4 questions per area | ≤ 8 min | defaults for unasked fields |
| **3 · ADVANCED SYSTEM BUILDER** | power users, post-activation | Profile → System → Blueprint (§28.5) | — | bounded editing of attributes, formulas' weights, gates, instrument parameters, evidence, bosses; saved as staged versions |

Quick is not a lesser System. It generates the *same* Blueprint sections with default answers. The Reveal makes that visible, so Quick users see a complete System, never an empty one.

### 23.5 Owner impact

None. The owner never sees the new onboarding; their arc exists. The old `Onboarding.tsx` remains the legacy flow until Phase 11 replaces it for new arcs. Its step components and visual kit are reused, not deleted.

---

## 24. Configuration validation

### 24.1 Shape

```ts
validateBlueprint(bp: SystemBlueprint, ctx: { today: string; library: LibraryIndex }): Issue[]
validateTransition(prev: SystemBlueprint, next: SystemBlueprint, ctx: { today; arcDay; nextCheckpointDay }): Issue[]
interface Issue { code: string; severity: 'error' | 'warning' | 'info'; path: string; system: string; plain: string; fix?: FixHint }
```

- **Errors block activation.** Warnings require a single acknowledgement ("PROCEED ANYWAY"). Info is shown on the Reveal only.
- Every issue has a System-voice line and a plain line, e.g. "THE FLOOR EXCEEDS THE TARGET." / "Your hard-day amount is higher than your good-day amount."
- `fix` offers a one-tap correction when one exists ("Set floor to 20").
- **The reducer re-validates on replay (H9).** An invalid `BLUEPRINT_ACTIVATED` that arrives via import is ignored and reported, never applied.

### 24.2 Catalogue

| Code | Severity | Rule |
|---|---|---|
| V-ARC-01 | error | Timezone is a valid IANA zone (`Intl.supportedValuesOf('timeZone')`) |
| V-ARC-02 | error | Length is within 60–365 days; end = start + length − 1 |
| V-ARC-03 | error | Start date is within [today − 14, today + 30] (the −14 honours the paper-log precedent, docs/13) |
| V-ARC-04 | error | dayBoundaryHour is derived from the typical sleep time + 2 h, at **any** hour so night shifts work (legacy: sleep 02:00 → 04:00); dayCloseHour lies 0–3 h before the boundary (legacy 03:00); the voice phases derive from the wake time, not the clock |
| V-DOM-01 | error | 4–8 core (engine + guardrail) domains; ≥ 2 engines; ≥ 1 guardrail; ≤ 3 support |
| V-DOM-02 | error | Designations unique within the System, ≤ 18 chars, not global-lexicon words |
| V-DOM-03 | error | No duplicate domains: same archetype with overlapping topic sets, or identical instrument type + params |
| V-DOM-04 | error | Every engine/guardrail domain has exactly one core quest |
| V-INS-01 | error | Instrument type is known; params are within per-type bounds (e.g. SRS intervals ascending, 1–180 days) |
| V-INS-02 | error | A time_window tolerance is 10–90 min; a threshold target lies inside the archetype's plausible band |
| V-QST-01 | error | Criterion references existing instruments and signals of the right type |
| V-QST-02 | error | Leaf targets ≥ the instrument minimum (duration ≥ 10 min, count ≥ 1, study_block ≥ 1 block) |
| V-QST-03 | error | Floor is satisfiable whenever criterion is (floor ≤ criterion, leaf by leaf) |
| V-QST-04 | error | A weekday schedule has ≥ 3 days per week |
| V-QST-05 | error | Time windows and intention times fall outside the closed hours |
| V-QST-06 | warning | Σ estimated floor minutes > available daily minutes × 1.2 ("THE SYSTEM CANNOT FIT 5H 40M OF FLOORS INTO 3H.") |
| V-QST-07 | warning | Baseline already meets the criterion ("YOU ALREADY DO THIS. THE SYSTEM MEASURES CHANGE.") |
| V-XP-01 | error | Core XP sums to the budget exactly (500) |
| V-XP-02 | error | Each core quest's XP is within [30, 150] |
| V-XP-03 | error | Channel headroom (cap − XP) ≤ the smallest engine core XP |
| V-XP-04 | error | Each bonus unit ≤ 40% of its quest's XP; bonuses only on effort signals |
| V-XP-05 | error | The daily cap equals 1.4 × budget; BONUS/BOSS grants are frequency-limited |
| V-MET-01 | error | No external or body metric used by XP, gates, attributes or evidence messages |
| V-GATE-01 | error | Every gate from C upward has ≥ 1 `public_url` or `recorded` condition |
| V-GATE-02 | warning | A ladder target implies a daily rate above the instrument's plausible maximum at 85% completion |
| V-GATE-03 | error | Ladders are monotonic non-decreasing C ≤ B ≤ A ≤ S, and the S target is above baseline |
| V-GATE-04 | error | The D gate equals the global D gate; the schedule matches the arc-length table |
| V-BOSS-01 | error | Every boss has an anchor milestone |
| V-BOSS-02 | error | A boss window starts ≥ 7 days before the checkpoint that requires it |
| V-ATT-01 | error | `sum` weights total 1 ± 0.001; `product` factors ≤ 3 |
| V-ATT-02 | error | One signal is used by ≤ 2 attributes |
| V-ATT-03 | error | 3–6 attributes; DISCIPLINE present; ≤ 4 groups |
| V-SKL-01 | error | Nodes reference existing topics; `dependsOn` is acyclic |
| V-SKL-02 | error | ≤ 30 nodes per tree; ≤ 5 trees |
| V-REF-01 | error | No dangling ids anywhere (domain, instrument, quest, metric, milestone, boss, prompt) |
| V-MSG-01 | error | Message templates reference only eligible signals |
| V-VOC-01 | warning | A designation is missing its reality label |
| V-TRN-01 | error | `activeFrom` ≥ today (cosmetic) or > today (other classes); never retroactive |
| V-TRN-02 | error | The declared change class matches the computed diff class |
| V-TRN-03 | error | Structural changes only at a checkpoint seal, or within calibration week (arc days 1–7) |
| V-TRN-04 | error | Progression section, arc timezone and start date are unchanged after Day 1 |
| V-TRN-05 | error | Domain ids are preserved for continuing domains; a changed instrument type requires a new domain id |

### 24.3 Vague goals

The validator never parses prose. **Vagueness is prevented structurally:** a quest can only be built from an instrument, a signal and a number (D10). "Learn something" cannot be entered, because there is no field that accepts it. The guidance happens earlier, in the Measure stage (§23.3): *"What action proves progress?"* offers eight action cards, one per instrument type, each with a concrete example drawn from the user's own area.

---

## 25. Default blueprint architecture

### 25.1 Library structure (data, shipped in the bundle, versioned by app release)

```
src/library/
  index.ts                 LIBRARY_VERSION, lookup tables
  archetypes/*.ts          one file per archetype (ArchetypeDef)
  presets/*.ts             PresetDef = archetypes + priorities + default guardrails + default arc length
  questions/*.ts           stage questions + per-archetype packs
  calibration.ts           arc length → level coefficient, checkpoint days (generated + asserted by test)
  icons.ts, hues.ts        curated tokens (contrast-tested)
  lexicon.ts               global vocabulary + designation suggestions
```

### 25.2 ArchetypeDef

```ts
interface ArchetypeDef {
  id: string; area: AreaId; label: string; version: number;
  questionPack: QuestionDef[];                         // ≤ 4
  instruments: InstrumentTemplate[];                   // default params + bounds for this archetype
  quest: { designations: string[]; objective: string; criterion: CriterionTemplate; floor: CriterionTemplate; bonus: BonusTemplate[] };
  weeklyQuest?: WeeklyProposalPolicy;
  skillTree?: { seedNodes?: string[]; fromAnswer?: DraftPath; policy: MasteryPolicy };
  attribute?: AttributeTemplate;                       // e.g. KNOWLEDGE = volume + accuracy + retention
  metrics: MetricTemplate[];                           // headline + performance + body/external if relevant
  milestone: { successQuestion: string; ramp: [0.23, 0.53, 0.82, 1]; examples: string[]; evidenceKinds: Verifiability[] };
  bossAnchors: string[];                               // "FIRST MOCK EXAM", "FIRST PUBLIC RELEASE"
  reviewPrompts: ReviewPromptDef[];
  rules: RuleTemplate[];
  messaging: { labels: Record<string,string>; firstOfKindLines: Record<string,string>; reflectionThemes: string[] };
  checkpoint: { selfEfficacyItems: string[]; enjoymentLabel: string };
  achievements: AchievementTemplate[];
  presentation: { icons: IconToken[]; hue: DomainHueToken; artSlot?: ArtToken };
  evidenceSurface?: string;
  role: 'engine' | 'guardrail' | 'support';
}
```

### 25.3 Initial archetype set (v1 library)

| Archetype | Role | Primary instruments | Default designation options |
|---|---|---|---|
| software-practice | engine | practice_item (+ duration) | LOGIC TRIAL · ALGORITHM GATE |
| career-pipeline | engine | pipeline + duration(substitute) | ASCENSION · DESPATCH |
| deep-build | engine | duration(input/output) + artifact | FORGE · CONSTRUCT |
| exam-prep | engine | practice_item (MCQ) + study_block + metric(mock score, performance) | ARCANE STUDY · KNOWLEDGE TRIAL |
| language-learning | engine | practice_item (drills) + duration(listening/speaking modes) | TONGUE TRIAL · LEXICON |
| strength-movement | engine | session + threshold(steps) | VITALITY TRIAL · PHYSICAL TRIAL |
| endurance | engine | session + threshold(distance) | STAMINA TRIAL |
| creative-practice | engine | duration(input/output) + artifact(public release) | CRAFT · OPUS |
| writing | engine | threshold(words ≥) + artifact(published) | SCRIPTORIUM |
| business-building | engine | pipeline(outreach) + artifact(ship) + metric(revenue, external) | DOMINION · VENTURE |
| reading | engine/support | threshold(pages ≥) + study_block | ARCHIVE |
| finance-control | guardrail | threshold(spend ≤) + checklist(weekly review of accounts) | TREASURY WARD |
| relationships | engine | threshold(intentional connections ≥) + checklist | BONDS |
| sleep-regularity | guardrail | time_window | RECONSTITUTION |
| attention-control | guardrail | threshold(screen ≤) | WILL TRIAL |
| health-routine | guardrail/support | checklist + threshold | SUSTENANCE |
| spiritual-practice | engine | duration + time_window | STILLNESS |
| public-speaking | engine | session(recorded talks) + artifact | ORATION |
| custom:<instrument> | any | one per instrument type (§26) | from action verbs |

### 25.4 Presets (data, not engine)

| Preset | Archetypes (priority order) | Guardrails | Arc |
|---|---|---|---|
| SOFTWARE ENGINEER | software-practice · deep-build · career-pipeline · strength-movement | sleep · attention | 120 |
| CAREER BUILDER | career-pipeline · deep-build · reading · strength-movement | sleep · attention | 90 |
| STUDENT | exam-prep · reading · strength-movement · relationships | sleep · attention | 120 |
| EXAM PREPARATION | exam-prep · exam-prep (second subject) · strength-movement | sleep · attention | align to exam date |
| FITNESS | strength-movement · endurance · health-routine | sleep · attention | 90 |
| ENTREPRENEUR | business-building · deep-build · reading · strength-movement | sleep · attention | 120 |
| CREATIVE | creative-practice · writing · public-speaking · strength-movement | sleep · attention | 90 |
| GENERAL SELF-DEVELOPMENT | reading · strength-movement · finance-control · relationships | sleep · attention | 90 |

**LEGACY is not a preset.** It is a pinned fixture (§21). SOFTWARE ENGINEER is its nearest *generated* analogue, and a test documents the differences between the two, so any drift between "what we'd generate for the owner" and "what the owner has" stays visible.

### 25.5 "Never empty" guarantee

Every preset, and every archetype combination reachable by Quick answers, must produce a Blueprint with:

- ≥ 4 core quests and ≥ 3 attributes
- ≥ 1 skill tree (a practice or study archetype) *or* a milestone panel
- a full gate schedule and 2–4 bosses
- review prompts and message labels for every domain

This is a property test over the Cartesian product of Quick-reachable answers (§31).

---

## 26. Custom domain architecture

A custom domain is `archetype = custom:<instrumentType>`, so everything downstream (economy, attributes, gates, bosses, sheets, messages) works unchanged. The flow never says "name your task".

| Step | Heading | Captures | Field |
|---|---|---|---|
| 1 | WHAT ARE YOU TRYING TO BECOME BETTER AT? | short text | `name` |
| 2 | WHAT ACTION PROVES PROGRESS? | action card: *Items I practise* (practice_item) · *Time I focus* (duration) · *Sessions I complete* (session) · *A number I keep over or under* (threshold) · *A time I keep* (time_window) · *Things I finish and show* (artifact) · *People or places I reach out to* (pipeline) · *A routine I keep* (checklist) | instrument type |
| 3 | ON A HARD DAY, WHAT STILL COUNTS? / ON A GOOD DAY? | two numbers, with the instrument's unit and minimum | `floor`, `criterion` |
| 4 | WHAT WOULD A SUCCESSFUL WEEK LOOK LIKE? | number (defaults to 5 × good day) | weekly proposal target |
| 5 | WHAT EVIDENCE WOULD CONVINCE YOU THAT YOU IMPROVED? | *a link someone can open* · *a recording or score sheet* · *a count* · *a measured score* + a target | milestone, verifiability, S target |
| 6 | DOES IT BREAK INTO PARTS? (optional) | up to 12 part names | skill tree nodes (practice/study types only) |
| 7 | NAME IT | designation suggestions from `lexicon.ts` × the action verb; or own (validated) | `designation` |

- The generator then fills XP from priority, caps from instrument headroom, and an attribute contribution (joined to the closest attribute template for that instrument type, or a new attribute if there are fewer than 3). Bosses anchor on the declared evidence milestone.
- Custom domains get the generic icon set, a free hue slot and the procedural art fallback.

---

## 27. UI architecture

### 27.1 Principles

1. **Screens don't know domains.** No `ui/` file outside `ui/instruments/legacy/*` may contain a legacy domain key literal (`'dsa'`, `'career'`, …). This is enforced by an ESLint `no-restricted-syntax` rule added in Phase 7.
2. **Config is provided, not imported.** `DEFAULT_CONFIG` imports are banned in `ui/` (lint). Components read `useSystem()` → `{ arc, blueprint (version for today), resolveVersion(date), engineConfig }`.
3. **Blueprint values reach the DOM only as tokens**: icon tokens from a curated set (≈ 48 Phosphor icons), hue tokens from 8 domain hues validated across all 5 themes by an extended `theme-contrast.test.ts`, and art tokens that map to the manifest slots (null → procedural). No raw colours, sizes or fonts from data.
4. **Extract, don't rewrite.** Each generic component is carved out of the current bespoke one, so the legacy Blueprint renders the *same markup* (the E3 pixel-equivalence gate).

### 27.2 Registries

```ts
// ui/instruments/registry.ts
const INSTRUMENT_SHEETS: Record<InstrumentType, React.ComponentType<InstrumentSheetProps>> = {
  practice_item: PracticeItemSheet,   // extracted from LogProblemSheet (topics, difficulty scale, outcome labels from params)
  pipeline:      PipelineSheet,       // extracted from LogApplicationSheet (+ substitute tab when a duration sibling exists)
  duration:      DurationSheet,       // extracted from LogBuildSessionSheet (mode chips from params)
  session:       SessionSheet,        // extracted from LogTrainingSheet
  threshold:     ThresholdSheet,      // extracted from LogAttentionSheet (+ steps entry)
  time_window:   TimeWindowSheet,     // extracted from LogSleepSheet
  artifact:      ArtifactSheet,       // split out of the BUILD sheet's "shipped" section
  study_block:   StudyBlockSheet,     // extracted from LearningBlockSheet
  checklist:     ChecklistCard,       // extracted from MaintenanceCard
};
// ui/presentation/domain.ts
function presentDomain(d: DomainDefinition): { Glyph: Icon; theme: DomainTheme; designation; realityLabel; logVerb }
```

### 27.3 Screen by screen

| Surface | Today | After (Phase 7) | Owner-visible change |
|---|---|---|---|
| Today | 6 booleans + a `switch` over 6 keys; `QUEST_ICON`, `DOMAIN_THEME`, `ROW_SUMMARY` | `openSheet: { instrumentId } \| null`; rows from instances + `presentDomain`; progress from `evaluateCriterion`; the priority line uses Blueprint priority; "Six of six" uses count words | none (E3) |
| Quest detail sheet | `CRITERION_TEXT[key]` | `explainCriterion(criterion, params)` + the existing legacy override strings in the legacy Blueprint | none |
| Progress · SYSTEM | Attribute bars grouped by `ATTRIBUTE_GROUPS`; streak grid of 120 | groups from the Blueprint; arc length from the arc | none |
| Progress · REALITY | `RealitySummary` fixed fields | headline-metric cards per domain + an evidence list + an external panel (only for pipelines with external stages) | none (legacy headline set = current fields) |
| Attribute detail | 3 routes: body / mind / craft | `/attributes/:groupId` with `layout` variants body/mind/craft; legacy routes redirect | none |
| Skills | tabs dsa / foundations / ai / career; interview benchmark block | tabs = the Blueprint's trees + milestone panels; benchmark = a self_cert metric card | none |
| Profile | `CHECKPOINT_DAYS` literal; gate checklist; bosses; achievements | schedule from the Blueprint; the same components fed by generic results | none |
| Evening review | `PRIORITY_OPTIONS` 4 keys | core domains; + one domain prompt (off in legacy) | none |
| Weekly review | fixed rules + DSA proposal + resume nudge | generalized rules / proposals / nudge | none |
| Settings · System | reminders for career/dsa/training | reminders for domains with `intentionAllowed`; + **Blueprint** entry (view · revisions · amend) | one new row |
| Checkpoint | fixed rows, SE instruments | generated rows and items; + **Amend the System** step (Phase 14) | new step, opt-in |
| PWA shortcuts | `/log/problem`, `/log/application`, `/review` | `/log/primary`, `/log/evidence`, `/review`; legacy paths kept forever as aliases (the installed WebAPK caches the manifest) | none |
| Moments | copy literals | count words / designations | none |
| Onboarding | fixed 6 steps | adaptive interview (new arcs only) | none |

### 27.4 State and data flow

```
SystemProvider (React context, one per app)
  ├─ loads arc row + blueprint versions (from blueprint_version cache; implicit legacy if none)
  ├─ exposes resolveVersion(date), today's version, engineConfig derived from it
  └─ re-reads on BLUEPRINT_ACTIVATED / ARC_* writes (the existing refresh signals)
store/* functions take (today, version, deps) instead of (today, DEFAULT_CONFIG, deps)
```

---

## 28. Configuration UX

### 28.1 Principles

One decision per screen. Every screen has a generated default. No screen has more than 3 inputs. System-voice heading, plain subline. Echo every answer. Show consequences, not parameters ("5 problems a day at 85% reaches 510 by Day 120"). Never show XP numbers during onboarding; XP appears only on the Reveal, as the result.

### 28.2 The Reveal — SYSTEM AWAKENED

This is a **Moment** (P8: earned; the user just finished the interview), built with the existing Moment kit and motion tokens.

1. The sequence runs in order: title → domains materialize one by one (designation over reality label, icon, hue) → quests with their floors → attributes → skill trees → the checkpoint spine with rank letters → bosses as sealed gates.
2. Then it settles into a scrollable **System Codex**: one card per section, each with **Adjust**.
3. Reduced motion collapses the sequence to the settled Codex.

### 28.3 Adjust

"Adjust" opens a bottom sheet (the existing `Sheet` kit) with 1–3 controls for that card only. Examples:

- **Quest card:** hard-day and good-day numbers, schedule, designation choice.
- **Attribute card:** read-only formula explanation (weights are Advanced).

An adjusted field becomes **pinned**, so re-generation after another answer changes never overwrites it (`draft.pinned: Set<path>`). Every card shows a small "because: your answer to *What matters most*" provenance line.

### 28.4 Activation — BIND THE SYSTEM

- Errors appear in System voice with a one-tap fix.
- Warnings need an explicit acknowledgement.
- The primary button is disabled until the validator is clean.
- Activation writes `ARC_STARTED` + `BLUEPRINT_ACTIVATED` + intentions + baseline metrics + the Day-0 checkpoint in one Dexie transaction (same atomicity as `initialiseArc`), then routes to Today.

### 28.5 After activation — the System Codex (Profile → System → Blueprint)

- **View:** the Codex, read-only, with the version badge "v3 · since Day 31".
- **Revisions:** a timeline, e.g. "v1 Day 0 genesis · v2 Day 12 cosmetic · v3 Day 31 structural (at checkpoint)". Each entry shows its diff in plain words.
- **Amend:** edits are staged into a draft version. The UI shows the computed change class and when it takes effect ("TAKES EFFECT AFTER THE DAY 60 CHECKPOINT"). Structural drafts wait for the checkpoint's Amend step.
- **Advanced** (behind a disclosure): attribute term weights (bounded sliders), gate thresholds (bounded by ladder rules), instrument parameters (bounded), boss conditions (from existing milestones), extra milestones. It is never raw XP editing: users adjust *relative domain weight*, and the economy re-derives.

### 28.6 Anti-patterns explicitly rejected

Admin dashboards; tables of quests with edit icons; colour pickers; free XP fields; "Add task" buttons; forms with more than 3 fields; settings-page aesthetics inside onboarding; a blank state after activation.

---

## 29. System generation pipeline

```
DraftState (answers + pinned overrides)
  S1  normalize            trim, clamp, timezone detect, defaults for unanswered
  S2  resolve archetypes   area → archetype (explicit answer, or area default)
  S3  domains+instruments  ids = slug(archetype, topic) + short stable hash of the lineage — deterministic
  S4  quests               criterion / floor / schedule / intentions from answers + archetype templates
  S5  economy+progression  budget allocation (§9.4), caps, bonuses, calibration lookup, checkpoint schedule
  S6  metrics+milestones   headline metrics; ladders = ramp × success target, baseline-adjusted; feasibility
  S7  skills               trees from answers (parts) or archetype seeds; policy from archetype
  S8  attributes           DISCIPLINE + one template per engine (merge related); groups (≤ 4)
  S9  gates                compose per §16.2
  S10 bosses               anchor milestones, windows by arc fraction, conditions
  S11 checkpoint+achieve   comparison rows, self-efficacy / enjoyment items, achievements
  S12 reviews+rules+msgs   universal + domain prompts, rules, message labels, reflection themes, vocabulary
  S13 presentation         icon/hue assignment without collision (deterministic by priority)
  S14 hash+validate        computationalHash, presentationHash, validateBlueprint → { draft, issues }
```

**Properties (each is a test in §31):**

- **Pure.** No clock (today is an input), no randomness, no I/O.
- **Deterministic.** Same answers + same library version → deep-equal Blueprint. Ties are broken by id.
- **Total.** Every reachable DraftState produces a Blueprint, possibly with issues. It never throws.
- **Local.** Changing one answer only changes the sections that derive from it. Each section records `derivedFrom: DraftPath[]` to power the provenance line.
- **Pinned-respecting.** Pinned paths are never overwritten.
- **Fast.** < 20 ms on a mid-range Android device.

**Future LLM assistance** (not in scope; the spec cuts LLM calls from V1) could only *propose DraftState answers or field values*. It would pass through the same generator and validator, and would never be required, because the app works offline.

---

## 30. Anti-gaming architecture

| Attack | Defence | Where |
|---|---|---|
| "Open app → +10,000 XP" | No XP from app events, reviews, settings or configuration. XP only from effort signals via criteria and bonus rules. Fixed 500 budget; daily cap 700; channel caps. | engine xp, V-XP-01…05 |
| "Think about goal → +500 XP" | No free-text quests (D10); instrument minimums; structured records only | instruments, V-QST-02 |
| Grinding one domain | Channel caps; the headroom rule (cap − XP ≤ smallest engine XP); bonus ≤ 40% per unit | V-XP-03/04 |
| Trivial floors ("1 minute") | Instrument minimums; archetype plausible bands; "you already do this" warning from baseline | V-QST-02/07, V-INS-02 |
| Re-pricing today or the past by editing | Change classes; no retroactive `activeFrom`; version-in-effect pricing; cosmetic changes can't touch computation | V-TRN-*, H2, H10 |
| Lowering a gate right before a checkpoint | Gates are structural → changes only apply *after* the seal; S target above baseline; monotonic ladders | V-TRN-03, V-GATE-03 |
| Duplicate domains to double-dip | Duplicate detection; each record belongs to exactly one instrument | V-DOM-03 |
| Boss farming | Once per boss (idem key); anchor required; conditions from milestones | B1–B4 |
| Rank from outcomes the user doesn't control | External/body metrics barred from gates | V-MET-01, E2 |
| Weekly quest farming | One accepted per week (existing); frequency-limited uncapped grant (existing) | existing |
| Recovery farming | Max one per day (existing idem); recovery XP ≤ 10% of budget | existing + V-XP-05 |
| Padding pipeline counts | Quality gate (required fields, rationale length, no duplicate rationale) generalized from applications | pipeline instrument |
| Self-report inflation | Level accepts self-report by design (P6); **rank reads instrument records and verifiable evidence, never quest ticks**; `evidenceMode: 'logged_only'` available per quest | gates, E1 |
| Tampered import | Import re-validates every `BLUEPRINT_ACTIVATED` (H9); idem keys; `verifyIntegrity` | reducer, import |

**The honest limit, stated plainly** (as docs/10 A6 does): a person can type numbers that didn't happen. The design makes honesty the path of least resistance, makes Rank require artefacts a stranger could check, and makes lying pointless because no one else sees the score. The platform keeps that posture and doesn't pretend to more.
