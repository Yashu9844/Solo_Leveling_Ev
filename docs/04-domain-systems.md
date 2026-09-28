# 04 — Domain Systems

Career · DSA · AI Engineering · Fitness · Self-Efficacy · Skill Model · Progress Tracking

---

## 1. The skill progression model (applies to all domains)

Your brief said: *"Do not assume 'completed' = 'mastered.' Explore a better skill progression model."* Correct instinct. A checklist of topics is the standard design and it lies to you — you tick "Graphs" after four problems and never revisit it.

**Recommended model: five mastery states with explicit, evidence-based transitions.**

| State | Definition | Transition requires |
|---|---|---|
| **Unseen** | No exposure | — |
| **Introduced** | You've read/watched the concept | 1 logged learning session |
| **Applied** | You've solved with help | 3 problems solved (hints allowed) |
| **Fluent** | You solve unaided at speed | 5 problems, ≥ 60% first-attempt, ≥ 2 at medium |
| **Retained** | It survives time | A revisit ≥ 21 days later, solved first-attempt |

The key state is **Retained** — you cannot reach it by grinding, only by waiting and then succeeding. That's what makes the model honest, and it's exactly what an interview tests.

Topic mastery is displayed as a 5-segment bar, not a percentage. Percentages invite rounding-up; discrete states don't.

**Regression:** a topic in Retained that fails a later revisit drops to Fluent. This is the one place regression is allowed, because it's a factual statement about your recall, not a judgement.

**V1 scope:** this model is implemented for DSA only. AI/engineering skills use a simpler shipped-artefact model (below), because "mastery" of RAG isn't testable by a problem set.

---

## 2. DSA system

### 2.1 What gets logged (7 seconds, and this is the budget)

| Field | Input | Why |
|---|---|---|
| Problem | Text or slug | Identity for revisits |
| Topic | Picker (last-used first) | Topic-level analytics |
| Difficulty | E / M / H | XP weighting |
| Outcome | First-attempt ✓ / Hint / Editorial / Unsolved | **The single most important field** |
| Minutes | Stepper, 5-min increments | Speed trend |

Optional, one field, skippable: **"What was the insight?"** — one line. This exists because writing the insight is itself retrieval practice, and because at revisit time it's the most useful thing to show you. Skipping it costs nothing.

### 2.2 Spaced repetition scheduling

Deterministic, no SRS library, ~30 lines:

```
schedule(problem, outcome):
  if outcome == FIRST_ATTEMPT:  interval = next in [3, 10, 30, 90] days
  if outcome == HINT:           interval = 3 days  (reset)
  if outcome == EDITORIAL:      interval = 2 days  (reset, flagged as "learn again")
  if outcome == UNSOLVED:       interval = 1 day
  next_review = today + interval
```

Revisit quests appear on the home screen capped at **3 per day** (overflow rolls forward, oldest first). A revisit is solved from scratch without notes. Worth 20 XP — less than a new problem, because the psychological pull is always toward novelty and the XP shouldn't fight that battle it will lose; the *scheduling* is what makes revisits happen, not the reward.

This is the highest-value feature in the DSA subsystem and probably the second-highest in the whole app after implementation intentions. 150 problems with scheduled revisits beats 300 problems solved once, because the interview is a retrieval test.

### 2.3 Curriculum

Don't invent one. Anchor to an existing, well-sequenced list — the **Blind 75 → NeetCode 150 → topic-depth** progression is the de facto standard and is organised by pattern rather than by arbitrary topic, which matches how interviews actually probe.

Phase plan for the arc:

| Phase | Days | Target | Focus |
|---|---|---|---|
| Foundation | 1–30 | ~60 problems | Arrays, strings, hashing, two pointers, sliding window, stacks |
| Core | 31–70 | ~90 problems | Trees, BST, heaps, graphs, BFS/DFS, binary search |
| Advanced | 71–100 | ~70 problems | DP, backtracking, tries, union-find, intervals |
| Interview-ready | 101–120 | ~30 + revisits | Mixed random sets under time pressure, mock loops |

