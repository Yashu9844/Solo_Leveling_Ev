// final/03-learning-systems.md §4.1 — the LEARN/SHIP enforcement rule.
// Not pre-scaffolded in Phase 0 (there was no engine/build.ts stub);
// added following the same pattern as engine/career.ts and engine/dsa.ts
// — a small pure domain module, reused (not duplicated) by
// engine/rules.ts's evaluateRules from Slice 11 onward.

export interface BuildSessionFixture {
  local_date: string;
  mode: 'LEARN' | 'SHIP';
}

/** Pure. LEARN session count ÷ SHIP session count over the given window
 * (final/03 §4.1's example: "11 learning sessions · 2 shipped units" ->
 * ratio 5.5). Infinite (no SHIP sessions at all) when learn count > 0. */
export function learnShipRatio(sessions: BuildSessionFixture[]): number {
  const learnCount = sessions.filter((s) => s.mode === 'LEARN').length;
  const shipCount = sessions.filter((s) => s.mode === 'SHIP').length;
  if (shipCount === 0) {
    return learnCount > 0 ? Infinity : 0;
  }
  return learnCount / shipCount;
}

/** Pure. Fires exactly when the ratio exceeds 3:1 — final/03 §4.1's
 * enforcement rule: "learning without shipping produces no evidence." */
export function learnShipRuleFires(sessions: BuildSessionFixture[]): boolean {
  return learnShipRatio(sessions) > 3;
}
