import { describe, it, expect } from 'vitest';
import { ifThenFiringRate, type FirableQuestInstanceFixture } from '../../src/engine/ifThen';

function instance(state: FirableQuestInstanceFixture['state'], recovered: boolean): FirableQuestInstanceFixture {
  return { state, recovered };
}

describe('ifThenFiringRate', () => {
  it('is 0 on an empty window -- no data reads as "not proven," never "achieved"', () => {
    expect(ifThenFiringRate([])).toBe(0);
  });

  it('is 1 when every instance completed on its own day', () => {
    const instances = [instance('complete', false), instance('complete', false), instance('complete', false)];
    expect(ifThenFiringRate(instances)).toBe(1);
  });

  it('a recovered completion does not count as a fire, even though it eventually completed', () => {
    const instances = [instance('complete', false), instance('complete', true)];
    expect(ifThenFiringRate(instances)).toBe(0.5);
  });

  it('an incomplete/expired instance does not count as a fire', () => {
    const instances = [instance('complete', false), instance('incomplete', false), instance('expired', false)];
    expect(ifThenFiringRate(instances)).toBeCloseTo(1 / 3);
  });

  it('matches final/01 §8s 80% threshold at the boundary', () => {
    const instances = [
      ...Array(8).fill(null).map(() => instance('complete', false)),
      ...Array(2).fill(null).map(() => instance('incomplete', false)),
    ];
    expect(ifThenFiringRate(instances)).toBe(0.8);
  });
});
