// platform/05 loop 4.4 — the Blueprint attribute DSL against the live
// getAttributes (attributesFrom + store/attributes.ts's inputs): same six
// attributes, same values to the last float, same components (E2).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { evaluateAttributes } from '../../src/blueprint/evaluate/attribute';
import { readModelEnv } from '../../src/blueprint/evaluate/readModel';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import type { SystemEvent } from '../../src/engine/types';
import { getAttributes } from '../../src/store/attributes';
import { dateAt, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

const bp = LEGACY_BLUEPRINT_V1;

async function assertAttributesAgree(events: SystemEvent[], offset: number) {
  const today = dateAt(offset);
  const prefix = prefixOf(events, today);
  await loadLegacyDb(prefix, today);
  const legacy = await getAttributes(today, DEFAULT_CONFIG);
  const v2 = evaluateAttributes(bp, readModelEnv({ blueprint: bp, events: prefix, checkpoints: [], asOf: today }));
  expect(v2, `day ${offset + 1}`).toEqual(legacy);
  return legacy;
}

describe('attribute DSL (loop 4.4)', () => {
  const golden = legacyActivityLog({ seed: 42, days: 120 });

  it('reproduces getAttributes on the golden log across the arc, including the pause and lapsed stretches', async () => {
    let nonTrivial = 0;
    for (const offset of [0, 1, 6, 13, 20, 29, 44, 49, 50, 52, 53, 59, 76, 89, 104, 119]) {
      const attributes = await assertAttributesAgree(golden, offset);
      if (attributes.some((a) => a.value > 0)) nonTrivial++;
    }
    expect(nonTrivial).toBeGreaterThan(10);
  }, 120_000);

  it('reproduces getAttributes on other seeds with heavy lapsing', async () => {
    for (const seed of [3, 9, 27]) {
      const events = legacyActivityLog({ seed, days: 60, skipRate: 0.3 });
      for (const offset of [4, 17, 33, 59]) await assertAttributesAgree(events, offset);
    }
  }, 120_000);

  it('is zero-safe before the arc has any data and on a day before it starts', async () => {
    await assertAttributesAgree(golden, 0);
    const env = readModelEnv({ blueprint: bp, events: golden.slice(0, 1), checkpoints: [], asOf: '2026-08-25' });
    for (const attribute of evaluateAttributes(bp, env)) expect(Number.isFinite(attribute.value)).toBe(true);
  }, 60_000);

  it('explains itself: components sum to value/100 and every term is named', async () => {
    const attributes = evaluateAttributes(bp, readModelEnv({ blueprint: bp, events: golden, checkpoints: [], asOf: dateAt(100) }));
    for (const attribute of attributes) {
      const parts = Object.values(attribute.components).reduce((a, b) => a + b, 0);
      expect(parts * 100).toBeCloseTo(attribute.value, 10);
    }
    expect(Object.keys(attributes.find((a) => a.attribute === 'DISCIPLINE')!.components)).toEqual(['mvd', 'sleep', 'attention']);
    expect(Object.keys(attributes.find((a) => a.attribute === 'DEPTH')!.components)).toEqual(['deep_minutes']);
  });

  it('follows the definition: a changed weight moves the value, a renamed label does not', () => {
    const env = readModelEnv({ blueprint: bp, events: golden, checkpoints: [], asOf: dateAt(100) });
    const base = evaluateAttributes(bp, env);
    const relabelled = structuredClone(bp);
    relabelled.attributes.defs[0]!.terms[0]!.label = 'Days you showed up';
    expect(evaluateAttributes(relabelled, env)).toEqual(base);
    const reweighted = structuredClone(bp);
    reweighted.attributes.defs[0]!.terms[0]!.weight = 0.1;
    expect(evaluateAttributes(reweighted, env)[0]!.value).not.toBe(base[0]!.value);
  });
});
