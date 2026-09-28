# 10 — Risks and Failure Modes

Two categories: ways the app could harm you, and ways the project could fail. The first matters more.

---

## Part A — Psychological harm modes

Format: **RISK → WHY IT HAPPENS → WARNING SIGNAL (observable in the data) → DESIGN CONTROL.**

---

### A1. Obsessive streak protection
**Why:** Loss aversion makes a long streak feel like a possession. Protecting it starts overriding judgement — training on an injury, "studying" at 1am to keep a number.
**Warning signal:** MVD-only completions clustered after 23:00. Streak length correlating negatively with deep-work minutes. Any completion logged between 00:00 and 04:00 more than twice a week.
**Control:** One streak only, on the *floor* not the ceiling. Grace auto-applies without you having to act. Streak displayed smaller than consistency %. No achievement rewards streak length. **Detector:** if 3+ MVD completions in a week land after 23:00, the weekly review says so plainly and suggests the streak may be driving rather than reflecting.

### A2. Guilt and the setback cascade
**Why:** One miss reads as evidence about the self ("I'm not the kind of person who does this"), which makes the next miss more likely. The what-the-hell / setback effect.
**Warning signal:** A miss followed by 2+ more misses. Recovery quests offered but never taken.
**Control:** No red on incomplete quests. No word "failed" anywhere in the codebase or copy. No notification about a miss. Recovery quest with a 48h window. Reduced Mode auto-engages at 2 consecutive misses. Post-lapse messaging restricted to calm/reflective tone. `13-day0-baseline.md` includes a "lapse plan" you write *before* the arc starts, at a moment when you're calm.

### A3. The app becomes the productivity task
**Why:** Configuring, reviewing, and optimising feel productive and are far easier than DSA at 8pm. This is the highest-probability failure mode in the entire project, and you correctly identified it.
**Warning signal:** **Median daily app time > 4 minutes** (the guardrail metric). Or: quest-template edits > 2 per week. Or: Progress screen opens > 3/day.
**Control:** App time is measured and reported in every weekly review. Quest templates are *locked between checkpoints* — you cannot fiddle. No themes, no cosmetics, no customisation surface. Onboarding is 90 seconds. Free-text journalling excluded. Every screen is designed for exit. **If app time exceeds 4 minutes median for two consecutive weeks, the app displays a warning that says so and recommends deleting features.**

### A4. Reward dependence / dopamine loop
**Why:** Variable rewards and escalating celebration train you to seek the app's feedback rather than the work's outcome. Then the arc ends and the behaviours have no fuel.
**Warning signal:** Opening the app without completing anything, repeatedly. Enjoyment scores falling while output rises.
**Control:** **No variable rewards at all.** Fixed XP, no random multipliers, no loot. Level-up celebration *degrades* after the third one. Zero XP for opening the app or checking stats. Enjoyment measured at every checkpoint specifically to catch this. The arc's designed ending explicitly removes measurement from two behaviours.

