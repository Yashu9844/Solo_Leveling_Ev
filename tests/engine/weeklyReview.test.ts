import { describe, it, expect } from 'vitest';
import { attributeDeltas, bottleneckFrom, improvedFrom, declinedFrom, weeklyReviewFor, resumeNudgeFor, sleepDsaCorrelation } from '../../src/engine/weeklyReview';
import type { AttributeResult } from '../../src/engine/attributes';
import type { RuleProposal } from '../../src/engine/rules';

function snapshot(values: Partial<Record<AttributeResult['attribute'], number>>): AttributeResult[] {
  const all: AttributeResult['attribute'][] = ['DISCIPLINE', 'DEPTH', 'PROBLEM_SOLVING', 'ENGINEERING', 'MOMENTUM', 'VITALITY'];
  return all.map((attribute) => ({ attribute, value: values[attribute] ?? 0, components: {} }));
}

describe('attributeDeltas', () => {
  it('hand-computed: pairs before/after by attribute name and computes the delta', () => {
    const before = snapshot({ DISCIPLINE: 72, PROBLEM_SOLVING: 54, MOMENTUM: 60 });
    const after = snapshot({ DISCIPLINE: 60, PROBLEM_SOLVING: 61, MOMENTUM: 70 });
    const deltas = attributeDeltas(before, after);

    const discipline = deltas.find((d) => d.attribute === 'DISCIPLINE')!;
    expect(discipline).toEqual({ attribute: 'DISCIPLINE', before: 72, after: 60, delta: -12 });

    const problemSolving = deltas.find((d) => d.attribute === 'PROBLEM_SOLVING')!;
    expect(problemSolving.delta).toBe(7);

    const momentum = deltas.find((d) => d.attribute === 'MOMENTUM')!;
    expect(momentum.delta).toBe(10);
  });

  it('skips an attribute missing from the before snapshot', () => {
    const before = [{ attribute: 'DISCIPLINE' as const, value: 50, components: {} }];
    const after = snapshot({ DISCIPLINE: 55, VITALITY: 40 });
    const deltas = attributeDeltas(before, after);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!.attribute).toBe('DISCIPLINE');
  });
});

describe('bottleneckFrom — final/05 §6\'s fixture week ("DECLINED Discipline (sleep window)" -> BOTTLENECK Sleep window)', () => {
  it('picks the single most-declined attribute', () => {
    const before = snapshot({ DISCIPLINE: 72, PROBLEM_SOLVING: 54, MOMENTUM: 60, VITALITY: 50 });
    const after = snapshot({ DISCIPLINE: 50, PROBLEM_SOLVING: 61, MOMENTUM: 70, VITALITY: 48 });
    const deltas = attributeDeltas(before, after);
    // DISCIPLINE drops 22, VITALITY drops 2 -> DISCIPLINE is the bottleneck.
    expect(bottleneckFrom(deltas)).toBe('DISCIPLINE');
  });

  it('is null when nothing declined', () => {
    const before = snapshot({ DISCIPLINE: 50 });
    const after = snapshot({ DISCIPLINE: 55 });
    expect(bottleneckFrom(attributeDeltas(before, after))).toBeNull();
  });
});

describe('improvedFrom / declinedFrom', () => {
  it('hand-computed: matches final/05 §6\'s fixture week exactly', () => {
    // "IMPROVED Problem solving · Momentum" · "DECLINED Discipline"
    const before = snapshot({ DISCIPLINE: 72, PROBLEM_SOLVING: 54, MOMENTUM: 60, ENGINEERING: 63, VITALITY: 50, DEPTH: 61 });
    const after = snapshot({ DISCIPLINE: 50, PROBLEM_SOLVING: 65, MOMENTUM: 68, ENGINEERING: 63, VITALITY: 50, DEPTH: 61 });
    const deltas = attributeDeltas(before, after);

    // PROBLEM_SOLVING +11, MOMENTUM +8 -> strongest first.
    expect(improvedFrom(deltas)).toEqual(['PROBLEM_SOLVING', 'MOMENTUM']);
    expect(declinedFrom(deltas)).toEqual(['DISCIPLINE']);
  });

  it('respects the limit', () => {
    const before = snapshot({ DISCIPLINE: 10, DEPTH: 10, PROBLEM_SOLVING: 10, ENGINEERING: 10, MOMENTUM: 10, VITALITY: 10 });
    const after = snapshot({ DISCIPLINE: 90, DEPTH: 80, PROBLEM_SOLVING: 70, ENGINEERING: 60, MOMENTUM: 50, VITALITY: 40 });
    expect(improvedFrom(attributeDeltas(before, after), 2)).toHaveLength(2);
    expect(improvedFrom(attributeDeltas(before, after), 2)[0]).toBe('DISCIPLINE'); // +80, the largest
  });
});

