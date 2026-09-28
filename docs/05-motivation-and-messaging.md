# 05 — Motivation, Messaging and Notifications

---

## 1. The core argument: cut the quote database by 95%

You asked for potentially thousands of motivational messages. My recommendation is **~150 original lines**, and I want to be explicit about why, because this is one of the bigger cuts in the report.

**The evidence argument.** Bandura's four sources of self-efficacy rank mastery experience first and **verbal persuasion last**. Motivational text is verbal persuasion — the weakest lever available. Meanwhile the app is sitting on a complete log of your mastery experiences and, in a naive design, would show you none of it at the moment of decision. *"You've solved 7 graph mediums; your last 3 were first-attempt"* will beat any quote ever written, because it's evidence rather than exhortation, it's about you, and it's true.

**The novelty argument.** Gamification effects decay from week 4 and partially recover through familiarisation. Text content decays faster. A larger database delays the decay by weeks at most, and it does so by making the content less curated — the 1,400th-best line you can find is not a line you'd endorse.

**The legal argument.** Quote collections on the internet are largely of unverifiable provenance, frequently misattributed, and often under copyright. Scraping them into a shipped app is a real risk for zero benefit. Original lines you wrote (or that I drafted and you approved) are yours.

**The taste argument.** You said you don't want the app to be toxic. Every large scraped quote database contains hustle-culture material about sleeping less, working through illness, and treating rest as weakness. Filtering thousands of lines for tone is more work than writing 150 good ones.

**Recommendation:** ~150 lines, all original, each tagged, each with a cooldown. If any line ever makes you cringe, delete it — a 150-line library you fully endorse is worth more than 5,000 you skim past.

---

## 2. The architectural distinction: System Messages vs Reflections

You were right that these are different things and belong in different parts of the architecture.

|  | **System Message** | **Reflection** |
|---|---|---|
| Source | Generated from your data at runtime | Authored, stored in a table |
| Content | Facts about your state | A framing or an idea |
| Example | "Third hard problem this week. First-attempt rate on graphs: 58%, up from 31%." | "One problem today is one problem you won't fear in the room." |
| Frequency | Many per day | One per day, maximum |
| Value | **High** — this is competence feedback | Low-moderate — supporting texture |
| Failure mode | Wrong or noisy | Stale, generic, or preachy |

**Investment should follow value: build the System Message generator properly, keep the Reflection library small.** Most habit apps do exactly the opposite, and it's why their "motivation" feels like a fortune cookie.

### 2.1 System Message generator

A templated, deterministic generator over the event log. Templates are ranked by a **specificity score** and the highest-scoring applicable template wins.

```
Priority 1 — Personal record or first occurrence
  "First hard problem solved first-attempt."
  "Longest deep block yet: 71 minutes."

Priority 2 — Trend with numbers
  "First-attempt rate on mediums: 58% over 14 days, up from 31%."
  "Wake time SD down to 38 minutes. Two weeks ago: 71."

Priority 3 — Streak/consistency fact
  "11 of the last 14 days had a deep block."

Priority 4 — Neutral status
  "4 of 6 complete. Two quests remain."
```

Rules: never more than one number-heavy sentence at a time · never comment on a body metric's direction · never a comparison to any other person · never speculation about the future ("at this rate you'll…" — that's a projection, and projections belong on the Progress screen where they can show their error bars).

### 2.2 Reflection library: ~150 lines

**Categories (12):** discipline · focus · career · setbacks · consistency · self-efficacy · training · study · procrastination · courage · identity · long-horizon thinking.

**Tones (5, cut from your 8):** direct · calm · challenging · reflective · celebratory.

I cut *aggressive* and *urgent*. Aggressive tone at 6:30am on a low day is the mechanism by which these apps become shame machines, and manufactured urgency is dishonest — nothing in a 120-day arc is urgent today. *Encouraging* folds into *calm*.

**Schema:**

```
reflection {
  id, text, category, tone,
  context: [MORNING | PRE_DEEP_WORK | POST_COMPLETION | POST_LAPSE
            | EVENING | LEVEL_UP | CHECKPOINT],
  min_day, max_day,          // day-of-arc gating; Day-3 lines ≠ Day-90 lines
  cooldown_days,             // default 21
  times_shown, last_shown_at,
  weight                     // manual, so you can promote lines that land
}
```

No `author` field, no `source` field, no `copyright_status` field — because everything is original. If you later want attributed quotes, add the fields then; don't build a rights-management system for content you wrote yourself.

No `effectiveness` field either, and this is a deliberate cut: you can't measure whether a line worked without an experiment you'll never run, and a fake effectiveness score would be worse than none. `weight` is honest — it's your taste, labelled as your taste.