**≈ 250 problems over 120 days ≈ 2.1/day.** That's a demanding but achievable target alongside a job, and it's the number the weekly quests are calibrated against.

**Interview-ready benchmark (used by the Rank S gate):** solve 3 randomly-drawn mediums in 90 minutes total, unseen, first-attempt, with a working solution and a stated complexity. Self-administered, logged, repeatable. This is a *test*, not a count — which is the point.

### 2.4 What the app tracks that a problem counter doesn't

- First-attempt rate by topic and difficulty, trended.
- Median time-to-solve by difficulty, trended (are you getting faster, or just doing more?).
- **Revisit success rate** — the retention signal, and the one that predicts interview performance.
- Repeated failure clusters: "3 of your last 4 DP failures involved state definition." Rule-detected from topic + tags.
- Topic coverage vs the curriculum, with staleness ("Graphs: Fluent, last touched 24 days ago").

---

## 3. AI / Agentic engineering system

### 3.1 Skill tree, grounded in 2026 hiring reality

Your proposed list was reasonable but reflects a 2024 framing. Current hiring signals have shifted: **evaluation design is now the strongest differentiator**, RAG and vector DBs have become table-stakes rather than differentiators, and cost/latency engineering plus production observability are explicitly screened for. A "LangChain + Pinecone" profile reads as dated.

Restructured into four tiers by hiring leverage:

**Tier 0 — Table stakes (assumed, not differentiating)**
LLM fundamentals · prompting with cache-awareness · structured outputs · function/tool calling · embeddings · RAG basics · vector store selection (pgvector / Qdrant / Pinecone) · frontier model landscape and pricing

**Tier 1 — The differentiators (spend most of your arc here)**
- **Evaluation design** — golden datasets, LLM-as-judge with its failure modes, offline vs online eval, regression suites in CI. *This is the single strongest hiring signal and it is where most self-taught candidates have nothing.*
- **Agent orchestration** — supervisor/worker patterns, state across tool calls, failure recovery, retries, loop termination
- **Context engineering** — retrieval strategy, compaction, memory design, what actually goes in the window and why
- **MCP** — servers, transports, auth, building a real one
- **Cost & latency** — model routing, prompt caching economics, per-task unit cost, streaming

**Tier 2 — Production**
Observability and tracing (traces vs spans, regression alerting) · guardrails and the OWASP LLM risks, especially excessive agency · sandboxing and kill-switches for irreversible actions · deployment and scaling · async job architecture

**Tier 3 — Frontier**
Multi-agent coordination · computer-use / vision-action loops · fine-tuning and when it's actually justified · RL-from-feedback basics

### 3.2 Progression model: artefacts, not topics

Studying agent architecture produces nothing checkable. **Shipping does.** So AI progression is measured by artefacts:

| Artefact | Definition | Counts toward |
|---|---|---|
| **Feature** | Committed, tested, in a repo | CRAFT attribute, weekly quests |
| **Eval** | A test suite with a golden set and a scoring function | CRAFT × `eval_coverage`, Rank A gate |
| **Project** | Public repo, README, runnable, ≥ 1 eval suite | Rank B/A gates, Boss II |
| **Deployment** | Publicly reachable, or installable by someone else | Rank A gate |
| **Write-up** | Public technical post about something you built | Rank A external-event condition |

Note that `eval_coverage` is 25% of the CRAFT attribute. That's a deliberate thumb on the scale toward the thing the market is screening for and the thing you're least likely to do unprompted.

### 3.3 Arc project plan

| Days | Project | Must include |
|---|---|---|
| 1–35 | **P1: A working agent with real tools** — narrow scope, ~3 tools | Structured outputs, error handling, a 20-case golden eval set, README |
| 36–75 | **P2: A retrieval-backed agent with memory** | Retrieval eval with recall@k reported, context compaction, tracing, cost per task measured and stated |
| 76–110 | **P3: An MCP server + multi-step agent using it** | Auth, a kill-switch on irreversible actions, CI-run eval suite, deployed publicly |
| 111–120 | Portfolio consolidation | READMEs, a write-up, resume integration |

