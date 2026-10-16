// Loop 13.1: the evening review's one domain prompt - chosen from the System's own prompts, answered with a chip, worth no XP.
import 'fake-indexeddb/auto';
import { v7 as uuidv7 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chooseDomainPrompt, isPromptAnswer } from '../../src/blueprint/evaluate/reviewPrompt';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { engineConfigFor } from '../../src/engine/config';
import type { EngineDeps, ReviewCompletedPayload } from '../../src/engine/types';
import { setEngineV2Override } from '../../src/flags';
import { generateBlueprint } from '../../src/generator';
import { activateNewSystem } from '../../src/store/activation';
import { getActiveArc } from '../../src/store/arc';
import { completeEveningReview, reviewPromptFor } from '../../src/store/review';
import { asksSleptAt } from '../../src/ui/presentation/plan';

const TODAY = '2026-09-01';
const draft = {
  lineageId: 'review', today: TODAY, identity: { displayName: 'ADA', primaryObjective: 'x' },
  domains: [{ archetypeId: 'deep-build' }, { archetypeId: 'reading' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }],
  rhythm: { wakeTime: '07:00', sleepTime: '23:00' }, arc: { startDate: TODAY, lengthDays: 90, timezone: 'Asia/Kolkata' },
};
const { blueprint } = generateBlueprint(draft);
const prompts = blueprint.reviews.domainPrompts;
const byPriority = [...blueprint.domains].sort((a, b) => a.priority - b.priority).map((domain) => domain.id);

describe('which prompt is asked', () => {
  const none = { missedToday: new Set<string>(), misses7: new Map<string, number>(), recentPromptIds: [] as string[] };

  it('the System has one prompt per domain, every one with chips', () => {
    expect(prompts.map((prompt) => prompt.domainId).sort()).toEqual(blueprint.domains.map((domain) => domain.id).sort());
    for (const prompt of prompts) expect(prompt.options.length, prompt.id).toBeGreaterThanOrEqual(2);
  });

  it('a domain that missed today comes first - and the least recently asked among them', () => {
    const [first, second] = byPriority;
    const missed = { ...none, missedToday: new Set([first!, second!]) };
    const asked = chooseDomainPrompt(blueprint, missed)!;
    expect(asked.reason).toBe('missed');
    expect(new Set([first, second]).has(asked.domainId)).toBe(true);
    const next = chooseDomainPrompt(blueprint, { ...missed, recentPromptIds: [asked.id] })!;
    expect(next.reason).toBe('missed');
    expect(next.domainId).not.toBe(asked.domainId);
  });

  it('with nothing missed today, the week\'s bottleneck; with a quiet week, the one asked longest ago', () => {
    const target = byPriority[2]!;
    const week = chooseDomainPrompt(blueprint, { ...none, misses7: new Map([[target, 4], [byPriority[0]!, 1]]) })!;
    expect(week).toMatchObject({ reason: 'bottleneck', domainId: target });

    const rotation = chooseDomainPrompt(blueprint, none)!;
    expect(rotation).toMatchObject({ reason: 'rotation', domainId: byPriority[0] });
    const seen: string[] = [];
    for (let night = 0; night < prompts.length; night++) {
      const chosen = chooseDomainPrompt(blueprint, { ...none, recentPromptIds: [...seen].reverse() })!;
      seen.push(chosen.id);
    }
    expect(new Set(seen).size).toBe(prompts.length);
  });

  it('is deterministic, and never null while the System has a prompt', () => {
    for (const missed of [[], byPriority, [byPriority[1]!]]) {
      const facts = { ...none, missedToday: new Set(missed), misses7: new Map(missed.map((id, i) => [id, i + 1])) };
      expect(chooseDomainPrompt(blueprint, facts)).toEqual(chooseDomainPrompt(blueprint, facts));
      expect(chooseDomainPrompt(blueprint, facts)).not.toBeNull();
    }
  });

  it('the owner\'s System has no prompts, so nothing is asked', () => {
    expect(LEGACY_BLUEPRINT_V1.reviews.domainPrompts).toEqual([]);
    expect(chooseDomainPrompt(LEGACY_BLUEPRINT_V1, { ...none, missedToday: new Set(['dsa']) })).toBeNull();
  });

  it('only a chip of the prompt is an answer', () => {
    const prompt = prompts[0]!;
    expect(isPromptAnswer(blueprint, prompt.id, prompt.options[0]!)).toBe(true);
    expect(isPromptAnswer(blueprint, prompt.id, 'something typed')).toBe(false);
    expect(isPromptAnswer(blueprint, 'nobody', prompt.options[0]!)).toBe(false);
  });

  it('"slept at" is asked where there is a sleep window: the owner\'s System and a sleep-regularity domain, not a System without one', () => {
    expect(asksSleptAt(LEGACY_BLUEPRINT_V1)).toBe(true);
    expect(asksSleptAt(blueprint)).toBe(true);
    const withoutSleep = generateBlueprint({ ...draft, lineageId: 'nosleep', domains: [{ archetypeId: 'deep-build' }, { archetypeId: 'reading' }] }).blueprint;
    expect(asksSleptAt(withoutSleep)).toBe(false);
  });
});

