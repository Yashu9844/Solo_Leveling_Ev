# 09 · New-user usability study (loop 16.2 — prepared; it needs people)

Question the study answers: **does a person who is not the owner get a System that feels built for them, and do they use it for a week?** It gates the public release (platform/05 loop 16.2). No participant has been recruited and no session has been run.

## Who

6–8 adults, no relationship with the owner, spanning the personas the generator is built for: a software engineer (P1), a student with an exam (P2), someone who wants to train (P3), someone running a business or side project (P4), a competitive-exam candidate (P5), a creative (P6), and one who says "none of these" (P7: fully custom). At least two Android users on mid-range phones. Not people who have used a habit app for more than a month (they bring a template). Thank or pay them; tell them it is a test of the app, not of them.

## What the facilitator needs

A build with `VITE_ENGINE_V2=true VITE_NEW_ONBOARDING=true` on its **own origin** (never the owner's). A clean install per participant (fresh browser profile). Screen recording with consent. The facilitator does not explain anything the screen does not.

## Session (about 45 minutes, think-aloud)

1. 2 min: "Say what you are thinking as you go. I can't help; if you're stuck, say so and I will note it."
2. Quick tier, from the install screen: they answer for their real life. **Do not intervene.** Note the time to the Reveal and to *Initialise system*.
3. The Reveal: "Tell me what you're looking at." Then: "Change anything you'd change." (Count adjusted cards.)
4. Ask, one at a time: What is the name on the first card? What does it mean? What is the line under it? What would you do first tomorrow?
5. Then the Guided tier on a second install, for the participants who chose Quick (and the reverse for one in three): same notes.
6. Close: "In your own words, what is this app?" **Record the exact words.**

## Measures (record per participant; thresholds are the plan's)

| Measure | How | Target |
|---|---|---|
| Time to activation, Quick | stopwatch from the first screen to *Initialise system* | median ≤ 3 min (the plan says about 2) |
| Time to activation, Guided | same | median ≤ 10 min |
| Adjusted at least one card on the Reveal | count | report it; under 25% suggests the Reveal is not being read, over 90% that the defaults are poor |
| Describes it as "a to-do app" / "a habit tracker" | the exact words at the close | **0** |
| Describes it as built for them ("it knows I…", "mine") | same | the majority |
| Comprehension of designations | step 4: can they say what the designation stands for, using the reality label under it? | ≥ 80% correct for their own cards |
| Misreads | any card, line or button interpreted wrongly | log each; none may be about *what a quest asks of them* |
| Seven-day floor completion | they keep the app for a week; count the days the hard-day floor was met (read from their export, with consent) | median ≥ 5 of 7; also record who stops and the day they stop |
| Unprompted quotes | anything they say about the voice, the capitals, the tone | verbatim |

## Afterwards

- Findings go in `platform/decisions/NNNN-usability-study.md`: one row per finding (what, who, how bad, which file fixes it). Content fixes are usually `src/onboarding/content.ts`, the archetype library, or the voice lines; change them, re-run `npm test`, and re-test the changed step with two new people.
- **Go / no-go for public release** is a written decision with the numbers above. Any "to-do app" description, any misread of what a quest asks, or a median floor completion below 5/7 is a no-go until fixed and re-tested.
- Anything a participant says about the owner's System, the name, or the art that touches the IP review goes to `platform/10-STORE-READINESS.md` §1.
