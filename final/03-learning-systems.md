# 03 — Learning Systems: DSA · SE Foundations · AI/Agentic

Three domains, one shared mastery model, three different evidence types.

---

## 1. The shared mastery model

Applies to DSA topics and SE foundation topics. Five states, explicit transitions.

| State | Meaning | Transition requires |
|---|---|---|
| **Unseen** | No exposure | — |
| **Introduced** | Concept read/watched | 1 logged learning block |
| **Applied** | Solved/used with help | 3 problems or 2 blocks + 1 applied artefact |
| **Fluent** | Unaided, at speed | 5 problems, ≥ 60% first-attempt, ≥ 2 at medium *(DSA)* · 1 written explanation + 1 applied use *(foundations)* |
| **Retained** | Survives time | A revisit **≥ 21 days later**, passed unaided |

**Retained cannot be grinded — only waited for.** That is what makes the model honest, and it is exactly what an interview tests.

**Regression is allowed here and nowhere else:** a Retained topic that fails a later revisit drops to Fluent. It is a factual statement about your recall, not a judgement, and the app words it that way.

Displayed as a 5-segment bar, never a percentage. Percentages invite rounding up.

---

## 2. DSA system

### 2.1 Logging — 7-second budget

| Field | Input |
|---|---|
| Problem | Text / slug |
| Topic | Chips, last-used first |
| Difficulty | E / M / H |
| **Outcome** | **First attempt · Hint · Editorial · Unsolved** |
| Minutes | Stepper, 5-min steps |
| Insight | Optional, one line, skippable |

`Outcome` is the single most important field in the app's learning data. It is what separates 240 problems solved from 240 problems *counted*.

### 2.2 Spaced repetition — deterministic, ~30 lines

```
schedule(outcome):
  FIRST_ATTEMPT → next interval in [3, 10, 30, 90] days
  HINT          → 3 days   (reset)
  EDITORIAL     → 2 days   (reset, flagged "learn again")
  UNSOLVED      → 1 day
```

Revisit quests appear on Today, **max 3/day**, overflow rolls forward oldest-first. Solved from scratch, no notes. 20 XP each — less than a new problem, deliberately: the pull toward novelty is real and XP shouldn't fight a battle it will lose. **The scheduling is what makes revisits happen, not the reward.**

150 problems with scheduled revisits beats 300 solved once. The interview is a retrieval test.

### 2.3 Curriculum and pacing

Anchored to the Blind 75 → NeetCode 150 → topic-depth progression, which is organised by *pattern* rather than arbitrary topic and matches how interviews probe.

| Phase | Days | Volume | Focus |
|---|---|---|---|
| Foundation | 1–30 | ~55 | Arrays, strings, hashing, two pointers, sliding window, stacks |
| Core | 31–70 | ~85 | Trees, BST, heaps, graphs, BFS/DFS, binary search |
| Advanced | 71–100 | ~65 | DP, backtracking, tries, union-find, intervals |
| Interview-ready | 101–120 | ~35 + revisits | Mixed random sets under time, mock loops |

**≈ 240 problems / 120 days ≈ 2 per day.** Your stated target is 3/day; that's the weekly-quest target. The daily floor is 1. (`00 §C2`.)

### 2.4 The benchmark

**3 randomly drawn unseen mediums · 90 minutes total · first attempt · working solution + stated complexity.** Self-administered, logged, repeatable. Required for Rank S and Boss IV. It is a *test*, not a count — which is the point.

### 2.5 Tracked beyond the count

First-attempt rate by topic and difficulty (trended) · median time-to-solve by difficulty · **revisit success rate** (the retention signal) · repeated failure clusters by topic and tag · coverage vs curriculum with staleness flags.

---

## 3. SE Foundations — your office blocks

This is where 10:00–20:00 free periods land. **Not a seventh core quest.** A `LEARN` XP category, loggable at any time, feeding the ENGINEERING attribute and the FOUNDATIONS tree.

### 3.1 Logging — 4 seconds

```
┌────────────────────────────────┐
│  LEARNING BLOCK            ✕   │
│                                 │
│  Topic  [OS][Networking][DB]    │  chips
│         [Distributed][Backend]  │
│         [Concurrency][SysDes]   │
│         [Performance][Prod Arch]│
│                                 │
│  Time   ─ [ 15 ] +  min         │
│  Note (optional) [___________]  │
│                                 │
│        [ Log  +25 XP ]          │
└────────────────────────────────┘
```

25 XP per 15-minute block, **max 3 blocks/day** (LEARN cap 75). Small blocks are the design — your brief asked for exactly this, and it matches the reality of snatched time at work.

### 3.2 The nine topics

`Operating Systems` · `Networking` · `Databases` · `Distributed Systems` · `Concurrency` · `Backend Engineering` · `System Design` · `Performance` · `Production Architecture`

Each carries a mastery state (§1). Mastery points feed ENGINEERING at 0.35 weight: Introduced 1 · Applied 2 · Fluent 3 · Retained 4, summed across nine topics, max 36, with the 100-mark at 24.

### 3.3 System design specifically