### 2.3 Selection rules

1. Never repeat a line within its cooldown (default 21 days). With 150 lines and 1/day, natural repetition is ~5 months out.
2. Context must match the current moment.
3. `min_day`/`max_day` must bracket the current arc day.
4. After a lapse, only the `setbacks` category, only `calm` or `reflective` tone. **Never `challenging` after a lapse** — that's the self-criticism response the evidence says reduces subsequent effort.
5. If the system has a Priority-1 or Priority-2 System Message available, **show that instead**. Evidence beats exhortation whenever evidence exists.

### 2.4 Tone constraints — hard bans

The library may not contain, and generated messages may never produce:

- Anything implying sleep is optional or that rest is weakness
- Anything about "no days off," "no excuses," or grinding through illness
- Any body-shape, weight, or appearance claim
- Any comparison to other people, real or imagined
- Any second-person negative identity claim ("you're being lazy," "you're weak")
- Any manufactured urgency or countdown pressure
- Any guilt framing about the app itself ("you haven't opened this in 3 days")

**Sample lines that pass** (drafted here for calibration, subject to your approval):

> *Morning:* "The decision was made last night. This morning is just execution."
> *Pre-deep-work:* "Twenty-five minutes. You can stop after that and it still counts."
> *Post-lapse:* "Yesterday is data, not a verdict. What's the first ten minutes today?"
> *Post-completion:* "That's the fourth time this week you did it when you didn't want to."
> *Evening, partial day:* "Four of six. That's a day that happened, not a day that failed."
> *Level-up:* "Level 12. The number is a receipt, not an achievement."
> *Checkpoint:* "Thirty days of evidence. Read it before you decide how it went."

---

## 3. Notification strategy

### 3.1 The platform reality — read this before designing anything

**Reliable scheduled local notifications are not available to PWAs on either platform.** This is not a limitation you can design around; it's a fact you have to design *with*.

- The **Notification Triggers API** — which would allow a PWA to schedule a local notification for a future time without a server — ran as a Chrome origin trial and was never shipped. There is no standardised replacement.
- **Web Push** works, but it requires (a) a server holding a push subscription, and (b) on iOS, the PWA must be installed to the Home Screen first, iOS 16.4+. We have chosen a local-first, no-server architecture — so Web Push means adding a server, which is the thing we deliberately avoided.
- **Background Sync and Periodic Background Sync** are not supported on Safari or Firefox at all. On iOS a PWA cannot do anything while closed.
- The service worker only runs when the browser decides to run it, which for a closed PWA is "rarely, and never on a schedule you chose."

Any product plan that assumes "the PWA will notify me at 07:15" is wrong on iOS and unreliable on Android.

### 3.2 Recommended solution: use the OS

**MVP notification strategy: the app generates three native alarms/calendar events during onboarding and asks you to add them. The phone's own clock does the notifying.**

Concretely, onboarding produces a downloadable `.ics` file with three recurring events (or, more simply, gives you three times and a one-line instruction to set them as repeating alarms). The alarm labels *are* your implementation-intention sentences:

```
06:45  "SYSTEM — open, read today's priority"
07:15  "At my desk: open the editor before anything else"   ← your if-then sentence
22:30  "Evening review — 25 seconds"
```

This is better than a push stack in every way that matters: it needs no server, it works identically on iOS and Android, it's dead reliable, it survives the app being closed for a week, and it costs about two hours of build time instead of two days. The only thing it can't do is include dynamic content in the notification — and the dynamic content belongs on the screen you open anyway.

**In-app notifications** (foreground `Notification` API, when the app happens to be open) are used only for immediate feedback — level-up, achievement — never for reminders.

**Web Push is a Phase 7 option**, not MVP. If you later decide you want dynamic reminders badly enough to run a tiny server, the architecture supports adding it without changes to the data model.

### 3.3 If notifications did exist: the policy

Documented for whenever push does get built, and applied to the native alarms in the meantime.

**Hard cap: 3 scheduled per day.** Morning brief · one deep-work cue · evening review. That's it.

**Escalation is downward only.** If a slot is ignored twice, it goes silent and the weekly review asks whether to move or drop it. This is the exact inverse of an engagement-optimised app, which escalates when you disengage. Here, disengagement from a reminder is *information about the reminder*, not about you.

