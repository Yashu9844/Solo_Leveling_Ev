# 02 — Behavioral Evidence Base

Every concept below is graded, then converted into a build decision. The grading scale:

| Grade | Meaning |
|---|---|
| **A** | Multiple meta-analyses or large replicated field experiments. Safe to build on. |
| **B** | Consistent evidence, moderate effects, some replication concerns or narrow populations. Build, but don't over-engineer around it. |
| **C** | Theoretically coherent, evidence thin, mixed, or mostly correlational. Build only if cheap; don't make it load-bearing. |
| **D** | Popular in productivity/gamification writing, weak or absent empirical support. Do not build. |

A note on honesty: several ideas that are *extremely* popular in habit-app design sit at C or D. I've flagged those explicitly rather than dressing them up.

---

## A-grade: build the product on these

### Implementation intentions ("if-then plans") — **A**
**What it is:** Specifying in advance *when, where, and how* you will act — "If it is 07:15 and I am at my desk, then I will open the editor before anything else" — rather than merely intending to act.
**Evidence:** Gollwitzer & Sheeran's meta-analysis covers 94 independent tests, N ≈ 8,000, and reports a medium-to-large effect (d ≈ 0.65) on goal attainment over and above goal intentions alone. The mechanism is well-characterised: the plan delegates action initiation to an environmental cue, removing the need for a deliberate decision at the moment of action. Later meta-analytic work on mental contrasting combined with implementation intentions (MCII) supports the combination.
**How it shapes the app:** This is the single highest-leverage feature and it costs almost nothing to build. During onboarding, each core quest requires an if-then sentence (time + place + first physical action). That sentence is shown *at the cue time* — not a generic reminder, your own sentence. It is also shown on the quest detail screen. The Day-30 review lets you rewrite plans that aren't firing.
**Risks:** Plans decay if the context changes (new job, travel). Mitigation: checkpoint review of every plan's firing rate; a plan below 40% completion gets flagged for rewriting rather than for guilt.
**Decision: BUILD — V1, core.**

### Goal setting: specific and difficult beats "do your best" — **A**
**Evidence:** Locke & Latham's 35-year research programme is one of the most replicated findings in organisational psychology; specific, difficult goals reliably outperform vague or easy ones, with moderating conditions (commitment, feedback, task complexity, ability).
**How it shapes the app:** No quest may be vague. Not "study DSA" but "one medium graph problem, first attempt, no editorial." Difficulty is calibrated to just above current ability, and the app tracks whether you're systematically setting goals you always hit (too easy) or never hit (too hard) — completion rates between 60–85% are the target band.
**Important caveat from the same literature:** on *complex, novel* tasks, specific difficult outcome goals can hurt performance versus learning goals. So for a topic you've never touched, the quest is a **learning goal** ("understand how union-find works well enough to explain it") not a performance goal ("solve 3 union-find problems"). The app distinguishes these.
**Decision: BUILD — V1, core.**

### Self-efficacy, and mastery experience as its dominant source — **A**
**Evidence:** Bandura's framework identifies four sources — mastery experience, vicarious experience, verbal persuasion, physiological state — with mastery experience consistently the strongest. Recent empirical rankings in the physical-activity domain confirm the ordering, with mastery experience dominating and verbal persuasion weakest.
**How it shapes the app:** This is the finding that kills the quote database as a primary mechanism. *Verbal persuasion is the weakest of the four sources.* Motivational text is verbal persuasion. Meanwhile, the app is sitting on a complete log of your mastery experiences and mostly not showing it back to you. So: the highest-value "motivational" content the app can display is **your own past performance on the specific task you are about to attempt** — "you've solved 7 graph mediums; your last 3 were first-attempt."
**Also:** self-efficacy is task-specific, not global. So the app measures it per-domain (DSA interview confidence, system design confidence, gym confidence), never as a single "CONFIDENCE" number. → see `04`.
**Decision: BUILD — V1. And demote motivational quotes accordingly.**

