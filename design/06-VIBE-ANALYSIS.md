# Why it doesn't feel like the System — a diagnosis

You built a correct app. It is honest, event-sourced, accessible, responsive across six
viewports and five themes, and it refuses to lie to you. None of that is the problem.

The problem is that **it behaves like an accountant and Solo Leveling's System behaves like a
character.** Every screen in this build answers *"what is true?"*. Not one screen answers
*"what does the System demand of you, right now, and what happens if you don't?"*

Below: the five root causes, the seven secondary ones, and a prioritised list of what to add.
Everything here is measured against the current code, not against the design docs.

---

## Part 1 — The five root causes

### 1. The System narrates. It never commands.

Every user-facing string in the app is written in the register of a careful observer:

| Currently says | Register |
|---|---|
| `Today: CAREER at 08:35.` | a diary entry |
| `Six of six. Day closed.` | a bookkeeper's note |
| `Yesterday: 1 of 6. ATTENTION and SLEEP incomplete.` | a report |
| `Reduced to the floor for two days. The arc continues.` | a status update |
| `Worth less than what you'd have earned` | a footnote |
| `3 quality applications, or 25 minutes of substitute career work.` | a spec |
| `Day closed. Next day begins at 04:00.` | a sign on a door |

Solo Leveling's System speaks in **decrees, addressed to you, in the second person, with
consequences attached**:

> ⟨ DAILY QUEST HAS ARRIVED ⟩
> ⟨ WARNING: Failure to complete the daily quest will result in an appropriate penalty. ⟩
> ⟨ You have acquired the qualifications to be a Player. ⟩

The difference is not decoration. It is **agency**. A narrator describes a world you happen to
be in. A System *makes demands of you*, which means it has noticed you, which is the entire
emotional engine of the genre. Your app has an `engine/messages.ts` with a five-tier priority
system for choosing what to say — and then says it in italic 12px grey at the bottom of a line.

**This is the single biggest miss, and it is the cheapest to fix.** It is a copy and typography
change, not an architecture change.

---

### 2. There is no clock. Nothing is ever at stake in the next hour.

The most motivating pixel in all of Solo Leveling is a countdown:

> ⟨ Daily Quest: … ⟩ ⟨ Time remaining: 06:23:11 ⟩

Your app **knows** the day ends at 03:00 (`dayCloseHour: 3`) and rolls over at 04:00. It has a
`visibilitychange` listener specifically so the date can never go stale. It has every piece of
data needed for a countdown.

It shows the user a countdown **never**. The only time-awareness in the entire UI is the
`Day closed. Next day begins at 04:00.` banner — which appears *after* it is too late, attached
to a disabled state.

The result: at 9am and at 9pm the screen looks identical. There is no pressure gradient across
the day, so there is no moment where the app makes you *move*.

---

### 3. All three full-screen LEVEL UPs are spent by day 2.

This is the sharpest finding in the audit. Computed from your actual level curve
(`base: 200, coefficient: 84, exponent: 0.98`) at a full 500 XP day:

| Level | Cumulative XP | Reached on |
|---|---|---|
| 2 | 280 | **day 0.6** |
| 3 | 650 | **day 1.3** |
| 4 | 1,100 | **day 2.2** |

`FULL_SCREEN_LEVEL_UP_LIMIT = 3`, so from level 5 onward LEVEL UP degrades to a 6-second inline
text banner. Forever.

Now count every full-screen ceremony the app can produce across 120 days:

| Moment | Max occurrences |
|---|---|
| LEVEL UP (full screen) | 3 — all by day 2 |
| RANK ADVANCED | 5 — days 14, 30, 60, 90, 120 |
| CHECKPOINT | 5 — same days |
| BOSS CLEARED | 4 — days 25+, 50+, 75+, 100+ |
| **Total** | **17 in 120 days** |

**Between day 3 and day 14 there is not one full-screen moment available in the entire
application.** Eleven consecutive days — precisely the window where a habit either forms or
dies — in which the app's maximum emotional response to a perfect day is a meter bar moving and
a line of text changing to `Six of six. Day closed.`

And that line is the whole reward. **Completing all six core quests — the most important
recurring achievement in the product — has no ceremony at all.** Not a moment, not a flourish,
not a sound. The priority line changes wording.

---

### 4. The first two weeks are a wall of zeros.

From the live audit of a fresh arc, here is what a new user actually sees:

| Screen | Fresh-arc state |
|---|---|
| Today | 6 rows at `+100`, all hollow. LV 1. `0/280`. No streak line (hidden at 0) |
| Progress SYSTEM | LV 1, empty XP meter, six attribute bars **all at 0** |
| Progress REALITY | 8 rows reading `0`, `—`, `0`, `0`, `0`, `—`, `—`, `0 / 9` |
| Skills | 18 mastery bars, **all "unseen", all empty** |
| Profile | LV 1 · RANK E · `0 / 280` · **achievements section renders nothing at all** · boss locked for 20 more days |
| Weekly review | `0 XP · 0h 0m · 0 applications · 0 problems · 0 sessions · 0 blocks` |

