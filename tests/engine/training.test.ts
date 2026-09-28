import { describe, it, expect } from 'vitest';
import { estimate1RM } from '../../src/engine/training';

describe('estimate1RM (Epley)', () => {
  it('computes weight * (1 + reps/30)', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(100 * (1 + 5 / 30));
    expect(estimate1RM(60, 10)).toBeCloseTo(80);
  });

  it('degenerates to the raw weight at zero or negative reps', () => {
    expect(estimate1RM(80, 0)).toBe(80);
    expect(estimate1RM(80, -1)).toBe(80);
  });
});