describe('weeklyReviewFor — fixture week end-to-end (final/08\'s Slice 11 done criterion)', () => {
  it('assembles improved/declined/bottleneck/proposals from a hand-built fixture week', () => {
    const before = snapshot({ DISCIPLINE: 72, PROBLEM_SOLVING: 54, MOMENTUM: 60 });
    const after = snapshot({ DISCIPLINE: 45, PROBLEM_SOLVING: 61, MOMENTUM: 70 });
    const deltas = attributeDeltas(before, after);
    const proposals: RuleProposal[] = [
      { rule: 'LEARN_SHIP_RATIO', message: 'SHIP only.', fires_on: 'ratio > 3:1' },
    ];

    const review = weeklyReviewFor(deltas, proposals);
    expect(review.bottleneck).toBe('DISCIPLINE');
    expect(review.declined).toEqual(['DISCIPLINE']);
    expect(review.improved).toEqual(['MOMENTUM', 'PROBLEM_SOLVING']);
    expect(review.proposals).toEqual(proposals);
  });

  it('an empty-history fixture week produces no bottleneck and no proposals', () => {
    const flat = snapshot({});
    const review = weeklyReviewFor(attributeDeltas(flat, flat), []);
    expect(review.bottleneck).toBeNull();
    expect(review.improved).toEqual([]);
    expect(review.declined).toEqual([]);
    expect(review.proposals).toEqual([]);
  });
});

describe('resumeNudgeFor', () => {
  it('is null when nothing shipped', () => {
    expect(resumeNudgeFor(0)).toBeNull();
  });

  it('singular for exactly one artifact', () => {
    expect(resumeNudgeFor(1)).toBe('You shipped 1 artifact this week. Does your resume say so?');
  });

  it('plural for more than one, matching final/02 §5s pattern', () => {
    expect(resumeNudgeFor(2)).toBe('You shipped 2 artifacts this week. Does your resume say so?');
  });
});

describe('sleepDsaCorrelation', () => {
  it('is null with no wake records or no DSA rates at all', () => {
    expect(sleepDsaCorrelation([], [])).toBeNull();
    expect(sleepDsaCorrelation([{ local_date: '2026-09-05', onTime: false }], [])).toBeNull();
  });

  it('is null when every wake record is on the same side (no miss or no on-time to compare)', () => {
    const wakeRecords = [
      { local_date: '2026-09-01', onTime: true },
      { local_date: '2026-09-02', onTime: true },
    ];
    const dsaRates = [
      { local_date: '2026-09-02', firstAttemptRate: 0.5 },
      { local_date: '2026-09-03', firstAttemptRate: 0.6 },
    ];
    expect(sleepDsaCorrelation(wakeRecords, dsaRates)).toBeNull();
  });

  it("matches final/05 §6's example shape: a real gap, positive deltaPoints when misses correlate with a lower next-day rate", () => {
    const wakeRecords = [
      { local_date: '2026-09-01', onTime: false }, // miss -> next day 0.2
      { local_date: '2026-09-02', onTime: false }, // miss -> next day 0.3
      { local_date: '2026-09-03', onTime: true }, // on-time -> next day 0.6
      { local_date: '2026-09-04', onTime: true }, // on-time -> next day 0.7
    ];
    const dsaRates = [
      { local_date: '2026-09-02', firstAttemptRate: 0.2 },
      { local_date: '2026-09-03', firstAttemptRate: 0.3 },
      { local_date: '2026-09-04', firstAttemptRate: 0.6 },
      { local_date: '2026-09-05', firstAttemptRate: 0.7 },
    ];
    const result = sleepDsaCorrelation(wakeRecords, dsaRates);
    expect(result).not.toBeNull();
    expect(result!.missedNights).toBe(2);
    expect(result!.afterMissRate).toBeCloseTo(0.25);
    expect(result!.afterOnTimeRate).toBeCloseTo(0.65);
    expect(result!.deltaPoints).toBe(40);
  });

  it('a wake record with no following-day DSA data is simply excluded, not treated as a zero', () => {
    const wakeRecords = [
      { local_date: '2026-09-01', onTime: false }, // no DSA data the next day -- excluded
      { local_date: '2026-09-02', onTime: false }, // next day 0.2
      { local_date: '2026-09-03', onTime: true }, // next day 0.8
    ];
    const dsaRates = [
      { local_date: '2026-09-03', firstAttemptRate: 0.2 },
      { local_date: '2026-09-04', firstAttemptRate: 0.8 },
    ];
    const result = sleepDsaCorrelation(wakeRecords, dsaRates);
    expect(result!.afterMissRate).toBe(0.2);
    expect(result!.afterOnTimeRate).toBe(0.8);
  });
});
