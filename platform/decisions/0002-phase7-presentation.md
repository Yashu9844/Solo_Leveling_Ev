# 0002 — Phase 7: what the screens now read from the Blueprint, and what they still do not

Recorded 16 Oct 2026, at the end of loop 7.9. Phase 7 is the stop-point the roadmap names ("the owner gains correctness, nothing breaks"): it is the owner's to re-decide whether to continue. Nothing here needed the owner; this is the record of where the line fell.

## Done, and how it was proven

- Every screen in the roadmap's list reads its structure from the Blueprint through `useSystem()` (`SystemProvider`): Today (rows, hues, log buttons, support cards, priority line, checklist cards), Progress (attribute groups, REALITY rows, arc length), `/attributes/:groupId`, Skills (trees, tiers, milestone panel, self-cert card), Profile (checkpoint days), evening review and reminder settings (domains), PWA shortcut aliases.
- **E3 (pixels) stayed at zero diff for the owner's Blueprint through every loop** (41 captures, tolerance 0.1%), on the legacy engine and on `VITE_ENGINE_V2=true`.
- Lint now forbids a legacy domain id as a string literal anywhere under `src/ui` except `ui/instruments/legacy` and the legacy onboarding, and `DEFAULT_CONFIG` anywhere under `src/ui` except the legacy onboarding.
- `tests/e2e/synthetic-system.spec.ts` seeds a Blueprint that is not the owner's (every name, glyph and hue replaced, legacy marker removed) and walks Today, Progress, an attribute group, Skills, Profile and Settings: its names and tokens appear, none of the owner's wording does, and nothing logs an error.

## Deliberate limits (each one needs the owner, or a later phase)

1. **No criterion progress on the rows or the quest sheet.** 03 §27.3 mentions progress from `evaluateCriterion`. Showing it changes the owner's Today, which E3 forbids until they approve. The helper to compute it exists; the rendering does not.
2. **The weekly review is not generalized.** It still prints the owner's DSA row, the sleep/DSA correlation and the resume nudge. It is not in the 7.x list; it belongs with the rules work in Phase 12.
3. **The bespoke attribute layouts (body, mind, craft) serve the owner's System only.** Another System gets the generic group screen. They read the owner's domain tables directly.
4. **Skill mastery for the owner's trees still reads the domain tables** (identical to the Blueprint's by E1). A generic tree reads its instrument records through its mastery policy.
5. **The synthetic System keeps the owner's instruments** (their ids are what the stores write against), so it proves Blueprint-driven presentation, not fully generic recording. The generic recorders (`ui/instruments/recorders`) are tested on their own against fake-indexeddb with synthetic instruments of every type; a generated System arrives with Phase 8.
6. **Checkpoint days are typed as the owner's five in the engine** (`Checkpoint['day']`); the Profile casts another System's days through. The V2 read path is already day-generic; the rest of the engine's typing is Phase 11 work.
7. **The manifest keeps the three installed shortcut paths.** `/log/primary` and `/log/evidence` exist as routes for manifests built later; an installed WebAPK caches its manifest.
8. **A `?open=` shortcut still only lands on Today** (as before this phase); wiring Today to open the named sheet would change `navigation.spec`'s contract and was left alone.

## Changes to the owner's data model made on the way

Presentation fields were added to the legacy Blueprint so its sheets render as they always have (log verbs, session types, default minutes, art slots, card taglines, REALITY display, MOMENTUM in CRAFT, the training hue corrected from rose to violet to equal the Today row). They are presentation in the partition hash except instrument `params`, which are computational by design; the owner's projections are unaffected (E1/E2 pass).
