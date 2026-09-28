import { describe, it, expect } from 'vitest';
import { proposeWeeklyQuest, type DsaTopicRate } from '../../src/engine/weeklyQuest';

describe('proposeWeeklyQuest', () => {
  it('falls back to a ship-focused quest with no DSA data at all', () => {
    const proposal = proposeWeeklyQuest([]);
    expect(proposal).toEqual({
      kind: 'ship_project',
      description: 'Ship one real unit of progress this week',
      target: 1,
    });
  });

  it('falls back the same way when every topic has zero attempts', () => {
    const rates: DsaTopicRate[] = [{ topic: 'Arrays', attempts: 0, firstAttemptRate: 0 }];
    expect(proposeWeeklyQuest(rates).kind).toBe('ship_project');
  });

  it("targets the topic with the lowest first-attempt rate, matching final/05 §6's example shape", () => {
    const rates: DsaTopicRate[] = [
      { topic: 'Arrays', attempts: 10, firstAttemptRate: 0.7 },
      { topic: 'Graphs', attempts: 12, firstAttemptRate: 0.31 },
      { topic: 'DP', attempts: 5, firstAttemptRate: 0.5 },
    ];
    const proposal = proposeWeeklyQuest(rates);
    expect(proposal.kind).toBe('dsa_topic_volume');
    expect(proposal.topic).toBe('Graphs');
    expect(proposal.description).toBe('18 problems, Graphs focus (31% first-attempt, weakest)'); // round(12 * 1.5) = 18
    expect(proposal.target).toBe(18);
  });

  it('floors the target at 10 even for a topic touched only once', () => {
    const rates: DsaTopicRate[] = [{ topic: 'Arrays', attempts: 1, firstAttemptRate: 0 }];
    expect(proposeWeeklyQuest(rates).target).toBe(10);
  });

  it('ties resolved by topic name, for determinism', () => {
    const rates: DsaTopicRate[] = [
      { topic: 'Trees', attempts: 5, firstAttemptRate: 0.4 },
      { topic: 'Arrays', attempts: 5, firstAttemptRate: 0.4 },
    ];
    expect(proposeWeeklyQuest(rates).topic).toBe('Arrays');
  });
});
