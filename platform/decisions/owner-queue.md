# Owner queue

Things the autonomous roadmap run prepared but cannot do. Each entry says what, why it is yours, and the command or file. Nothing here blocks the code loops; every one degrades safely until it is done.

| Since | Item | Why it is yours | How |
|---|---|---|---|
| 12.2 | Render 18 voice clips | `npm run voice` calls Fish Audio with your `FISH_API_KEY` / `FISH_VOICE_ID` (`.env.local`) | `npm run voice` fills only what is missing: `cleared-003@{4,5,7,8}`, `morning-zero-005@{4,5,7,8}`, `midday-started-002@{4,5,7,8}`, `final-condition-003@{4,5,7,8}`, `exception-closed-008`, `exception-closed-009`. Until then those lines fall back to the device voice (e2e `system-voice` covers the fallback). Commit `public/voice/*.mp3` and `manifest.json` afterwards; `voice-variants.test.ts` then needs its `unrendered` list emptied. |
| 11.5 | Decide GO / HOLD / NO-GO on the stranger build | Product judgement | Boxes in `0002-stranger-build.md` |
| 6.3–6.5 | Soak, cutover deploy, decision record | Production deploy and your own data | `platform/06-CUTOVER-RUNBOOK.md` |
