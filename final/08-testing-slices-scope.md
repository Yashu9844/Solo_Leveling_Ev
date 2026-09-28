# 08 — Testing, V1/V2 Boundary, Development Slices

---

## 1. V1 / V2 boundary

### In V1

Onboarding (6 steps, 90 s) · arc config · **implementation intentions per quest** · six core quests + completion + undo · Maintenance row · XP engine with ledger and caps · level curve + level-up · **Moments (6)** · MVD + arc streak + auto-grace + recovery + Reduced Mode + arc pause · evening review + daily report · weekly review + rules-based proposals · **DSA log + SRS + mastery states** · **SE foundations learning blocks + mastery** · system design tracking · **BUILD with LEARN/SHIP enforcement** · training + steps + lifts · sleep + attention · **career: applications + quality gate + funnel + resume versions + follow-ups** · 6 derived attributes + formula screens · **checkpoints + rank gates + verdict generation** · Progress SYSTEM/REALITY · 8 achievements + 5 identities · 4 bosses · ~150 reflections + System Message generator · export/import + **paper CSV importer** · backup nudges + `persist()` · Android install + offline · OS alarm setup.

### Not in V1

| Deferred | Why | Phase |
|---|---|---|
| Web Push + server | OS alarms are better and free | 7 |
| Cloud backup / sync | Q2 answered: local-only for V1 | 7 |
| GitHub / LeetCode integration | Auth, rate limits, network — against the local-first grain | 7 |
| Wearables / Health Connect | Permissions and sync for a number you type in 3 s | 7 |
| AI coach (any LLM) | Every insight described is a `GROUP BY` | 7, only if rules prove insufficient |
| Interactive skill-tree graph | Read-mostly; a flat list carries the same information | 6 |
| Career tree visualisation | Same | 6 |
| Reflection editor UI | Edit the seed file; delete-only in-app | 6 |
| Achievement gallery screen | A list on Profile suffices | 6 |
| Body-fat tracking | Home methods have error bars wider than 4 months of change | optional field only |
| Calorie / macro tracking | Fuel is a Maintenance tick until a checkpoint says otherwise | on evidence |
| Multi-arc support | One arc | 7 |
| Light theme | Opened at 08:30 and 02:00 | never |
| Desktop dashboard | A week of work for 5% of sessions | never |
| Badging API | **Unsupported on Android** | never |
| Themes / avatars / cosmetics | Produces the "customising instead of doing" failure | never |
| Random events / XP multipliers | Slot-machine schedule; breaks XP comparability | never |
| Leaderboards / social | No second user | never |

---

## 2. Development slices

Every slice: **plan → implement → run → test → verify on the real Android phone → commit → next.** No slice is "mostly done." The first usable app appears at Slice 2, around day 3–4 of building.

