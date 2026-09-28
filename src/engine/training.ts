// final/04-physical-lifestyle.md §2 — optional per-lift estimated 1RM via
// the Epley formula. Not pre-scaffolded by Phase 0 — same precedent as
// engine/build.ts (Slice 8) and engine/maintenance.ts (Slice 9).

/** Pure. Epley: 1RM ≈ weight × (1 + reps/30). At reps = 0 (a set with no
 * reps logged) this degenerates to just the weight, which is the sane
 * floor rather than a division artifact. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg;
  return weightKg * (1 + reps / 30);
}
