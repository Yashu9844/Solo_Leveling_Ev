// Loop 8.3: the ladder, schedule and boss-window rules (V-GATE-03, V-GATE-04, V-BOSS-02) - the owner's Blueprint obeys
// them; a Blueprint that bends them is refused.
import { describe, expect, it } from 'vitest';
import { legacyBlueprintFor } from '../../src/blueprint/legacy/legacyV1';
import { validateBlueprint } from '../../src/blueprint/validate';
import type { SystemBlueprint } from '../../src/blueprint/schema';

const codes = (blueprint: SystemBlueprint) => validateBlueprint(blueprint, { today: blueprint.arc.startDate }).map((issue) => issue.code);
const gate = (blueprint: SystemBlueprint, rank: string) => blueprint.gates.find((candidate) => candidate.rank === rank)!;

describe('V-GATE-03, V-GATE-04, V-BOSS-02', () => {
  it('the owner\'s Blueprint breaks none of them', () => {
    expect(codes(legacyBlueprintFor())).toEqual([]);
  });

  it('V-GATE-03: a count asked for less at a later rank is refused', () => {
    const blueprint = legacyBlueprintFor();
    const problems = gate(blueprint, 'B').conditions.find((condition) => condition.id === 'problems')!;
    problems.clauses![0]!.threshold = 20; // below C's 55
    expect(codes(blueprint)).toContain('V-GATE-03');
  });

  it('V-GATE-03: a ceiling asked for more loosely at a later rank is refused (wake SD < 60 at A, < 70 at S)', () => {
    const blueprint = legacyBlueprintFor();
    gate(blueprint, 'S').conditions.find((condition) => condition.id === 'wake-sd')!.clauses![0]!.threshold = 70;
    expect(codes(blueprint)).toContain('V-GATE-03');
  });

  it('V-GATE-03: a milestone ladder that falls is refused', () => {
    const blueprint = legacyBlueprintFor();
    blueprint.milestones[0]!.ladder = [{ checkpointIndex: 1, threshold: 50 }, { checkpointIndex: 2, threshold: 40 }];
    expect(codes(blueprint)).toContain('V-GATE-03');
  });

  it('V-GATE-04: the D gate must be the global consistency gate, and the checkpoints the arc length\'s', () => {
    const notGlobal = legacyBlueprintFor();
    gate(notGlobal, 'D').conditions = gate(notGlobal, 'C').conditions.slice(0, 1);
    expect(codes(notGlobal)).toContain('V-GATE-04');

    const offSchedule = legacyBlueprintFor();
    offSchedule.progression.checkpointDays = [14, 30, 60, 90, 119];
    expect(codes(offSchedule)).toContain('V-GATE-04');

    const gateDays = legacyBlueprintFor();
    gate(gateDays, 'B').day = 55;
    expect(codes(gateDays)).toContain('V-GATE-04');
  });

  it('V-BOSS-02: a window must open a week before the checkpoint that needs the boss', () => {
    const blueprint = legacyBlueprintFor();
    blueprint.bosses[0]!.windowStartDay = 54; // Boss I gates B at day 60
    expect(codes(blueprint)).toContain('V-BOSS-02');
    blueprint.bosses[0]!.windowStartDay = 53;
    expect(codes(blueprint)).not.toContain('V-BOSS-02');
  });
});
