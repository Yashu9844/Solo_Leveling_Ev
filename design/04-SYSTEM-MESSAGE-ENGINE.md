# SYSTEM — Dynamic System Message Engine ("the Transmission")

> Companion to `design/00-DESIGN-SYSTEM.md` (visual language), `design/02-NAVIGATION-FLOW.md`
> (routes and transitions) and `final/05-motivation-moments-notifications.md` (the existing
> motivation layer this integrates with rather than replaces).
>
> Scope: when the Player opens the app, the SYSTEM states the Player's current condition in
> its own voice — cold, precise, short, and *earned by the data*. Fully offline, fully
> deterministic, zero network, zero LLM.

---

## 1. Current architecture findings

| Area | What exists today | Consequence for this feature |
| --- | --- | --- |
| Event model | Append-only `db.event` log, 31 `EventType`s (`src/engine/types.ts`), `idem_key` per event. Includes **`APP_OPENED`**, already written once per `local_date` by `loadTodayQuests`. | The "app was opened today" fact is already recorded. Nothing new to emit; the engine *reads* this log, never adds to it. |
| Derivation | `applyEvents(events, config)` → `EngineState`; `rebuildProjections()` rebuilds `quest_template`, `quest_instance`, `xp_ledger`, `day_rollup`, `player_state` from the log on every write. One code path, no drift. | The message context must be **derived**, never recomputed by hand. `day_rollup` is the single richest row. |
| Day boundary | `src/engine/time.ts` — `localDate()` shifts by `dayBoundaryHour` (04:00) before reading the wall clock; `isDayClosed()` covers 03:00→04:00. Timezone is `Asia/Kolkata` in `DEFAULT_CONFIG.arc`. | **IST is already the app's definition of time.** The message engine must consume `config.arc`, never `new Date().getHours()`, and must not invent a second definition of "day". |
| Daily state | `db.day_rollup` per `local_date`: `xp_earned`, `core_completed`, `core_total`, `mvd_met`, `reduced_mode`, `grace_applied`, `deep_minutes`, … | Progress state is one `db.day_rollup.get(today)` — no new aggregation logic. |
| Player state | `PlayerState`: `total_xp`, `level`, `xp_into_level`, `xp_for_next`, `rank`, `arc_streak`, `consistency_7/28`, `grace_remaining`. `levelFor()` is pure. | Level/rank/streak proximity are reads, not calculations. |
| Streak / reduced mode | `store/streak.ts` → `LiveStreakState { arc_streak, grace_remaining, reduced_mode, consistency_7/14/28 }`. | `reduced_mode` is the authoritative Reduced Mode flag. |
| Recovery | `store/recovery.ts` → `getRecoverableDay()` returns yesterday's recoverable state or `null`. | Authoritative post-lapse signal; already drives Today's recovery card. |
| Checkpoints / rank | `engine/rank.ts` — checkpoints at days **14, 30, 60, 90, 120**; `store/checkpoint.ts` → `getCurrentRank()`. | Checkpoint proximity = `arcDay` vs that ladder. No new schedule. |
| Existing message layer | `engine/messages.ts` (`selectMessage` P1–P5, evidence with real numbers) + `engine/reflections.ts` (64-line reflection library, `db.reflection_state` show-state) + `store/messages.ts` `getTodaySystemLine()` → rendered on Today as `data-testid="system-line"`. | **Do not duplicate.** That layer is *evidence about your data* in sentence case. The new layer is *the System addressing you* in its own voice. They stack; they don't compete. |
| UI vocabulary | `ui/kit/SystemWindow.tsx` — a bordered pane with corner brackets that **materialises** (frame snap → scan line → content rise), all in CSS, collapsed to nothing by the reduced-motion rules in `index.css`. | The transmission surface already exists. Reuse it; do not build a new card. |
| Motion policy | `data-motion` (`reduced` / `full` / `system`) drives both the CSS rules in `index.css` and framer-motion via `ui/MotionRoot.tsx`. | Reduced-motion support is free if the animation stays in CSS. |
| Test contract | `design/00 §10`: 29 testids, `role="navigation"` + `aria-label="Primary"`, route paths, IndexedDB name `system-arc`, asserted strings. `tests/e2e/reflections.spec.ts` asserts `system-line` is visible and non-empty. | The transmission is **additive**. `system-line` keeps its meaning, its position and its content source. |

### 1.1 The one thing that must not happen

The app already has a "line of text under the priority line". Adding a second one that says
roughly the same thing in a different tone would make Today noisier and both lines weaker. The
resolution below is structural, not cosmetic: the two lines occupy **different registers** —

- **Transmission** (new): the System *states the Player's condition*. Uppercase, display type, one clause. `THE DAY IS NOT YET SEALED.`
- **System line** (existing, unchanged): evidence with numbers, or a reflection. Small, dim, italic, clamped to two lines. `Longest deep block yet: 95 minutes.`

---

## 2. Existing systems reused (nothing re-implemented)