Three shipped projects with evals beats twelve tutorials, and it is what the Rank gates are calibrated to.

---

## 4. Fitness system

### 4.1 The hard rules

1. **No XP for weight, body fat, or any measurement.** Ever. (P2.)
2. **No target that implies a rate faster than ~0.75% of bodyweight per week.** The app refuses to accept a goal outside safe bounds and explains why.
3. **All body metrics are displayed as 7-day rolling means with raw points behind them.** A single scale reading is mostly water and glycogen.
4. **No streak on training.** Rest is a training variable, not a lapse.
5. **The app never comments on a body metric's direction.** It renders the trend. It does not say "great progress" or "up this week" — that's editorialising on a number with high measurement noise, and it's the mechanism by which tracking apps produce disordered relationships with the scale.

### 4.2 Realistic 120-day expectations

From the applied literature on rates of change, roughly:

| Rate | % bodyweight / week | Adherence needed | Over 120 days (17 weeks) |
|---|---|---|---|
| Aggressive | 1.0–1.5% | 90–100% | Not recommended — high lean-mass cost |
| **Reasonable** | **0.5–1.0%** | **70–85%** | **~6–12% of starting bodyweight** |
| Comfortable | < 0.5% | 50–65% | ~4–8% |

Muscle gain runs on a *monthly* scale, not weekly: roughly 1–1.5% of bodyweight per month for a true beginner, 0.5–0.75% intermediate, 0.25–0.4% advanced. Simultaneous fat loss and muscle gain (recomposition) is realistic for beginners and returning trainees, and slow-to-negligible for trained lifters in a deficit.

**What this means for the arc:** four months is enough for a visible, real change in body composition and a large change in strength — and it is *not* enough for a dramatic transformation. The app should set the target at Day 0 within these bounds and then never mention the target again except at checkpoints. Targets shown daily become a source of daily judgement.

### 4.3 Tracked

**Sessions:** date, type (push/pull/legs/full/conditioning), duration, RPE 1–10, notes. That's it. The app is not a workout logger — you likely already have one, and rebuilding it is scope creep.

**Strength (the honest progress signal):** 3–5 key lifts, top set weight × reps, estimated 1RM via Epley. Strength is the fitness metric that actually tracks training quality, is far less noisy than weight, and cannot be gamed by dehydration.

**Body:** weight (daily if you like, shown as 7-day mean), and optionally waist + one other girth, monthly. Body fat % is **optional and de-emphasised** — every home measurement method has error bars wide enough to swamp four months of real change, and the app should say so at the point of entry rather than pretending the number is precise.

### 4.4 The non-gym-day fallback

The BODY quest is not "go to the gym." It is "a logged session," where on non-gym days a 20-minute walk or mobility session satisfies it. This prevents the 4-gym-days-per-week schedule from generating 3 automatic quest failures per week, which would be a design bug that manufactures a 57% completion ceiling.

---

## 5. Mind / confidence / self-efficacy

**Your instinct to question "confidence" is right — self-efficacy is the better construct**, for three reasons: it's task-specific rather than global, it has a well-validated measurement approach, and its dominant source (mastery experience) is something this app is already generating and logging.

### 5.1 What not to do

Don't derive a CONFIDENCE attribute from task completion. That assumes exactly what you'd want to test — whether doing the work actually changes how capable you feel. If confidence is computed *from* completions, then completions "prove" confidence rose, and you've learned nothing.

Don't ask "how confident are you?" daily either. Daily self-report of a slow-moving trait is noise plus reactivity.

### 5.2 What to do

**A 6-item, task-specific self-efficacy scale, administered at Day 0 / 30 / 60 / 90 / 120 only.** Following Bandura's guidance: domain-specific, phrased as confidence in performing a *specific task under specific conditions*, rated 0–100.

> How confident are you, right now, that you could:
> 1. Solve an unseen medium DSA problem in 25 minutes, in front of an interviewer? `0–100`
> 2. Explain your last project's architecture to a senior engineer for 10 minutes? `0–100`
> 3. Design an evaluation suite for an agent from a blank file? `0–100`
> 4. Complete your planned training session on a day you don't feel like it? `0–100`
> 5. Hold your wake time within 30 minutes for the next 14 days? `0–100`
> 6. Apply to 5 roles above your current level this week? `0–100`

