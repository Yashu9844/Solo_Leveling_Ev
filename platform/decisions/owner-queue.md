# Owner queue

Things the autonomous roadmap run prepared but cannot do. Each entry says what, why it is yours, and the command or file. Nothing here blocks the code loops; every one degrades safely until it is done.

| Since | Item | Why it is yours | How |
|---|---|---|---|
| 12.2 | ~~Render 18 voice clips~~ **Done 2026-10-18** (344 clips, manifest updated; the run also found that `@` in a clip id must not be percent-encoded - fixed in voicePackAudio.ts). Listen to the 18 new lines once: they are the counts FOUR/FIVE/SEVEN/EIGHT and two time-free closed-day lines. | | |
| 11.5 | Decide GO / HOLD / NO-GO on the stranger build | Product judgement | Boxes in `0002-stranger-build.md` |
| 6.3–6.5 | Soak, cutover deploy, decision record | Production deploy and your own data | `platform/06-CUTOVER-RUNBOOK.md` |

## What the owner will see after the cutover (14.5)

With ENGINE_V2 on, the first checkpoint you seal ends with an **Amend the System** step offering the fixes the System has always been waiting for. Take or leave each; declining changes nothing and is remembered only for that checkpoint.

| Offer | What it does | What it does not |
|---|---|---|
| Honour the wake time you gave | Sync quest asks for a wake within 30 minutes of the time you entered at onboarding (profile) instead of 08:30; the quest text follows | does not move any past day |
| Let Reduced Mode lower the day | While Reduced Mode is on, the day collapses to the hard-day floors (generated Systems already do) | does not touch XP, levels or the budget |
| *Not built:* the per-application and per-difficulty bonuses the spec describes | needs engine support for a bonus that depends on a record's content (quality, difficulty); the Blueprint's bonus rules can't express it yet | — |

## Engineering follow-ups noted on the way

- Advanced builder (14.4): swapping a boss's conditions and adding brand-new milestones need a signal picker; not built.
- Amend ops cover rename, target/floor, weekly rhythm (op exists, no control yet), weight shift, attribute weights, gate thresholds, instrument parameters and ladder rungs. Adding or retiring a domain is not an op: it needs the generator, which needs the interview answers (only a digest is kept).

## Device checks the automated suite cannot make

| Since | Item | How |
|---|---|---|
| 15.1 | Performance budgets on a real mid-range Android (the suite assumes a 4x slower device than CI) | `npm run bench` is a Node script; time a rebuild in the installed PWA on the device (Settings → Data → Verify integrity is a full rebuild) |
| 15.3 | The rollback drill in a real browser profile (the suite verifies Dexie's downgrade behaviour under fake-indexeddb only) | `platform/07-ROLLBACK-RUNBOOK.md`, steps 1–5 |

## Encrypted backups (15.5)

Settings → Data → "Protect the next export with a passphrase". AES-256-GCM, key from PBKDF2-SHA-256 (600,000 iterations), fresh salt and IV per file. A lost passphrase is a lost backup; the screen says so. Only that card encrypts: the checkpoint screen's export-before-seal and the weekly review's backup button still write plain files. Decide whether they should offer it too (and whether 600,000 iterations feels right on your phone: it is about half a second on a desktop).
