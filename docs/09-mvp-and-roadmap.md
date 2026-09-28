# 09 — MVP Scope, Development Plan and Testing

---

## 1. The MVP question, answered

You asked me to decide the final MVP. The decision rule I used: **what is the minimum system such that, if the app existed and nothing else was ever built, the 120-day arc would still be run well and honestly measured?**

That test cuts a lot. It keeps the daily loop, the evidence layer and the failure system. It cuts almost everything visual and everything AI.

### In V1

| Feature | Justification |
|---|---|
| 90-second onboarding + arc config | Can't start without it |
| **Implementation intentions per quest** | Highest-evidence feature in the product |
| 6 core daily quests + completion + undo | The spine |
| XP engine, ledger, caps | Immediate reward — the persistence mechanism |
| Level curve + level-up | Progress visibility |
| MVD + arc streak + auto grace + recovery quests + Reduced Mode | Determines whether the arc survives past Day 20 |
| Evening review (5 taps) + daily report | Where the `GROUP BY` insight lives |
| **DSA problem log + spaced revisit scheduling** | Second-highest-evidence feature |
| Training session log + weight (7d mean) + strength | Body evidence |
| Screen-time numeric entry | Attention evidence |
| 5 derived attributes + formula screens | Diagnosis, and the antidote to meaningless numbers |
| Weekly review + rules-based proposals | The 3-minute screen that redirects the week |
| **Checkpoints (Day 0/30/60/90/120) + rank gates** | The entire anti-self-deception mechanism |
| Progress: SYSTEM tab + REALITY tab | Game vs real, side by side |
| 8 achievements, 5 identities | Milestone marking, cheap |
| ~150 reflections + System Message generator | Texture + competence feedback |
| Boss quests (4, checklist only) | Consolidation in the novelty trough |
| PWA: install, offline, persist storage, shortcuts | It has to live on the home screen |
| Native alarm generation (.ics / instructions) | The honest notification solution |
| Export / import + weekly backup nudge | The only defence against device loss |
| **Paper-log CSV importer** | The Sept 1 → app migration depends on it |
| Arc pause | Principle P5 |

### Cut from V1 (with the phase it returns in)

| Cut | Why | Returns |
|---|---|---|
| AI coach / any LLM | It's a `GROUP BY`. Rules first. | Phase 7, if rules prove insufficient |
| Web Push server | Native alarms are better and free | Phase 7, optional |
| Interactive skill-tree graph | Read-mostly screen; a flat list carries the same info | Phase 6 |
| Career tree visualisation | Same | Phase 6 |
| Full body measurements (chest/arms/legs) | Weight + waist + strength is enough signal | Phase 5 |
| Body-fat tracking | Home methods have error bars wider than 4 months of change | Optional field only |
| Reflection editor UI | Edit the seed file; delete-only in-app | Phase 6 |
| Achievement gallery screen | A list on Profile is enough | Phase 6 |
| Multi-arc support | You're running one arc | Phase 7 |
| Themes, avatars, cosmetics | Generates the "customising instead of doing" failure | Never |
| Double XP / random events | Slot-machine mechanic | Never |
| Leaderboards / social | No second user | Never |
| Desktop dashboard layout | 5% of sessions, a week of work | Never (responsive column only) |
| Health/wearable integration | Adds platform complexity, permissions, sync | Phase 7 |
| GitHub / LeetCode API integration | Genuinely appealing; also auth, rate limits, network — against the local-first grain | Phase 7 |

---

## 2. Development phases

| Phase | What | Status |
|---|---|---|
| **0 — Research** | Behavioural evidence, platform constraints, domain benchmarks | ✅ Done (`02`) |
| **1 — Product spec** | Vision, mechanics, formulas, simulation | ✅ Done (`01`,`03`,`04`,`05`) |
| **2 — UX / wireframes** | Screens, design system, navigation | ✅ Done (`06`) |
| **3 — Architecture** | Data model, stack, PWA strategy | ✅ Done (`07`,`08`) — **pending your answers in `12`** |
| **4 — MVP build** | 11 vertical slices, ~10–14 days | ⬜ Next |
| **5 — Personal pilot** | Days 1–120, running it for real | ⬜ From 1 Sept (on paper), app from ~Day 14 |
| **6 — Behavioural iteration** | Changes driven by checkpoint data, not by taste | ⬜ Day 30+ |
| **7 — Advanced** | Push, integrations, AI coach — only if earned | ⬜ Day 60+ |

