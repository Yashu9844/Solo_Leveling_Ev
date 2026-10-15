// Loop 8.1: the calibration tables are derived (library/simulation.ts) and written down
// (library/calibration.ts). This re-derives them, so a drifting number fails here, not in a player's arc.
import { describe, expect, it } from 'vitest';
import { validateBlueprint } from '../../src/blueprint/validate';
import { legacyBlueprintFor } from '../../src/blueprint/legacy/legacyV1';
import {
  ARC_LENGTH_PRESETS, CHECKPOINT_ANCHORS, COEFFICIENT_ANCHORS, checkpointDaysFor, coefficientFor, MAX_ARC_LENGTH, MIN_ARC_LENGTH,
  MIN_CHECKPOINT_GAP, rankScheduleFor, terminusTarget,
} from '../../src/library/calibration';
import { GLOBAL_LEXICON, ARCHETYPE_DESIGNATIONS, CUSTOM_DESIGNATION_STEMS, isValidDesignation, MAX_DESIGNATION_LENGTH } from '../../src/library/lexicon';
import { HUE_TOKENS } from '../../src/library/hues';
import { ICON_TOKENS } from '../../src/library/icons';
import { LIBRARY_VERSION } from '../../src/library';
import { levelAt, meanTotals, solveCoefficient } from '../../src/library/simulation';

describe('the level coefficient table', () => {
  it('terminus targets: 40 at 120 days, scaling with the square root of the length', () => {
    expect(ARC_LENGTH_PRESETS.map(terminusTarget)).toEqual([28, 35, 40, 49, 70]);
  });

  it('every anchor is what the simulation solves for (60 seeds, 85% completion)', () => {
    for (const length of ARC_LENGTH_PRESETS) {
      expect(solveCoefficient(length, terminusTarget(length)), `${length} days`).toBe(COEFFICIENT_ANCHORS[length]);
    }
  });

  it('120 days is the owner\'s 84, and the owner\'s Blueprint agrees', () => {
    expect(coefficientFor(120)).toBe(84);
    expect(legacyBlueprintFor().progression.level.coefficient).toBe(84);
  });

  it('a length between anchors lands within one terminus level of a direct simulation', () => {
    for (const length of [60, 75, 94, 100, 150, 200, 270, 330, 365]) {
      const direct = meanTotals({ days: length, p: 0.85 }, [length])[0]!;
      const level = levelAt(direct, coefficientFor(length));
      expect(Math.abs(level - terminusTarget(length)), `${length} days: level ${level}, target ${terminusTarget(length)}`).toBeLessThanOrEqual(1);
    }
  });

  it('clamps outside the allowed range instead of extrapolating', () => {
    expect(coefficientFor(MIN_ARC_LENGTH - 20)).toBe(coefficientFor(MIN_ARC_LENGTH));
    expect(coefficientFor(MAX_ARC_LENGTH + 100)).toBe(coefficientFor(MAX_ARC_LENGTH));
  });
});

describe('the checkpoint schedule', () => {
  it('an anchor length returns the design\'s table; 120 days is the owner\'s', () => {
    for (const length of ARC_LENGTH_PRESETS) expect(checkpointDaysFor(length)).toEqual([...CHECKPOINT_ANCHORS[length]!]);
    expect(checkpointDaysFor(120)).toEqual(legacyBlueprintFor().progression.checkpointDays);
    expect(rankScheduleFor(120)).toEqual(legacyBlueprintFor().progression.rankSchedule);
  });

  it('every length from 60 to 365 is D=14 ... S=length, ascending, at least ten days apart', () => {
    for (let length = MIN_ARC_LENGTH; length <= MAX_ARC_LENGTH; length++) {
      const days = checkpointDaysFor(length);
      expect(days, `${length}`).toHaveLength(5);
      expect(days[0]).toBe(14);
      expect(days[4]).toBe(length);
      for (let i = 1; i < 5; i++) expect(days[i]! - days[i - 1]!, `${length} gap ${i}`).toBeGreaterThanOrEqual(MIN_CHECKPOINT_GAP);
    }
  });

  it('an exam-aligned 94-day arc interpolates between the 90 and 120 rows', () => {
    const days = checkpointDaysFor(94);
    expect(days[0]).toBe(14);
    expect(days[4]).toBe(94);
    expect(days[1]).toBeGreaterThanOrEqual(28);
    expect(days[1]).toBeLessThanOrEqual(32);
  });
});

describe('the lexicon and the token sets', () => {
  it('a designation is uppercase, short, and not a System word', () => {
    expect(isValidDesignation('FORGE')).toBe(true);
    expect(isValidDesignation('RANK')).toBe(false);
    expect(isValidDesignation('forge')).toBe(false);
    expect(isValidDesignation('A'.repeat(MAX_DESIGNATION_LENGTH + 1))).toBe(false);
    expect(GLOBAL_LEXICON.has('REDUCED MODE')).toBe(true);
  });

  it('every offered designation is valid, and archetypes offer 3 of them', () => {
    for (const [archetype, offered] of Object.entries(ARCHETYPE_DESIGNATIONS)) {
      expect(offered.length, archetype).toBeGreaterThanOrEqual(3);
      for (const designation of offered) expect(isValidDesignation(designation), `${archetype}: ${designation}`).toBe(true);
    }
    for (const stems of Object.values(CUSTOM_DESIGNATION_STEMS)) for (const stem of stems) expect(isValidDesignation(stem), stem).toBe(true);
  });

  it('the validator and the library agree on the lexicon', () => {
    const blueprint = legacyBlueprintFor();
    blueprint.domains[0]!.designation = 'RANK';
    expect(validateBlueprint(blueprint, { today: '2026-09-02' }).some((issue) => issue.code === 'V-DOM-02')).toBe(true);
  });

  it('the library knows its version and its token sets', () => {
    expect(LIBRARY_VERSION).toBe(1);
    expect(HUE_TOKENS.length).toBe(8);
    expect(ICON_TOKENS.length).toBe(48);
  });
});