**Never notify about:**
- A missed quest (a shame-delivery mechanism)
- A streak at risk (manufactured anxiety, on your worst day, when you're least able to handle it)
- Not having opened the app
- Anything during quiet hours (default: sleep target − 30 min to wake target)

**Notification copy is specific, never generic.** "07:15 — DSA. Open the editor." not "Time to be productive!"

### 3.4 On adaptive notification timing

Worth doing eventually, and it's a `GROUP BY`, not a machine-learning problem: bucket completions by hour-of-day, compare completion rates, and if one bucket beats another by more than 20 percentage points over 14+ days, propose the change **at the weekly review** — not by silently moving the reminder. The user makes the schedule change; the app makes the observation. That preserves autonomy, which is the thing SDT says actually matters.

---

## 4. The morning experience

Optimised for one thing: **you know what to do within 5 seconds and you can close the app.**

```
┌─────────────────────────────────┐
│  DAY 22 · LEVEL 12 · RANK D     │   ← one line, small, no bar
│                                  │
│  Today: DSA at 07:15.            │   ← THE priority, one sentence
│  Everything else is bonus.       │
│                                  │
│  ○ DSA Block           +100      │
│  ○ Build Block         +100      │
│  ○ Training            +100      │
│  ○ Sleep window        +75       │
│  ○ Fuel                +60       │
│  ○ Attention           +65       │
│                                  │
│  ─────────────────────────────   │
│  "The decision was made last     │   ← one reflection, small, muted
│   night. This morning is just    │
│   execution."                     │
└─────────────────────────────────┘
```

Deliberately absent: XP progress bar (it's on Profile), weekly progress, main-quest progress, attribute summary, quick-action grid, achievements, anything animated. Nine regions became three.

The "Today's priority" line is computed: the highest-value quest that is (a) most at risk based on your completion history for that slot, or (b) blocking a weekly quest. One sentence, one decision removed.

---

## 5. The evening review

**Budget: 25 seconds, 5 taps, zero typing required.**

```
┌─────────────────────────────────┐
│  DAY 22 · EVENING               │
│                                  │
│  Energy    ○ ○ ● ○ ○            │  1 tap
│  Focus     ○ ● ○ ○ ○            │  1 tap
│                                  │
│  What got in the way?            │  1 tap (optional)
│  [Time] [Tired] [Wrong time]    │
│  [Didn't want to] [Nothing]      │
│                                  │
│  Tomorrow's one priority:        │  1 tap from today's quests
│  [DSA] [Build] [Train] [...]     │
│                                  │
│  Slept at: [22:40 ▾]             │  1 tap (defaults to last night)
│                                  │
│         [ Complete day ]         │
└─────────────────────────────────┘
```

Then the report, which is the actual reward for doing the review:

```
DAILY REPORT · DAY 22

XP                    420
Quests                5 / 6
Arc streak            21 days
Deep work             65 min
Strongest             DSA (4th consecutive day)
Weakest               Sleep window (3 misses in 7)

"Sleep is the constraint this week. Your DSA completion
 on days after a hit sleep window is 91%; after a miss, 43%."
```

That last sentence is a `GROUP BY` over your own log, and it is the most valuable text the app will ever produce. No LLM required.

**Free-text journalling is deliberately excluded from V1.** You said "do not turn it into journaling homework" and you were right — an empty text box at 22:30 is the single most reliable way to make someone stop completing a review. One optional line is available on the quest detail screen for DSA insights, and that's the only free text in the daily loop.

---

## 6. The weekly review

Sunday. 3 minutes. This should be the most useful screen in the app, and it earns that by ending with **decisions, not data**.

```
SYSTEM EVALUATION · WEEK 2 (Days 8–14)

COMPLETION           78%  ▲ from 71%
XP                 2,940
Deep work        7h 20m  ▲ 1h 05m
─────────────────────────────────────
DSA           14 problems (4E 8M 2H)
              first-attempt on M: 50%  ▲ from 38%
Build          4 sessions, 2 features shipped
Training       4 sessions
Sleep window   4 / 7  ▼ from 6 / 7
Attention      6 / 7 under cap
Fuel           6 / 7
─────────────────────────────────────
IMPROVED    Problem solving · Craft
DECLINED    Discipline (sleep window)
BOTTLENECK  Sleep window

  Late sleep on 3 nights; all 3 followed evening
  build sessions ending after 23:00.

NEXT WEEK — proposed
  → Move Build block to 20:00 (from 21:30)
  → Weekly quest: 16 problems, graph focus
     (graphs: 31% first-attempt, weakest topic)
  → Weekly quest: ship P1 tool-calling layer

        [ Accept ]      [ Adjust ]
```

The bottleneck is identified by a rule (lowest-completion category weighted by its downstream correlations), and the proposals are template instantiations. Two buttons. You accept in one tap on most weeks.
