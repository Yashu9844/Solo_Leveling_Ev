import { describe, it, expect } from 'vitest';
import {
  REFLECTIONS,
  selectReflection,
  type Reflection,
  type ReflectionShowState,
  type ReflectionCategory,
} from '../../src/engine/reflections';

const ALL_CATEGORIES: ReflectionCategory[] = [
  'discipline', 'focus', 'career', 'setbacks', 'consistency', 'self_efficacy',
  'training', 'study', 'procrastination', 'courage', 'identity', 'long_horizon',
];

describe('REFLECTIONS — content integrity', () => {
  it('has at least one line in every one of the 12 categories', () => {
    for (const category of ALL_CATEGORIES) {
      expect(REFLECTIONS.some((r) => r.category === category)).toBe(true);
    }
  });

  it('has unique ids', () => {
    const ids = REFLECTIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never uses aggressive or urgent tone — both were explicitly cut', () => {
    const tones = new Set(REFLECTIONS.map((r) => r.tone));
    expect(tones.has('aggressive' as never)).toBe(false);
    expect(tones.has('urgent' as never)).toBe(false);
  });

  it('every setbacks-category line is calm or reflective — the only tones post-lapse selection allows', () => {
    for (const refl of REFLECTIONS.filter((r) => r.category === 'setbacks')) {
      expect(['calm', 'reflective']).toContain(refl.tone);
    }
  });

  it('contains none of the banned words anywhere in its text', () => {
    const banned = /\b(failed|broken|ruined|lost)\b/i;
    for (const refl of REFLECTIONS) {
      expect(refl.text).not.toMatch(banned);
    }
  });

  it('never implies rest is optional, uses "no excuses"/"no days off", or compares to other people', () => {
    const banned = /(no days off|no excuses|rest is optional|sleep is optional)/i;
    for (const refl of REFLECTIONS) {
      expect(refl.text).not.toMatch(banned);
    }
  });
});

function fixture(overrides: Partial<Reflection> = {}): Reflection {
  return {
    id: 'test-1',
    text: 'test line',
    category: 'discipline',
    tone: 'calm',
    context: ['MORNING'],
    min_day: 1,
    max_day: 120,
    cooldown_days: 21,
    weight: 1,
    ...overrides,
  };
}

describe('selectReflection', () => {
  it('returns null when nothing matches the context', () => {
    const pool = [fixture({ context: ['EVENING'] })];
    const result = selectReflection(pool, new Map(), { context: 'MORNING', arcDay: 10, isPostLapse: false, today: '2026-09-10' });
    expect(result).toBeNull();
  });

  it('respects the day-range bracket on both ends', () => {
    const pool = [fixture({ id: 'early', min_day: 1, max_day: 14 }), fixture({ id: 'late', min_day: 60, max_day: 120 })];
    const day5 = selectReflection(pool, new Map(), { context: 'MORNING', arcDay: 5, isPostLapse: false, today: '2026-09-10' });
    expect(day5?.id).toBe('early');
    const day90 = selectReflection(pool, new Map(), { context: 'MORNING', arcDay: 90, isPostLapse: false, today: '2026-09-10' });
    expect(day90?.id).toBe('late');
    const day30 = selectReflection(pool, new Map(), { context: 'MORNING', arcDay: 30, isPostLapse: false, today: '2026-09-10' });
    expect(day30).toBeNull(); // neither brackets day 30
  });

  it('respects cooldown — excludes a reflection shown fewer than cooldown_days ago', () => {
    const pool = [fixture({ id: 'a', cooldown_days: 21 })];
    const states = new Map<string, ReflectionShowState>([['a', { times_shown: 1, last_shown_at: '2026-09-01' }]]);
    const tooSoon = selectReflection(pool, states, { context: 'MORNING', arcDay: 10, isPostLapse: false, today: '2026-09-15' }); // 14 days
    expect(tooSoon).toBeNull();
    const cooledDown = selectReflection(pool, states, { context: 'MORNING', arcDay: 30, isPostLapse: false, today: '2026-09-22' }); // 21 days
    expect(cooledDown?.id).toBe('a');
  });

  it('post-lapse restricts to setbacks category AND calm/reflective tone, excluding everything else', () => {
    const pool = [
      fixture({ id: 'setback-calm', category: 'setbacks', tone: 'calm', context: ['POST_LAPSE'] }),
      fixture({ id: 'setback-direct', category: 'setbacks', tone: 'direct', context: ['POST_LAPSE'] }),
      fixture({ id: 'discipline-calm', category: 'discipline', tone: 'calm', context: ['POST_LAPSE'] }),
    ];
    const result = selectReflection(pool, new Map(), { context: 'POST_LAPSE', arcDay: 10, isPostLapse: true, today: '2026-09-10' });
    expect(result?.id).toBe('setback-calm');
  });

  it('is not post-lapse-restricted outside a lapse — any matching category/tone is eligible', () => {
    const pool = [fixture({ id: 'discipline-1', category: 'discipline', tone: 'direct', context: ['MORNING'] })];
    const result = selectReflection(pool, new Map(), { context: 'MORNING', arcDay: 10, isPostLapse: false, today: '2026-09-10' });
    expect(result?.id).toBe('discipline-1');
  });

  it('deterministic rotation: prefers the least-shown candidate among ties', () => {
    const pool = [fixture({ id: 'shown-often' }), fixture({ id: 'shown-rarely' })];
    const states = new Map<string, ReflectionShowState>([
      ['shown-often', { times_shown: 5 }],
      ['shown-rarely', { times_shown: 1 }],
    ]);
    const result = selectReflection(pool, states, { context: 'MORNING', arcDay: 10, isPostLapse: false, today: '2026-09-10' });
    expect(result?.id).toBe('shown-rarely');
  });

  it('breaks a times-shown tie by weight, then by id, with no randomness', () => {
    const pool = [fixture({ id: 'z', weight: 1 }), fixture({ id: 'a', weight: 2 })];
    const result = selectReflection(pool, new Map(), { context: 'MORNING', arcDay: 10, isPostLapse: false, today: '2026-09-10' });
    expect(result?.id).toBe('a'); // higher weight wins the tie

    const sameWeight = [fixture({ id: 'z', weight: 1 }), fixture({ id: 'a', weight: 1 })];
    const result2 = selectReflection(sameWeight, new Map(), { context: 'MORNING', arcDay: 10, isPostLapse: false, today: '2026-09-10' });
    expect(result2?.id).toBe('a'); // lowest id wins the final tie-break

    // Same inputs, called twice -> identical result (fully deterministic).
    const result3 = selectReflection(sameWeight, new Map(), { context: 'MORNING', arcDay: 10, isPostLapse: false, today: '2026-09-10' });
    expect(result3?.id).toBe(result2?.id);
  });
});
