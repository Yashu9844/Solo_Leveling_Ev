// Loop 14.2: staged amendments. The class is computed from the diff, the start is set by the class, and nothing the validator would refuse
// is ever offered as ready.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { activationEvent, assertActivatable } from '../../src/blueprint/activation';
import { activationTiming, applyOps, planAmendment, stageOp, type AmendOp } from '../../src/blueprint/amend';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { hashesFor } from '../../src/blueprint/hash';
import type { Criterion, SystemBlueprint } from '../../src/blueprint/schema';
import { generateBlueprint } from '../../src/generator';
import { p1 } from '../fixtures/personas/p1';
import { p3 } from '../fixtures/personas/p3';
import { personaEventLog } from './support/personaEventLog';

const { blueprint: base } = generateBlueprint(p3.draft);
const day = (offset: number): string => new Date(Date.parse(`${base.arc.startDate}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const context = (arcDay: number) => ({ today: day(arcDay - 1), arcDay, nextCheckpointDay: base.progression.checkpointDays.find((d) => d >= arcDay) });
const core = base.quests.filter((quest) => quest.type === 'core');
const leaves = (criterion: Criterion): number[] => (criterion.kind === 'signal' ? [criterion.target] : criterion.of.flatMap(leaves));
const engine = base.domains.find((domain) => domain.role === 'engine')!;
const engineQuest = core.find((quest) => quest.domainId === engine.id)!;

describe('applyOps', () => {
  it('a designation is uppercased and trimmed; the rest of the System is untouched', () => {
    const next = applyOps(base, [{ kind: 'designation', domainId: engine.id, value: '  outpost ' }]);
    expect(next.domains.find((domain) => domain.id === engine.id)!.designation).toBe('OUTPOST');
    expect(next.version).toBe(base.version + 1);
    expect(next.quests).toEqual(base.quests);
  });

  it('a percentage scales every number a quest asks for, never below 1', () => {
    const next = applyOps(base, [{ kind: 'target', questId: engineQuest.id, percent: 10 }, { kind: 'floor', questId: engineQuest.id, percent: -50 }]);
    const quest = next.quests.find((candidate) => candidate.id === engineQuest.id)!;
    expect(leaves(quest.criterion)).toEqual(leaves(engineQuest.criterion).map((value) => Math.max(1, Math.round(value * 1.1))));
    expect(leaves(quest.floor).every((value) => value >= 1)).toBe(true);
  });

  it('weight moves budget between two core quests and the total never changes', () => {
    const [from, to] = core;
    const next = applyOps(base, [{ kind: 'weight', fromQuestId: from!.id, toQuestId: to!.id, xp: 10 }]);
    expect(next.quests.find((quest) => quest.id === from!.id)!.xp).toBe(from!.xp - 10);
    expect(next.quests.find((quest) => quest.id === to!.id)!.xp).toBe(to!.xp + 10);
    expect(next.quests.filter((quest) => quest.type === 'core').reduce((sum, quest) => sum + quest.xp, 0)).toBe(core.reduce((sum, quest) => sum + quest.xp, 0));
  });

  it('the base is never mutated', () => {
    const before = JSON.stringify(base);
    applyOps(base, [{ kind: 'designation', domainId: engine.id, value: 'x' }, { kind: 'target', questId: engineQuest.id, percent: 20 }]);
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe('stageOp', () => {
  it('the same kind of edit on the same thing replaces the one before', () => {
    let ops: AmendOp[] = [];
    ops = stageOp(ops, { kind: 'target', questId: 'a', percent: 5 });
    ops = stageOp(ops, { kind: 'target', questId: 'b', percent: 5 });
    ops = stageOp(ops, { kind: 'target', questId: 'a', percent: 15 });
    expect(ops).toEqual([{ kind: 'target', questId: 'b', percent: 5 }, { kind: 'target', questId: 'a', percent: 15 }]);
    ops = stageOp(ops, { kind: 'designation', domainId: 'a', value: 'X' });
    expect(ops).toHaveLength(3);
  });
});

describe('activationTiming', () => {
  it('cosmetic now, operational tomorrow, structural the day after its checkpoint - or tomorrow in the first week', () => {
    expect(activationTiming('cosmetic', { today: '2026-09-20', arcDay: 20, nextCheckpointDay: 30 })).toEqual({ activeFrom: '2026-09-20', effect: 'TAKES EFFECT NOW.', waits: false });
    expect(activationTiming('operational', { today: '2026-09-20', arcDay: 20, nextCheckpointDay: 30 })).toMatchObject({ activeFrom: '2026-09-21', waits: false });
    expect(activationTiming('structural', { today: '2026-09-05', arcDay: 5, nextCheckpointDay: 14 })).toMatchObject({ activeFrom: '2026-09-06', waits: false });
    expect(activationTiming('structural', { today: '2026-09-20', arcDay: 20, nextCheckpointDay: 30 })).toEqual({ activeFrom: '2026-10-01', effect: 'TAKES EFFECT AFTER THE DAY 30 CHECKPOINT.', waits: true });
    // On the checkpoint day itself the change begins the next day.
    expect(activationTiming('structural', { today: '2026-09-30', arcDay: 30, nextCheckpointDay: 30 })).toMatchObject({ activeFrom: '2026-10-01', waits: true });
    expect(activationTiming('structural', { today: '2026-12-20', arcDay: 111, nextCheckpointDay: undefined })).toMatchObject({ waits: true });
  });
});

describe('planAmendment', () => {
  const plan = (ops: AmendOp[], arcDay = 10) => planAmendment(base, ops, context(arcDay));
  const weight = (xp: number): AmendOp => ({ kind: 'weight', fromQuestId: core[0]!.id, toQuestId: core[1]!.id, xp });

  it('nothing staged is empty', async () => {
    expect(await plan([])).toMatchObject({ empty: true, status: 'empty', issues: [] });
  });

  it('a rename is cosmetic: now, ready, and the computation is byte-identical', async () => {
    const result = await plan([{ kind: 'designation', domainId: engine.id, value: 'Outpost' }]);
    expect(result).toMatchObject({ changeClass: 'cosmetic', status: 'ready', activeFrom: day(9) });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect((await hashesFor(result.candidate)).computationalHash).toBe((await hashesFor(base)).computationalHash);
  });

  it('a target within a quarter, a floor within a quarter and a new rhythm are operational: tomorrow, ready', async () => {
    for (const op of [{ kind: 'target', questId: engineQuest.id, percent: 10 }, { kind: 'target', questId: engineQuest.id, percent: 25 }, { kind: 'floor', questId: engineQuest.id, percent: -25 }] as AmendOp[]) {
      const result = await plan([op]);
      expect(result.changeClass, JSON.stringify(op)).toBe('operational');
      expect(result.issues.map((issue) => issue.code + ' ' + issue.path), JSON.stringify(op)).toEqual([]);
      expect(result).toMatchObject({ status: 'ready', activeFrom: day(10) });
    }
    const daily = core.find((quest) => quest.schedule.kind === 'daily')!;
    expect(await plan([{ kind: 'days', questId: daily.id, days: ['mon', 'wed', 'fri', 'sat'] }])).toMatchObject({ changeClass: 'operational', status: 'ready' });
  });

  it('a target pulled below its own hard-day floor is refused', async () => {
    const result = await plan([{ kind: 'target', questId: engineQuest.id, percent: -25 }]);
    expect(result.status).toBe('invalid');
    expect(result.issues.map((issue) => issue.code)).toContain('V-QST-03');
  });

  it('a target beyond a quarter, and any shift of weight, are structural: they wait for the checkpoint', async () => {
    const far = await plan([{ kind: 'target', questId: engineQuest.id, percent: 40 }]);
    expect(far).toMatchObject({ changeClass: 'structural', status: 'waits-for-checkpoint', effect: 'TAKES EFFECT AFTER THE DAY 14 CHECKPOINT.', activeFrom: day(14) });
    const moved = await plan([weight(10)]);
    expect(moved).toMatchObject({ changeClass: 'structural', status: 'waits-for-checkpoint' });
    expect(moved.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('in the first week a structural change is allowed tomorrow', async () => {
    expect(await plan([weight(10)], 4)).toMatchObject({ changeClass: 'structural', status: 'ready', activeFrom: day(4) });
  });

  it('what the validator refuses is invalid, with its reasons: too few days, a weight outside the band', async () => {
    const daily = core.find((quest) => quest.schedule.kind === 'daily')!;
    const thin = await plan([{ kind: 'days', questId: daily.id, days: ['mon', 'tue'] }]);
    expect(thin.status).toBe('invalid');
    expect(thin.issues.map((issue) => issue.code)).toContain('V-QST-04');
    const drained = await plan([weight(core[0]!.xp - 5)]);
    expect(drained.status).toBe('invalid');
    expect(drained.issues.map((issue) => issue.code)).toContain('V-XP-02');
  });

  it('after the last checkpoint a structural change has nowhere to land', async () => {
    const last = base.progression.checkpointDays[base.progression.checkpointDays.length - 1]!;
    const result = await planAmendment(base, [weight(10)], { today: day(last), arcDay: last + 1, nextCheckpointDay: undefined });
    expect(result.status).toBe('invalid');
  });
});

describe('what is offered as ready can always be activated, and changes nothing before it begins', () => {
  const opArbitrary = (blueprint: SystemBlueprint): fc.Arbitrary<AmendOp> => {
    const cores = blueprint.quests.filter((quest) => quest.type === 'core');
    return fc.oneof(
      fc.record({ kind: fc.constant('designation' as const), domainId: fc.constantFrom(...blueprint.domains.map((domain) => domain.id)), value: fc.stringMatching(/^[A-Za-z]{3,12}$/) }),
      fc.record({ kind: fc.constant('target' as const), questId: fc.constantFrom(...cores.map((quest) => quest.id)), percent: fc.integer({ min: -60, max: 60 }) }),
      fc.record({ kind: fc.constant('floor' as const), questId: fc.constantFrom(...cores.map((quest) => quest.id)), percent: fc.integer({ min: -60, max: 60 }) }),
      fc.record({ kind: fc.constant('weight' as const), fromQuestId: fc.constantFrom(...cores.map((quest) => quest.id)), toQuestId: fc.constantFrom(...cores.map((quest) => quest.id)), xp: fc.integer({ min: 1, max: 40 }) }),
    );
  };

  for (const persona of [p1, p3]) {
    it(`${persona.id}: 25 random drafts, at random days`, async () => {
      const { blueprint } = generateBlueprint(persona.draft);
      const events = personaEventLog(blueprint, persona.seed, { kind: 'steady', days: 40 });
      const before = buildProjectionsV2(events, { now: () => '', newId: () => '' });
      await fc.assert(fc.asyncProperty(fc.array(opArbitrary(blueprint), { minLength: 1, maxLength: 4 }), fc.integer({ min: 2, max: 40 }), async (ops, arcDay) => {
        const startDate = blueprint.arc.startDate;
        const today = new Date(Date.parse(`${startDate}T00:00:00Z`) + (arcDay - 1) * 86_400_000).toISOString().slice(0, 10);
        const next = blueprint.progression.checkpointDays.find((d) => d >= arcDay);
        const result = await planAmendment(blueprint, ops, { today, arcDay, nextCheckpointDay: next });
        if (result.status === 'invalid') return;
        // Offered as ready (or as waiting): the writer's own gate accepts it.
        await assertActivatable(result.candidate, blueprint, { today, arcDay, nextCheckpointDay: next ?? arcDay, arcId: blueprint.arcId });
        if (result.changeClass !== 'cosmetic') expect(result.activeFrom > today).toBe(true);
        // H2: nothing dated before it begins moves.
        const anchor = events.map((event) => event.local_date <= result.activeFrom).lastIndexOf(true);
        if (anchor < 0) return;
        const amended = [...events.slice(0, anchor + 1), activationEvent(result.candidate, { id: 'amend~', occurred_at: events[anchor]!.occurred_at, local_date: today }), ...events.slice(anchor + 1)];
        const after = buildProjectionsV2(amended, { now: () => '', newId: () => '' });
        const upTo = (rows: { local_date: string }[]) => JSON.stringify(rows.filter((row) => row.local_date < result.activeFrom));
        expect(upTo(after.ledger)).toBe(upTo(before.ledger));
      }), { numRuns: 25 });
    }, 120_000);
  }
});
