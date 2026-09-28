import type { EngineConfig } from './types';

/**
 * Pure. XP required to advance from level n to n+1.
 * req(n) = round_10( base + coefficient * n^exponent )
 * Every term read from config — final/01 §3 (coefficient 84, revised
 * from 75 to account for the uncapped BONUS/BOSS grants in §2.1.1).
 */
export function levelRequirement(n: number, config: EngineConfig): number {
  const { base, coefficient, exponent, roundTo } = config.level;
  const raw = base + coefficient * Math.pow(n, exponent);
  return Math.round(raw / roundTo) * roundTo;
}

export interface LevelState {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  totalXp: number;
}

/**
 * Pure. Resolves total XP into a level, XP into that level, and XP
 * needed for the next one. Handles multi-level-up: a grant large enough
 * to cross two boundaries in one call still lands on the right level.
 */
export function levelFor(totalXp: number, config: EngineConfig): LevelState {
  let level = 1;
  let remaining = totalXp;
  let req = levelRequirement(level, config);

  while (remaining >= req) {
    remaining -= req;
    level += 1;
    req = levelRequirement(level, config);
  }

  return { level, xpIntoLevel: remaining, xpForNext: req, totalXp };
}