Your attributes use a **28-day rolling window**, so they are near-zero for weeks by design and
move imperceptibly after that. Your achievements component `return null`s until something is
earned. Your boss list shows "Opens Day 25 · 20 days away".

Solo Leveling gives Jin-Woo his first stat point in chapter one. Your app asks for two weeks of
faith before it shows the user anything that looks like progress.

---

### 5. The future is hidden. There is no visible ladder.

Aspiration requires seeing what you do not yet have. The app systematically hides it:

- **Achievements** — the entire component is invisible until the first one is earned. There is
  no locked grid. The user does not know the 8 achievements and 5 identities exist.
- **Bosses** — only the *next* one is ever shown. Boss II, III and IV are invisible until day 50.
- **Ranks** — E → D → C → B → A → S exists in `engine/rank.ts`. The UI shows one letter and the
  next checkpoint's day number. The ladder itself is never drawn.
- **Level unlocks** — `LEVEL_UNLOCKS` names 9 unlocks (weekly quests, attributes screen, career
  funnel, DSA revisits, skills screen, weekly review, boss quests, arc projection). They are
  shown **for 200ms on the LEVEL UP moment as you pass them** and never again. They are also
  **not enforced** — nothing is gated, so the "unlock" is a lie of omission.
- **The 120-day arc** — the user sees `DAY 5 / 120`. There is no map, no path, no timeline. The
  five checkpoints and four boss windows that structure the entire arc are never drawn together.

Skills is the one screen that gets this right: it shows all 18 topics including the untouched
ones. That is why Skills is the closest thing you have to an RPG screen.

---

## Part 2 — The seven secondary causes

**6. Rank is decorative.** `RANK E` sits in a corner on three screens and does nothing for 14
days. In Solo Leveling rank *is* identity — it is how the world addresses you.

**7. Attributes never visibly move.** Six bars, 0–100, read-only, 28-day rolling window. The
most RPG-shaped element in the product is also the most inert. Nothing ever says `+1 DISCIPLINE`.

**8. There is not one chart in the entire application.** The audit confirmed it: zero line
charts, zero bar charts, zero sparklines, zero timelines. Every visualisation is a bar, a
segment strip, or a table. **The user has no way to see themselves improving over time.** The
power fantasy of Solo Leveling is *watching the curve bend*. Your app can prove the user improved
and never shows them the shape of it.

**9. The user is never addressed.** Onboarding collects a name on step 1, persists it, and the
UI displays it **nowhere**. The System in Solo Leveling says *"Player Sung Jin-Woo"*.

**10. Nothing ever arrives as a window.** The signature visual event of the genre is a
translucent blue pane that *materialises* with a chime. Your panels are beautiful and they are
always already there. Nothing is ever announced.

**11. Silence.** No sound anywhere, by explicit decision. The System's `ping` is half of its
identity.

**12. Quest rows read as a to-do list.** `icon · title · "3 applications" · +100 · ○`. That is a
task manager row. A Solo Leveling quest is a *framed window* with a title, requirements, a
reward, and a stated consequence.

---

## Part 3 — What to add

Ordered by **vibe gained per unit of work**. Nothing here requires changing the event log, the
engine, or any of the honesty guarantees.

### Tier 1 — The vibe transplant (highest impact, mostly copy + one component)

**1. Give the System its voice.**
Rewrite every user-facing string into second-person system register. Not hype — *authority*.

| From | To |
|---|---|
| `Today: CAREER at 08:35.` | `⟨ DAILY QUEST ⟩ CAREER — 08:35. Six remain.` |
| `Six of six. Day closed.` | `⟨ DAILY QUEST COMPLETE ⟩ All requirements met.` |
| `Yesterday: 1 of 6.` | `⟨ INCOMPLETE ⟩ Yesterday: 1 of 6. A recovery quest is available.` |
| `Learning block · +25 XP` | `⟨ SIDE QUEST ⟩ Learning block · +25 XP` |
| `Evening review · 25 seconds` | `⟨ DAILY REPORT ⟩ Ready. 25 seconds.` |
| `Day closed.` | `⟨ DAY SEALED ⟩ Next window opens 04:00.` |
Keep every frozen test string; change the ones around them.

**2. Build a `SystemWindow` component and make things *arrive*.**
A bordered pane that materialises with a scan-line sweep and a corner-bracket draw-on. Use it
for: daily quest arrival on first open, quest completion, penalty warnings, and any System
announcement. This is the single component that would do the most visual work in the app.

