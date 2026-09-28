# 02 — Career System

The subsystem behind the CAREER core quest. This is the part of the app that most directly serves objective #1, and it is built around one hard distinction.

---

## 1. Controlled vs External — the structural rule

```
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│  CONTROLLED                       │   │  EXTERNAL                        │
│  ─────────────────────────────    │   │  ─────────────────────────────   │
│  applications sent                │   │  recruiter responses             │
│  application quality              │   │  screening calls                 │
│  resume versions & reviews        │   │  interview loops                 │
│  follow-ups                       │   │  onsites                         │
│  networking conversations         │   │  offers                          │
│  mock interviews                  │   │  rejections                      │
│  portfolio & write-ups            │   │                                  │
│  interview preparation            │   │                                  │
│                                   │   │                                  │
│  → XP · attributes · RANK GATES   │   │  → displayed as a funnel with    │
│                                   │   │    conversion rates. NEVER XP,   │
│                                   │   │    NEVER a rank gate, NEVER a    │
│                                   │   │    reason for a negative message │
└──────────────────────────────────┘   └──────────────────────────────────┘
```

**Implementation invariant, enforced by a unit test:** no `career_event` of kind `response | call | interview | onsite | offer | rejection` may ever produce an `xp_ledger` row or appear in a rank gate expression. This is asserted in `career.test.ts` and in the global "no outcome earns XP" property test.

**Copy rule:** the app never writes a discouraging sentence about external outcomes. It reports rates and, when a rate is poor, points at the *controllable* input that most plausibly explains it.

---

## 2. The morning application block

```
08:30  wake
08:35  CAREER cue fires (native alarm, labelled with your if-then sentence)
08:35  ~30 minutes
09:05  done
```

Completion: **3 quality applications** OR **25 min substitute career work.**

### 2.1 The quality gate

An application counts only if all three hold:

1. Company + role recorded
2. A resume version selected (never "none")
3. A one-line **"why this role"** — ≥ 15 characters, and not a duplicate of the previous application's line

Condition 3 is the real gate. It takes eight seconds, it forces a moment of targeting judgement, and it is the thing that separates a considered application from a mass-apply. Duplicate or empty lines earn 0 XP for that application and are flagged in the weekly review.

### 2.2 Substitute career work

Because 280+ *relevant* roles may simply not exist, the quest accepts 25 minutes of any of:

| Substitute | Logged as |
|---|---|
| Resume iteration | `artifact: resume_version` |
| Follow-ups on open applications | `career_event: followup` (n) |
| A networking message or conversation | `career_event: conversation` |
| Portfolio / README work | `artifact: portfolio` |
| Technical write-up drafting | `artifact: writeup` |
| Mock interview | `career_event: mock` |

All are controllable, all are leverage-positive, none are padding. The weekly review tracks the applications:substitute ratio and comments if substitutes exceed 50% for two weeks running — that's avoidance, and the app should say so.

---

## 3. Application record

```ts
application {
  id, local_date,
  company, role, role_category,       // backend | ai | fullstack | platform | other
  source,                             // referral | jobboard | company_site | recruiter | network
  resume_version_id,                  // FK — required
  why_line,                           // required, >= 15 chars, dedupe-checked
  status,                             // applied → responded → call → interview
                                      //   → onsite → offer | rejected | ghosted
  status_history: [{status, date}],
  followup_due_at,                    // auto: applied + 10 days
  followed_up_at?,
  recruiter_contact?,
  notes?,
  quality_pass: bool                  // computed at write time
}
```

Status transitions after `applied` are all EXTERNAL and are logged as `career_event` rows. Nothing after `applied` earns XP.

---

## 4. The funnel

Shown weekly and at every checkpoint. This is market feedback, framed as diagnostics.

