# 07 · Rollback runbook

How to go back from build N to build N−1 without losing a day. Policy: platform/04 §38. The automated half is `npm run drill`; the half that needs a real browser profile is below, and it is the owner's.

## What is guaranteed, and by what

| Claim | Evidence |
|---|---|
| An older build opens the database a newer one left behind | Dexie 4 opens a database whose version is higher than the code declares, keeps its data and hides the tables it does not declare (`tests/engine/rollback-drill.test.ts`, run under fake-indexeddb with Dexie 4.0.x). **Not yet seen in a real browser** — step 3 below is that check. |
| The schema only grows, so an older build's declarations are a subset of the current ones | the same file: no version re-declares or re-indexes a table |
| An older build skips events it does not know and counts them | `applyEvents` (`state.skipped`); the drill writes a Blueprint activation, a generic instrument record and an event type from the future |
| The tables it does know come out exactly as before | the drill rebuilds with and without the newer events and compares all five cache tables |
| Rolling forward loses nothing | export → wipe → import reproduces every event and `verifyIntegrity` is clean |

**The rollback build** is the previous code with the *current* schema declarations (every table declared, unused ones included). It is never "open a v5 database with v4 code" — if you ever have to build one, keep the `this.version(n).stores(...)` blocks of `src/db/db.ts` from the build you are leaving.

## The drill on a device (repeat before each cutover step and before Phase 17)

1. **Back up first.** Settings → Data → Export. Keep the file somewhere that is not the phone.
2. Install build N on a persistent browser profile. Onboard, or import the owner fixture, then use every new thing once: log on a generated instrument, complete an evening review with a prompt, accept a weekly quest, stage and activate one cosmetic amendment.
3. Install the rollback build N−1 *over it* (same origin). Open the app:
   - it boots and Today renders;
   - legacy data is all there (quests, XP, streak);
   - Settings → Data → Verify integrity says clean;
   - nothing in the console but expected "skipped event" counts.
4. Use it for a day. Log one thing.
5. Roll forward to N. Everything from steps 2 and 4 is there; Verify integrity is clean; the E1 shadow (`npm run shadow` against a fresh export) still passes.

If step 3 fails with a version error, stop, restore from the export in step 1 on a clean profile, and record what the browser said in `platform/decisions/`.