describe('the review, written and read back', () => {
  const NOW = `${TODAY}T14:00:00Z`;
  const deps: EngineDeps = { now: () => NOW, newId: () => uuidv7() };
  const TABLES = [db.event, db.arc, db.checkpoint, db.profile, db.blueprint_version, db.quest_template, db.quest_instance, db.xp_ledger, db.day_rollup, db.player_state];

  beforeEach(async () => {
    setEngineV2Override(true);
    await db.transaction('rw', TABLES, async () => { for (const table of TABLES) await table.clear(); });
    await activateNewSystem({ blueprint: generateBlueprint({ ...draft, lineageId: uuidv7() }).blueprint, name: 'Ada', baseline: {} }, deps);
  });
  afterEach(() => setEngineV2Override(undefined));

  it('on a day nothing was done, every domain missed: the prompt is one of theirs, and it rotates night to night', async () => {
    const live = (await db.blueprint_version.toArray())[0]!.blueprint;
    const first = await reviewPromptFor(TODAY, live);
    expect(first?.reason).toBe('missed');
    expect(live.reviews.domainPrompts.some((prompt) => prompt.id === first!.id)).toBe(true);

    const arc = (await getActiveArc())!;
    const xpBefore = (await db.xp_ledger.toArray()).reduce((sum, row) => sum + row.amount, 0);
    await completeEveningReview(TODAY, arc.id, { energy: 4, focus: 3, blocker: 'time', domainPrompt: { promptId: first!.id, answer: first!.options[0]! } }, engineConfigFor(arc), deps, live);

    const stored = (await getAllEvents()).filter((event) => event.type === 'REVIEW_COMPLETED');
    expect(stored).toHaveLength(1);
    expect((stored[0]!.payload as unknown as ReviewCompletedPayload).domainPrompt).toEqual({ promptId: first!.id, answer: first!.options[0] });
    expect((await db.xp_ledger.toArray()).reduce((sum, row) => sum + row.amount, 0)).toBe(xpBefore);

    const next = await reviewPromptFor(TODAY, live);
    expect(next!.id).not.toBe(first!.id);
  });

  it('the writer refuses an answer that is not one of the prompt\'s chips, and writes nothing', async () => {
    const live = (await db.blueprint_version.toArray())[0]!.blueprint;
    const arc = (await getActiveArc())!;
    const prompt = live.reviews.domainPrompts[0]!;
    await expect(completeEveningReview(TODAY, arc.id, { energy: 3, focus: 3, blocker: 'nothing', domainPrompt: { promptId: prompt.id, answer: 'typed' } }, engineConfigFor(arc), deps, live)).rejects.toThrow(/Not a prompt/);
    expect((await getAllEvents()).filter((event) => event.type === 'REVIEW_COMPLETED')).toHaveLength(0);
  });

  it('a review without a prompt answer is whole: the prompt is optional', async () => {
    const live = (await db.blueprint_version.toArray())[0]!.blueprint;
    const arc = (await getActiveArc())!;
    await completeEveningReview(TODAY, arc.id, { energy: 3, focus: 3, blocker: 'nothing' }, engineConfigFor(arc), deps, live);
    const [event] = (await getAllEvents()).filter((e) => e.type === 'REVIEW_COMPLETED');
    expect((event!.payload as unknown as ReviewCompletedPayload).domainPrompt).toBeUndefined();
  });
});