**3. Put a countdown on Today.**
`⟨ TIME REMAINING 07:41:22 ⟩` in mono, in the identity block, ticking. You already have
`dayCloseHour`. Below 3 hours it shifts to `--state-recover` amber. This one addition creates
the pressure gradient the app currently has none of.

**4. Add a DAY COMPLETE moment.**
Completing all six core quests must produce a full-screen ceremony. This is the achievement the
user will earn 60+ times in the arc and it currently earns a text change. Gold Horizon, the
day's numbers, the streak count, one line of System text. This alone fixes the day-3-to-14
ceremony blackout.

**5. Address the user by name.**
`⟨ PLAYER: ADA ⟩` in the Profile hero and on the daily report. You already store it.

**6. Rebalance the ceremony budget.**
Raise `FULL_SCREEN_LEVEL_UP_LIMIT` from 3 to ~8, or better: make it *rarity-based* rather than
count-based (every 5th level stays full-screen forever). Currently the app spends its entire
budget in 48 hours.

### Tier 2 — Feedback density

**7. Stat-gain notifications.** When a completed quest moves an attribute, float
`+2 DISCIPLINE` off the row. Requires exposing the per-action attribute delta, which the engine
already computes.

**8. Per-quest completion flourish.** The circle fills — good. Add a brief ring pulse and the XP
number flying to the meter. Currently the strongest per-quest feedback is a 180ms colour change.

**9. Streak escalation.** A 7-day streak, a 14-day streak and a 30-day streak should each
announce themselves. Right now `streak 12` is grey 12px text.

**10. Sound, off by default, one toggle in Appearance.** Three cues only: quest complete,
window arrival, moment. The Appearance screen already has the settings infrastructure.

### Tier 3 — Make the ladder visible

**11. The Arc Map.** A vertical 120-day path — the single highest-value *new screen*. Day
markers, the five checkpoints as gates, the four boss windows as marked encounters, your current
position as a lit node, everything ahead dim but *visible*. This is what turns "day 5 of 120"
from a number into a journey.

**12. Locked achievement grid.** Show all 8 achievements and 5 identities, locked ones dimmed
with their requirement stated. Never hide the collection.

**13. The full rank ladder.** E → D → C → B → A → S with each rank's gate conditions, current
position lit. Put it on Profile under the next-gate panel.

**14. All four bosses, always.** Show Boss II, III and IV locked with their windows and
conditions, not just the next one.

### Tier 4 — Make growth visible

**15. Charts — the app has none.** At minimum: a 28-day XP sparkline on Progress, an attribute
radar or 6-line trend, and a "you vs Day 0" comparison on the checkpoint report. Right now the
app can *prove* the user improved and never *shows* them the shape of it.

**16. A power number.** One composite figure that goes up and can be watched — not to replace
the six attributes (which §5 correctly refuses to average) but as a *display* value with its own
history. This is the "level 47 hunter" fantasy in one line.

### Tier 5 — Fix the first 72 hours

**17. Awakening onboarding.** The current step 1 is a name field. Solo Leveling opens with
*"You have acquired the qualifications to be a Player."* Make step 1 a System window announcing
the awakening, then the form.

**18. A guaranteed day-1 win.** The user should earn something in the first ten minutes —
a first-move achievement fired as a real moment, not a chip that appears silently.

**19. Show the zeros as potential, not absence.** Skills already does this correctly (all 18
topics visible, greyed). Apply the same to achievements, bosses, and ranks so day 1 shows a
*ladder*, not an empty room.

---

## One warning about the work already in progress

`src/ui/screens/Skills.tsx` has been reworked in the working tree with exactly this kind of
flavour — `AWAKENED`, `MONARCH S-RANK`, `SHADOW MONARCH SPELLS`, tabs, search, framer
animations. The direction is right. But it contains this:

```ts
const totalTouchedCount = dsaTouched + foundationsTouched + 12;
const masteryPercentage = Math.round((totalTouchedCount / totalSkillsCount) * 100);
```

That `+ 12` is a hardcoded credit for AI tiers the app does not track. It will show a new user a
non-zero mastery percentage on day 1 for skills they have never touched.

That is the one thing that can actually kill this product. The app's entire claim — the reason
`verifyIntegrity()` exists, the reason settings are kept out of the event log, the reason REALITY
prints `—` instead of `0` for an undefined rate — is that **its numbers are true**. Solo
Leveling's System is terrifying and motivating precisely because it is *incorruptible*. A System
that flatters you is just a mood board.

Get the vibe from **voice, ceremony, pressure and visible ladders**. Never from inflated numbers.

---

*Analysis only. No application code was modified.*
