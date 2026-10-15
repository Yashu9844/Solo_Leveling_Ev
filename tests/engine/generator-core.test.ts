// Loop 8.2: generator stages S1-S5. The owner's economy must fall out of legacy-shaped answers
// (100/100/100/100/60/40 with caps 140/200/200/150/60/40) - as a check on the rules, not an input to them.
import { describe, expect, it } from 'vitest';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import type { Criterion } from '../../src/blueprint/schema';
import { generateCore } from '../../src/generator';
import { priorityTilt } from '../../src/generator/s5Economy';
import { allocate, shortHash, slug } from '../../src/generator/util';
import type { DraftState } from '../../src/generator/types';

const LEGACY_SHAPED: DraftState = {
  lineageId: 'arc-legacy', today: '2026-09-01',
  identity: { displayName: 'SYSTEM', primaryObjective: 'Ship a working agent and land an offer.' },
  domains: [
    { archetypeId: 'career-pipeline' }, { archetypeId: 'software-practice' }, { archetypeId: 'deep-build' },
    { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' },
  ],
  priorityMode: 'equal',
  rhythm: { wakeTime: '08:30', sleepTime: '02:00' },
  arc: { startDate: '2026-09-01', lengthDays: 120, timezone: 'Asia/Kolkata' },
};

/** The generated instrument id -> the owner's, per domain position. */
const OWNER_IDS: Record<string, string>[] = [
  { main: 'career.applications', substitute: 'career.substitute', resumes: 'career.resumes' },
  { main: 'dsa.problems' },
  { main: 'build.sessions', artifacts: 'build.artifacts' },
  { main: 'training.sessions', steps: 'training.steps' },
  { main: 'sleep.wake' },
  { main: 'attention.screen' },
];

const withOwnerIds = (criterion: Criterion, ids: Record<string, string>): Criterion =>
  criterion.kind === 'signal'
    ? { ...criterion, instrumentId: ids[criterion.instrumentId.split('.').pop()!]! }
    : { kind: criterion.kind, of: criterion.of.map((child) => withOwnerIds(child, ids)) };

describe('generator S1-S5, legacy-shaped answers', () => {
  const generated = generateCore(LEGACY_SHAPED);

  it('prices the owner\'s economy: core XP 100/100/100/100/60/40', () => {
    expect(generated.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(generated.quests.map((quest) => quest.xp)).toEqual([100, 100, 100, 100, 60, 40]);
    expect(generated.quests.reduce((sum, quest) => sum + quest.xp, 0)).toBe(500);
  });

  it('caps the channels at 140/200/200/150/60/40', () => {
    expect(generated.domains.map((domain) => domain.channel.cap)).toEqual([140, 200, 200, 150, 60, 40]);
    expect(generated.domains.map((domain) => domain.channel.id)).toEqual(['CAREER', 'MIND', 'CRAFT', 'BODY', 'SLEEP', 'ATTENTION']);
  });

  it('is the owner\'s progression: budget, cap, coefficient 84, checkpoints, the day boundary', () => {
    const owner = LEGACY_BLUEPRINT_V1.progression;
    // Two things a generated System adds: its Reduced Mode collapses, and its features open by level (the owner's open from the start).
    const { unlocks, ...withoutUnlocks } = generated.progression;
    expect(unlocks).toBeDefined();
    expect({ ...withoutUnlocks, reducedMode: { ...generated.progression.reducedMode, collapsesQuests: false } }).toEqual(owner);
    expect(generated.draft.arc).toMatchObject({ dayBoundaryHour: 4, dayCloseHour: 3, wakeTime: '08:30', sleepTime: '02:00', lengthDays: 120, endDate: '2026-12-29' });
    expect(generated.progression.reducedMode.collapsesQuests).toBe(true); // a generated System's Reduced Mode collapses to the floor
  });

  it('writes the owner\'s criteria (same instruments, signals, comparators and targets)', () => {
    generated.quests.forEach((quest, index) => {
      const owner = LEGACY_BLUEPRINT_V1.quests[index]!;
      expect(withOwnerIds(quest.criterion, OWNER_IDS[index]!), owner.id).toEqual(owner.criterion);
      expect(withOwnerIds(quest.floor, OWNER_IDS[index]!), `${owner.id} floor`).toEqual(owner.floor);
    });
  });

  it('adapts the instruments: the owner\'s parameters, with the wake time the person gave', () => {
    const byId = new Map(generated.instruments.map((instrument) => [instrument.id.split('.').pop() + '@' + instrument.domainId, instrument]));
    const wake = generated.instruments.find((instrument) => instrument.type === 'time_window')!;
    expect(wake.params).toEqual(LEGACY_BLUEPRINT_V1.instruments.find((instrument) => instrument.id === 'sleep.wake')!.params);
    for (const [domainIndex, mapping] of OWNER_IDS.entries()) {
      for (const [key, ownerId] of Object.entries(mapping)) {
        if (ownerId === 'career.substitute') continue; // the owner's substitute duration carries no minimum; a generated one asks for 10m
        const instrument = generated.instruments.find((candidate) => candidate.id === `${generated.domains[domainIndex]!.id}.${key}`)!;
        expect(instrument.params, ownerId).toEqual(LEGACY_BLUEPRINT_V1.instruments.find((candidate) => candidate.id === ownerId)!.params);
      }
    }
    expect(byId.size).toBe(generated.instruments.length);
  });

  it('is deterministic, and its ids are stable per lineage and different across lineages', () => {
    expect(generateCore(LEGACY_SHAPED)).toEqual(generated);
    const other = generateCore({ ...LEGACY_SHAPED, lineageId: 'arc-other' });
    expect(other.domains.map((domain) => domain.id)).not.toEqual(generated.domains.map((domain) => domain.id));
    expect(other.quests.map((quest) => quest.xp)).toEqual(generated.quests.map((quest) => quest.xp));
    expect(generated.domains.map((domain) => domain.id)).toEqual(generated.domains.map((domain) => `${slug(domain.archetypeId!)}-${shortHash(`arc-legacy|${slug(domain.archetypeId!)}`)}`));
  });
});

describe('S5 allocation, over every shape the interview can reach', () => {
  const ENGINES = ['career-pipeline', 'software-practice', 'deep-build', 'strength-movement'];
  const GUARDRAILS = ['sleep-regularity', 'attention-control'];

  it('always sums to 500, keeps each quest in [30, 150], in whole tens, ranked or equal', () => {
    for (const engines of [2, 3, 4, 5, 6]) {
      for (const guardrails of [1, 2, 3]) {
        if (engines + guardrails < 4 || engines + guardrails > 8) continue;
        for (const priorityMode of ['ranked', 'equal'] as const) {
          const domains = [
            ...Array.from({ length: engines }, (_, i) => ({ archetypeId: ENGINES[i % ENGINES.length]! })),
            ...Array.from({ length: guardrails }, (_, i) => ({ archetypeId: GUARDRAILS[i % GUARDRAILS.length]! })),
          ];
          const result = generateCore({ ...LEGACY_SHAPED, domains, priorityMode });
          const xp = result.quests.map((quest) => quest.xp);
          const label = `${engines} engines + ${guardrails} guardrails, ${priorityMode}`;
          expect(result.issues.filter((issue) => issue.severity === 'error'), label).toEqual([]);
          expect(xp.reduce((sum, v) => sum + v, 0), label).toBe(500);
          for (const v of xp) {
            expect(v, label).toBeGreaterThanOrEqual(30);
            expect(v, label).toBeLessThanOrEqual(150);
            expect(v % 10, label).toBe(0);
          }
          // First-unit dominance (V-XP-03): no channel earns more beyond its quest than the smallest engine's quest is worth.
          const smallestEngine = Math.min(...result.quests.filter((quest) => result.domains.find((domain) => domain.id === quest.domainId)!.role === 'engine').map((quest) => quest.xp));
          for (const quest of result.quests) {
            const cap = result.domains.find((domain) => domain.id === quest.domainId)!.channel.cap;
            expect(cap - quest.xp, `${label}: ${quest.id}`).toBeLessThanOrEqual(smallestEngine);
          }
        }
      }
    }
  });

  it('ranked priority tilts toward what matters most; equal does not', () => {
    const domains = ENGINES.map((archetypeId) => ({ archetypeId })).concat(GUARDRAILS.map((archetypeId) => ({ archetypeId })));
    const ranked = generateCore({ ...LEGACY_SHAPED, domains, priorityMode: 'ranked' }).quests.map((quest) => quest.xp).slice(0, 4);
    expect(ranked[0]).toBeGreaterThan(ranked[3]!);
    expect([...ranked].sort((a, b) => b - a)).toEqual(ranked);
    expect(priorityTilt(0)).toBeCloseTo(1.2);
    expect(priorityTilt(3)).toBeCloseTo(0.9);
    expect(priorityTilt(20)).toBe(0.6);
  });

  it('allocate() respects bounds and hits the total when it can', () => {
    expect(allocate(500, [{ weight: 1, min: 30, max: 150 }, { weight: 1, min: 30, max: 150 }, { weight: 1, min: 30, max: 150 }, { weight: 1, min: 30, max: 150 }, { weight: 1, min: 30, max: 150 }], 10)).toEqual([100, 100, 100, 100, 100]);
    const clamped = allocate(400, [{ weight: 3, min: 30, max: 150 }, { weight: 1, min: 30, max: 150 }, { weight: 1, min: 30, max: 150 }], 10);
    expect(clamped.reduce((sum, v) => sum + v, 0)).toBe(400);
    expect(clamped[0]).toBe(150); // the heavy item is pinned at its maximum and the others share the rest
    expect(clamped.every((v) => v >= 30 && v <= 150 && v % 10 === 0)).toBe(true);
  });
});

describe('S1 normalize, S2 resolve and the answers', () => {
  it('derives the day boundary from the sleep time, at any hour (a night shift works)', () => {
    const arc = (sleepTime: string) => generateCore({ ...LEGACY_SHAPED, rhythm: { wakeTime: '07:00', sleepTime } }).draft.arc;
    expect(arc('02:00')).toMatchObject({ dayBoundaryHour: 4, dayCloseHour: 3 });
    expect(arc('23:00')).toMatchObject({ dayBoundaryHour: 1, dayCloseHour: 0 });
    expect(arc('09:00')).toMatchObject({ dayBoundaryHour: 11, dayCloseHour: 10 });
  });

  it('clamps and defaults without throwing, and says what it changed', () => {
    const result = generateCore({
      ...LEGACY_SHAPED, identity: { displayName: '   ', primaryObjective: '  go  ' },
      arc: { startDate: '2026-01-01', lengthDays: 5000, timezone: 'Mars/Olympus' }, rhythm: { wakeTime: 'soon', sleepTime: '' },
    });
    expect(result.draft.identity).toEqual({ displayName: 'SYSTEM', primaryObjective: 'go' });
    expect(result.draft.arc).toMatchObject({ lengthDays: 365, timezone: 'UTC', startDate: '2026-08-18', wakeTime: '07:00', sleepTime: '23:00' });
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['G-ARC-01', 'G-ARC-02', 'G-ARC-03']));
  });

  it('skips a domain the library does not know, and reports it', () => {
    const result = generateCore({ ...LEGACY_SHAPED, domains: [{ archetypeId: 'astrology' }, { archetypeId: 'deep-build' }] });
    expect(result.domains).toHaveLength(1);
    expect(result.issues.map((issue) => issue.code)).toContain('G-ARCH-01');
    expect(generateCore({ ...LEGACY_SHAPED, domains: [] }).quests).toEqual([]);
  });

  it('takes the person\'s numbers: good day, hard day, limit, topics, wake time, designation', () => {
    const result = generateCore({
      ...LEGACY_SHAPED, rhythm: { wakeTime: '06:15', sleepTime: '22:30' },
      domains: [
        { archetypeId: 'software-practice', answers: { goodDay: 4, hardDay: 1, topics: ['Arrays', ' Graphs ', 'Arrays'], designation: 'Riddle Wall' } },
        { archetypeId: 'deep-build', answers: { goodDay: 90 } },
        { archetypeId: 'sleep-regularity' },
        { archetypeId: 'attention-control', answers: { limit: 90, hardDay: 5 } },
      ],
    });
    const [practice, build, sleep, attention] = result.quests;
    const practiceLeaf = (practice!.criterion as Extract<Criterion, { kind: 'any' }>).of[0] as Extract<Criterion, { kind: 'signal' }>;
    const practiceFloor = (practice!.floor as Extract<Criterion, { kind: 'any' }>).of[0] as Extract<Criterion, { kind: 'signal' }>;
    expect(practiceLeaf.target).toBe(4);
    expect(practiceFloor.target).toBe(1);
    expect(practice!.objective).toBe('4 problem logged, or 25 minutes of analysis.');
    expect((build!.criterion as Extract<Criterion, { kind: 'signal' }>).target).toBe(90);
    expect(sleep!.objective).toBe('Wake within 30 minutes of 06:15.');
    expect(sleep!.realityLabel).toBe('wake window 05:45–06:45');
    expect(attention!.objective).toBe('90 minutes or under screen time.');
    const topics = result.instruments.find((instrument) => instrument.type === 'practice_item')!.params.topics;
    expect(topics).toEqual(['Arrays', 'Graphs']);
    expect(result.instruments.find((instrument) => instrument.type === 'threshold')!.params).toMatchObject({ target: 90, defaultValue: 68 });
    expect(result.domains[0]!.designation).toBe('RIDDLE WALL');
  });

  it('refuses a designation that is a System word, taking an offer instead; a hard day above a good day is lowered', () => {
    const result = generateCore({
      ...LEGACY_SHAPED,
      domains: [{ archetypeId: 'software-practice', answers: { designation: 'RANK', goodDay: 2, hardDay: 5 } }, { archetypeId: 'deep-build' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'strength-movement' }],
    });
    expect(result.domains[0]!.designation).toBe('LOGIC TRIAL');
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['G-DOM-02', 'G-QST-01']));
    const floor = (result.quests[0]!.floor as Extract<Criterion, { kind: 'any' }>).of[0] as Extract<Criterion, { kind: 'signal' }>;
    expect(floor.target).toBe(2);
  });

  it('two domains of one kind get distinct ids, designations and channels', () => {
    const result = generateCore({ ...LEGACY_SHAPED, domains: [{ archetypeId: 'deep-build' }, { archetypeId: 'deep-build' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }] });
    expect(new Set(result.domains.map((domain) => domain.id)).size).toBe(4);
    expect(new Set(result.domains.map((domain) => domain.designation)).size).toBe(4);
    expect(new Set(result.domains.map((domain) => domain.channel.id)).size).toBe(4);
    expect(new Set(result.instruments.map((instrument) => instrument.id)).size).toBe(result.instruments.length);
  });
});