### A5. Quantification kills the enjoyment
**Why:** The evidence is direct — measuring an activity increases output but reduces enjoyment and reduces continuation once measurement stops. This predicts a Day-121 collapse.
**Warning signal:** Enjoyment score for DSA or building declining across checkpoints while volume rises.
**Control:** Deliberately leave some things unmeasured (reading, side projects, anything you do for fun — the app has no place for them and that's intentional). Enjoyment tracked at every checkpoint per domain. **The Day-120 protocol requires you to nominate two behaviours to continue *unmeasured*.** If enjoyment has dropped more than 3 points in a domain by Day 60, the checkpoint report flags it as a finding.

### A6. Gaming the XP system
**Why:** The score is easier to move than the life.
**Warning signal:** XP rising while first-attempt rate on mediums falls. Easy-problem share climbing. Deep-work block length shrinking while block count rises.
**Control:** Full strategy in `03 §12` — category caps, daily cap, difficulty weighting, first-attempt rate as 35% of PROBLEM SOLVING, block-length multiplier in DEPTH, and above all the evidence-gated rank system. **Detector:** the weekly review computes XP-per-hour-of-deep-work; a sustained rise in that ratio means the score is decoupling from the work.

### A7. Burnout from an unsustainable arc
**Why:** Six daily quests plus a job plus a 250-problem target is genuinely a lot. Week 1 enthusiasm sets a pace week 7 can't hold.
**Warning signal:** Energy and focus self-ratings trending down over 14 days. Completion above 90% for 3 weeks then a sharp drop. Sleep window misses rising.
**Control:** MVD floor. Arc pause, no penalty. Reduced Mode. Target completion band is **60–85%, not 100%** — and the weekly review says so when you're above 90% for three weeks running ("this pace is above the sustainable band; consider reducing the weekly targets"). No achievement for perfect weeks.

### A8. Sleep sacrifice
**Why:** The most available hour is the one after 23:00, and the app rewards completing quests.
**Warning signal:** Sleep-window misses correlating with high-XP days. Completions logged after 23:30.
**Control:** Sleep window is a *core quest worth 75 XP*, so late work costs you. The daily cap means there is no reward for extending the day. The daily report explicitly correlates sleep with next-day performance ("DSA completion after a hit sleep window: 91%; after a miss: 43%"). **Hard rule: the app never suggests doing anything after your sleep target.** Quests are not offered after that time; the screen says "Day closed."

### A9. Overtraining
**Why:** Training is a core daily quest and "consistency" is rewarded.
**Warning signal:** > 6 sessions/week sustained. RPE trending up while est. 1RM flat or falling.
**Control:** The BODY quest accepts a 20-minute walk on non-gym days — it is a *movement* quest, not a gym quest. Rest days count as complete. No training streak. Sessions per week capped for attribute purposes at 16/28 days (~4/week), so a 7th session earns nothing.

### A10. Body-image harm
**Why:** Daily weighing plus a target plus a score is a well-known bad combination.
**Warning signal:** Weight logged more than once a day. Body-fat entries clustered.
**Control:** **No XP for any body metric, ever.** Weight displayed only as a 7-day rolling mean. No target line on the chart. The app never comments on weight direction. Goal rates capped at ~0.75%/week with an explanation if you try to set more. Body fat optional and de-emphasised with an honest note about measurement error. No before/after photos feature. No BMI anywhere.

### A11. Over-planning instead of doing
**Why:** Planning is pleasant and feels like progress.
**Warning signal:** Weekly review "Adjust" used more often than "Accept." Quest-amendment requests between checkpoints.
**Control:** The weekly review *proposes*; the default action is one tap to accept. Quest templates locked between checkpoints. Onboarding has no quest-design step — the six core quests are given. Side quests exist as an autonomy valve but carry no XP pressure.

### A12. Isolation
**Why:** A single-user offline app with no social features gives you zero relatedness — one of the three needs in self-determination theory. I'm not going to pretend a fake community solves that.
**Warning signal:** Not detectable in-app. This one is honest-limitation territory.
**Control:** The *only* honest control is real: the arc protocol asks you to name **one human** who will see your checkpoint reports, and the checkpoint flow generates a shareable summary. That's an accountability partner, which is the real version of the thing. The app will not simulate one.

---

## Part B — Project risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Build slips past mid-September** | Medium | Medium | Arc starts on paper 1 Sept regardless. Slices 2–4 give a usable app by ~day 8 of the build. Slices 6–9 can degrade. |
| **You build the app instead of doing the arc** | **High** | **High** | This is the meta-version of A3 and it's the real risk. Control: the build is timeboxed to ~54 hours; after V1 ships, changes are permitted **only at checkpoints, driven by checkpoint data**, not by ideas. Write that rule down and hold to it. |
| **Device loss wipes the arc** | Low | High | `persist()`, weekly export prompt, mandatory checkpoint exports, red warning past 14 days. Residual risk: up to one week. |
| **iOS storage eviction** | Low (if installed + used daily) | High | Home-screen install is required on iOS. `persist()` requested. Daily use keeps you clear of the 7-day rule regardless. Export is the real backstop. |
| **Scope creep during the arc** | High | Medium | Everything in the cut list stays cut until Day 60. Feature ideas go in a text file, not the codebase. |
| **The six core quests turn out to be wrong** | Medium | Medium | Day-30 checkpoint is the designed amendment point. Changes are recorded in the checkpoint snapshot, so the final report is honest about what changed. |
| **Arc goals turn out to be miscalibrated** | Medium | Low | Completion band 60–85% is the calibration signal. Above 90% for 3 weeks → targets too easy. Below 50% for 2 weeks → too hard, and Reduced Mode plus a checkpoint amendment handles it. |
| **You lose interest around Day 40** | Medium | High | Predicted by the novelty-effect literature (weeks 4–6). Countered with substance, not novelty: Day-30 checkpoint delivers hard evidence and Boss I resolves right in the trough. |
| **The app is honest and the honest answer is "nothing changed"** | Low | — | **This is a success, not a risk.** It's the outcome the whole design exists to make possible. An app that can't return that answer is worthless. |

---

## Part C — The four rules that override everything

If a design decision ever conflicts with one of these, the design decision loses.

1. **No mechanic may punish rest, illness, or life.** Arc pause exists, is free, and is never discouraged.
2. **No mechanic may attach a score to a body measurement.**
3. **No mechanic may make the app more rewarding than the work it points at.** When in doubt, make the app more boring.
4. **The app must be able to tell you the arc failed.** Every mechanic that would soften or hide that answer is removed.
