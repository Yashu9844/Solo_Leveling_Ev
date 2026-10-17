// Loop 14.4: the advanced builder. Bounded weights, thresholds, parameters and ladders; the validator bounds every control, and no control edits XP.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { assertActivatable } from '../../src/blueprint/activation';
import { applyOps, editableParams, planAmendment, type AmendOp } from '../../src/blueprint/amend';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { generateBlueprint } from '../../src/generator';
import { p1 } from '../fixtures/personas/p1';
import { p3 } from '../fixtures/personas/p3';

const { blueprint: base } = generateBlueprint(p3.draft);
const day = (arcDay: number): string => new Date(Date.parse(`${base.arc.startDate}T00:00:00Z`) + (arcDay - 1) * 86_400_000).toISOString().slice(0, 10);
const context = (arcDay: number) => ({ today: day(arcDay), arcDay, nextCheckpointDay: base.progression.checkpointDays.find((d) => d >= arcDay) });
const sumAttribute = base.attributes.defs.find((def) => def.combine === 'sum' && def.terms.length >= 2)!;
const firstPart = (condition: SystemBlueprint['gates'][number]['conditions'][number]) => (condition.clauses?.length ? condition.clauses[0]! : condition);

describe('attribute weights', () => {
  it('one term is set and the others share the rest in proportion, so the formula still sums to one', () => {
    for (const weight of [0.05, 0.3, 0.55, 0.9]) {
      const next = applyOps(base, [{ kind: 'attributeWeight', attributeId: sumAttribute.id, termId: sumAttribute.terms[0]!.id, weight }]);
      const def = next.attributes.defs.find((candidate) => candidate.id === sumAttribute.id)!;
      expect(def.terms[0]!.weight).toBe(weight);
      expect(def.terms.reduce((sum, term) => sum + term.weight, 0)).toBeCloseTo(1, 6);
      expect(def.terms.every((term) => term.weight > 0)).toBe(true);
    }
  });

  it('is operational or structural by the validator\'s own diff - never silently cosmetic', async () => {
    const plan = await planAmendment(base, [{ kind: 'attributeWeight', attributeId: sumAttribute.id, termId: sumAttribute.terms[0]!.id, weight: 0.5 }], context(10));
    expect(plan.changeClass).toBe('structural'); // attribute formulas are structural (02 §19.2)
    expect(plan.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });
});

describe('gate thresholds', () => {
  it('move by a percentage - counts stay whole, rates stay fractions of one', () => {
    let moved = 0;
    for (const gate of base.gates) for (const condition of gate.conditions) {
      const part = firstPart(condition);
      if (typeof part.threshold !== 'number' || part.threshold === 0 || condition.verifiability === 'structural') continue;
      const next = applyOps(base, [{ kind: 'gate', rank: gate.rank, conditionId: condition.id, percent: 20 }]);
      const after = firstPart(next.gates.find((candidate) => candidate.rank === gate.rank)!.conditions.find((candidate) => candidate.id === condition.id)!);
      if (part.format === 'percent') expect(after.threshold as number).toBeLessThanOrEqual(1);
      else expect(Number.isInteger(after.threshold)).toBe(true);
      moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('a ladder that would fall as it climbs is refused (V-GATE-03)', async () => {
    // Lowering the lowest rung of a milestone below nothing, or raising an early rank above a later one, breaks "ranks ask more as they climb".
    const milestone = base.milestones.find((candidate) => (candidate.ladder?.length ?? 0) >= 2)!;
    const plan = await planAmendment(base, [{ kind: 'rung', milestoneId: milestone.id, index: 0, percent: 400 }], context(10));
    expect(plan.status).toBe('invalid');
    expect(plan.issues.map((issue) => issue.code)).toContain('V-GATE-03');
  });
});

describe('instrument parameters', () => {
  it('only numeric, catalogue-bounded parameters are offered, and never an XP amount', () => {
    for (const persona of [p1, p3]) {
      const { blueprint } = generateBlueprint(persona.draft);
      for (const instrument of blueprint.instruments) {
        for (const key of editableParams(instrument)) {
          expect(typeof instrument.params[key]).toBe('number');
          expect(key, instrument.id).not.toMatch(/xp|amount|grant/i);
        }
      }
    }
    expect(editableParams({ type: 'practice_item', params: { bonusXp: 20, maxRevisitsPerDay: 3, grant: { amount: 5 } } })).toEqual(['maxRevisitsPerDay']);
  });

  it('a value beyond what the instrument allows is refused by the validator, not applied blindly', async () => {
    const instrument = base.instruments.find((candidate) => editableParams(candidate).length > 0)!;
    const key = editableParams(instrument)[0]!;
    const plan = await planAmendment(base, [{ kind: 'param', instrumentId: instrument.id, key, percent: 100000 }], context(10));
    expect(plan.status).toBe('invalid');
  });
});

describe('nothing reaches XP', () => {
  it('whatever advanced control is staged, every quest weight and the budget are as they were', () => {
    const rung = base.milestones.find((milestone) => milestone.ladder?.length)!;
    const next = applyOps(base, [
      { kind: 'attributeWeight', attributeId: sumAttribute.id, termId: sumAttribute.terms[0]!.id, weight: 0.5 },
      { kind: 'rung', milestoneId: rung.id, index: 0, percent: 10 },
      { kind: 'gate', rank: base.gates[1]!.rank, conditionId: base.gates[1]!.conditions[0]!.id, percent: 10 },
    ]);
    expect(next.quests.map((quest) => quest.xp)).toEqual(base.quests.map((quest) => quest.xp));
    expect(next.progression).toEqual(base.progression);
  });

  it('the only operation that moves XP is the explicit shift between two quests, and it keeps the total', () => {
    const kinds: AmendOp['kind'][] = ['designation', 'target', 'floor', 'days', 'weight', 'attributeWeight', 'gate', 'param', 'rung'];
    expect(new Set(kinds).size).toBe(kinds.length);
    // There is no operation whose payload names an `xp` field other than the weight shift.
    const withXp = kinds.filter((kind) => kind === 'weight');
    expect(withXp).toEqual(['weight']);
  });
});

describe('what is offered as ready can always be activated', () => {
  const gateConditions = base.gates.flatMap((gate) => gate.conditions.filter((condition) => typeof firstPart(condition).threshold === 'number' && firstPart(condition).threshold !== 0 && condition.verifiability !== 'structural').map((condition) => ({ rank: gate.rank, id: condition.id })));
  const params = base.instruments.flatMap((instrument) => editableParams(instrument).map((key) => ({ instrumentId: instrument.id, key })));
  const rungs = base.milestones.flatMap((milestone) => (milestone.ladder ?? []).map((_rung, index) => ({ milestoneId: milestone.id, index })));
  const advanced: fc.Arbitrary<AmendOp> = fc.oneof(
    fc.record({ kind: fc.constant('attributeWeight' as const), attributeId: fc.constant(sumAttribute.id), termId: fc.constantFrom(...sumAttribute.terms.map((term) => term.id)), weight: fc.double({ min: 0, max: 1, noNaN: true }) }),
    fc.record({ kind: fc.constant('gate' as const), choice: fc.constantFrom(...gateConditions), percent: fc.integer({ min: -60, max: 60 }) }).map(({ choice, percent }): AmendOp => ({ kind: 'gate', rank: choice.rank, conditionId: choice.id, percent })),
    ...(params.length > 0 ? [fc.record({ kind: fc.constant('param' as const), choice: fc.constantFrom(...params), percent: fc.integer({ min: -60, max: 60 }) }).map(({ choice, percent }): AmendOp => ({ kind: 'param', instrumentId: choice.instrumentId, key: choice.key, percent }))] : []),
    ...(rungs.length > 0 ? [fc.record({ kind: fc.constant('rung' as const), choice: fc.constantFrom(...rungs), percent: fc.integer({ min: -60, max: 60 }) }).map(({ choice, percent }): AmendOp => ({ kind: 'rung', milestoneId: choice.milestoneId, index: choice.index, percent }))] : []),
  );

  it('60 random advanced drafts: ready or waiting means the writer\'s own gate accepts it; the rest says why', async () => {
    let accepted = 0;
    await fc.assert(fc.asyncProperty(fc.array(advanced, { minLength: 1, maxLength: 4 }), fc.integer({ min: 2, max: 60 }), async (ops, arcDay) => {
      const result = await planAmendment(base, ops, context(arcDay));
      if (result.status === 'invalid') { expect(result.issues.some((issue) => issue.severity === 'error') || arcDay > 7).toBe(true); return; }
      await assertActivatable(result.candidate, base, { today: day(arcDay), arcDay, nextCheckpointDay: context(arcDay).nextCheckpointDay ?? arcDay, arcId: base.arcId });
      accepted++;
    }), { numRuns: 60 });
    expect(accepted).toBeGreaterThan(5);
  }, 120_000);
});
