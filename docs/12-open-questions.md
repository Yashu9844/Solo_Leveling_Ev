# 12 — Open Questions

Nine questions. Q1–Q4 block Phase 3 sign-off and the start of the build. Q5–Q9 can be answered by Day 7 of the build.

---

## BLOCKING

### Q1 — Which phone? **iOS or Android?**
The single most consequential unanswered question in the report.

- **Android:** home-screen install can be prompted, `beforeinstallprompt` works, storage is generous, and Web Push remains a viable Phase 7 option.
- **iOS:** install must be done manually via Share → Add to Home Screen and the app must show instructions for it; **home-screen install is effectively mandatory**, not optional, because an uninstalled iOS PWA has weaker storage guarantees and no push capability at all. Background execution is nil.

The native-alarm notification strategy (`08 §5`) works identically on both, so it doesn't change the recommendation — but it changes the install flow, the storage warnings, and how loudly the app nags you to export.

### Q2 — Is "up to one week of data loss if the phone dies" acceptable?
You chose local-first with no server, which I agree with. The residual risk is device loss between exports. Options:

- **(a) Accept it** — weekly export + mandatory checkpoint exports. *My recommendation.* Cost: zero. Worst case: one week.
- **(b) Add file-system sync** — export automatically to a folder your phone already backs up (Google Drive / iCloud) via the File System Access API. Chromium-only, so on iOS it degrades to manual. ~4 hours of work.
- **(c) Add a real backend** — Supabase. Solves it properly, and adds auth, network states, conflict handling, and a server that knows your sleep schedule. ~2 days, and it contradicts the architecture you picked.

### Q3 — The six core quests: are these the right six, and are these the right thresholds?
Locked at onboarding, changeable only at checkpoints. Getting them wrong costs you 30 days.

```
DSA Block        ≥ 25 min or 1 problem            100 XP
Build Block      ≥ 25 min on the current project  100 XP
Training         a logged session (walk counts
                 on non-gym days)                 100 XP
Sleep Window     wake within ±30 min of target     75 XP
Fuel             ate to plan (3 discretionary
                 meals/week built in)              60 XP
Attention        OS screen time ≤ 60 min           65 XP
```

Specifically: is 25 minutes the right deep-block minimum? Is ±30 minutes the right wake tolerance for a workday? Is 60 minutes the right screen cap, or is that a target you'll miss so often it becomes noise? **A quest you fail 70% of the time isn't accountability, it's a broken sensor.**

### Q4 — Your main quest, in one sentence.
Everything is judged against this. It should be specific, dated, and falsifiable.

Not: *"get better at software engineering."*
Something like: *"By 31 March 2027, hold an offer for a senior AI/backend role at ≥ X level, with 3 public projects and an interview-ready DSA benchmark."*

Related: **which do you actually want more — a new job, or the capability?** They pull in different directions. The capability path says grind depth. The job path says spend 30% of the arc on applications, networking and interviews, starting in month 1. The rank gates are currently calibrated for the *job* interpretation. Confirm or I'll recalibrate.

---

## NON-BLOCKING

### Q5 — Where does "system design" sit?
It's in the career tree (`04 §6.1`) but it has no core quest and no dedicated tracking, because adding a 7th core quest breaks the six-quest constraint. Options: (a) fold it into the Build Block on alternating days; (b) make it a weekly quest only; (c) give it its own core quest and demote something else. Default if you don't answer: **(b)**.

### Q6 — Reflection library: do you want to write them, approve them, or let me draft them?
~150 original lines. Fastest path: I draft 150 in the twelve categories, you delete the ones that make you wince. Probably a 20-minute review. Sample tone is in `05 §2.4`.

### Q7 — The one human.
`10 §A12` — relatedness is structurally absent from a single-user offline app and I won't fake it. The honest fix is one real person who sees your checkpoint reports. Who? The checkpoint flow will generate a shareable summary for them.

### Q8 — Name.
"SYSTEM" is a placeholder. It's fine — literal, unbranded, matches the instrument aesthetic, and appears on your home screen where a clever name would age badly. Alternatives worth a thought: ARC, LEDGER, BASELINE. Anything referencing the source inspiration should be avoided for the obvious reason.

### Q9 — Boss rewards.
Four real-world rewards, one per boss, defined by you at onboarding. The app stores the text and shows it when the boss clears. It doesn't track whether you took it. Have four in mind before Day 1.

---

## Decisions already made (recorded so they don't get relitigated)

| Decision | Where |
|---|---|
| Arc starts 1 Sep on paper; app follows around Day 14 | Your call |
| Local-first, no server, no account | Your call |
| Level measures effort; **Rank measures evidence**; non-convertible | `03 §1` |
| No XP for any body metric, ever | `03 §2.1`, P2 |
| 5 derived attributes, non-editable, 28-day rolling window | `03 §5` |
| One streak, on the MVD floor, 4 auto-grace per 28 days | `03 §7` |
| No AI, no LLM, in V1 | `08 §1`, `09 §1` |
| No random events, no XP multipliers, no cosmetics | `03 §10`, `03 §13` |
| ~150 original reflections, not thousands of scraped quotes | `05 §1` |
| Native OS alarms instead of a push stack | `08 §5` |
| Day boundary at 04:00 local, not midnight | `07 §2` |
| Event-sourced data model; all state is a projection | `07 §1` |
| 4 tabs: Today / Progress / Skills / Profile | `06 §4` |
| Level 40 as the natural arc terminus, not 100 | `03 §3.3` |
| No salary data collected | `04 §6.3` |
| Body/Mind/Career composite scores cut | `03 §5.3` |
