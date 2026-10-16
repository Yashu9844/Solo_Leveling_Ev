// Loop 10.4: the activation transaction of a generated System. All of the arc's genesis lands together or not at all.
import 'fake-indexeddb/auto';
import { v7 as uuidv7 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ActivationError } from '../../src/blueprint/activation';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { verifyIntegrity } from '../../src/db/projections';
import { engineConfigFor } from '../../src/engine/config';
import type { EngineDeps } from '../../src/engine/types';
import { setEngineV2Override } from '../../src/flags';
import { generateBlueprint } from '../../src/generator/generate';
import { QUESTIONS } from '../../src/onboarding/content';
import { withDefaults } from '../../src/onboarding/engine';
import { interviewToDraft } from '../../src/onboarding/mapping';
import { activateNewSystem } from '../../src/store/activation';
import { getActiveArc } from '../../src/store/arc';
import { getBlueprintVersions } from '../../src/store/blueprint';

const NOW = '2026-09-01T04:00:00Z';
const deps: EngineDeps = { now: () => NOW, newId: () => uuidv7() };
const TABLES = [db.event, db.arc, db.checkpoint, db.profile, db.blueprint_version, db.quest_template, db.quest_instance, db.xp_ledger, db.day_rollup, db.player_state];

function generated(areas = ['career', 'body', 'knowledge']) {
  const draft = withDefaults({ tier: 'quick', answers: { 'identity.displayName': 'Ada', areas } }, QUESTIONS, { today: '2026-09-01' });
  const arcId = uuidv7();
  const { draft: input } = interviewToDraft(draft, QUESTIONS, { lineageId: arcId, today: '2026-09-01', timezone: 'Asia/Kolkata' });
  return { arcId, blueprint: generateBlueprint(input).blueprint };
}

beforeEach(async () => {
  setEngineV2Override(true);
  await db.transaction('rw', TABLES, async () => { for (const table of TABLES) await table.clear(); });
});
afterEach(() => setEngineV2Override(undefined));

describe('activateNewSystem', () => {
  it('writes ARC_STARTED, BLUEPRINT_ACTIVATED v1, the Day-0 checkpoint and the projections together', async () => {
    const { arcId, blueprint } = generated();
    expect(await activateNewSystem({ blueprint, name: 'Ada', baseline: { weight_kg: 71.5, not_tracked: 3 } }, deps)).toBe(arcId);

    const events = await getAllEvents();
    expect(events.map((event) => event.type)).toEqual(['ARC_STARTED', 'BLUEPRINT_ACTIVATED', 'METRIC_RECORDED']);
    expect(events[2]!.payload).toMatchObject({ kind: 'weight_kg', value: 71.5, unit: 'kg' });

    const arc = await getActiveArc();
    expect(arc).toMatchObject({ id: arcId, start_date: blueprint.arc.startDate, end_date: blueprint.arc.endDate, timezone: 'Asia/Kolkata', status: 'active' });
    const checkpoints = await db.checkpoint.toArray();
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]).toMatchObject({ day: 0, blueprint_version: 1, metrics: { weight_kg: 71.5 } });
    expect(await db.profile.get(arcId)).toMatchObject({ name: 'Ada' });
    expect(await db.blueprint_version.count()).toBe(1);
    expect(await db.quest_template.count()).toBe(blueprint.quests.length);
    expect((await getBlueprintVersions()).versions.map((version) => version.version)).toEqual([1]);

    // What was written is exactly what a rebuild from the log produces.
    expect(await verifyIntegrity(engineConfigFor(arc!), deps)).toMatchObject({ clean: true });
  });

  it('is idempotent: a second activation changes nothing', async () => {
    const { arcId, blueprint } = generated();
    await activateNewSystem({ blueprint, name: 'Ada' }, deps);
    const before = await getAllEvents();
    expect(await activateNewSystem({ blueprint, name: 'Ada' }, deps)).toBe(arcId);
    const other = generated(['body', 'career']);
    expect(await activateNewSystem({ blueprint: other.blueprint, name: 'Eve' }, deps)).toBe(arcId);
    expect(await getAllEvents()).toEqual(before);
    expect(await db.arc.count()).toBe(1);
  });

  it('an invalid Blueprint is refused and nothing is written', async () => {
    const { blueprint } = generated();
    const broken = structuredClone(blueprint);
    broken.quests = [];
    await expect(activateNewSystem({ blueprint: broken, name: 'Ada' }, deps)).rejects.toBeInstanceOf(ActivationError);
    for (const table of TABLES) expect(await table.count(), table.name).toBe(0);
  });

  it('needs the Blueprint engine', async () => {
    setEngineV2Override(false);
    const { blueprint } = generated();
    await expect(activateNewSystem({ blueprint, name: 'Ada' }, deps)).rejects.toThrow(/ENGINE_V2/);
    expect(await db.event.count()).toBe(0);
  });
});

describe('intentions', () => {
  it('are written as PLAN_AMENDED on the quest, and the quest template carries the sentence', async () => {
    const { blueprint } = generated();
    const quest = blueprint.quests.find((candidate) => candidate.type === 'core')!;
    await activateNewSystem({ blueprint, name: 'Ada', intentions: [{ questId: quest.id, time: '07:30', place: 'the desk', first_action: 'open the question bank' }, { questId: 'not-a-quest', time: '08:00', place: 'x', first_action: 'y' }] }, deps);
    const events = await getAllEvents();
    expect(events.map((event) => event.type)).toEqual(['ARC_STARTED', 'BLUEPRINT_ACTIVATED', 'PLAN_AMENDED']);
    expect(events[2]!.payload).toEqual({ questKey: quest.id, implementationIntention: { time: '07:30', place: 'the desk', first_action: 'open the question bank' } });
    const template = (await db.quest_template.toArray()).find((row) => row.id.includes(quest.id));
    expect(template?.implementation_intention).toMatchObject({ place: 'the desk' });
  });
});
