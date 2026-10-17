// Loop 14.5: the owner's opt-in offers (platform/02 §22.4). Each is a version the owner may accept at a checkpoint; declining changes nothing.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { engineConfigFromBlueprint } from '../../src/blueprint/engineConfig';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { applicableOffers } from '../../src/blueprint/ownerOffers';
import { computeChangeClass, validateBlueprint, validateTransition } from '../../src/blueprint/validate';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { verifyIntegrity } from '../../src/db/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { setEngineV2Override } from '../../src/flags';
import { activateBlueprint, getBlueprintVersions } from '../../src/store/blueprint';
import { declineOffer, isDeclined } from '../../src/store/ownerOffers';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

const log = legacyActivityLog({ seed: 3, days: 40 });
const facts = { ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID };
const owner = legacyBlueprintFor(facts);
const today = dateAt(29); // Day 30, a checkpoint day
const tomorrow = dateAt(30);

describe('the offers themselves', () => {
  it('both apply to the owner\'s System as it is; each is a structural change that validates', async () => {
    const offers = applicableOffers(owner, { wakeTime: '06:30' });
    expect(offers.map((entry) => entry.offer.id)).toEqual(['wake-target', 'reduced-mode-collapse']);
    for (const { offer, candidate } of offers) {
      candidate.activeFrom = tomorrow;
      expect(await computeChangeClass(owner, candidate), offer.id).toBe('structural');
      candidate.changeClass = 'structural';
      expect(validateBlueprint(candidate, { today }).filter((issue) => issue.severity === 'error'), offer.id).toEqual([]);
      const transition = await validateTransition(owner, candidate, { today, arcDay: 30, nextCheckpointDay: 30, sealedToday: true });
      expect(transition.filter((issue) => issue.severity === 'error'), offer.id).toEqual([]);
    }
  });

  it('the wake offer makes the target the time the owner gave, and the System reads it', () => {
    const candidate = applicableOffers(owner, { wakeTime: '06:30' }).find((entry) => entry.offer.id === 'wake-target')!.candidate;
    expect(engineConfigFromBlueprint(owner).wakeTargetTime).toBe('08:30');
    expect(engineConfigFromBlueprint(candidate).wakeTargetTime).toBe('06:30');
    const quest = candidate.quests.find((q) => q.id === 'sleep')!;
    expect(quest.objective).toBe('Synchronization active: wake within 30 minutes of 06:30 (06:00–07:00).');
    expect(quest.realityLabel).toBe('sync window 06:00–07:00');
  });

  it('the reduced-mode offer turns on collapsing and nothing else in the economy', () => {
    const candidate = applicableOffers(owner, {}).find((entry) => entry.offer.id === 'reduced-mode-collapse')!.candidate;
    expect(owner.progression.reducedMode.collapsesQuests).toBe(false);
    expect(candidate.progression.reducedMode.collapsesQuests).toBe(true);
    expect({ ...candidate.progression, reducedMode: { ...candidate.progression.reducedMode, collapsesQuests: false } }).toEqual(owner.progression);
  });

  it('offers nothing that does not apply: no wake time given, a wake time already honoured, collapsing already on', () => {
    expect(applicableOffers(owner, {}).map((entry) => entry.offer.id)).toEqual(['reduced-mode-collapse']);
    expect(applicableOffers(owner, { wakeTime: '08:30' }).map((entry) => entry.offer.id)).toEqual(['reduced-mode-collapse']);
    // Once both are taken there is nothing left to offer.
    const take = (base: typeof owner, id: string) => applicableOffers(base, { wakeTime: '06:30' }).find((entry) => entry.offer.id === id)!.candidate;
    const woke = take(owner, 'wake-target');
    expect(applicableOffers(woke, { wakeTime: '06:30' }).map((entry) => entry.offer.id)).toEqual(['reduced-mode-collapse']);
    const both = take(woke, 'reduced-mode-collapse');
    expect(applicableOffers(both, { wakeTime: '06:30' })).toEqual([]);
  });

  it('a generated System is not offered what only the owner\'s System was missing', () => {
    expect(applicableOffers({ ...owner, origin: undefined }, { wakeTime: '06:30' })).toEqual([]);
  });
});

describe('accepting, through the writer', () => {
  beforeEach(async () => {
    setEngineV2Override(true);
    const sealed = { id: 'cp-30', day: 30, sealed_at: `${today}T10:00:00Z`, export_verified: true, metrics: {}, self_efficacy: {}, automaticity: {}, enjoyment: {}, rank_before: 'E', rank_after: 'E', gates: {}, controlled: {}, external: {}, quest_templates_snapshot: {} };
    await loadLegacyDb(prefixOf(log, today), today, [sealed]);
  });

  it('writes an ordinary version that begins the day after the seal; the days before it do not move; the log still rebuilds clean', async () => {
    const before = buildProjectionsV2(await getAllEvents(), { now: () => '', newId: () => '' });
    const candidate = applicableOffers(owner, { wakeTime: '06:30' }).find((entry) => entry.offer.id === 'wake-target')!.candidate;
    candidate.activeFrom = tomorrow;
    candidate.changeClass = 'structural';
    candidate.provenance = { ...candidate.provenance };
    await activateBlueprint(candidate, today, { now: () => `${today}T10:30:00Z`, newId: () => 'owner-offer-1' });

    const { versions } = await getBlueprintVersions();
    expect(versions.map((version) => [version.version, version.activeFrom])).toEqual([[1, owner.activeFrom], [2, tomorrow]]);
    expect(versions[1]!.origin).toBe('legacy');

    // H2: everything dated before the new version begins is what it was.
    const events = await getAllEvents();
    const after = buildProjectionsV2(events, { now: () => '', newId: () => '' });
    // The only difference an explicit version makes to an old row is the version stamp it now carries (H6); amounts, reasons and states are as they were.
    const upTo = (rows: { local_date: string }[]) => JSON.stringify(rows.filter((row) => row.local_date < tomorrow).map(({ ...row }) => { delete (row as { blueprint_version?: number }).blueprint_version; return row; }));
    expect(upTo(after.ledger)).toBe(upTo(before.ledger));
    expect(upTo(after.instances)).toBe(upTo(before.instances));
    expect(await verifyIntegrity(DEFAULT_CONFIG, { now: () => `${today}T10:30:00Z`, newId: () => 'x' })).toMatchObject({ clean: true });
  });

  it('is refused on a day nothing was sealed, however the owner asks', async () => {
    const candidate = applicableOffers(owner, { wakeTime: '06:30' })[0]!.candidate;
    candidate.activeFrom = dateAt(21);
    candidate.changeClass = 'structural';
    await expect(activateBlueprint(candidate, dateAt(20), { now: () => `${dateAt(20)}T10:30:00Z`, newId: () => 'x' })).rejects.toMatchObject({ message: expect.stringContaining('V-TRN-03') });
  });

  it('declining writes nothing to the log or to the versions, and is remembered for that checkpoint only', async () => {
    // The browser's localStorage, for a node run.
    const data = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    const eventsBefore = (await getAllEvents()).length;
    expect(isDeclined('wake-target', 30)).toBe(false);
    declineOffer('wake-target', 30);
    expect(isDeclined('wake-target', 30)).toBe(true);
    expect(isDeclined('wake-target', 60)).toBe(false);
    expect(isDeclined('reduced-mode-collapse', 30)).toBe(false);
    expect((await getAllEvents()).length).toBe(eventsBefore);
    expect((await getBlueprintVersions()).versions).toHaveLength(1);
    expect(await db.blueprint_version.count()).toBe(0);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
