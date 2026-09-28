import { describe, it, expect } from 'vitest';
import { levelRequirement, levelFor } from '../../src/engine/level';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { EngineConfig } from '../../src/engine/types';

// final/01-quests-xp-level-rank.md §3's published table — the test fixture.
const EXPECTED_REQ: Record<number, number> = {
  1: 280,
  2: 370,
  3: 450,
  5: 610,
  10: 1000,
  15: 1390,
  20: 1780,
  25: 2170,
  30: 2550,
  35: 2940,
  40: 3320,
};

function cumulativeTo(level: number, config: EngineConfig): number {
  let sum = 0;
  for (let n = 1; n < level; n++) {
    sum += levelRequirement(n, config);
  }
  return sum;
}

describe('levelRequirement', () => {
  it('matches the §3 table exactly at n = 1,2,3,5,10,15,20,25,30,35,40', () => {
    for (const [n, expected] of Object.entries(EXPECTED_REQ)) {
      expect(levelRequirement(Number(n), DEFAULT_CONFIG)).toBe(expected);
    }
  });

  it('cumulative to reach L10 = 5,460, L20 = 19,000, L40 = 69,280', () => {
    expect(cumulativeTo(10, DEFAULT_CONFIG)).toBe(5460);
    expect(cumulativeTo(20, DEFAULT_CONFIG)).toBe(19000);
    expect(cumulativeTo(40, DEFAULT_CONFIG)).toBe(69280);
  });

  it('coefficient is read from config — mutating it changes the output', () => {
    const mutated: EngineConfig = { ...DEFAULT_CONFIG, level: { ...DEFAULT_CONFIG.level, coefficient: 100 } };
    expect(levelRequirement(1, mutated)).not.toBe(levelRequirement(1, DEFAULT_CONFIG));
    expect(levelRequirement(1, mutated)).toBe(Math.round((200 + 100 * 1 ** 0.98) / 10) * 10);
  });
});

describe('levelFor', () => {
  it('levelFor(0) -> level 1, 0 into level, 280 for next', () => {
    const state = levelFor(0, DEFAULT_CONFIG);
    expect(state).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 280, totalXp: 0 });
  });

  it('exactly-enough XP levels up; one XP short does not', () => {
    const req1 = levelRequirement(1, DEFAULT_CONFIG);
    expect(levelFor(req1, DEFAULT_CONFIG).level).toBe(2);
    expect(levelFor(req1 - 1, DEFAULT_CONFIG).level).toBe(1);
  });

  it('a single grant crossing two boundaries advances two levels', () => {
    const req1 = levelRequirement(1, DEFAULT_CONFIG);
    const req2 = levelRequirement(2, DEFAULT_CONFIG);
    const state = levelFor(req1 + req2 + 5, DEFAULT_CONFIG);
    expect(state.level).toBe(3);
    expect(state.xpIntoLevel).toBe(5);
    expect(state.xpForNext).toBe(levelRequirement(3, DEFAULT_CONFIG));
  });
});