---

## 3. Build slices

Each slice must **build → run → pass tests → be manually verified on a real phone → be committed** before the next begins. No slice is "mostly done."

| # | Slice | Deliverable | Done when |
|---|---|---|---|
| **0** | Foundation | Vite+TS+Tailwind, tokens, routing, 4 tabs, Dexie schema, event log, **pure engine skeleton with injected clock**, Vitest wired, ESLint rule banning I/O in `engine/` | App installs to home screen and navigates offline; `applyEvents([])` returns a valid empty state |
| **1** | Onboarding + arc | 6 screens, arc record, quest templates generated, **if-then sentences captured** | Fresh install → initialised arc in < 90 s, measured with a stopwatch |
| **2** | **The core loop** | Today screen, quest instances, completion, undo, day rollover at 04:00 | Complete a quest, kill the app, reopen — state is correct. Rollover verified with a mocked clock across a 00:40 boundary |
| **3** | XP + levels | Ledger, category caps, daily cap, level curve, level-up | **Property test: no event sequence produces > 700 XP/day or negative XP.** Curve table matches `03 §3.2` exactly |
| **4** | Failure system | MVD, arc streak, auto-grace, recovery quests, Reduced Mode, arc pause | Simulated 30-day sequence with 6 misses produces the expected streak, grace count and mode transitions |
| **5** | Evening review + report | 5-tap review, daily report, System Message generator | Review completes in < 25 s on a phone; report renders with correct rollups |
| **6** | DSA subsystem | Problem log, outcomes, difficulty weighting, **SRS scheduling**, revisit quests, topic mastery states | Log 20 problems across outcomes → revisit dates match the algorithm; mastery states transition correctly |
| **7** | Attributes | 5 derived attributes, 28-day windows, formula-breakdown screens | Attribute values match hand-computed fixtures; window sensitivity matches `03 §5.2` |
| **8** | Metrics + evidence | Weight (7d mean), strength, sessions, screen time, artifacts, career events, REALITY tab | Chart renders trend + raw; **assert no metric ever writes an xp_ledger row** |
| **9** | Weekly review + rules | Weekly evaluation, bottleneck rule, quest proposals, accept/adjust | Fixture weeks produce the expected bottleneck and proposals |
| **10** | **Checkpoints + rank** | Checkpoint entry, self-efficacy/automaticity/enjoyment instruments, gate evaluation, sealing, verdict generation, Before/After report | Day-30 fixture evaluates gates correctly; sealed checkpoints reject writes |
| **11** | Ship | Bosses, achievements, identities, reflections seeded, export/import, **paper CSV importer**, alarm generation, install card, backup nudges, `persist()` | Full arc simulation end-to-end; install on your actual phone; run one real day |

**Slices 2, 3, 4 and 10 are the load-bearing ones.** If time runs short, slices 6–9 can degrade (fewer attributes, simpler DSA log) without breaking the arc. Slice 10 cannot degrade — without checkpoints the app is a habit tracker.

**Sequencing note:** slice 2 gives a usable app on day ~3 of the build. From there, every slice adds value to something you're already using. There is no big-bang integration.

---

## 4. Testing strategy

### 4.1 Engine — deterministic unit tests, the priority

The engine is pure, so these are fast and exhaustive. Target **> 90% coverage on `engine/`**, and it's achievable because there's no I/O to mock.

