// Loop 8.8: Reduced Mode that collapses (platform/02 §9.3), and level unlocks (final/01 §3).
//
// After two missed days a System in Reduced Mode asks each quest for its FLOOR, not its full criterion, until the person is
// back. The owner's System has never done this (collapsesQuests is false and the golden suite pins it), so the same two
// lapsed days with the same small session complete nothing for them.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { activationEvent } from '../../src/blueprint/activation';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import type { Criterion, SystemBlueprint } from '../../src/blueprint/schema';
import { featureUnlocked, FEATURE_IDS, unlockLevel } from '../../src/blueprint/unlocks';
import { db } from '../../src/db/db';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { setEngineV2Override } from '../../src/flags';
import { generateBlueprint } from '../../src/generator';
import { FEATURE_UNLOCK_LEVELS } from '../../src/library/calibration';
import { logBuildSession } from '../../src/store/build';
import { loadTodayQuests } from '../../src/store/quests';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb } from './support/legacyDb';

afterEach(() => setEngineV2Override(undefined));

const facts = { ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID };

/** The owner's System as an explicit version 1, with the build quest's floor lowered to 15 minutes and Reduced Mode collapsing or not. */
function blueprint(collapses: boolean): SystemBlueprint {
  const system = legacyBlueprintFor(facts);
  system.progression.reducedMode.collapsesQuests = collapses;
  const build = system.quests.find((quest) => quest.id === 'build')!;
  build.floor = { ...(build.criterion as Extract<Criterion, { kind: 'signal' }>), target: 15 };
  return system;
}

/** Day 0 played in full, then `missed` days with nothing, then today. */
function lapsed(system: SystemBlueprint, missed: number) {
  const first = legacyActivityLog({ seed: 11, days: 1 }).filter((event) => event.local_date <= dateAt(0));
  const arcStarted = first[0]!;
  const activation = activationEvent(system, { id: `${arcStarted.id}a`, occurred_at: arcStarted.occurred_at, local_date: arcStarted.local_date });
  return { events: [arcStarted, activation, ...first.slice(1)], today: dateAt(missed + 1) };
}

async function logSmallBuild(system: SystemBlueprint, missed: number): Promise<'complete' | 'available'> {
  setEngineV2Override(true);
  const { events, today } = lapsed(system, missed);
  const deps = await loadLegacyDb(events, today);
  let n = 0;
  const realDeps = { now: () => `${today}T10:00:00.000Z`, newId: () => `zzzz-collapse-${String(n++).padStart(5, '0')}` };
  void deps;
  await loadTodayQuests(today, DEFAULT_CONFIG, realDeps); // today's instances, as opening the app would make them
  await logBuildSession(today, LEGACY_ARC_ID, { mode: 'LEARN', minutes: 20, projectKey: 'probe' }, DEFAULT_CONFIG, realDeps);
  const template = (await db.quest_template.toArray()).find((candidate) => candidate.key === 'build' && candidate.type === 'core')!;
  const instance = (await db.quest_instance.where('local_date').equals(today).toArray()).find((candidate) => candidate.template_id === template.id)!;
  return instance.state as 'complete' | 'available';
}

describe('Reduced Mode that collapses to the floor (loop 8.8)', () => {
  it('after two missed days, a 20-minute session completes the build quest when the System collapses', async () => {
    expect(await logSmallBuild(blueprint(true), 2)).toBe('complete'); // the floor is 15 minutes
  });

  it('the same lapse and the same 20 minutes complete nothing in the owner\'s System (it never collapses)', async () => {
    expect(await logSmallBuild(blueprint(false), 2)).toBe('available'); // the criterion is 45 minutes
  });

  it('without the lapse, a collapsing System still asks for the full 45 minutes', async () => {
    expect(await logSmallBuild(blueprint(true), 0)).toBe('available');
    expect(await logSmallBuild(blueprint(true), 1)).toBe('available'); // one missed day is not Reduced Mode
  });

  it('a generated System collapses; the owner\'s does not', () => {
    const { blueprint: generated } = generateBlueprint({
      lineageId: 'collapse-gen', today: '2026-09-01', identity: { displayName: 'ADA', primaryObjective: '' },
      domains: [{ archetypeId: 'deep-build' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
      arc: { startDate: '2026-09-01', lengthDays: 90, timezone: 'UTC' },
    });
    expect(generated.progression.reducedMode.collapsesQuests).toBe(true);
    expect(legacyBlueprintFor().progression.reducedMode.collapsesQuests).toBe(false);
  });
});

describe('level unlocks', () => {
  it('the owner\'s System gates nothing: every feature is open at level 1', () => {
    const owner = legacyBlueprintFor().progression;
    expect(owner.unlocks).toBeUndefined();
    for (const feature of FEATURE_IDS) {
      expect(unlockLevel(owner, feature)).toBeUndefined();
      expect(featureUnlocked(owner, feature, 1)).toBe(true);
    }
  });

  it('a generated System opens up as it is earned: weekly quests 3, attributes 5, skills 10, review 12, bosses 15, projection 20', () => {
    const { blueprint: generated } = generateBlueprint({
      lineageId: 'unlock-gen', today: '2026-09-01', identity: { displayName: 'ADA', primaryObjective: '' },
      domains: [{ archetypeId: 'deep-build' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
      arc: { startDate: '2026-09-01', lengthDays: 120, timezone: 'UTC' },
    });
    expect(generated.progression.unlocks).toEqual(FEATURE_UNLOCK_LEVELS);
    expect(featureUnlocked(generated.progression, 'weekly_quests', 2)).toBe(false);
    expect(featureUnlocked(generated.progression, 'weekly_quests', 3)).toBe(true);
    expect(featureUnlocked(generated.progression, 'bosses', 14)).toBe(false);
    expect(featureUnlocked(generated.progression, 'bosses', 15)).toBe(true);
    expect(FEATURE_IDS.every((feature) => unlockLevel(generated.progression, feature) !== undefined)).toBe(true);
  });

  it('every unlock is reachable well inside the arc: the lowest completion rate we plan for reaches the last one before the second checkpoint', () => {
    // Level 20 needs 19,000 XP at coefficient 84; at 50% completion the owner's table shows ~L21 at day 60 and ~L14 at day 30.
    expect(FEATURE_UNLOCK_LEVELS.projection).toBeLessThanOrEqual(21);
    expect(Math.max(...Object.values(FEATURE_UNLOCK_LEVELS))).toBe(FEATURE_UNLOCK_LEVELS.projection);
  });
});