Five data points across the arc. Plotted against mastery evidence in the Before/After report. **This is a tracked metric, never an attribute, never XP-linked.**

### 5.3 Also measured at checkpoints

- **Automaticity** — a 4-item self-rating per core behaviour ("I do this without having to consciously remember"). Given the 59–66 day median for habit formation, watching automaticity rise across the arc is genuinely interesting and is the honest way to answer "did this become a habit?"
- **Enjoyment**, per domain, 0–10. This exists specifically to detect the quantification-reduces-enjoyment risk. A domain whose output rises while enjoyment falls is a warning, and the Day-120 report will say so.

---

## 6. Career system

### 6.1 The quest tree

```
MAIN QUEST — <you name it at onboarding, e.g. "Senior AI/backend role by March 2027">
│
├── TECHNICAL DEPTH
│   ├── DSA ─────────── 250 problems · ≥65% first-attempt on mediums · interview-ready benchmark
│   ├── AI Engineering ─ 3 shipped projects with evals (see §3.3)
│   └── System Design ── 12 designs studied · 4 written up · 2 explained aloud
│
├── ARTEFACTS
│   ├── Resume ───────── Draft → reviewed by 1 person → 3 tailored variants
│   ├── Portfolio ────── 3 project READMEs → landing page → 1 write-up published
│   └── Profile ──────── Headline → experience rewritten → 1 public post per project
│
└── MARKET CONTACT                 ← the part everyone skips
    ├── Applications ── 15+ sent, tracked by stage
    ├── Networking ──── 8 real conversations (not connection requests)
    ├── Mocks ───────── 4 mock interviews
    └── Loops ───────── 3 real interview processes entered
```

**The observation worth making:** the left branch is the comfortable one and the right branch is the one that produces the job. It is entirely possible to spend 120 days on technical depth and end the arc with a better brain and no offer. The Rank A and S gates are placed on the right branch deliberately, and the Day-90 report will say, in plain words, if you have been avoiding it.

### 6.2 Tracked as evidence

- Applications: company, role, date, stage (`applied → screen → technical → onsite → offer → rejected`), source
- Interviews: date, type, outcome, and — most valuable — *what you got stuck on*, which feeds back into DSA and system-design quests
- Artefact status: resume / portfolio / profile, as discrete states not percentages
- Conversations: date, who, what came of it

### 6.3 The salary question

Your brief listed current and target salary as optional profile fields. **Recommendation: don't collect them, and don't compute anything from them.** Rationale: they add nothing the app can act on, a target salary is a market fact rather than a behaviour, and a personal file containing your compensation is a privacy liability with no offsetting benefit. Track *offers received* as a binary evidence item instead.

---

## 7. Progress tracking — game vs real

The Progress screen has two tabs and they are never merged.

**Tab 1 — SYSTEM (the game layer)**
Level, XP over time, rank history, attribute radar with 28-days-ago ghost overlay, consistency percentages, streak.

**Tab 2 — REALITY (the evidence layer)**

```
┌── CAREER ───────────────────────────────────┐
│  Problems       Day 0: 0     Now: 148       │
│  First-attempt (M)     —            58%     │
│  Projects shipped      0              2     │
│  Applications          0             11     │
│  Interviews            0              2     │
├── BODY ─────────────────────────────────────┤
│  Weight (7d mean)   78.4 kg      76.9 kg    │
│  Est. 1RM squat        95 kg      112 kg    │
│  Sessions              0             41     │
│  Wake-time SD       71 min       38 min     │
├── ATTENTION ────────────────────────────────┤
│  Screen time (avg) 2h 40m       1h 05m      │
│  Days under cap        —          71 / 89   │
└─────────────────────────────────────────────┘
```

Tab 2 is the **default** tab from Day 30 onward. That's a small decision with a large effect: the app's default answer to "how am I doing?" becomes the real one.