### Immediate rewards drive persistence better than delayed rewards — **A/B**
**Evidence:** Woolley & Fishbach show across field and lab studies that immediate rewards (including intrinsic enjoyment of the activity itself) predict persistence in long-term goals better than the delayed rewards the goals themselves promise. Delayed rewards predict *intention*; immediate rewards predict *continuation*.
**How it shapes the app:** The XP animation must fire in under two seconds of logging, offline, with no network round trip. This is a hard performance requirement, not a nicety. It is also the entire justification for having XP at all — XP exists to convert a reward that arrives in 90 days into one that arrives in 2 seconds.
**Decision: BUILD — V1, core, with a performance budget.**

### Temptation bundling — **A/B**
**Evidence:** Milkman, Minson & Volpp's gym field experiment found meaningful increases in gym attendance when a tempting audiobook was available *only* at the gym; a later, larger field experiment replicated the effect but found it decayed over time and around holidays.
**How it shapes the app:** Cheap and worth including as *advice* rather than as machinery. During gym-quest setup, one optional field: "what do you only allow yourself during this activity?" The app surfaces it at the cue. No enforcement — the app cannot police your podcast app, and pretending otherwise would be dishonest.
**Decision: BUILD — V1, as a single optional field. Do not build enforcement.**

### Spaced and retrieval practice — **A**
**Evidence:** Among the most robust findings in learning science. Meta-analyses of spaced retrieval practice show consistent, substantial retention benefits over massed practice, across domains and including STEM course contexts; effects are largest when spacing and retrieval are *combined* rather than used alone.
**How it shapes the app:** This is the second-highest-leverage feature after implementation intentions, and it's the reason a DSA tracker beats a DSA counter. Every logged problem gets a scheduled revisit. Revisits are scheduled by a simple deterministic algorithm (see `04 §DSA`) — 3 days, 10 days, 30 days, with intervals extended on first-attempt success and reset on failure. Revisit quests are generated automatically and count for XP.
**Why this matters for interviews specifically:** solving 250 problems once is worse preparation than solving 150 problems with scheduled revisits, because the interview *is* a retrieval test under pressure. Your brief's instinct here ("explore whether the system should schedule revisions automatically") is correct — yes, unambiguously.
**Decision: BUILD — V1, core to the DSA system.**

### Sleep regularity matters more than sleep duration — **A**
**Evidence:** A large UK Biobank prospective cohort (~60,000 participants, accelerometer-measured) found sleep regularity a stronger predictor of all-cause mortality risk than sleep duration.
**How it shapes the app:** The sleep quest is a **consistency** quest, not a duration quest. Success = wake time within ±30 minutes of target. The tracked metric is the standard deviation of wake time across the arc, not average hours slept. This also avoids the failure mode where an app rewards "8 hours" and thereby rewards oversleeping after a bad night.
**Decision: BUILD — V1. Metric is wake-time SD.**

### Behavioural activation: action precedes motivation — **A (clinical), B (applied to general productivity)**
**Evidence:** Behavioural activation is a well-supported treatment for depression across multiple meta-analyses, with effects comparable to cognitive therapy. Its core premise — schedule and perform the activity regardless of felt motivation, and mood/motivation follow — is strongly supported in that clinical context.
**Caveat, stated honestly:** the evidence base is for treating depression, not for optimising the output of a healthy motivated engineer. Extrapolation is reasonable but is extrapolation.
**How it shapes the app:** The 5-minute floor. The framing of every quest as "start" rather than "complete." The evening review asks what you *did*, never how motivated you *felt*, because tracking felt motivation reifies it as a prerequisite.
**Decision: BUILD — V1, as the floor mechanic.**

---

## B-grade: build, but keep them small

