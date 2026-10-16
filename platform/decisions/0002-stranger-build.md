# 0002 · The stranger build — stop-point review after Phase 11

**Status: engineering evidence written; the go/no-go is the owner's.** Prepared at the end of loop 11.5 (2026-10-16). Nothing here has been pushed, deployed, or shown to a person other than the owner's machine.

## The question

Phases 7–11 were meant to make one thing true: *a person who is not the owner can install the app, answer questions, be given a System that fits them, bring it online, and live in it.* Phase 11's roadmap row ends in a stop-point: decide whether to carry on into messaging, reviews, configuration management and the rest (Phases 12–17), or to stop and put this build in front of a stranger first.

## What now exists

| Capability | Where | Evidence |
|---|---|---|
| A stranger is asked, not configured | `src/onboarding` (engine, content, mapping, pins, provenance, activation issues, draft storage); `src/ui/onboarding/adaptive/*` | engine + content + renderer + provenance + pins + activation-issue unit tests |
| Quick (≈2 min) and Guided (≈8 min) tiers | `TierChoice`, `AdaptiveInterview` | e2e: 8 presets Quick, ≈10 s scripted each (limit 2 min) |
| Things of their own (custom domains), and up to two more things in an area (Body: strength and endurance) | `customs`, `also` questions; `custom:<type>` archetypes | e2e P7; random walks (Quick/Guided, with customs and added things) always generate a valid System |
| The System is built from the answers, and says so | Reveal: arc, domains/quests/floors, attributes, skills, checkpoints, bosses, each with a "because" line | provenance tests; e2e |
| The person can adjust, and the adjustment holds | Adjust sheets, pins | fast-check property: any later change to the interview leaves a pinned good day, hard day, designation and arc length intact |
| An invalid System cannot be brought online | `activationIssues`, re-judged every 30 s and at the tap | e2e: warning needs acknowledgement; a Reveal left open 49 days is refused, un-acknowledgeable, and one tap rebuilds it |
| One transaction creates the arc | `store/activation.ts` (`ARC_STARTED`, `BLUEPRINT_ACTIVATED` v1, intentions, baseline, Day-0 checkpoint, projections) | atomic, idempotent, refused-means-nothing-written; log == rebuild (`verifyIntegrity`) |
| Resumable | `onboarding_draft`, `onboarding_pins` | e2e kill-and-resume; deleted at activation and by `resetArc` |
| P1–P7 as a person answers for them (found the gap that an area could hold only one thing; fixed by "anything else in it?") | `tests/fixtures/personas/journeys.ts` | engine: each journey's System passes the whole persona suite (108 tests); browser: 7/7 replayed tap by tap to Today |
| The owner is untouched | flag `NEW_ONBOARDING` governs new arcs only and needs `ENGINE_V2`; the legacy `Onboarding` is unchanged | the legacy onboarding/boot/smoke e2e and `npm run test:v2` unchanged; E3 pixels (see the gate below) |

Gates at this commit: `tsc -b` clean, `eslint .` clean, 112 unit files / 1716 tests (also under `test:v2`), adaptive e2e 29/29 (8 presets, resume, P2, P7, adjust/pin, binding, and the seven journeys). The whole legacy e2e project: 108 passed, 4 failed — the three StreakGrid 14 px tap-target failures in `responsive.spec` and the intermittent core-loop 131 px overflow, all four already recorded in `0000-e2e-baseline.md`; the E3 pixel baselines (`visual-baseline`) pass.

## What has **not** been verified, and cannot be by me

1. **A person.** Every journey above is scripted. Nobody has read the questions, felt the pace, or misunderstood a card. The voice (capitals, no praise, echoes) is linted, not read aloud. Phase 16's usability study is the first real test; this build is the thing it would test.
2. **A device.** Visual and motion review of the interview, the Reveal sequence and the Adjust sheets (loops 10.3, 11.3) is a "visual review on device" acceptance row. Layout is exercised at one viewport (Pixel 7) with reduced motion on; the responsive matrix and a TalkBack pass have not been run on these screens.
3. **Production conditions.** The new onboarding is only reachable on a build with `VITE_ENGINE_V2=true` and `VITE_NEW_ONBOARDING=true`. The owner's cutover (6.3 soak, 6.4 deploy) has not happened, so there is no production build with ENGINE_V2 on. Until it does, a stranger cannot reach any of this.

## Known gaps in what was built

- **03 §26 steps not captured:** the *evidence kind* card ("a link / a recording / a count / a score") and the *weekly target* question have no field in `DomainAnswers`, so the interview does not ask them. A custom domain's S target is its action's default.
- **Six domains in all.** The System prices at most six domains of your own (areas + what is added to them + your own things), eight with guardrails. P5 (two exam domains) and P7 (six of their own) are therefore approximated (stated in `journeys.ts`). Raising it means re-pricing the XP budget (V-XP-02), not changing a number.
- **Quick can be one area.** The `areas` card needs one, not two; the System adds a default engine. That is honest but thin.
- **Intentions** are written as `PLAN_AMENDED` and show under Settings → System. They are not on Today, and only domains that allow one carry one.
- **`answersDigest`** (03 §23.2) is not written into `provenance`; the raw answers are never in the log, but the digest the spec promises is absent.
- **"Delete everything"** as a user-facing action does not exist (Phase 14); `resetArc` is the one wipe path and it clears the draft and pins.
- **The activation window uses the first boundary hour.** The interview picks "today" with the default 04:00 boundary; the generated System derives its own from the sleep time. Within two hours of midnight these can name different days. Both are inside the ±14/+30 window, so nothing breaks; it is untidy.
- **Pre-existing, not mine:** the voice pack's `morning-zero-004` names ASCENSION (retired in 12.2); phase bounds are fixed clock hours, not relative to wake (12.3); 18 responsive tap-target failures and one intermittent core-loop overflow (`0000-e2e-baseline.md`); the owner export is absent so owner-fixture checks never ran.

## Recommendation

**Continue to Phases 12–15 on engineering grounds; do not ship any of this to a stranger until two things happen, both the owner's:**

1. Run the new onboarding yourself on a phone, once as Quick and once as Guided, with a made-up life that is not yours, and read every question and every Reveal card as the stranger would. If any line makes you wince, that is a content change, and the content is one file (`src/onboarding/content.ts`).
2. Decide the cutover (6.3/6.4/6.5). The stranger build is behind ENGINE_V2; ENGINE_V2 is behind your soak.

Why not stop now: Phases 12–15 (messaging, reviews, configuration management, performance/offline/encryption) are what make a *second week* in a generated System coherent. The interview is only worth testing on a person if their second week is. Why not skip the device check: everything after this point assumes the screens are right, and they have only been checked by machines.

If you disagree, the cheapest stop is: set `VITE_NEW_ONBOARDING` off (the default) and nothing in this phase is reachable.

## Decision

- [ ] **GO** — continue to Phase 12; stranger exposure waits for the two conditions above.
- [ ] **HOLD** — stop after 11.5; run the device review first.
- [ ] **NO-GO** — rework the interview before anything else (say what).

*Owner, date:*