| # | Slice | Done when |
|---|---|---|
| **0** | **Foundation** — Vite/TS/Tailwind, tokens, 4-tab routing, Dexie schema, event model, pure engine skeleton with injected clock, Vitest, Playwright, ESLint engine restrictions, PWA manifest + SW | Installs to Android home screen via WebAPK, navigates offline, `applyEvents([])` returns a valid empty state, ESLint fails if `Date.now()` is added to `engine/` |
| **1** | Onboarding + arc | Fresh install → initialised arc in < 90 s, stopwatch-verified. If-then sentences captured. Alarm setup screen renders. |
| **2** | **The core loop** — Today, quest instances, completion, undo, 04:00 rollover, 03:00 day-close | Complete a quest, kill the app, reopen — state correct. Rollover verified with a mocked clock across a 00:40 and a 03:05 boundary. |
| **3** | XP + levels + Moments | Property test: no event sequence yields > 700/day or negative XP. Curve table matches `01 §3` exactly. Level-up Moment fires in < 300 ms with haptic. |
| **4** | Failure system — MVD, streak, auto-grace, recovery, Reduced Mode, pause | Simulated 30-day sequence with 6 misses produces expected streak, grace count, mode transitions |
| **5** | Evening review + daily report + System Message generator | Review completes in < 25 s on the phone; correlation sentences render from real rollups |
| **6** | **Career subsystem** — applications, quality gate, substitute work, funnel, resume versions, follow-ups | Quality gate rejects duplicate `why_line`. **Invariant test: no external `career_event` produces a ledger row.** Funnel maths correct against a fixture. |
| **7** | DSA — log, outcomes, difficulty weighting, SRS, revisit quests, mastery states | 20 logged problems produce correct revisit dates; mastery transitions correct; Retained requires a ≥21-day gap |
| **8** | Foundations + BUILD — learning blocks, system design, LEARN/SHIP mode, artifacts, learn:ship rule | Rule fires at ratio > 3:1 and not otherwise; LEARN cap of 3 blocks/day holds |
| **9** | Physical + lifestyle — sessions, lifts, steps, weight, waist, sleep, attention, maintenance | Charts render 7-day mean + raw. **Assert no body metric writes a ledger row.** |
| **10** | Attributes + Progress | Six attributes match hand-computed fixtures; window sensitivity matches `01 §5`; REALITY defaults from Day 30 |
| **11** | Weekly review + rules engine | Fixture weeks produce expected bottleneck and proposals; each rule fires exactly on its condition |
| **12** | **Checkpoints + rank** | Day-30 fixture evaluates gates correctly; sealing blocked without export; sealed checkpoints reject writes; verdict text generated |
| **13** | Ship — bosses, achievements, identities, reflections seeded, export/import, **paper CSV importer**, alarm generation, install card, backup nudges, `persist()`, wake lock | Full 120-day arc simulation end-to-end; installed on your phone; one real day run through it |

**Load-bearing slices: 2, 3, 6, 12.** If time compresses, slices 7–11 can degrade (fewer attributes, simpler logging). **Slice 12 cannot degrade** — without checkpoints and rank gates this is a habit tracker.

### Effort estimate

| Slices | Hours | Calendar (evenings + weekends) |
|---|---|---|
| 0–2 | ~16 | Days 1–4 |
| 3–5 | ~13 | Days 5–8 |
| 6–8 | ~16 | Days 9–12 |
| 9–11 | ~14 | Days 13–16 |
| 12–13 | ~13 | Days 17–20 |

**≈ 72 hours, ~20 calendar days.** Starting 31 August puts a usable app in your hand around 8–10 September and a complete V1 around 20 September. Days 1–14+ come in via the paper CSV importer.

---

## 3. Testing strategy

### 3.1 Engine — the priority surface. Target > 90% coverage on `src/engine/`

Pure functions, no I/O, no mocks needed.

