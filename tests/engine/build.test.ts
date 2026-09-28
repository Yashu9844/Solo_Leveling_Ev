import { describe, it, expect } from 'vitest';
import { learnShipRatio, learnShipRuleFires, type BuildSessionFixture } from '../../src/engine/build';

function sessions(learn: number, ship: number): BuildSessionFixture[] {
  const result: BuildSessionFixture[] = [];
  for (let i = 0; i < learn; i++) result.push({ local_date: '2026-09-05', mode: 'LEARN' });
  for (let i = 0; i < ship; i++) result.push({ local_date: '2026-09-05', mode: 'SHIP' });
  return result;
}

describe('learnShipRatio / learnShipRuleFires', () => {
  it('matches final/03 §4.1s example: 11 learning, 2 shipped -> 5.5, fires', () => {
    const s = sessions(11, 2);
    expect(learnShipRatio(s)).toBe(5.5);
    expect(learnShipRuleFires(s)).toBe(true);
  });

  it('does not fire at exactly 3:1', () => {
    const s = sessions(9, 3);
    expect(learnShipRatio(s)).toBe(3);
    expect(learnShipRuleFires(s)).toBe(false);
  });

  it('fires just above 3:1', () => {
    const s = sessions(10, 3);
    expect(learnShipRuleFires(s)).toBe(true);
  });

  it('does not fire when there is no learning at all', () => {
    expect(learnShipRuleFires(sessions(0, 5))).toBe(false);
  });

  it('fires when there are learn sessions and zero ship sessions', () => {
    expect(learnShipRatio(sessions(5, 0))).toBe(Infinity);
    expect(learnShipRuleFires(sessions(5, 0))).toBe(true);
  });

  it('does not fire on an empty window', () => {
    expect(learnShipRuleFires([])).toBe(false);
  });
});
