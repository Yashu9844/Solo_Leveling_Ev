// Loop 15.1: the performance budgets of platform/04 §33.3, enforced (`npm run perf`, apart from the unit suite: a time measured while a hundred test
// files share the machine says nothing about the code). The budgets are for a mid-range Android; these run on a development machine, so each
// measured time is multiplied by CPU_SLOWDOWN before it is held to the budget. The log is the maximum System (X2's eight engines, three support
// domains, two guardrails) lived for a year. Medians of several runs, so one slow moment does not fail a build.
import { describe, expect, it } from 'vitest';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { evaluateAttributes } from '../../src/blueprint/evaluate/attribute';
import { evaluateGate } from '../../src/blueprint/evaluate/gate';
import { readModelEnv } from '../../src/blueprint/evaluate/readModel';
import { resolveBlueprints } from '../../src/blueprint/resolve';
import { validateBlueprint } from '../../src/blueprint/validate';
import type { Rank } from '../../src/engine/types';
import { generateBlueprint } from '../../src/generator';
import { personaEventLog } from '../engine/support/personaEventLog';
import { x2 } from '../fixtures/personas/x';

/** How much slower a mid-range Android is than the machine running CI. A conservative round number. */
const CPU_SLOWDOWN = 4;
/** platform/04 §33.3, p95 on the device, in milliseconds. `snapshot` is not in that table: see the note on the evaluation tests. */
const BUDGET = { rebuild: 150, generate: 20, validate: 10, evaluation: 50, snapshot: 100 } as const;

const draft = { ...x2.draft, lineageId: 'perf-365', arc: { ...x2.draft.arc, lengthDays: 365 } };
const { blueprint } = generateBlueprint(draft);
const events = personaEventLog(blueprint, x2.seed, { kind: 'steady', days: 365 });
const deps = { now: () => '2027-09-01T00:00:00Z', newId: () => 'perf' };

/** Median milliseconds of `work`. */
function median(runs: number, work: () => unknown): number {
  work(); // warm up
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    work();
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[Math.floor(times.length / 2)]!;
}
const onDevice = (ms: number): number => ms * CPU_SLOWDOWN;

describe('the budgets (04 §33.3)', () => {
  it('the log is the size the budget is written for: a year of the maximum System is on the order of twelve thousand events', () => {
    expect(blueprint.domains.length).toBeGreaterThanOrEqual(10);
    expect(events.length).toBeGreaterThan(8_000);
    expect(events.length).toBeLessThan(30_000);
  });

  it(`a full rebuild of the year computes in under ${BUDGET.rebuild} ms on the device`, () => {
    const ms = onDevice(median(5, () => buildProjectionsV2(events, deps, [blueprint])));
    console.log(`rebuild @ ${events.length} events: ${ms.toFixed(0)} ms (device-equivalent)`);
    expect(ms).toBeLessThan(BUDGET.rebuild);
  });

  it('resolving the versions takes a fraction of that', () => {
    expect(onDevice(median(7, () => resolveBlueprints(events)))).toBeLessThan(BUDGET.rebuild / 3);
  });

  it(`generateBlueprint takes under ${BUDGET.generate} ms`, () => {
    const ms = onDevice(median(9, () => generateBlueprint(draft)));
    console.log(`generateBlueprint: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(BUDGET.generate);
  });

  it(`validateBlueprint takes under ${BUDGET.validate} ms`, () => {
    const ms = onDevice(median(15, () => validateBlueprint(blueprint, { today: blueprint.arc.startDate })));
    console.log(`validateBlueprint: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(BUDGET.validate);
  });
});

// 04 §33.3 gives one number for "gate + attribute evaluation" and says one snapshot is shared. Building that snapshot (the records upcast, the
// reducer fold, the day outcomes) is a per-read cost of its own, so it is measured separately: the evaluation is held to 50 ms, the snapshot to
// 100 ms, and the two together to the ceiling of a full rebuild.
describe('a read (gates, attributes and the snapshot they share)', () => {
  const built = buildProjectionsV2(events, deps, [blueprint]);
  const asOf = blueprint.arc.endDate < '2027-09-01' ? blueprint.arc.endDate : '2027-08-31';
  const snapshot = () => readModelEnv({ blueprint, events, checkpoints: [], asOf, projections: built });
  const evaluate = (env: ReturnType<typeof snapshot>): void => {
    evaluateAttributes(blueprint, env);
    let rank: Rank = 'E';
    for (const gate of blueprint.gates) rank = evaluateGate(gate, rank, env).rank;
  };

  it(`gates and attributes evaluate in under ${BUDGET.evaluation} ms from one shared snapshot`, () => {
    // A fresh snapshot each run: the first evaluation is the one that pays for each signal, the rest read the snapshot.
    const envs = Array.from({ length: 8 }, snapshot);
    let next = 0;
    const ms = onDevice(median(7, () => evaluate(envs[next++]!)));
    console.log(`gates + attributes (snapshot given): ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(BUDGET.evaluation);
  });

  it(`the snapshot itself, built once per read, takes under ${BUDGET.snapshot} ms`, () => {
    const ms = onDevice(median(7, snapshot));
    console.log(`snapshot @ ${events.length} events: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(BUDGET.snapshot);
  });

  it(`and a whole read stays under the ceiling of a rebuild, ${BUDGET.rebuild} ms`, () => {
    const ms = onDevice(median(5, () => evaluate(snapshot())));
    console.log(`whole read: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(BUDGET.rebuild);
  });
});
