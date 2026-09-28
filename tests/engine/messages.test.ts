import { describe, it, expect } from 'vitest';
import { selectMessage, type DayFacts, type MessageContext } from '../../src/engine/messages';

function day(local_date: string, core_completed: number, core_total = 6): DayFacts {
  return { local_date, core_completed, core_total };
}

describe('selectMessage', () => {
  it('falls back to the neutral P5 status when there is not enough history for P4', () => {
    const context: MessageContext = {
      today: day('2026-09-05', 4),
      trailingDays: [day('2026-09-03', 6), day('2026-09-04', 5)], // only 2 days
    };
    expect(selectMessage(context)).toBe('4 of 6 complete.');
  });

  it('P5 is always available even with zero history', () => {
    const context: MessageContext = { today: day('2026-09-05', 0), trailingDays: [] };
    expect(selectMessage(context)).toBe('0 of 6 complete.');
  });

  it('produces the P4 consistency fact once there are at least 7 trailing days', () => {
    const trailingDays = [
      day('2026-08-30', 6),
      day('2026-08-31', 6),
      day('2026-09-01', 3),
      day('2026-09-02', 6),
      day('2026-09-03', 6),
      day('2026-09-04', 4),
      day('2026-09-05', 6),
    ];
    const context: MessageContext = { today: day('2026-09-06', 6), trailingDays };
    // 5 of the 7 trailing days were fully complete (6 of 6).
    expect(selectMessage(context)).toBe('5 of the last 7 days were fully complete.');
  });

  it('P4 only counts the trailing 14 days, even with more history available', () => {
    const trailingDays = Array.from({ length: 20 }, (_, i) => day(`2026-08-${10 + i}`, 6, 6));
    const context: MessageContext = { today: day('2026-09-06', 6), trailingDays };
    expect(selectMessage(context)).toBe('14 of the last 14 days were fully complete.');
  });

  it('P4 prefers a real signal over P5 when both are available', () => {
    const trailingDays = Array.from({ length: 7 }, (_, i) => day(`2026-08-${20 + i}`, 6, 6));
    const context: MessageContext = { today: day('2026-08-27', 6), trailingDays };
    expect(selectMessage(context)).not.toBe('6 of 6 complete.');
  });
});

describe('selectMessage — P1 personal records', () => {
  it('a new longest deep block beats everything below it', () => {
    const context: MessageContext = {
      today: day('2026-09-05', 6),
      trailingDays: [],
      newLongestDeepBlockMinutes: 84,
    };
    expect(selectMessage(context)).toBe('Longest deep block yet: 84 minutes.');
  });

  it('the first hard problem solved first-attempt fires exactly on that flag', () => {
    const context: MessageContext = { today: day('2026-09-05', 6), trailingDays: [], firstHardProblemFirstAttempt: true };
    expect(selectMessage(context)).toBe('First hard problem first-attempt.');
  });

  it('the first reachable deployment fires exactly on that flag', () => {
    const context: MessageContext = { today: day('2026-09-05', 6), trailingDays: [], firstDeploymentReachable: true };
    expect(selectMessage(context)).toBe('First deployment reachable from outside your machine.');
  });

  it('P1 beats P4 even when there is plenty of P4 history available', () => {
    const trailingDays = Array.from({ length: 14 }, (_, i) => day(`2026-08-${10 + i}`, 6, 6));
    const context: MessageContext = { today: day('2026-09-06', 6), trailingDays, firstHardProblemFirstAttempt: true };
    expect(selectMessage(context)).toBe('First hard problem first-attempt.');
  });
});

describe('selectMessage — P2 trend with numbers', () => {
  it('reports the medium first-attempt-rate trend only when it genuinely improved', () => {
    const improved: MessageContext = {
      today: day('2026-09-05', 6),
      trailingDays: [],
      firstAttemptRateMTrend: { current: 0.58, previous: 0.31 },
    };
    expect(selectMessage(improved)).toBe('First-attempt on mediums: 58% over 14 days, up from 31%.');

    const notImproved: MessageContext = {
      today: day('2026-09-05', 6),
      trailingDays: [],
      firstAttemptRateMTrend: { current: 0.3, previous: 0.5 }, // declined -- P2 should not report this as improvement
    };
    expect(selectMessage(notImproved)).toBe('6 of 6 complete.'); // falls through to P5
  });

  it('reports a wake-SD improvement only when it genuinely tightened', () => {
    const improved: MessageContext = {
      today: day('2026-09-05', 6),
      trailingDays: [],
      wakeSdTrend: { current: 38, fourWeeksAgo: 71 },
    };
    expect(selectMessage(improved)).toBe('Wake SD down to 38 min. Four weeks ago: 71.');

    const worsened: MessageContext = {
      today: day('2026-09-05', 6),
      trailingDays: [],
      wakeSdTrend: { current: 71, fourWeeksAgo: 38 },
    };
    expect(selectMessage(worsened)).toBe('6 of 6 complete.');
  });

  it('P2 beats P4', () => {
    const trailingDays = Array.from({ length: 14 }, (_, i) => day(`2026-08-${10 + i}`, 6, 6));
    const context: MessageContext = { today: day('2026-09-06', 6), trailingDays, wakeSdTrend: { current: 38, fourWeeksAgo: 71 } };
    expect(selectMessage(context)).toBe('Wake SD down to 38 min. Four weeks ago: 71.');
  });
});

describe('selectMessage — P3 correlation', () => {
  it('reports the sleep-window correlation when supplied', () => {
    const context: MessageContext = {
      today: day('2026-09-05', 6),
      trailingDays: [],
      dsaFirstAttemptBySleep: { afterHit: 0.71, afterMiss: 0.44 },
    };
    expect(selectMessage(context)).toBe('DSA first-attempt after a hit sleep window: 71%. After a miss: 44%.');
  });

  it('P3 beats P4 but loses to P1/P2', () => {
    const trailingDays = Array.from({ length: 14 }, (_, i) => day(`2026-08-${10 + i}`, 6, 6));
    const withP3Only: MessageContext = { today: day('2026-09-06', 6), trailingDays, dsaFirstAttemptBySleep: { afterHit: 0.71, afterMiss: 0.44 } };
    expect(selectMessage(withP3Only)).toContain('DSA first-attempt');

    const withP1Too: MessageContext = { ...withP3Only, firstHardProblemFirstAttempt: true };
    expect(selectMessage(withP1Too)).toBe('First hard problem first-attempt.');
  });
});
