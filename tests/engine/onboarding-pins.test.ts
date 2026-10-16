// Loop 11.3: a pinned field survives re-generation. Whatever else in the interview changes afterwards, what the person adjusted stays.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generateBlueprint } from '../../src/generator/generate';
import type { DraftState } from '../../src/generator/types';
import { ARCHETYPES } from '../../src/library/archetypes';
import { QUESTIONS, RESOLUTIONS, measureBounds } from '../../src/onboarding/content';
import { withDefaults } from '../../src/onboarding/engine';
import { interviewToDraft } from '../../src/onboarding/mapping';
import { NO_PINS, applyPins, clampPin, domainKey, hasPins, pinnedPaths, withArcLength, withPin, type Pins } from '../../src/onboarding/pins';
import type { InterviewDraft } from '../../src/onboarding/types';

const ctx = { today: '2026-09-01' };
const mapping = { lineageId: 'lineage-pins', today: '2026-09-01', timezone: 'Asia/Kolkata' };
const AREAS = Object.keys(RESOLUTIONS);

const interview = (answers: Record<string, unknown>): InterviewDraft => withDefaults({ tier: 'guided', answers: { 'identity.displayName': 'Ada', ...answers } }, QUESTIONS, ctx);
const build = (draft: InterviewDraft, pins: Pins) => generateBlueprint(applyPins(interviewToDraft(draft, QUESTIONS, mapping).draft, pins));

/** A random interview: some areas, a resolution for each, and sometimes a good day. */
const interviews = fc.record({
  areas: fc.shuffledSubarray(AREAS, { minLength: 2, maxLength: 5 }),
  pick: fc.array(fc.nat(5), { minLength: 5, maxLength: 5 }),
  good: fc.array(fc.option(fc.nat(60), { nil: undefined }), { minLength: 5, maxLength: 5 }),
}).map(({ areas, pick, good }) => {
  const answers: Record<string, unknown> = { areas };
  areas.forEach((area, index) => {
    const options = RESOLUTIONS[area]!;
    answers[`area.${area}.resolution`] = options[pick[index]! % options.length]!.value;
    if (good[index] !== undefined) answers[`area.${area}.goodDay`] = 1 + good[index]!;
  });
  return answers;
});

/** The engine domain pinned: the first, with a good day, hard day and designation drawn inside what its question allows. */
function pinFor(draft: DraftState, seed: number): { pins: Pins; key: string; archetypeId: string } {
  const choice = draft.domains.find((candidate) => ARCHETYPES[candidate.archetypeId]?.role === 'engine' && measureBounds(candidate.archetypeId) && ARCHETYPES[candidate.archetypeId]!.quest)!;
  const bounds = measureBounds(choice.archetypeId)!;
  const good = clampPin(choice.archetypeId, bounds.min + (seed % Math.max(1, bounds.max - bounds.min)));
  const hard = clampPin(choice.archetypeId, Math.max(bounds.min, Math.floor(good / 2)));
  const designations = ARCHETYPES[choice.archetypeId]!.designations;
  const key = domainKey(choice.archetypeId);
  let pins = withPin(NO_PINS, key, 'goodDay', good);
  pins = withPin(pins, key, 'hardDay', Math.min(hard, good));
  pins = withPin(pins, key, 'designation', designations[seed % designations.length]!);
  return { pins: withArcLength(pins, 60 + (seed % 300)), key, archetypeId: choice.archetypeId };
}

const questOf = (blueprint: ReturnType<typeof generateBlueprint>['blueprint'], archetypeId: string) => {
  const domain = blueprint.domains.find((candidate) => candidate.archetypeId === archetypeId)!;
  return blueprint.quests.find((candidate) => candidate.domainId === domain.id && candidate.type === 'core')!;
};

