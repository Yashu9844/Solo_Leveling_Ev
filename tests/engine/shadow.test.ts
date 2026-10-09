// platform/05 loop 4.8 — the shadow harness itself: it must be clean for the
// legacy Blueprint, and (just as important) it must FAIL when the Blueprint
// engine deviates, or "clean" would mean nothing.
import { describe, expect, it } from 'vitest';
import { legacyBlueprintFor } from '../../src/blueprint/legacy/legacyV1';
import { formatReport, runShadow } from './support/shadow';

const small = { fuzzSeeds: 20, activitySeeds: 2, goldenDays: [29, 119], fuzzE2Seeds: 1 };

describe('shadow harness (loop 4.8)', () => {
  it('is clean for the legacy Blueprint and covers every E1 table and E2 read model', async () => {
    const report = await runShadow(small);
    expect(formatReport(report)).toContain('SHADOW CLEAN');
    expect(report.ok).toBe(true);
    const names = report.sections.map((section) => section.name);
    for (const wanted of ['E1 golden', 'E1 activity', 'E1 fuzz', 'E2 attributes', 'E2 gates', 'E2 bosses', 'E2 achievements', 'E2 frozen evidence', 'E2 reality', 'E2 weekly review', 'E2 message context', 'E2 transmission context', 'E2 recoverable day', 'E2 checkpoint comparison']) {
      expect(names, wanted).toContain(wanted);
    }
    expect(report.sections.every((section) => section.compared > 0)).toBe(true);
  }, 300_000);

  it('fails, and says where, when the Blueprint engine deviates', async () => {
    const tighter = (arc: Parameters<typeof legacyBlueprintFor>[0]) => {
      const blueprint = legacyBlueprintFor(arc);
      blueprint.domains.find((domain) => domain.id === 'dsa')!.channel.cap = 100; // the legacy MIND cap is 200
      blueprint.gates.find((gate) => gate.day === 30)!.conditions[1]!.clauses![0]!.threshold = 56; // 55 problems
      return blueprint;
    };
    const report = await runShadow({ ...small, goldenDays: [29], fuzzSeeds: 5, blueprintFor: tighter });
    expect(report.ok).toBe(false);
    const differing = report.sections.filter((section) => section.mismatches.length > 0).map((section) => section.name);
    expect(differing).toContain('E1 golden'); // the cap changes the ledger
    expect(formatReport(report)).toContain('SHADOW FOUND DIFFERENCES');
  }, 300_000);
});