```
CAREER FUNNEL · DAYS 1–60

  Applications sent          158
  ├─ Responded                14      8.9%
  │  ├─ Screening call         9      5.7%   (64% of responses)
  │  │  ├─ Interview loop      3      1.9%
  │  │  │  ├─ Onsite           1      0.6%
  │  │  │  └─ Offer            0
  ├─ Rejected                 31     19.6%
  └─ No response             113     71.5%

  Follow-through              76%    (94 of 124 eligible followed up or closed)
  Quality-gate pass rate      91%

  BY ROLE CATEGORY        sent   resp   rate
    backend                 71     9    12.7%
    ai / agentic            44     4     9.1%
    fullstack               31     1     3.2%
    platform                12     0     0.0%
```

### 4.1 What the app does with this

Rules, not opinions:

```
IF  applications >= 40 AND response_rate < 0.05
THEN  "158 applications, 4% response. The constraint is not volume.
       Next week's CAREER target: resume rewrite + 1 external review.
       Application target reduced to 1/day until response rate is re-measured."

IF  response_rate(category_A) > 2 × response_rate(category_B) AND n >= 20 each
THEN  "Backend roles respond at 12.7%; fullstack at 3.2%. Shift targeting."

IF  followthrough_rate < 0.5
THEN  "31 applications past 10 days with no follow-up. Follow-ups are
       controllable and they convert. This week: clear the backlog."

IF  substitute_share(14d) > 0.5
THEN  "8 of the last 14 CAREER completions were substitute work.
       If relevant roles are genuinely scarce, say so and we'll
       re-target. If not, this is avoidance."
```

Note the first rule **reduces the application target**. An app that only ever asks for more is not a coach.

---

## 5. Resume and evidence

The app is **not** a resume editor. It tracks versions and whether they improved for a reason.

```ts
resume_version { id, label, created_at, changed_because, external_review? }
```

`changed_because` is required and is free text — one line. The weekly review asks:

> *"You shipped an eval suite and 2 features this week. Does your resume say so? [ Update ] [ Not yet ]"*

That's the whole feature. It links accomplishments you already logged to the artefact that has to carry them.

Rank gates require: v2 with ≥ 1 external review by Day 60, v3 externally reviewed by Day 120.

---

## 6. Career quest tree

```
MAIN QUEST — "Substantially stronger SWE + AI engineer, interview-ready,
              with credible public evidence, by 29 Dec 2026"
│
├── SOFTWARE ENGINEERING                    → FOUNDATIONS tree (03 §2)
│   DSA · OS · System Design · Backend · Distributed Systems
│   · Databases · Networking · Concurrency · Production Engineering
│
├── AI / AGENTIC ENGINEERING                → AI tiers (03 §3)
│   Tier 0 table stakes → Tier 1 differentiators → Tier 2 production → Tier 3 frontier
│
├── PROJECTS                                → artifact table
│   feature → eval → project → deployment → write-up
│
├── RESUME                                  → resume_version
│   v1 → v2 + external review → v3 + external review
│
├── APPLICATIONS                            → application table  [CONTROLLED]
│
├── INTERVIEWS                              → career_event       [EXTERNAL]
│
└── OFFER                                   → career_event       [EXTERNAL]
```

Every node has real mastery state or real evidence behind it — nothing in this tree is cosmetic. The three left branches are scored; the two right branches are displayed.

**The observation the app will make at Day 90 if it applies:** the left branches are the comfortable ones. It is entirely possible to finish 120 days with a much better brain, three good repos, and eleven applications. The Rank A gate places its heaviest requirements on applications, follow-through, networking and mocks for exactly that reason.

---

## 7. Interview preparation

| Item | Tracked | Counts toward |
|---|---|---|
| Mock interview | date, type, interviewer (self/peer/platform), **what you got stuck on** | Rank A/S, Boss IV |
| Interview-ready benchmark | 3 unseen mediums / 90 min / first-attempt / complexity stated — pass or fail, repeatable | Rank S, Boss IV |
| System design explained aloud | topic, duration, recorded? | Boss IV |
| Post-interview debrief | what was asked, what broke | feeds DSA + FOUNDATIONS quests |

**"What you got stuck on" is the highest-value field in the career subsystem.** It's the only input that closes the loop from a real interview back into next week's study quests, and a rule reads it: three stuck-on entries tagged the same topic in 30 days generates a targeted learning quest for that topic.
