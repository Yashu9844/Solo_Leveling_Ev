// Loop 8.1: the TypeScript port of final/xp-simulation.py must BE the script - same random
// stream, same means - because the level curve was priced by it (final/01 §3).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { levelAt, meanTotals, PythonRandom, requiredXp, simulate } from '../../src/library/simulation';

const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/xp-simulation-means.json', import.meta.url)), 'utf-8')) as Record<string, number[]>;

describe('PythonRandom', () => {
  it('is Python\'s Mersenne Twister: random.Random(1).random() and choice()', () => {
    // Values from CPython 3.13: random.Random(1).random() x3, then random.Random(7).choice() x3.
    const rng = new PythonRandom(1);
    expect([rng.random(), rng.random(), rng.random()]).toEqual([0.13436424411240122, 0.8474337369372327, 0.763774618976614]);
    const choices = new PythonRandom(7);
    expect([choices.choice([0, 1, 1, 2, 2, 3]), choices.choice([0, 1, 1, 2, 2, 3]), choices.choice([15, 25, 25, 40])]).toEqual([1, 1, 40]);
  });
});

describe('the level curve (final/01 §3)', () => {
  it('prices a level exactly as the table says at coefficient 84', () => {
    const table: [number, number][] = [[1, 280], [2, 370], [3, 450], [5, 610], [10, 1000], [15, 1390], [20, 1780], [25, 2170], [30, 2550], [35, 2940], [40, 3320], [45, 3700], [50, 4080]];
    for (const [level, xp] of table) expect(requiredXp(level, 84), `level ${level}`).toBe(xp);
    expect(levelAt(0, 84)).toBe(1);
    expect(levelAt(280, 84)).toBe(2);
    expect(levelAt(279, 84)).toBe(1);
  });
});

describe('the Monte Carlo (60 seeds, 120 days)', () => {
  it('reproduces the Python script\'s means to the last digit, for every completion rate', () => {
    for (const [p, expected] of Object.entries(GOLDEN)) {
      const mean = meanTotals({ days: 120, p: Number(p) }, [30, 60, 90, 120]);
      mean.forEach((value, i) => expect(value, `p=${p} day ${[30, 60, 90, 120][i]}`).toBeCloseTo(expected[i]!, 9));
    }
  });

  it('reproduces final/01 §3 "Simulated arc outcomes": total, xp/day and the terminus level (coefficient 84)', () => {
    const table: [p: number, total: number, perDay: number, level: number][] = [
      [0.5, 43574, 363, 31], [0.6, 51657, 430, 34], [0.7, 60044, 500, 37], [0.85, 71984, 600, 40], [0.95, 80200, 668, 43], [1.0, 84201, 702, 44],
    ];
    for (const [p, total, perDay, level] of table) {
      const [mean] = meanTotals({ days: 120, p }, [120]);
      expect(Math.abs(mean! - total), `total at ${p}`).toBeLessThanOrEqual(0.5); // the doc prints Python's round-half-even
      expect(Math.abs(mean! / 120 - perDay), `xp/day at ${p}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(levelAt(mean!, 84) - level), `terminus at ${p}`).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic and cumulative', () => {
    const a = simulate({ days: 30, p: 0.85, seed: 3 });
    expect(simulate({ days: 30, p: 0.85, seed: 3 })).toEqual(a);
    expect(a).toHaveLength(30);
    expect(a.every((value, i) => i === 0 || value >= a[i - 1]!)).toBe(true);
  });
});
