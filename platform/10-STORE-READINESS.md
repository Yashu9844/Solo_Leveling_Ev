# 10 · Play Store readiness (loop 17.2 — prepared; the audit and the submission are the owner's)

Written 2026-10-18 at the end of the engineering run. Every item below says what is **done**, what **I could check**, and what **only you can**. Nothing here has been submitted, signed, or published. Per the roadmap, 17.2 is a *written audit with every item passed or waived with a reason*; this is the draft of it, not the sign-off.

## 1. IP review (the one that can stop a listing)

The app's name, icon, store text and art must not use Solo Leveling names, characters or copyrighted art.

| Check | Result |
|---|---|
| App name, short name, manifest, `index.html` title | `SYSTEM`. No property name. **Pass.** |
| Package name (`package.json`) | `system`. **Pass.** |
| Shipped strings that named the property | Fixed in this loop: export filenames (`solo-leveling-backup-…` → `system-backup-…`, `system-export-day-…`), the import error ("Not a Solo Leveling export" → "Not a SYSTEM export"), a placeholder example (`Solo_Leveling` removed), and a theme label (`Monarch violet` → `Violet`). Three E3 baselines (the Craft screens) were regenerated for the placeholder; nothing else moved. |
| Code comments that say "Solo Leveling" (Splash, SettingsList, SettingsScreen, Skills) | Not shipped to users (stripped from the bundle) but they are in the repository; reword before the repository is made public. |
| **Legacy owner copy — "MONARCH ARCHITECTURES · S-RANK" on the Skills screen, `MonarchRail` (a component name), "HUNTER PLAYER CARD" comment** | **Open, and yours.** This is the owner's System's wording (platform/02 §18.5 Q6). The Skills "MONARCH S-RANK" label also collides with Rank S. Decide: rename for the store build, or accept the risk. "Monarch" is a generic English word but is also a franchise term (the "Shadow Monarch"); a reviewer who knows the franchise may read it that way. |
| Designation vocabulary (TRIAL, FORGE, ASCENSION, RECONSTITUTION, WILL, VITALITY) | Generic English words in a generic register. **Pass** (not franchise-specific). |
| **Art plates** (33 files in `src/assets/art`, from the owner's local folder `system-app\project\assests_high_res`) | **Cannot be checked by me.** I do not know how they were made or whether they depict franchise characters or resemble its illustrations. You must confirm their provenance and licence (own work / commissioned / generated under terms that allow commercial use) and that none shows a recognisable character, a recognisable monster design, or the franchise's logo or title treatment. If any is in doubt, remove the plate: every slot has a gradient fallback and the app works without art (Settings → Appearance → Art: off). |
| Voice | Rendered from a voice you chose in Fish Audio (`FISH_VOICE_ID`). Confirm the voice's licence permits commercial redistribution, and that it is not a clone of an actor's or character's voice. |
| Fonts | Cormorant Garamond, Inter, JetBrains Mono, via `@fontsource` (SIL OFL). **Pass**; keep the licence texts in the build's notices. |

## 2. Packaging (TWA / Bubblewrap)

| Item | State |
|---|---|
| Web app manifest | Present (`name`, `short_name`, icons 192/512, `display: standalone`, `scope: /`). Icons are not maskable (documented in `vite.config.ts`): Android will letterbox the icon. A maskable 512 is worth making before the listing. |
| Origin | The TWA must point at the **production origin after cutover**, never a preview (platform/04 §34.6). Cutover is 6.4. |
| `assetlinks.json` | **Yours.** Needs the SHA-256 fingerprint of the signing key Play will use (Play App Signing shows it). Template: `[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"<your.package>","sha256_cert_fingerprints":["<FINGERPRINT>"]}}]`, served at `/.well-known/assetlinks.json`. |
| Package name, signing key, Play developer account | **Yours.** |
| Target SDK | Bubblewrap's current default meets Play's requirement at the time of the build; check the requirement on the day you submit. |
| Shortcuts | The manifest still lists `/log/problem`, `/log/application`, `/review` (the owner's). Platform 03 §27.3 makes them generic (`/log/primary`, `/log/evidence`) with the old paths kept as aliases; the aliases exist, the manifest switch is part of the cutover, not done. A listing for strangers should not advertise "Log problem". |

## 3. Data Safety form (Play Console)

Everything is local; nothing is sent anywhere (proved: `tests/engine/no-network.test.ts`, `adaptive-offline.spec.ts`).

| Question | Answer |
|---|---|
| Does the app collect or share any of the required user data types? | **No.** |
| Is all of the user data encrypted in transit? | Not applicable — no data leaves the device. |
| Do you provide a way for users to request that their data be deleted? | Yes: all data is on the device; uninstalling or Settings → Data → reset removes it. (There is no in-app "delete everything" button yet beyond reset; Phase 14 did not add one. Reset is the one wipe path.) |
| Account / sign-in | None. |
| Third-party SDKs | None. The bundle contains no analytics, no ads, no crash reporter. |
| Optional file encryption | Exports can be passphrase-protected (15.5). |

## 4. Privacy policy (draft — the policy URL is required by Play)

> **SYSTEM keeps everything on your device.** It has no account, no server and no analytics. What you log, your answers when you set up, and your reviews are stored in your browser's local database on your phone. Nothing is sent to us or to anyone else. If you export a backup, the file is saved where you choose; you can protect it with a passphrase, and if you lose the passphrase it cannot be opened. Uninstalling the app or using Settings → Data → Reset removes your data. SYSTEM does not give medical advice; it records what you tell it. Contact: *<your address>*.

Host it on the production origin (`/privacy`) or a static page of yours; the Play listing needs a URL. **Yours.**

## 5. Content rating

Questionnaire answers (no violence, no user-generated content shared with others, no purchases, no location, no data collection) suggest the lowest rating. The plan targets **16+** (platform/04 Q11) because the voice is stern and the product is about self-discipline; set it to what you are comfortable with. No health claims: the app does not diagnose or advise; body metrics are the user's own numbers (never scored). Say that in the listing.

## 6. Accessibility

| Check | State |
|---|---|
| Text scale XL at 320 px | `settings.spec` passes (no overflow). |
| Tap targets ≥ 44 px | **Open.** `responsive.spec` has 18 documented failures (StreakGrid cells are 14 px; decision recorded in `decisions/0000-e2e-baseline.md`). The StreakGrid is a calendar of 120 small cells; either make the cells tappable at 44 px (changes the design), or accept it as a read-only visual with the day detail reachable elsewhere, and write that down as a waiver. |
| Reduced motion | Honoured everywhere (`motion: reduced`); the Reveal sequence collapses. |
| Colour is never the only signal | Shape-first rule (final/06 §7), checked in the gate list and deltas. |
| **TalkBack** pass | **Yours** — not run. Prioritise: the interview (radios/checkboxes carry `role` and `aria-checked`), the Reveal, the quest rows and the log sheets. |
| Crash-free sessions on three devices | **Yours** — needs the devices. |

## 7. Before you press submit

1. Settle the IP items in §1 (Monarch wording, art provenance, voice licence).
2. Run the cutover (6.3/6.4/6.5) so the TWA has a production origin.
3. Run the rollback drill on a device (`07-ROLLBACK-RUNBOOK.md`) and the performance check (`decisions/0003-performance.md`).
4. Render the 18 new voice clips (`decisions/owner-queue.md`).
5. Decide the StreakGrid tap-target waiver or fix.
6. Then fill this audit: each row **passed** or **waived with a reason**, signed and dated by you.
