import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Proves the fast-check harness is wired up. Replaced by real invariant
// properties (e.g. "0 <= daily XP <= 700") starting in Slice 3.
describe('fast-check harness', () => {
  it('string round-trips through split/join for any array of words', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ minLength: 1 }).filter((s) => !s.includes(' ')), { minLength: 1 }), (words) => {
        const joined = words.join(' ');
        expect(joined.split(' ')).toEqual(words);
      })
    );
  });
});