### Gamification works, modestly, and the effect is design-dependent — **B**
**Evidence:** Sailer & Homner's meta-analysis of gamified learning found small-to-moderate positive effects on cognitive (g ≈ 0.49), motivational (g ≈ 0.36) and behavioural (g ≈ 0.25) outcomes. Later meta-analytic work finds gamification improves intrinsic motivation and perceived autonomy and relatedness, with *minimal* effect on perceived competence. Effects vary enormously by implementation.
**The honest read:** gamification is real but small, and "we added points and badges" is not the version that works. The version that works satisfies psychological needs. That points at self-determination theory as the design filter rather than at points-per-se.
**Decision: BUILD, but treat every mechanic as guilty until it proves it satisfies a need. See `03 §Mechanic audit`.**

### Self-determination theory as a design filter — **B**
**What it is:** Motivation quality depends on satisfying autonomy (I chose this), competence (I'm getting better), and relatedness (this connects me to others). Experimental work on specific game elements finds different elements hit different needs — badges/performance graphs/leaderboards affect competence perceptions, avatars and narrative affect autonomy and relatedness.
**How it shapes the app:**
- *Autonomy:* you author your own quests and if-then plans at onboarding and can edit them at checkpoints. The system proposes; you dispose. Never the reverse.
- *Competence:* the attribute system and the "your own past performance" surfacing are competence machinery. This is where the app should invest most.
- *Relatedness:* **structurally absent in a single-user offline app, and I am not going to fake it.** No social features, no fake community. The honest mitigation is an *optional* weekly "share the report" export you can send to one real human. Accountability partners are the real version of relatedness; simulated ones are not.
**Decision: BUILD as a filter. Explicitly accept the relatedness gap.**

### Goal-gradient effect and endowed progress — **B**
**Evidence:** Kivetz, Urminsky & Zheng showed purchase acceleration as customers approached a reward, and that *illusory* endowed progress (a 12-stamp card with 2 stamps pre-filled beats a 10-stamp card) increased completion. Robust in loyalty contexts.
**How it shapes the app:** Level 1→2 requires only 260 XP, achievable on Day 1 — deliberate endowed progress. Weekly quest bars show "4 of 5" prominently near completion. The XP bar accelerates visually in the last 15%.
**Where I will not use it:** no fake pre-filled progress on real-world metrics. Faking progress on your actual DSA count would corrupt the evidence layer, which is the one thing that must stay clean. Endowed progress is allowed in the *game* layer only.
**Decision: BUILD — game layer only.**

### Habit formation takes far longer than 21 days, and varies enormously — **B**
**Evidence:** Lally et al.'s original real-world study gave a median of 66 days to automaticity with a range of 18–254 days. A 2024 systematic review and meta-analysis of health-behaviour habit formation reports medians in the 59–66 day range but means of 106–154 days and an individual range of 4–335 days. It also found morning practices formed habits substantially faster than evening ones (≈106 vs ≈154 days), self-selected behaviours formed stronger habits than assigned ones, and simple cue-clear behaviours automated faster than complex ones like exercise.
**How it shapes the app — three concrete consequences:**
1. **Schedule your hardest quest in the morning.** The evidence directly supports it and it's free.
2. **A 120-day arc is roughly one habit-formation cycle, maybe less.** Do not promise yourself that DSA will feel automatic by December. It might not. The app should not imply otherwise — the Day-120 report should report *automaticity* honestly (via a short self-rated automaticity scale at each checkpoint) rather than assuming it.
3. **You choosing your own quests matters empirically, not just for autonomy vibes.**
**Decision: BUILD — morning-first scheduling default; automaticity self-rating at checkpoints.**

### Habit and identity are associated — **B, and note the direction problem**
**Evidence:** A 2025 systematic review and three-level meta-analysis found a moderate positive association between habit strength and identity in health behaviours.
**The honest caveat:** the relationship is largely correlational and bidirectional. "Change your identity and behaviour follows" is a much stronger claim than the evidence supports; "people who do a behaviour a lot come to see it as part of who they are" is what the data mostly shows. The popular self-help framing inverts the arrow.
**How it shapes the app:** Identity unlocks exist, but they are **retrospective descriptions of accumulated evidence**, never aspirational assignments. You don't get "Problem Solver" as a goal; you get it at 100 logged problems as a *statement of fact*: "You have solved 100 problems. That is what a problem solver does." That framing is honest under the actual evidence, and it's also more powerful.
**Decision: BUILD — retrospective only, evidence-gated. Cap at ~8 identities across the arc.**

### Commitment devices / deposit contracts — **B**
**Evidence:** Systematic review of commitment-making for weight loss finds mixed but generally positive results; deposit-contract studies show larger deposits associate with more weight loss, though selection effects are a serious confound; app-based RCTs comparing rewards vs deposit contracts for physical activity show effects that are real but not dramatic.
**How it shapes the app:** Offer it, don't build the machinery. The app cannot hold your money, and building payment handling into a local-first personal app is absurd. Instead: an optional "arc stake" field at onboarding where you write what you've committed and to whom, shown at checkpoints. If you want a real deposit contract, use a real one; the app records that you did.
**Decision: BUILD as a single text field. Do not build financial machinery.**

### Self-compassion after failure increases subsequent effort — **B**
**Evidence:** Breines & Chen's experiments found self-compassion inductions after a failure increased self-improvement motivation relative to self-esteem boosts and neutral controls. The broader self-compassion literature is now large, though effect sizes in lab-induction studies are modest.
**How it shapes the app:** Directly determines the copy in the failure/recovery flow. No "you failed." No shame framing. "Quest incomplete" + a diagnostic question + a concrete recovery option. This is a *copy* decision backed by evidence, which is unusual and worth honouring.
**Decision: BUILD — governs all failure-state copy.**

---

## C-grade: cheap to include, don't lean on them

### Streaks — **C, genuinely contested**
**The case for:** loss aversion is well-established; streaks manufacture a possession you don't want to lose. Product evidence from large consumer apps is strongly positive on retention.
**The case against:** the "what the hell" / setback effect — one lapse triggers disproportionate abandonment, particularly for *inhibitional* goals ("don't eat junk"). Recent work on the setback effect in everyday self-regulation finds it is real but *not universal*, and is moderated by how the lapse is interpreted; there is applied work specifically on regulating responses to self-regulation failure to *avoid* the setback. Streaks also optimise for the wrong thing — an app-retention metric — and can produce compliance behaviour that satisfies the streak without doing the work.
**Honest verdict:** the mechanic is powerful and double-edged, and most of the enthusiastic evidence comes from companies whose objective function is retention rather than your objective function.
**How it shapes the app:** one streak only; it tracks the *floor* (Minimum Viable Day), not perfection; grace days apply automatically without you having to remember; the streak is displayed smaller than consistency percentages. Full design in `03 §Failure`.
**Decision: BUILD — one, floor-based, de-emphasised.**

### Novelty effect and the week 4–6 dip — **B, and highly actionable**
**Evidence:** A 14-week longitudinal quasi-experiment (N = 756) found gamification's effect strong in weeks 1–4, decaying for roughly 2–6 weeks after, then partially recovering between weeks 6–10 as students familiarised — a U-shaped curve. Notably the effect was never negative at any point.
**How it shapes the app:** This is the most operationally useful finding in the whole review, because it tells you *when* the product will feel dead: roughly Days 28–45. So the schedule places the Day-30 checkpoint (first hard evidence of real change) and the first Boss resolution right in that trough. Don't try to prevent the dip with more novelty; counter it with substance.
**Decision: BUILD — schedule-level design decision.**

### Variable / intermittent rewards — **C for behaviour change, and a known harm vector**
**Evidence:** Variable-ratio schedules produce high, persistent response rates — that is textbook operant conditioning and not in dispute. What *is* in dispute is whether they help *behaviour change*, as opposed to helping *engagement*. They are the mechanism underlying slot machines and much of what is criticised as attention-extractive app design.
**How it shapes the app:** **Rejected.** No random XP multipliers, no loot, no surprise rewards. Rationale: (a) you explicitly said you don't want a dopamine casino; (b) variable rewards corrupt XP as a unit of account — a 2× day makes your own history non-comparable; (c) the mechanism optimises app engagement, which is my guardrail metric, i.e. it optimises the thing I'm trying to keep *down*. Scheduled, pre-announced challenge weeks give variety without randomness.
**Decision: DO NOT BUILD.**

### Extrinsic rewards can undermine intrinsic motivation — **A for the finding, C for its applicability here**
**Evidence:** Deci, Koestner & Ryan's meta-analysis of 128 experiments found tangible, expected, performance-contingent rewards significantly undermine intrinsic motivation for interesting tasks. The finding was contested but has largely held.
**Why it applies less than you'd think here:** the undermining effect is strongest for tasks that were *already intrinsically interesting* and for *tangible* rewards. XP is not tangible, and the target behaviours (waking early, gym on a tired evening, sleeping on time) are largely not intrinsically motivating to begin with — there's little intrinsic motivation available to undermine.
**Where it does apply, and this is the real risk:** DSA and AI building probably *are* intrinsically interesting to you. Pointsifying them carries genuine risk of turning play into work.
**How it shapes the app:** XP for the *lifestyle scaffolding* quests (sleep, train, fuel, attention) is uncontroversial. For the two deep-work quests, XP is deliberately attached to **starting and logging**, not to output quality or quantity beyond a modest bonus band, and the app foregrounds competence feedback (your first-attempt rate improving) over point totals. If at Day 30 you notice you're choosing easy problems to farm points, that's the undermining effect showing up and the mitigation is in `10`.
**Decision: BUILD with the mitigation. Monitor at checkpoints.**

### Quantification can reduce enjoyment of the measured activity — **B, and under-appreciated**
**Evidence:** Etkin's work on the hidden cost of personal quantification found that measuring an activity increased how much of it people did, but decreased enjoyment and subsequent continuation once measurement stopped.
**This is the sharpest warning in the whole review for this specific product**, because it predicts exactly the Day-121 failure: you measured everything for four months, output went up, enjoyment went down, and when the arc ends the behaviours collapse.
**How it shapes the app:** (a) the arc has a designed ending where you deliberately *stop measuring* two behaviours and let them run unmonitored — this is a feature, not an afterthought; (b) not everything gets measured — deliberately leave some things unquantified; (c) the Day-120 report includes an enjoyment question per domain, tracked from Day 0, so a collapse in enjoyment is *visible* rather than discovered in January.
**Decision: BUILD the countermeasures. This risk gets a row in `10`.**

### Notification timing and fatigue — **C, evidence is thin and context-dependent**
**Evidence:** There's a reasonable literature on notification receptivity and interruptibility (breakpoints between tasks, time of day, content type), and consistent findings that notification volume relates to perceived overload. Work on notification-disabling interventions shows effects on smartphone behaviour and digital wellbeing. But there's no good "N notifications per day is optimal" number, and anyone quoting one is guessing.
**How it shapes the app:** Fewer than you think. Hard cap of 3 scheduled per day. Auto-silencing of any slot ignored twice — escalation is *downward* only, which is the opposite of what engagement-optimised apps do. And critically: on the PWA platform, reliable scheduled notifications basically don't exist, which forces an honest solution anyway. See `08`.
**Decision: BUILD conservatively. Escalate down, never up.**

### Self-reported digital media use is unreliable — **A for the finding**
**Evidence:** A systematic review and meta-analysis of discrepancies between logged and self-reported digital media use found self-reports correlate only moderately with logged use and are rarely accurate — a large majority of studies using self-report are estimating usage inaccurately. Later studies confirm the discrepancy and find it varies with psychological factors.
**How it shapes the app:** Don't ask "did you stay under an hour?" Ask you to open iOS Screen Time / Android Digital Wellbeing and type the number. It's one extra tap for a categorically better measurement.
**Decision: BUILD — numeric entry from the OS, not a yes/no.**

---

## D-grade: popular, unsupported, not building

| Idea | Why not |
|---|---|
| "21 days to form a habit" | Originates from a plastic surgeon's 1960 observation about phantom limbs, not a study. The real median is 59–66 days with a range up to 335. Any app copy implying 21 days is misinformation. |
| "Willpower is a depletable resource" (ego depletion) | The literature suffered a severe replication crisis; large multi-lab replications found effects near zero. Do not build "willpower meters" or "decision fatigue" mechanics. |
| Universal "best time to post/notify" numbers | No credible general answer; entirely person- and context-specific. The app should learn *your* completion rates by time-of-day instead — which is a `GROUP BY`, not a theory. |
| Learning styles (visual/auditory/kinesthetic) | Repeatedly failed to find support for the meshing hypothesis. Irrelevant here but worth stating so it doesn't creep into the skill tree design. |
| Badges/points as motivation *in themselves* | The gamification meta-analyses show effects depend on need satisfaction, not on the presence of point mechanics. Points with no competence signal underneath are decoration. |
| "Gamification increases motivation by 60%" and similar marketing statistics | These come from vendor blog posts, not studies. I found several while researching; none had a traceable methodology. Excluded. |

---

## What this evidence base implies, compressed

If you built only the A-grade findings and nothing else, you would have:

1. An if-then plan per quest, shown at its cue time.
2. A 5-minute floor for every hard quest.
3. Sub-2-second reward feedback on logging.
4. Your own past performance surfaced before the attempt.
5. Automatic spaced revisits for DSA.
6. Morning-first scheduling.
7. Wake-time consistency rather than sleep duration.
8. Specific, difficult, calibrated quests — with learning goals for novel topics.

That is a complete product. **Everything else in this report — levels, ranks, attributes, achievements, bosses, messages — is B-grade and below.** It is worth building because it makes the A-grade machinery pleasant enough to keep using for 120 days, which is itself a real contribution. But if a scoping decision ever forces a choice, the list above wins.

---

## Sources

- [Lally et al. (2010), *How are habits formed: Modelling habit formation in the real world*, Eur. J. Soc. Psych.](https://onlinelibrary.wiley.com/doi/abs/10.1002/ejsp.674)
- [Time to Form a Habit: A Systematic Review and Meta-Analysis of Health Behaviour Habit Formation and Its Determinants (2024), *Healthcare*](https://www.mdpi.com/2227-9032/12/23/2488)
- [Gollwitzer & Sheeran (2006), *Implementation Intentions and Goal Achievement: A Meta-Analysis of Effects and Processes*](https://www.sciencedirect.com/science/chapter/bookseries/abs/pii/S0065260106380021)
- [A Meta-Analysis of the Effects of Mental Contrasting With Implementation Intentions on Goal Attainment (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892/)
- [Locke & Latham (2002), *Building a practically useful theory of goal setting and task motivation: A 35-year odyssey*](https://pubmed.ncbi.nlm.nih.gov/12237980/)
- [Bandura's self-efficacy theory — overview](https://www.simplypsychology.org/self-efficacy.html) and [An empirical ranking of the importance of the sources of self-efficacy for physical activity (2025)](https://www.tandfonline.com/doi/full/10.1080/21642850.2025.2567322)
- [Woolley & Fishbach (2017), *Immediate Rewards Predict Adherence to Long-Term Goals*, PSPB](https://kaitlinwoolley.com/wp-content/uploads/2017/08/woolleyfishbachpspb.pdf)
- [Milkman, Minson & Volpp (2014), *Holding the Hunger Games Hostage at the Gym: An Evaluation of Temptation Bundling*, Management Science](https://pubsonline.informs.org/doi/10.1287/mnsc.2013.1784) and [Teaching temptation bundling to boost exercise: A field experiment (2020)](https://www.sciencedirect.com/science/article/pii/S074959782030385X)
- [A Meta-Analytic Review of the Benefit of Spacing out Retrieval Practice Episodes on Retention (2021), Educational Psychology Review](http://www.lscp.net/persons/ramus/docs/EPR20.pdf) and [Single-paper meta-analyses of spaced retrieval practice in nine introductory STEM courses (2024)](https://link.springer.com/article/10.1186/s40594-024-00468-5)
- [Sleep regularity is a stronger predictor of mortality risk than sleep duration (2024), *SLEEP*](https://academic.oup.com/sleep/article/47/1/zsad253/7280269)
- [Behavioural Activation for Depression: an update of meta-analysis of effectiveness and subgroup analysis, PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0100100)
- [Sailer & Homner (2020), *The Gamification of Learning: a Meta-analysis*, Educational Psychology Review](https://link.springer.com/article/10.1007/s10648-019-09498-w)
- [Gamification enhances student intrinsic motivation, perceptions of autonomy and relatedness, but minimal impact on competency: a meta-analysis (2023)](https://link.springer.com/article/10.1007/s11423-023-10337-7)
- [Sailer et al. (2017), *How gamification motivates: An experimental study of the effects of specific game design elements on psychological need satisfaction*](https://www.sciencedirect.com/science/article/pii/S074756321630855X)
- [Kivetz, Urminsky & Zheng (2006), *The Goal-Gradient Hypothesis Resurrected*, J. Marketing Research](https://journals.sagepub.com/doi/abs/10.1509/jmkr.43.1.39)
- [Zhu et al. (2025), *The relationship between habit and identity in health behaviors: A systematic review and three-level meta-analysis*](https://iaap-journals.onlinelibrary.wiley.com/doi/abs/10.1111/aphw.70017)
- [ten Broeke et al. (2023), *Understanding the setback effect in everyday self-regulation*, Eur. J. Soc. Psych.](https://onlinelibrary.wiley.com/doi/full/10.1002/ejsp.2931) and [Adriaanse et al. (2022), *Beyond prevention: Regulating responses to self-regulation failure to avoid a set-back effect*](https://iaap-journals.onlinelibrary.wiley.com/doi/10.1111/aphw.12302)
- [Breines & Chen (2012), *Self-Compassion Increases Self-Improvement Motivation*, PSPB](https://journals.sagepub.com/doi/abs/10.1177/0146167212445599)
- [Rodrigues et al. (2022), *Gamification suffers from the novelty effect but benefits from the familiarization effect: findings from a longitudinal study*, IJETHE](https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-021-00314-6)
- [Deci, Koestner & Ryan (1999), *A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation*, Psych. Bulletin](https://home.ubalt.edu/tmitch/642/articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf)
- [Etkin (2016), *The Hidden Cost of Personal Quantification*, J. Consumer Research](https://academic.oup.com/jcr/article-abstract/42/6/967/2358309)
- [Parry et al., *Measurement Discrepancies Between Logged and Self-Reported Digital Media Use: A Systematic Review and Meta-Analysis*](https://www.researchgate.net/publication/345994533_Measurement_Discrepancies_Between_Logged_and_Self-Reported_Digital_Media_Use_A_Systematic_Review_and_Meta-Analysis)
- [Mehrotra et al., *Alert Now or Never: Understanding and Predicting Notification Preferences of Smartphone Users*, ACM TOCHI](https://dl.acm.org/doi/10.1145/3478868)
- [Beyond the Buzz: Investigating the Effects of a Notification-Disabling Intervention on Smartphone Behavior and Digital Well-Being (2024)](https://www.tandfonline.com/doi/full/10.1080/15213269.2024.2334025)
- [The effect of commitment-making on weight loss and behaviour change in adults with obesity/overweight: a systematic review, BMC Public Health](https://link.springer.com/article/10.1186/s12889-019-7185-3) and [Investigating Rewards and Deposit Contract Financial Incentives for Physical Activity Behavior Change Using a Smartphone App: RCT, JMIR](https://www.jmir.org/2022/10/e38339)
