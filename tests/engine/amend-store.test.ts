// Loop 14.3: the writer's gate for a structural change. It begins the day after a checkpoint seal - on the schedule, or tomorrow if a checkpoint
// was sealed today (the Amend step) - and at no other time after the first week.
import 'fake-indexeddb/auto';
import { v7 as uuidv7 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ActivationError } from '../../src/blueprint/activation';
import { applyOps, planAmendment, type AmendOp } from '../../src/blueprint/amend';
import { db } from '../../src/db/db';
import type { EngineDeps } from '../../src/engine/types';
import { setEngineV2Override } from '../../src/flags';
import { generateBlueprint } from '../../src/generator';
import { activateNewSystem } from '../../src/store/activation';
import { activateBlueprint, getBlueprintVersions } from '../../src/store/blueprint';
import { checkpointSealedToday } from '../../src/store/checkpoint';
import { getEngineConfig } from '../../src/store/engineConfig';
import { p1 } from '../fixtures/personas/p1';

const START = p1.draft.arc.startDate;
const day = (arcDay: number): string => new Date(Date.parse(`${START}T00:00:00Z`) + (arcDay - 1) * 86_400_000).toISOString().slice(0, 10);
const NOW = `${START}T04:00:00Z`;
const deps: EngineDeps = { now: () => NOW, newId: () => uuidv7() };
const TABLES = [db.event, db.arc, db.checkpoint, db.profile, db.blueprint_version, db.quest_template, db.quest_instance, db.xp_ledger, db.day_rollup, db.player_state];

beforeEach(async () => {
  setEngineV2Override(true);
  await db.transaction('rw', TABLES, async () => { for (const table of TABLES) await table.clear(); });
  await activateNewSystem({ blueprint: generateBlueprint({ ...p1.draft, lineageId: uuidv7() }).blueprint, name: 'Ada', baseline: {} }, deps);
});
afterEach(() => setEngineV2Override(undefined));

async function base() {
  return (await getBlueprintVersions()).versions[0]!;
}
async function weightMove(blueprint: Awaited<ReturnType<typeof base>>, activeFrom: string) {
  const cores = blueprint.quests.filter((quest) => quest.type === 'core').sort((a, b) => b.xp - a.xp);
  const op: AmendOp = { kind: 'weight', fromQuestId: cores[0]!.id, toQuestId: cores[cores.length - 1]!.id, xp: 10 };
  const next = applyOps(blueprint, [op]);
  next.changeClass = 'structural';
  next.activeFrom = activeFrom;
  return next;
}
const sealCheckpoint = (arcDay: number) => db.checkpoint.add({
  id: `cp-${arcDay}`, day: arcDay as 14, sealed_at: `${day(arcDay)}T10:00:00Z`, export_verified: true, metrics: {}, self_efficacy: {}, automaticity: {}, enjoyment: {},
  rank_before: 'E', rank_after: 'E', gates: {}, controlled: {}, external: {}, quest_templates_snapshot: {},
});

describe('a structural change after the first week', () => {
  it('is refused tomorrow when no checkpoint was sealed today, and says why', async () => {
    const v1 = await base();
    await expect(activateBlueprint(await weightMove(v1, day(21)), day(20), deps)).rejects.toMatchObject({ name: 'ActivationError', message: expect.stringContaining('V-TRN-03') });
    expect((await getBlueprintVersions()).versions).toHaveLength(1);
  });

  it('is accepted for the day after the next checkpoint', async () => {
    const v1 = await base();
    // Today is Day 20; the next checkpoint is Day 30; the change begins on Day 31.
    await activateBlueprint(await weightMove(v1, day(31)), day(20), deps);
    expect((await getBlueprintVersions()).versions.map((version) => [version.version, version.activeFrom])).toEqual([[1, START], [2, day(31)]]);
  });

  it('is refused on the checkpoint day itself - that would re-price the day that was sealed', async () => {
    const v1 = await base();
    await expect(activateBlueprint(await weightMove(v1, day(30)), day(20), deps)).rejects.toBeInstanceOf(ActivationError);
  });

  it('is accepted tomorrow on the day a checkpoint is sealed (the Amend step), and only then', async () => {
    const v1 = await base();
    expect(await checkpointSealedToday(day(30), getEngineConfig())).toBe(false);
    await sealCheckpoint(30);
    expect(await checkpointSealedToday(day(30), getEngineConfig())).toBe(true);
    expect(await checkpointSealedToday(day(31), getEngineConfig())).toBe(false);
    await activateBlueprint(await weightMove(v1, day(31)), day(30), deps);
    expect((await getBlueprintVersions()).versions[1]!.activeFrom).toBe(day(31));

    // The next day the seal is yesterday's: another structural change must wait for the next checkpoint.
    const v2 = (await getBlueprintVersions()).versions[1]!;
    const again = await weightMove({ ...v2, activeFrom: day(31) }, day(32));
    again.version = 3;
    await expect(activateBlueprint(again, day(31), deps)).rejects.toMatchObject({ message: expect.stringContaining('V-TRN-03') });
  });

  it('the plan agrees with the writer: ready only when the writer would accept', async () => {
    const v1 = await base();
    const ops: AmendOp[] = [{ kind: 'weight', fromQuestId: v1.quests.filter((q) => q.type === 'core').sort((a, b) => b.xp - a.xp)[0]!.id, toQuestId: v1.quests.filter((q) => q.type === 'core').sort((a, b) => a.xp - b.xp)[0]!.id, xp: 10 }];
    const waiting = await planAmendment(v1, ops, { today: day(20), arcDay: 20, nextCheckpointDay: 30 });
    expect(waiting).toMatchObject({ status: 'waits-for-checkpoint', activeFrom: day(31) });
    const sealed = await planAmendment(v1, ops, { today: day(30), arcDay: 30, nextCheckpointDay: 30, sealedToday: true });
    expect(sealed).toMatchObject({ status: 'ready', activeFrom: day(31), effect: 'TAKES EFFECT TOMORROW, THE DAY AFTER THE CHECKPOINT.' });
    const unsealed = await planAmendment(v1, ops, { today: day(30), arcDay: 30, nextCheckpointDay: 30 });
    expect(unsealed).toMatchObject({ status: 'waits-for-checkpoint', activeFrom: day(31) });
  });
});
