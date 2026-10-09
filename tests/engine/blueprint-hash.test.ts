import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalJson, hashesFor } from '../../src/blueprint/hash';
import type { SystemBlueprint } from '../../src/blueprint/schema';

const blueprint: SystemBlueprint = {
  schema: 'system-blueprint/1', lineageId: 'arc', version: 1, arcId: 'arc', activeFrom: '2026-09-01', changeClass: 'genesis', provenance: { generator: 'test', libraryVersion: 'test' },
  identity: { displayName: 'SYSTEM', primaryObjective: 'Build' }, arc: { lengthDays: 120, startDate: '2026-09-01', endDate: '2026-12-29', timezone: 'Asia/Kolkata', dayBoundaryHour: 4, dayCloseHour: 3, wakeTime: '08:30', sleepTime: '02:00' },
  progression: { dailyCoreBudget: 500, dailyCap: 700, engineShare: .8, mvdXp: 35, recoveryXp: 40, bossXp: 500, weeklyQuestXp: 200, level: { base: 200, coefficient: 84, exponent: .98, roundTo: 10 }, grace: { daysPer28: 4 }, reducedMode: { triggerMisses: 2, exitDays: 2, collapsesQuests: false }, attributeWindowDays: 28, checkpointDays: [14, 30, 60, 90, 120], rankSchedule: [{ day: 14, rank: 'D' }] },
  domains: [], instruments: [], quests: [], metrics: [], skills: [], attributes: { groups: [], defs: [] }, milestones: [], gates: [], bosses: [], checkpoints: { selfEfficacy: [], automaticity: [], enjoyment: [] }, achievements: [], reviews: { domainPrompts: [] }, rules: [], messaging: { evidenceTemplates: [] }, vocabulary: {},
};

describe('Blueprint hashing (loop 2.1)', () => {
  it('canonicalises object key order', () => {
    expect(canonicalJson({ b: [{ z: 1, a: 2 }], a: true })).toBe(canonicalJson({ a: true, b: [{ a: 2, z: 1 }] }));
  });

  it('has stable SHA-256 hashes and isolates cosmetic mutations', async () => {
    const before = await hashesFor(blueprint);
    const changed = structuredClone(blueprint);
    changed.identity.displayName = 'THE SYSTEM';
    const after = await hashesFor(changed);
    expect(before.computationalHash).toBe(after.computationalHash);
    expect(before.presentationHash).not.toBe(after.presentationHash);
    expect(before.computationalHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes the computational hash when scoring data changes', async () => {
    await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 10_000 }), async (dailyCap) => {
      const changed = structuredClone(blueprint);
      changed.progression.dailyCap = dailyCap;
      expect((await hashesFor(changed)).computationalHash).not.toBe((await hashesFor(blueprint)).computationalHash);
    }));
  }, 30_000);
});