Per your Q5 answer: **weekly/learning subsystem, not a core quest.** It gets extra structure because it's the highest-leverage foundation topic for your target roles:

```ts
system_design_study {
  id, local_date,
  system,              // "URL shortener", "rate limiter", "news feed"
  mode,                // studied | written_up | explained_aloud
  minutes, artifact_url?, notes?
}
```

Arc target: **12 studied · 4 written up · 2 explained aloud.** Weekly quests instantiate it ("write up one design this week"). Rank gates and Boss IV reference the counts. Explaining aloud is included because that is the interview skill; studying silently is not.

---

## 4. AI / Agentic Engineering — the BUILD quest's domain

### 4.1 The learn/ship distinction, enforced

Every BUILD log **requires a mode**:

```
        ┌──────────────┐  ┌──────────────┐
        │    LEARN     │  │     SHIP     │
        └──────────────┘  └──────────────┘
   reading, tutorials,      committed, tested code
   papers, experiments      in a repo
        ↓                         ↓
   FOUNDATIONS/tier          artifact row
   mastery states            + 50 XP bonus
        ↓                         ↓
   ENGINEERING × 0.35       ENGINEERING × 0.40 + 0.25 eval_coverage
```

**The enforcement rule:**
```
IF learn:ship ratio over 14 days > 3:1
THEN "14 days · 11 learning sessions · 2 shipped units.
      Learning without shipping produces no evidence.
      This week's BUILD target: SHIP only."
```

This is the mechanism that stops four months of tutorials. It's also why the rank gates reference repos and deployments rather than hours.

### 4.2 Skill tiers, ordered by 2026 hiring leverage

**Tier 0 — table stakes (assumed, not differentiating)**
LLM fundamentals · prompting with cache-awareness · structured outputs · tool calling · embeddings · RAG basics · vector store selection (pgvector / Qdrant / Pinecone) · model landscape and pricing

**Tier 1 — the differentiators (spend most of the arc here)**
- **Evaluation design** — golden datasets, LLM-as-judge and its failure modes, offline vs online eval, regression suites in CI. *The strongest single hiring signal, and where most self-taught candidates have nothing.*
- **Agent orchestration** — supervisor/worker patterns, state across tool calls, failure recovery, retries, loop termination
- **Context engineering** — retrieval strategy, compaction, memory design
- **MCP** — servers, transports, auth, building a real one
- **Cost & latency** — model routing, prompt caching economics, per-task unit cost, streaming

**Tier 2 — production**
Observability and tracing (traces vs spans, regression alerting) · guardrails and OWASP LLM risks, especially excessive agency · sandboxing and kill-switches for irreversible actions · deployment · async job architecture

**Tier 3 — frontier**
Multi-agent coordination · computer-use / vision-action loops · fine-tuning and when it's justified

Note `eval_coverage` is 25% of ENGINEERING. That is a deliberate thumb on the scale toward the thing the market screens for and the thing you're least likely to do unprompted.

### 4.3 Evidence ladder

| Artefact | Definition | Gates it feeds |
|---|---|---|
| **Feature** | Committed, tested, in a repo | ENGINEERING, weekly quests |
| **Eval** | Test suite with a golden set and a scoring function | `eval_coverage`, Rank B+ |
| **Project** | Public repo · README · runnable · ≥ 1 eval suite | Rank B/A/S, Boss III |
| **Deployment** | Publicly reachable, or installable by a stranger | Rank A, Boss III |
| **Write-up** | Published technical post about something you built | Rank A, Boss III |

### 4.4 Arc project plan

| Days | Project | Must include |
|---|---|---|
| 1–35 | **P1 — agent with real tools**, narrow scope, ~3 tools | Structured outputs, error handling, 20-case golden eval set, README |
| 36–75 | **P2 — retrieval-backed agent with memory** | Retrieval eval with recall@k reported, context compaction, tracing, **cost per task measured and stated** |
| 76–110 | **P3 — MCP server + multi-step agent using it** | Auth, kill-switch on irreversible actions, CI-run eval suite, deployed publicly |
| 111–120 | Portfolio consolidation | READMEs, write-up, resume integration |

Three shipped projects with evals beats twelve tutorials, and it is what the rank gates are calibrated to.

---

## 5. Where each learning behaviour lives

Quick reference, since this was the most tangled part of the brief:

| Behaviour | When | Home | XP |
|---|---|---|---|
| DSA problems | 22:00–23:00 | **DSA core quest** | 100 + bonuses (MIND cap 200) |
| DSA revisits | with DSA | Auto-generated quests | 20 each |
| AI learning | 23:00–02:00 | **BUILD core quest**, mode `LEARN` | 100 (CRAFT cap 200) |
| AI building | 23:00–02:00 | **BUILD core quest**, mode `SHIP` | 100 + 50/unit |
| OS / networking / DB / distributed / concurrency / backend / performance / prod-arch | office free periods | **LEARN category**, any time | 25 per 15 min, cap 75 |
| System design | office + weekly | **LEARN category** + weekly quest + its own table | 25 per 15 min |
| Mock interviews | weekend | **CAREER substitute work** | counts toward the 25-min substitute |