describe('pins', () => {
  it('a pinned good day, hard day, designation and arc length survive any later change to the interview', () => {
    fc.assert(fc.property(interviews, interviews, fc.nat(1000), fc.constantFrom('06:00', '07:30', '10:00'), (first, second, seed, wake) => {
      const before = interview(first);
      const { pins, archetypeId } = pinFor(interviewToDraft(before, QUESTIONS, mapping).draft, seed);
      const a = build(before, pins);
      // The interview changes: other areas, other numbers, another wake time. The pinned domain is still there, or the pin is simply not applied.
      const after = interview({ ...second, areas: [...new Set([...(second.areas as string[]), ...(first.areas as string[])])].slice(0, 6), ...first, 'rhythm.wakeTime': wake });
      const b = build(after, pins);
      expect(a.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      expect(b.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      expect(a.blueprint.arc.lengthDays).toBe(pins.arcLength);
      expect(b.blueprint.arc.lengthDays).toBe(pins.arcLength);
      const qa = questOf(a.blueprint, archetypeId);
      const qb = questOf(b.blueprint, archetypeId);
      expect(qb.criterion).toEqual(qa.criterion);
      expect(qb.floor).toEqual(qa.floor);
      expect(qb.designation).toBe(qa.designation);
      expect(qa.designation).toBe(pins.domains[domainKey(archetypeId)]!.designation);
    }), { numRuns: 60 });
  });

  it('a pin changes the System: pinned and unpinned differ unless the value was already the default', () => {
    const base = interview({ areas: ['career', 'body'] });
    const draft = interviewToDraft(base, QUESTIONS, mapping).draft;
    const { pins, archetypeId } = pinFor(draft, 7);
    const pinned = questOf(build(base, pins).blueprint, archetypeId);
    const free = questOf(build(base, NO_PINS).blueprint, archetypeId);
    expect(pinned.designation).not.toBe(free.designation === pinned.designation ? '' : free.designation);
    expect(JSON.stringify(pinned.criterion)).not.toBe(JSON.stringify(free.criterion));
  });

  it('is pure and serialisable: no pins is no change, and pins round-trip through JSON', () => {
    const base = interview({ areas: ['career', 'body'] });
    const draft = interviewToDraft(base, QUESTIONS, mapping).draft;
    expect(applyPins(draft, NO_PINS)).toEqual({ ...draft, pinned: [] });
    const { pins } = pinFor(draft, 3);
    expect(JSON.parse(JSON.stringify(pins))).toEqual(pins);
    expect(hasPins(pins)).toBe(true);
    expect(pinnedPaths(pins)).toEqual(expect.arrayContaining(['arc.lengthDays']));
    const frozen = structuredClone(draft);
    applyPins(draft, pins);
    expect(draft).toEqual(frozen);
  });

  it('unpinning removes the value, and the last unpin removes the domain', () => {
    const one = withPin(NO_PINS, 'reading', 'goodDay', 10);
    expect(one.domains).toEqual({ reading: { goodDay: 10 } });
    expect(withPin(one, 'reading', 'goodDay', undefined)).toEqual(NO_PINS);
    expect(withArcLength(withArcLength(NO_PINS, 90), undefined)).toEqual(NO_PINS);
    expect(withArcLength(NO_PINS, 9000).arcLength).toBe(365);
    expect(withArcLength(NO_PINS, 3).arcLength).toBe(60);
  });

  it('a pinned number is held to what the question allows, and a hard day never stands above the good day beside it', () => {
    expect(clampPin('reading', 100000)).toBe(measureBounds('reading')!.max);
    expect(clampPin('reading', -4)).toBe(measureBounds('reading')!.min);
    const draft = interviewToDraft(interview({ areas: ['knowledge', 'body'] }), QUESTIONS, mapping).draft;
    const pins = withPin(NO_PINS, 'reading', 'hardDay', 90);
    const applied = applyPins(draft, pins).domains.find((choice) => choice.archetypeId === 'reading')!;
    expect(applied.answers).toMatchObject({ hardDay: 90, goodDay: 90 }); // the unpinned good day gives way to the pinned hard day
    const both = applyPins(draft, withPin(withPin(NO_PINS, 'reading', 'goodDay', 20), 'reading', 'hardDay', 5)).domains.find((choice) => choice.archetypeId === 'reading')!;
    expect(both.answers).toMatchObject({ goodDay: 20, hardDay: 5 });
  });
});