```
xp.test.ts
  ✓ each core quest yields its exact XP
  ✓ category cap trims and records capped_from
  ✓ daily cap binds before category caps
  ✓ recovery quest < original quest value
  ✓ no metric event ever produces a ledger row      ← guards P2
  ✓ property: ∀ event sequences, 0 ≤ daily XP ≤ 700 ← fast-check
  ✓ property: total_xp == SUM(ledger)               ← invariant

level.test.ts
  ✓ req(n) matches the published table exactly
  ✓ boundary: exactly-enough XP levels up; one short does not
  ✓ multi-level-up in a single grant is handled
  ✓ simulated 120-day arcs reproduce the §3.2 table

streak.test.ts
  ✓ MVD day preserves the streak
  ✓ grace auto-applies, max 4 per rolling 28
  ✓ 5th miss in 28 days breaks it
  ✓ pause days are excluded, streak preserved
  ✓ 2 consecutive misses → Reduced Mode; 2 MVD days → exit

time.test.ts        ← the highest-risk area
  ✓ 00:40 completion → previous local_date
  ✓ 04:01 completion → new local_date
  ✓ device timezone ≠ arc timezone uses arc timezone
  ✓ DST transition (using a DST zone fixture) does not skip or double a day
  ✓ local_date is never recomputed after write

attributes.test.ts  ✓ hand-computed fixtures; window sensitivity table
srs.test.ts         ✓ interval progression per outcome; reset on failure; cap of 3 revisits/day with rollover
rank.test.ts        ✓ each gate; missing-condition reporting; no regression; sealed immutability
quests.test.ts      ✓ generation determinism: same inputs → identical quest set
rules.test.ts       ✓ each rule fires exactly on its condition and not otherwise
messages.test.ts    ✓ cooldown respected; no `challenging` tone after a lapse; System Message beats reflection when available
reduce.test.ts      ✓ replay determinism: applyEvents(log) twice → identical state
                    ✓ idempotency: duplicate idem_key is a no-op
```

**The single most valuable test in the suite:** a **120-day golden fixture** — a recorded event log of a full simulated arc — asserted against a snapshot of the final state. Any change to any rule that alters historical outcomes fails loudly. Regenerating the snapshot is a deliberate act.

### 4.2 Integration (Playwright, real Chromium + WebKit)

```
✓ fresh install → onboarding → first quest complete
✓ offline from first launch (network disabled before load)
✓ complete quest → kill app → reopen → state persists
✓ midnight rollover with a mocked clock
✓ export → wipe database → import → state identical
✓ paper CSV import produces correct events
✓ service worker update flow doesn't lose an in-flight event
✓ 200% dynamic type: no clipping on any screen
✓ prefers-reduced-motion: all animation disabled, all function intact
```

### 4.3 Manual, on your actual phone

Automation can't check these and they're the ones that determine whether you keep using it.

- [ ] Install to home screen on your real device; icon and splash look right
- [ ] Cold start to home in < 1.2 s
- [ ] Tap → XP feedback feels instant
- [ ] Every primary action reachable one-handed with your thumb
- [ ] Onboarding completed in < 90 s, stopwatch
- [ ] Evening review completed in < 25 s, stopwatch
- [ ] Airplane mode for 48 hours: nothing degrades
- [ ] Screen readable at 6:30am in a dark room without hurting
- [ ] Nothing anywhere in the app uses the word "failed"

### 4.4 Data integrity

- `verifyIntegrity()` dev command: rebuild all projections from the event log, diff against cached, assert identity. Run at the end of every build slice.
- Fuzz the reducer: 10,000 random valid event sequences, assert invariants hold (XP non-negative, level monotonic, streak within bounds).

---

## 5. Definition of done, per slice

1. Builds with zero TypeScript errors and zero ESLint warnings
2. All tests pass, including the golden 120-day fixture
3. Manually verified on a real phone, offline
4. `verifyIntegrity()` clean
5. No new runtime dependency added without an explicit note saying why
6. Committed with the slice number in the message

---

## 6. Realistic schedule

Working evenings and weekends alongside a job:

| Slices | Effort | Calendar |
|---|---|---|
| 0–2 (foundation + core loop) | ~14 h | Days 1–4 |
| 3–5 (XP, failure, review) | ~12 h | Days 5–8 |
| 6–8 (DSA, attributes, metrics) | ~14 h | Days 9–12 |
| 9–11 (weekly, checkpoints, ship) | ~14 h | Days 13–16 |

**≈ 54 hours, ~16 calendar days.** Starting the build on 31 August puts a usable app in your hand around 8–10 September and a complete V1 around 15 September.

Which is why you start the arc on paper on 1 September and import Days 1–14. The arc is the point; the app is instrumentation, and instrumentation that delays the experiment has failed at its job.