```
time.test.ts              ← highest risk for this user
  ✓ 00:40 completion → previous local_date       (you work until 02:00)
  ✓ 02:59 completion → previous local_date
  ✓ 03:05 → quests unavailable (day closed)
  ✓ 04:01 → new local_date
  ✓ device tz ≠ arc tz → arc tz wins
  ✓ DST fixture zone: no skipped or doubled day
  ✓ local_date never recomputed after write

xp.test.ts
  ✓ each core quest yields its exact XP (100/100/100/100/60/40 = 500)
  ✓ category cap trims and records capped_from
  ✓ daily cap 700 binds before the 885 category sum
  ✓ recovery (40) < original (100)
  ✓ property: ∀ event sequences, 0 ≤ daily XP ≤ 700        [fast-check]
  ✓ property: total_xp === SUM(ledger)                      [invariant]
  ✓ INVARIANT: no body metric_sample produces a ledger row
  ✓ INVARIANT: no external career_event produces a ledger row
  ✓ MVD = 35 and cannot be repeated within a day

level.test.ts
  ✓ req(n) matches the published table exactly (coefficient 84)
  ✓ boundary: exactly-enough levels up; one XP short does not
  ✓ multi-level-up in one grant handled
  ✓ simulated arcs reproduce the §3 outcome table (±1 level)

streak.test.ts
  ✓ MVD preserves streak · grace auto-applies, max 4 per rolling 28
  ✓ 5th miss in 28 breaks it · pause days excluded
  ✓ 2 consecutive misses → Reduced Mode; 2 MVD days → exit

rank.test.ts
  ✓ each gate evaluated correctly from fixtures
  ✓ missing-condition reporting is accurate
  ✓ no gate expression references an external outcome    ← structural test
  ✓ never regresses · sealed checkpoints immutable

career.test.ts
  ✓ quality gate: duplicate why_line rejected, empty rejected
  ✓ funnel conversion maths
  ✓ follow-through rate over a fixture
  ✓ low-response-rate rule reduces the application target

dsa.test.ts / srs.test.ts
  ✓ interval progression per outcome; reset on failure
  ✓ 3 revisits/day cap with oldest-first rollover
  ✓ mastery transitions; Retained requires ≥21-day gap; regression on failed revisit

attributes.test.ts   ✓ hand-computed fixtures; 28-day window sensitivity table
quests.test.ts       ✓ generation determinism: same inputs → identical quest set
rules.test.ts        ✓ each rule fires exactly on its condition; learn:ship at 3:1
messages.test.ts     ✓ cooldown; no `challenging` tone post-lapse;
                       System Message beats reflection when available
reduce.test.ts       ✓ replay determinism: applyEvents(log) twice → identical state
                     ✓ idempotency: duplicate idem_key is a no-op
```

**The golden fixture.** A recorded 120-day event log, asserted against a snapshot of final state:

```
same event log + same configuration = same resulting state
```

Any rule change that alters historical outcomes fails loudly. Regenerating the snapshot is a deliberate, reviewed act. This is the test that makes the whole architecture worth it.

### 3.2 Integration — Playwright, Chromium + mobile viewport

```
✓ fresh install → onboarding → first quest complete
✓ offline from first launch (network disabled before load)
✓ complete quest → reload → state persists
✓ 04:00 rollover with a mocked clock
✓ 03:00 day-close hides quests
✓ export → wipe IndexedDB → import → state identical
✓ paper CSV import produces correct events
✓ SW update flow does not lose an in-flight event
✓ tap → XP feedback rendered < 300 ms          ← performance assertion
✓ 200% dynamic type: no clipping on any screen
✓ prefers-reduced-motion: all animation off, all function intact
```

### 3.3 Real Android device — manual, per slice

Automation can't check these, and they decide whether you keep using it.

```
[ ] Installs to home screen as a WebAPK; icon and splash correct
[ ] Cold start to Today < 1.2 s
[ ] Tap → XP feedback feels instant
[ ] Haptics fire on Moments and feel right, not toy-like
[ ] Every primary action reachable one-handed with your thumb
[ ] Onboarding < 90 s (stopwatch)
[ ] Evening review < 25 s (stopwatch)
[ ] Airplane mode 48 h: nothing degrades
[ ] Readable at 02:00 in a dark room without hurting
[ ] Wake lock holds during a deep-work timer
[ ] Nothing anywhere uses the word "failed"
```

### 3.4 Data integrity

`verifyIntegrity()` dev command — rebuild all projections from the event log, diff against cached, assert identity. **Run at the end of every slice.**
Reducer fuzz — 10,000 random valid event sequences, assert invariants (XP non-negative, level monotonic, streak bounded, no outcome-derived XP).

---

## 4. Definition of done, per slice

1. Zero TypeScript errors (strict), zero ESLint warnings
2. All tests pass, including the golden 120-day fixture
3. Manually verified on the real Android phone, offline
4. `verifyIntegrity()` clean
5. No new runtime dependency without an explicit justification in the commit
6. Commit message carries the slice number

---

## 5. The rule that protects the arc

Once V1 ships, **changes are permitted only at checkpoints, driven by checkpoint data — not by ideas.** Feature thoughts go in `IDEAS.md`, not the codebase.

The highest-probability failure of this entire project is not that the app is bad. It is that building the app becomes more interesting than running the arc. Timebox the build to ~72 hours and hold the line.
