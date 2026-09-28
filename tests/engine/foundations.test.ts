import { describe, it, expect } from 'vitest';
import { foundationMasteryFor, foundationMasteryPoints, FOUNDATION_TOPICS } from '../../src/engine/foundations';
import type { LearningBlockFixture } from '../../src/engine/foundations';

function block(topic: string, local_date: string): LearningBlockFixture {
  return { topic, local_date };
}

describe('foundationMasteryFor', () => {
  it('unseen with no blocks', () => {
    expect(foundationMasteryFor('Networking', [])).toBe('unseen');
  });

  it('introduced at 1 block, applied at 3, fluent at 5', () => {
    const blocks = [
      block('Networking', '2026-09-01'),
      block('Networking', '2026-09-02'),
    ];
    expect(foundationMasteryFor('Networking', blocks)).toBe('introduced');

    blocks.push(block('Networking', '2026-09-03'));
    expect(foundationMasteryFor('Networking', blocks)).toBe('applied');

    blocks.push(block('Networking', '2026-09-04'), block('Networking', '2026-09-05'));
    expect(foundationMasteryFor('Networking', blocks)).toBe('fluent');
  });

  it('retains once a block lands >= 21 days after reaching Fluent', () => {
    const blocks = [
      block('Databases', '2026-09-01'),
      block('Databases', '2026-09-02'),
      block('Databases', '2026-09-03'),
      block('Databases', '2026-09-04'),
      block('Databases', '2026-09-05'), // Fluent reached here
    ];
    expect(foundationMasteryFor('Databases', blocks)).toBe('fluent');

    blocks.push(block('Databases', '2026-09-25')); // 20 days later — not yet
    expect(foundationMasteryFor('Databases', blocks)).toBe('fluent');

    blocks.push(block('Databases', '2026-09-26')); // 21 days later — retained
    expect(foundationMasteryFor('Databases', blocks)).toBe('retained');
  });

  it('is scoped per-topic — blocks for a different topic never contribute', () => {
    const blocks = [block('Networking', '2026-09-01'), block('Networking', '2026-09-02'), block('Networking', '2026-09-03')];
    expect(foundationMasteryFor('Databases', blocks)).toBe('unseen');
  });
});

describe('foundationMasteryPoints', () => {
  it('sums points across all nine topics (unseen contributes 0)', () => {
    expect(FOUNDATION_TOPICS).toHaveLength(9);
    expect(foundationMasteryPoints([])).toBe(0);
  });

  it('hand-computed: one topic at Introduced (1pt) + one at Applied (2pt) = 3', () => {
    const blocks = [
      block('Operating Systems', '2026-09-01'),
      block('Networking', '2026-09-01'),
      block('Networking', '2026-09-02'),
      block('Networking', '2026-09-03'),
    ];
    expect(foundationMasteryPoints(blocks)).toBe(1 + 2);
  });
});