1. `engine/time.ts` — `localDate`, `isDayClosed`, `arcDay`. The only source of "when".
2. `DEFAULT_CONFIG.arc` — timezone, `dayBoundaryHour`, `dayCloseHour`, `startDate`, `endDate`.
3. `db.day_rollup` — today's XP and core completion.
4. `store/playerState.ts` + `engine/level.ts` — level, XP into level, XP for next.
5. `store/streak.ts` — streak, reduced mode, consistency.
6. `store/recovery.ts` — recoverable day (post-lapse).
7. `store/checkpoint.ts` — current rank.
8. `db.event` — recent `LEVEL`-relevant events for the EVENT tier (`BOSS_CLEARED`, `CHECKPOINT_SEALED`, `WEEKLY_QUEST_COMPLETED`, `QUEST_RECOVERED`, `REVIEW_COMPLETED`), read by `local_date`.
9. `ui/kit/SystemWindow.tsx` — the arrival animation.
10. `db.reflection_state` pattern — copied exactly for the new show-state table.

Nothing in the XP, quest, level, rank, checkpoint, boss, streak or review engines is modified.
The feature is **read-only over the existing derived state**.

---

## 3. New components required

| Layer | File | Responsibility |
| --- | --- | --- |
| Pure engine | `src/engine/systemVoice.ts` | Types, taxonomy, phase/band derivation, priority resolution, deterministic selection, fingerprinting. No I/O, no clock, no Dexie. |
| Content | `src/engine/voicePack.ts` | The message library. Static data only. |
| Store | `src/store/systemMessage.ts` | Builds the context from Dexie + config + clock, caches the selection by fingerprint, records shows. |
| Persistence | `src/db/schema.ts`, `src/db/db.ts` | `system_message_state` (per-message show state) and `system_transmission` (today's resolved selection). Dexie `version(4)`, additive. |
| UI | `src/ui/today/SystemTransmission.tsx` | The surface. |
| Wiring | `src/ui/screens/Today.tsx` | One state hook, one call inside the existing `refresh()`, one element. |

---

## 4. New data model

```ts
// engine/systemVoice.ts

type DayPhase   = 'MORNING' | 'MIDDAY' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'CLOSED';
type ProgressBand = 'ZERO' | 'STARTED' | 'BUILDING' | 'HALFWAY' | 'ADVANCING' | 'NEAR_CLEAR' | 'CLEARED';
type MessageTier  = 'EXCEPTION' | 'EVENT' | 'RECOVERY' | 'CLEARED' | 'MILESTONE' | 'PROGRESS' | 'DEFAULT';

interface SystemMessage {
  id: string;            // stable, kebab, e.g. 'afternoon-zero-003'
  text: string;          // the line. Uppercase. One clause. No emoji.
  tier: MessageTier;
  label: string;         // the ⟨ … ⟩ context label rendered above it
  tone: MessageTone;     // 'awakening' | 'neutral' | 'pressure' | 'momentum' | 'closing' | 'verdict' | 'restraint'
  phases?: DayPhase[];   // omitted = any phase
  bands?: ProgressBand[];// omitted = any band
  when?: (c: SystemMessageContext) => boolean;  // extra guard for MILESTONE/EVENT/RECOVERY
  minStreak?: number;
  minArcDay?: number;
  cooldownDays?: number; // default 9
  weight?: number;       // default 1
}

interface SystemMessageContext {
  localDate: string;      // the 04:00-boundary date — never the raw calendar date
  arcDay: number;
  minutesOfDay: number;   // IST wall clock, 0–1439
  phase: DayPhase;
  dayClosed: boolean;
  arcState: 'before' | 'active' | 'after';

  xpEarned: number;
  xpTarget: number;       // Σ config.coreQuests.xp — 500, derived, never hard-coded
  progressPct: number;    // 0–100, clamped
  band: ProgressBand;
  coreCompleted: number;
  coreTotal: number;
  firstActionOfDay: boolean;   // exactly one core cleared

  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  rank: Rank;
  streak: number;
  consistency7: number;

  reducedMode: boolean;
  recoveryAvailable: boolean;
  mvdMet: boolean;

  daysToCheckpoint: number | null;  // to the next of 14/30/60/90/120
  eventsToday: EventType[];
  yesterdayCleared: boolean | null;
  daysSinceLastOpen: number | null; // for RETURN AFTER ABSENCE
}
```

`db` rows (additive, Dexie `version(4)`, no migration needed — Dexie carries unlisted stores forward):

```ts
system_message_state: 'id, last_shown_date'   // { id, times_shown, last_shown_date }
system_transmission:  'local_date'            // { local_date, fingerprint, message_id, chosen_at }
```

---

## 5. Quote library structure

`src/engine/voicePack.ts` exports one `SystemMessage[]`, built through a terse factory so an
entry is one readable line, the same shape `engine/reflections.ts` already uses:

```ts
m('morning-zero-001', 'A NEW DAY HAS BEEN REGISTERED.', 'PROGRESS', 'DAY OPEN', 'awakening',
  { phases: ['MORNING'], bands: ['ZERO'] }),
```

Grouped by tier, then phase, then band, with a section comment per group. ~150 entries,
statically bundled (see §18 — it is ~14 KB of string data; a lazy chunk would cost a round
trip on the app's most important paint).

---

## 6. Message taxonomy

| Tier | Groups |
| --- | --- |
| EXCEPTION | `DAY CLOSED` · `ARC NOT STARTED` · `ARC CONCLUDED` |
| EVENT | `LEVEL BREACHED` · `RANK ADVANCED` · `BOSS CLEARED` · `CHECKPOINT SEALED` · `WEEKLY QUEST CLEARED` · `REVIEW FILED` |
| RECOVERY | `REDUCED MODE` · `RECOVERY AVAILABLE` · `POST-FAILURE` · `RETURN AFTER ABSENCE` |
| CLEARED | `DAY CLEARED` · `CLEARED EARLY` · `CLEARED WITH STREAK` |
| MILESTONE | `LEVEL PROXIMITY` · `CHECKPOINT PROXIMITY` · `STREAK 3 / 7 / 14 / 30` · `ARC MIDPOINT` · `FINAL WEEK` |
| PROGRESS | MORNING × {ZERO, STARTED, BUILDING, ADVANCING, NEAR_CLEAR} · MIDDAY × {ZERO, STARTED, BUILDING, HALFWAY, ADVANCING, NEAR_CLEAR} · AFTERNOON × same · EVENING × same · NIGHT × {ZERO, STARTED, BUILDING, ADVANCING, NEAR_CLEAR} · `FIRST ACTION` · `FINAL CONDITION` (exactly one core left) |
| DEFAULT | `STATUS` — always eligible, phase-agnostic, the guaranteed floor |

Every tier above DEFAULT may be empty at runtime; DEFAULT never is. `selectSystemMessage`
therefore always returns a message and never `null`.

---

## 7. IST time-window design

Derived from `config.arc`, not hard-coded — the windows below are the defaults that fall out of
`dayBoundaryHour: 4` / `dayCloseHour: 3`:

| Window | IST | Rationale |
| --- | --- | --- |
| `MORNING` | 04:00 – 10:59 | Starts at the day boundary so the first minute of the new day is a *new day*, not "night". |
| `MIDDAY` | 11:00 – 13:59 | |
| `AFTERNOON` | 14:00 – 17:59 | The turn — half the day is gone. |
| `EVENING` | 18:00 – 21:59 | The final push. |
| `NIGHT` | 22:00 – 02:59 | Closure. Ends at `dayCloseHour`. |
| `CLOSED` | 03:00 – 03:59 | **Not a window of its own** — `isDayClosed(now, config)` decides it, so there is exactly one definition of a closed day. |

A phase is computed from the IST wall clock via `formatInTimeZone`, and `CLOSED` overrides
whatever the clock says. If `dayCloseHour`/`dayBoundaryHour` are ever re-tuned, `NIGHT` follows
them; the other four boundaries are voice decisions and stay as constants in the engine.

---

## 8. Progress-state model

`progressPct = clamp(round(100 × xpEarned / xpTarget), 0, 100)` where `xpTarget = Σ config.coreQuests[*].xp` (500 today).

| Band | Rule | Narrative |
| --- | --- | --- |
| `CLEARED` | `coreCompleted === coreTotal` — **quest truth, not XP truth** | the clear |
| `NEAR_CLEAR` | pct ≥ 80 | the final condition |
| `ADVANCING` | 65 ≤ pct < 80 | the run |
| `HALFWAY` | 50 ≤ pct < 65 | momentum |
| `BUILDING` | 21 ≤ pct < 50 | movement |
| `STARTED` | 1 ≤ pct < 21 | first step |
| `ZERO` | pct === 0 | absence |

`CLEARED` deliberately keys off `core_completed === core_total` rather than 100% XP: bonus XP
can push a day past 500 without every core quest being cleared, and the System must never
announce a clear the engine has not granted. `firstActionOfDay` (`coreCompleted === 1`) is
carried separately so the first clear of the day can be recognised regardless of band.

---

## 9. Message priority system

Resolved top-down; the **first non-empty tier wins**, and within a tier the selection of §10
runs. Fully explainable: every returned message carries the tier and the fingerprint that
produced it.

```
1 EXCEPTION   day closed · arc not yet started · arc concluded
2 EVENT       something irreversible happened today (boss, checkpoint, rank, level, weekly)
3 RECOVERY    reduced mode · recoverable day pending · return after ≥2 days absent
4 CLEARED     every core quest complete
5 MILESTONE   level within 60 XP · checkpoint within 2 days · streak hits 3/7/14/30 · final week
6 PROGRESS    phase × band — the everyday matrix
7 DEFAULT     neutral status, always available
```

Two rules that make the hierarchy feel right rather than merely ordered:

- **RECOVERY outranks CLEARED-adjacent pressure, never CLEARED itself.** A Reduced Mode day that
  is nonetheless cleared gets the clear. Recovery is a frame for an unfinished day, not a label
  stapled over a finished one.
- **MILESTONE never fires at `ZERO`.** "THE NEXT THRESHOLD IS 40 XP AWAY" at 0% on an untouched
  afternoon is the System bragging on the Player's behalf. Proximity messages require movement.

---

## 10. Message selection algorithm

```
selectSystemMessage(ctx, history) -> { message, tier, fingerprint }

1. fingerprint = `${tier}|${phase}|${band}|${streakBucket}|${flags}`   (see §11)
2. for tier in PRIORITY_ORDER:
3.     pool = VOICE_PACK.filter(m => m.tier === tier
                                  && (!m.phases || m.phases.includes(ctx.phase))
                                  && (!m.bands  || m.bands.includes(ctx.band))
                                  && (!m.minStreak || ctx.streak >= m.minStreak)
                                  && (!m.minArcDay || ctx.arcDay >= m.minArcDay)
                                  && (!m.when || m.when(ctx)))
4.     if pool is empty: continue
5.     fresh = pool.filter(m => daysSince(history[m.id]?.last_shown_date, ctx.localDate) >= (m.cooldownDays ?? 9))
6.     candidates = fresh.length ? fresh : pool          // cooldown yields rather than starves
7.     rank by: fewest times_shown  ->  highest weight  ->  seeded hash order
8.     return the winner
```

Step 7's third key is `fnv1a(`${ctx.localDate}|${fingerprint}|${m.id}`)`. It is a *hash*, not a
random number: the same Player, the same day, the same state always yields the same message —
reloadable, screenshot-stable, and reproducible in a test — while a different day or a different
state reorders the pool. This is what gives the System a large apparent vocabulary without
`Math.random()` anywhere in the path.

---

## 11. Anti-repetition strategy

Four mechanisms, in increasing scope:

1. **Fingerprint caching** (§12) — inside one state, the message is *fixed*. It cannot flicker.
2. **Per-message cooldown** — default 9 days, stored in `system_message_state.last_shown_date`.
   Exception-tier and event-tier lines use shorter cooldowns (3 days) because their pools are
   small and their triggers are rare.
3. **Least-shown-first ranking** — `times_shown` is the primary sort key, so the library is
   traversed broadly before any line repeats.
4. **Day-seeded hash tiebreak** — breaks ties differently each day, so a fresh install does not
   walk the library in alphabetical order.

Starvation is impossible: if every line in a tier is inside its cooldown, step 6 falls back to
the full pool rather than dropping to a lower tier — a slightly-early repeat beats the System
saying the wrong thing about the Player's state.

---

## 12. App-open trigger strategy

The message is **a pure function of (localDate, fingerprint)**, cached in
`db.system_transmission` keyed by `local_date`.

```
resolveTransmission():
  ctx  = buildContext()                     // one Dexie read set, ~4 gets
  fp   = fingerprint(ctx)
  row  = db.system_transmission.get(ctx.localDate)
  if row && row.fingerprint === fp:  return the cached message   // no re-roll, no write
  pick = selectSystemMessage(ctx, history)
  persist row {local_date, fingerprint, message_id, chosen_at}
  bump system_message_state[message_id]
  return pick
```

Consequences, exactly as required:

| Trigger | Behaviour |
| --- | --- |
| Cold app launch / PWA resume | Context rebuilt, fingerprint compared. Same state → same message. |
| Page refresh (F5) | Same message. The cache is in IndexedDB, not memory. |
| React re-render | Never re-evaluates — the message lives in `useState`, set once per `refresh()`. |
| Route navigation Today → Skills → Today | `Today` remounts and calls `refresh()`; the fingerprint is unchanged, so the same message returns. |
| Tab visibility / window focus | Existing handler only re-runs `refresh()` when the **local date changed** (the 04:00 rollover). Unchanged. |
| Completing a quest | `refresh` is not re-run, but the transmission is re-resolved after the XP refresh. Crossing a band boundary (e.g. 49% → 50%) changes the fingerprint and the System speaks again. Staying inside a band changes nothing. |
| Crossing a phase boundary without acting | Next `refresh()` (i.e. next open) picks it up. The System does not shout at an idle screen — a message that changes while nobody is looking is a notification, and notifications are out of scope here. |

---

## 13. Event-integration strategy

No new event type, no new emitter. The EVENT tier reads the existing log:

```ts
const eventsToday = await db.event.where('local_date').equals(today).toArray();
```

filtered to the types that mean *something irreversible happened*: `BOSS_CLEARED`,
`CHECKPOINT_SEALED`, `WEEKLY_QUEST_COMPLETED`, `REVIEW_COMPLETED`, `QUEST_RECOVERED`. Level-up
and rank change are not events in this codebase (they are derived from `total_xp` and from
checkpoint seals), so:

- **Level breached today** — compare `levelFor(totalXp)` against `levelFor(totalXp - xpEarnedToday)`. Pure, no new state.
- **Rank advanced** — a `CHECKPOINT_SEALED` event today, whose gate result the checkpoint row already carries.

The transmission never *replaces* a Moment. `LevelUpMoment`, `DayCompleteMoment` and the
checkpoint Moments keep their ceremony; the transmission is what the System says on the *next*
open, after the ceremony is over — the report, not the event.

---

## 14. State persistence strategy

| What | Where | Why |
| --- | --- | --- |
| Per-message show state (`times_shown`, `last_shown_date`) | `db.system_message_state` | Exactly mirrors `db.reflection_state`; survives reinstall via the existing snapshot export. |
| Today's resolved transmission | `db.system_transmission` (keyed `local_date`) | Makes refresh-stability durable rather than in-memory. Rows are per-day and tiny; the arc produces ≤120 of them. |
| Anything about *preference* | not stored | There is none. |

Neither table is an event. Per `design/00 §10`, settings and device state must never enter the
event log — and "which sentence was displayed" is device state, not evidence about the arc.
`verifyIntegrity()` is untouched.

---

## 15. UI / UX design

Placement: directly under the Today header block, **above** the existing DAILY QUEST window —
the System speaks before it lists requirements.

```
┌─ ⟨ SYSTEM · DAY OPEN ⟩ ─────────────────────┐
│                                              │
│   A NEW DAY HAS BEEN                         │   ← display face, uppercase,
│   REGISTERED.                                │     tracking 0.06em, 2 lines max
│                                              │
│   ───────────────────────────────            │   ← hairline, fades at both ends
│   DAY 07 · 0/6 CLEARED · 0/500 XP            │   ← mono, 9.5px, --faint
└──────────────────────────────────────────────┘
```

- Built on `SystemWindow` (`arrive` on), so it materialises the way every other System utterance
  in the app does. No new frame vocabulary.
- Tone mapping is deliberately narrow. `design/00 §2.2` bans the Gold Horizon mood from every
  daily-loop screen and §2.3 reserves red for BOSS surfaces — and Today *is* the daily loop — so
  the only split is amber (`recover`) for the states that already own amber on this screen (the
  recovery card, the day-closed banner). Everything else is the arc's blue. A System that
  changes colour for emphasis is a System whose colours mean nothing. `verdict` and `momentum`
  lines instead take the existing `--glow-text` on the headline.
- The metadata strip is deliberately numeric and affectless. It is the receipt under the decree,
  and it is what makes the line read as *measured* rather than *asserted*.
- `role="status"` so a screen reader announces it once when it lands, without stealing focus.
- `data-testid="system-transmission"`.

What it must never look like: a quote card (no quotation marks, no attribution, no serif italic
centred block), a toast (it does not dismiss), or a banner (it is not an alert colour).

---

## 16. Motion / animation plan

All CSS, all inside the existing keyframes in `index.css` — nothing new, and nothing whose final
state depends on JavaScript reaching the last frame:

| Step | Timing |
| --- | --- |
| Frame snap (`system-frame-in`) | 260 ms, `--ease-system` |
| Corner brackets (`system-bracket-in`) | 220 ms, staggered 30 ms |
| Scan line, one pass (`system-scan`) | 620 ms, starts at 120 ms |
| Content rise (`system-content-in`) | 240 ms, starts at 160 ms |
| Text reveal | the content rise **is** the reveal — no per-character typing |

Total ≈ 780 ms, front-loaded, and the text is legible from frame one because it rises 6 px with
an opacity ramp rather than being typed in. Opening the app must feel fast; a teletype effect
would hold the most important line on the screen hostage for a second.

The whole block re-plays **only when the fingerprint changes** (React `key={fingerprint}`), so
navigating back to Today does not re-announce a decree the Player has already read.

---

## 16.1 The spoken voice

The line is also **said out loud**, once per app open, in a Sung Jin-Woo character voice.

### Two engines, in order

1. **The rendered pack** — `/voice/<message id>.mp3`, one clip per line in `engine/voicePack.ts`,
   pre-rendered by `scripts/generate-voice-pack.mjs` (`npm run voice`) through Fish Audio. This
   is what the Player normally hears.
2. **The device's own `speechSynthesis`** — flat and synthetic, but always present. It covers a
   line whose clip is missing, a checkout that has never rendered the pack, and any device where
   audio playback fails. The System is never silent for want of a file.

### Why a build step and not an API call from the app

This was not a preference. `api.fish.audio` **serves no CORS headers** — its preflight returns
404 — so a browser cannot call it at all. Beyond that, three reasons make the build step the
better design even if CORS were open:

- The library is **166 fixed lines**. They do not vary by Player, by day or by state, so there
  is nothing to synthesise at runtime. Rendering the same 166 files on every device forever
  would be a per-play wait (~2 s measured) and a per-play cost for an identical result.
- **No API key reaches the client.** A key in a bundle is a key anyone who opens devtools can
  spend. The key lives in `.env.local` (gitignored) and is read only by Node, at render time.
- **Offline-first survives** (§18). Static files on the app's own origin are cached by the
  service worker; a live TTS call would have put a network dependency on the app's first breath.

### Voice and model

`FISH_VOICE_ID` in `.env.local`, default `a6aabeb8…` — the most-used public Sung Jin-Woo model
on the platform at time of writing (37 likes / 23.7k generations), English, described as deep
and authoritative. Rendered with **`s2.1-pro-free`**: the paid models answer `402 Insufficient
API credit` on a zero balance, and this one is the dashboard's "S2.1 Pro is now free for
developers". 64 kbps mono — transparent for speech, and half the storage of 128.

### Caching

`/voice/*.mp3` is **runtime CacheFirst**, not precached — exactly the treatment, and for exactly
the reason, that `.webp` art already gets (`vite.config.ts`): the pack is 4.8 MB across 166
clips and a Player hears one or two lines a day, so precaching all of it would make every
install pay for 164 sentences it will not hear that week. Each clip is permanent once heard, so
the lines this Player's actual states produce accumulate offline within days.

### The gesture problem

Browsers reject `audio.play()` **and** drop `speechSynthesis` calls until the document has seen
a user interaction, and a PWA launched from the home screen has seen none. So the first attempt
is *expected* to fail on a phone. `armOnFirstGesture` wraps both engines: the line is **armed
rather than lost**, and says itself at the Player's first touch. For `speechSynthesis` the check
is the `start` event and never `speechSynthesis.speaking` — a browser holding an utterance back
reports `speaking === true` while nothing is audible, which would suppress the fallback in
precisely the case it exists for.

### Trigger and settings

Keyed on the same fingerprint as the surface, in a module-level set: a page reload is a new app
open and the System greets you again; a re-render, a tab round trip or a quest toggle inside one
state is not. There is no cancel on unmount — these lines run three or four seconds, and cutting
one off to move to Skills reads as a glitch rather than as tidiness; overlap is impossible
anyway, since both engines stop whatever is playing before they start.

`settings.voice`, default on, in Appearance → Voice, with a Play button that previews a real
library line (`cleared-001`) rather than a bespoke recording — so the preview cannot flatter a
pack that is missing, and tapping it doubles as the gesture that unlocks audio on a phone.
Unlike every other field in `Settings` it is **not** stamped on the root element: no CSS keys
off it, and `applyToRoot`'s output is part of the theming contract.

### What is not in the repository

The rendered pack is a **local artifact**, gitignored alongside `.env.local`. It is ~5 MB of
cloned character audio, which belongs on the Player's own machine rather than published in a
public repo, and it is reproducible in one command. A fresh clone therefore speaks in the device
voice until `npm run voice` is run.

---

## 17. Reduced-motion behaviour

`index.css` already collapses every `animation-duration`/`transition-duration` to `0.01ms`
under `[data-motion='reduced']` and under `prefers-reduced-motion` when the setting is not
`full`. Because every part of §16 is a CSS animation on an element that is *already in its final
layout position*, the reduced-motion rendering is the finished block, instantly — no hidden
text, no stranded opacity, nothing to re-enable. The message is fully understandable with zero
animation, which is the acceptance test.

---

## 18. Performance considerations

- **Library cost**: ~150 × ~90 bytes ≈ 14 KB raw, ~4 KB gzipped, statically bundled. Lazy-loading
  it would cost a network/disk round trip on the app's most important paint and save less than
  one small image. Bundle it.
- **Selection cost**: one pass over ≤150 objects with cheap predicates, plus one FNV-1a per
  candidate. Sub-millisecond; it runs at most a few times per day.
- **I/O cost**: one `day_rollup.get`, one `player_state` read, one `system_transmission.get`,
  one `system_message_state.toArray()` (≤150 tiny rows), one indexed `event.where('local_date')`.
  All of it runs inside the `refresh()` that Today already performs, in parallel with the existing
  `Promise.all`, adding no serial latency.
- **No** rAF loops, no timers, no polling, no network.
- Cache hit (same fingerprint) performs **zero writes**.

---

## 19. Test plan

**Unit — `tests/engine/systemVoice.test.ts` (pure, no Dexie)**

1. Content integrity: unique ids · every tier populated · every phase×band cell in the PROGRESS tier has ≥2 candidates · every text is uppercase-normalised, ≤ 64 chars, ends in `.` · no message references a real-world trademark or a second-person insult.
2. Phase derivation across the IST day, including the 03:00 closed window and the 04:00 boundary.
3. Band derivation at every boundary value (0, 1, 20, 21, 49, 50, 64, 65, 79, 80, 99, 100) and the `CLEARED` quest-truth rule.
4. Priority: each tier's trigger beats every lower tier; `MILESTONE` suppressed at `ZERO`; `CLEARED` beats `RECOVERY`.
5. Determinism: same context + same history ⇒ identical message, 1000 iterations.
6. Variety: 30 consecutive days of the same context produce ≥ 10 distinct messages.
7. Cooldown: a message shown today is not reselected tomorrow while others are fresh; when all are exhausted the pool yields rather than returning `null`.
8. Totality: `selectSystemMessage` never returns `null` for any (phase × band × flags) combination — exhaustive product test.

**Integration — `tests/engine/systemMessage-store.test.ts`** (fake-indexeddb, the `*-store.test.ts` convention every Dexie-backed module in this repo already uses; `vitest.config.ts` only collects `tests/engine/**`)

9. Same fingerprint ⇒ cached row reused, `times_shown` not double-incremented.
10. Band crossing ⇒ new selection persisted.
11. New local date ⇒ new row, old row retained.

**E2E — `tests/e2e/system-message.spec.ts`**

12. Transmission visible on Today after onboarding, non-empty, uppercase.
13. Stable across reload and across a Today → Skills → Today round trip.
14. Changes after completing enough quests to cross a band boundary.
15. Reduced motion: visible and readable with `prefers-reduced-motion: reduce`.

**Regression**: the full existing suite — in particular `reflections.spec.ts` (the `system-line`
contract) and `responsive.spec.ts` (Today's above-the-fold height budget at 320px).

---

## 20. Edge cases

| Case | Handling |
| --- | --- |
| Arc not yet started (`localDate < arc.start_date`) | EXCEPTION tier — `⟨ STANDBY ⟩ THE ARC HAS NOT BEGUN.` |
| Arc concluded | EXCEPTION tier — final-report language, no urgency. |
| Day closed (03:00–04:00) | EXCEPTION tier. Never an urgency line: nothing can be logged. |
| No `day_rollup` row yet (first open of a fresh day) | Treated as zeros, not as missing. |
| No arc at all (pre-onboarding) | The component is not rendered; Today already returns early. |
| Clock skew / device timezone ≠ IST | Irrelevant — every computation goes through `formatInTimeZone(config.arc.timezone)`. |
| 100% XP but a core quest incomplete | Band is not `CLEARED` (§8). |
| Reduced Mode **and** day cleared | CLEARED wins (§9). |
| Streak milestone and level proximity on the same day | Streak wins — it is the rarer fact; both are MILESTONE, ordered within the tier. |
| Returning after N days absent | `daysSinceLastOpen` from the newest prior `APP_OPENED`; ≥ 2 triggers RETURN AFTER ABSENCE. |
| Library entry disabled/removed in a later version while cached in `system_transmission` | Resolution falls back to a fresh selection when the cached id is not found. |
| IndexedDB write fails (private mode, quota) | Selection still returns; persistence is wrapped and failure is non-fatal — the message is never gated on a write. |

---

## 21. Files modified

1. `src/db/schema.ts` — `SCHEMA_V4_ADDITIONS`, `SystemMessageStateRow`, `SystemTransmissionRow`.
2. `src/db/db.ts` — two `Table` declarations, `this.version(4)`.
3. `src/ui/screens/Today.tsx` — two imports, one state pair, one `refreshTransmission` callback, three call sites (`refresh()`, after a quest toggle, after a recovery claim) and one element above the DAILY QUEST window.

Nothing else. No engine, no store, no existing component is edited.

## 22. Files created

1. `src/engine/systemVoice.ts`
2. `src/engine/voicePack.ts`
3. `src/store/systemMessage.ts`
4. `src/ui/today/SystemTransmission.tsx`
5. `tests/engine/systemVoice.test.ts` (36 tests)
6. `tests/engine/systemMessage-store.test.ts` (12 tests)
7. `tests/e2e/system-message.spec.ts` (5 tests)
8. `design/04-SYSTEM-MESSAGE-ENGINE.md` (this document)

---

## 23. Implementation phases

| Phase | Work | Gate |
| --- | --- | --- |
| P1 | `engine/systemVoice.ts` — types, phase/band/fingerprint, priority + selection. | Unit tests 2–8 pass against a stub library. |
| P2 | `engine/voicePack.ts` — the full library. | Unit test 1 (content integrity) passes; every phase×band cell populated. |
| P3 | `db` v4 + `store/systemMessage.ts`. | Integration tests 9–11 pass. |
| P4 | `ui/today/SystemTransmission.tsx` + Today wiring. | E2E 12–15 pass. |
| P5 | Full `npm run verify` + responsive sweep at 320/360/430. | Suite green, no height regression on Today. |

---

## 24. Risks / regressions

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Today's above-the-fold budget (`final/06 §5.2`, measured at 412×915) overflows | **High** | The block is two lines of text plus a 12 px metadata strip inside an existing card idiom (~86 px). The headline is `line-clamp-2` so length cannot change the height. Verified by `responsive.spec.ts` at 320 px. |
| Two message lines read as redundant | Medium | §1.1 — different register, different weight, different source. Reviewed on-device before ship. |
| Dexie `version(4)` breaking existing installs | Medium | Additive-only, the pattern v2 and v3 already used; Dexie carries unlisted stores forward with no `.upgrade()`. Existing data untouched. |
| Voice drifts into coaching | Medium | Content integrity test bans second-person imperatives outside the sanctioned set, and every line is reviewed against §25's voice rules. |
| Message flicker on quest toggle | Medium | Fingerprint cache — a toggle inside a band is a no-op. |
| The System says something false about the Player's state | **High** | Every predicate reads derived engine state; none re-derives. `CLEARED` keys off quest truth. Covered by tests 3–4. |

---

## 25. Acceptance criteria

1. Opening the app at 07:15 IST with 0/500 XP and opening it at 14:30 IST with 0/500 XP produce **materially different** messages.
2. 0% and 20% at the same hour produce different messages.
3. A cleared day never shows a "start now" message; a zero day never shows a "nearly there" message.
4. Reduced Mode and recoverable-day states never produce a "push harder" message.
5. The same state on the same day produces the same message across reload, re-navigation and re-render — verified in e2e.
6. Thirty simulated consecutive identical days produce at least ten distinct messages.
7. No `Math.random()`, no `fetch`, no `import()` of a remote module anywhere in the feature.
8. The feature works with the network disabled and IndexedDB already populated.
9. `prefers-reduced-motion: reduce` renders the finished block with no animation and no loss of meaning.
9a. The line is spoken once per app open when `settings.voice` is on, in the best English voice the device has, and never repeats on a re-render or a tab round trip. With the setting off, nothing is ever spoken.
10. `npm run verify` is green, including every pre-existing test.
11. Every message is original; none is a quotation from any published work.

---

## 26. Sample quote-library structure

```ts
// src/engine/voicePack.ts
import type { SystemMessage } from './systemVoice';

const m = (
  id: string,
  text: string,
  tier: SystemMessage['tier'],
  label: string,
  tone: SystemMessage['tone'],
  extra: Partial<SystemMessage> = {}
): SystemMessage => ({ id, text, tier, label, tone, ...extra });

export const VOICE_PACK: SystemMessage[] = [
  // ── PROGRESS · MORNING · ZERO ──────────────────────────────────────
  m('morning-zero-001', 'A NEW DAY HAS BEEN REGISTERED.',        'PROGRESS', 'DAY OPEN',  'awakening', { phases: ['MORNING'], bands: ['ZERO'] }),
  m('morning-zero-002', 'THE DAY IS UNWRITTEN. BEGIN.',          'PROGRESS', 'DAY OPEN',  'awakening', { phases: ['MORNING'], bands: ['ZERO'] }),

  // ── MILESTONE · LEVEL PROXIMITY ────────────────────────────────────
  m('level-near-001',   'THE NEXT THRESHOLD IS WITHIN REACH.',   'MILESTONE','THRESHOLD', 'momentum',
    { when: (c) => c.xpForNext - c.xpIntoLevel <= 60 && c.band !== 'ZERO', cooldownDays: 4 }),
];
```

---

## 27. Example original SYSTEM messages

All original. Cold, precise, one clause, never a life coach.

| # | State | Message |
| --- | --- | --- |
| 1 | Morning · zero progress | `A NEW DAY HAS BEEN REGISTERED.` |
| 2 | Morning · zero progress | `THE RECORD FOR TODAY IS EMPTY.` |
| 3 | Morning · first action taken | `THE FIRST CONDITION IS MET. CONTINUITY DETECTED.` |
| 4 | Midday · zero progress | `TIME HAS ADVANCED. YOUR STATUS HAS NOT.` |
| 5 | Afternoon · zero progress | `HALF THE DAY IS SPENT. NOTHING IS RECORDED.` |
| 6 | Afternoon · halfway | `HALF THE REQUIREMENT IS CLEARED. THE REMAINDER IS YOURS.` |
| 7 | Afternoon · advancing | `MOMENTUM IS HOLDING.` |
| 8 | Evening · low progress | `THE DAY IS NOT YET SEALED.` |
| 9 | Evening · near clear | `ONE CONDITION REMAINS.` |
| 10 | Night · unfinished | `THE WINDOW IS NARROWING. THE DAY IS STILL OPEN.` |
| 11 | Day cleared | `DAILY CONDITIONS SATISFIED.` |
| 12 | Day cleared · with streak | `CONTINUITY PRESERVED. SEVEN CONSECUTIVE CLEARS.` |
| 13 | Streak 14 | `THIS IS NO LONGER AN ATTEMPT. IT IS A PATTERN.` |
| 14 | Long zero, late | `NO ACTION HAS BEEN REGISTERED. THE SYSTEM IS WAITING.` |
| 15 | Reduced mode | `CONTINUITY PROTOCOL ACTIVE. THE FLOOR IS ENOUGH.` |
| 16 | Recovery available | `A MINIMUM CONDITION REMAINS AVAILABLE FOR YESTERDAY.` |
| 17 | Post-failure | `THE PREVIOUS DAY IS CLOSED. IT HAS NO CLAIM ON THIS ONE.` |
| 18 | Return after absence | `THE SYSTEM HELD ITS RECORD. RESUME.` |
| 19 | Level proximity | `THE NEXT THRESHOLD IS WITHIN REACH.` |
| 20 | Checkpoint proximity | `EVALUATION APPROACHES. EVIDENCE IS WHAT IS MEASURED.` |
| 21 | Boss cleared | `THREAT ELIMINATED. THE RECORD STANDS.` |
| 22 | Rank advanced | `RANK REASSESSED. THE EVIDENCE WAS SUFFICIENT.` |
| 23 | Day closed window | `THE DAY IS SEALED. THE NEXT BEGINS AT 04:00.` |
| 24 | Arc not started | `STANDBY. THE ARC HAS NOT BEGUN.` |
| 25 | Default / status | `STATUS: UNCHANGED.` |
