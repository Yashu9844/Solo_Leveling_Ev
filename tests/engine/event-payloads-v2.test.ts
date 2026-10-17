// platform/05 loop 5.3 — QUEST_COMPLETED schema_v 2 and INSTRUMENT_RECORDED.
// Mixed v1/v2 logs must fold identically; a generic instrument's record must
// be validated, stored, picked up by the evaluators and paid by the ledger.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { activationEvent } from '../../src/blueprint/activation';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { recordsFromEvents } from '../../src/blueprint/evaluate/env';
import { ledgerRowsV2 } from '../../src/blueprint/evaluate/ledger';
import { questCompletedPayloadV2, questCompletionFacts } from '../../src/blueprint/events';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { resolveBlueprints } from '../../src/blueprint/resolve';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { instrumentRecordRows } from '../../src/db/instrumentProjection';
import { buildProjections } from '../../src/db/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { applyEvents } from '../../src/engine/reduce';
import type { QuestCompletedPayload, SystemEvent } from '../../src/engine/types';
import { allRecords } from '../../src/instruments/records';
import { activateBlueprint } from '../../src/store/blueprint';
import { setEngineV2Override } from '../../src/flags';
import { InstrumentRecordError, recordInstrument } from '../../src/store/instruments';
import { loadTodayQuests } from '../../src/store/quests';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';
import { fuzzDeps } from './support/randomEventLog';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

describe('QUEST_COMPLETED schema_v 2 (loop 5.3)', () => {
  const log = legacyActivityLog({ seed: 42, days: 120 });

  it('reads v1 and v2 completions the same way', () => {
    const v1 = log.find((e) => e.type === 'QUEST_COMPLETED')!;
    const p = v1.payload as unknown as QuestCompletedPayload;
    const v2: SystemEvent = { ...v1, schema_v: 2, payload: questCompletedPayloadV2(p, { id: p.questKey, domainId: p.questKey }, 1) as unknown as Record<string, unknown> };
    expect(questCompletionFacts(v1)).toEqual({ ...questCompletionFacts(v2), domainId: undefined });
    expect(questCompletionFacts(v1)).toMatchObject({ questDefId: p.questKey, blueprintVersion: 1 });
    expect(questCompletionFacts(v2)).toMatchObject({ questKey: p.questKey, questDefId: p.questKey, domainId: p.questKey, blueprintVersion: 1 });
  });

  it('a log that mixes v1 and v2 completions folds to identical projections, ledger and state', () => {
    const mixed = log.map((e, index) => {
      if (e.type !== 'QUEST_COMPLETED' || index % 2 === 0) return e;
      const p = e.payload as unknown as QuestCompletedPayload;
      return { ...e, schema_v: 2, payload: questCompletedPayloadV2(p, { id: p.questKey, domainId: p.questKey }, 1) as unknown as Record<string, unknown> };
    });
    expect(mixed.filter((e) => e.schema_v === 2).length).toBeGreaterThan(100);
    expect(json(buildProjections(mixed, DEFAULT_CONFIG, fuzzDeps))).toEqual(json(buildProjections(log, DEFAULT_CONFIG, fuzzDeps)));
    expect(json(buildProjectionsV2(mixed, fuzzDeps))).toEqual(json(buildProjectionsV2(log, fuzzDeps)));
    expect(json(applyEvents(mixed, DEFAULT_CONFIG).quests)).toEqual(json(applyEvents(log, DEFAULT_CONFIG).quests));
  });
});

/** The legacy System plus one generic instrument ("pages read"), as a legal operational version. */
function withReading(arcId: string, activeFrom: string): SystemBlueprint {
  const next = legacyBlueprintFor({ ...OWNER_ARC_DEFAULTS, id: arcId });
  next.version = 2;
  next.activeFrom = activeFrom;
  next.changeClass = 'operational';
  next.domains.find((d) => d.id === 'foundations')!.instrumentIds.push('foundations.pages');
  next.instruments.push({
    id: 'foundations.pages', domainId: 'foundations', type: 'threshold', label: 'Pages read', logVerb: 'Log Pages',
    params: { unit: 'pages', comparator: '>=', target: 20, bonusAt: 30, bonusXp: 10, grant: { amount: 10, reason: 'pages' } }, controllability: 'effort', eventBinding: { kind: 'generic' },
  });
  return next;
}

describe('INSTRUMENT_RECORDED (loop 5.3)', () => {
  const today = dateAt(15);
  const tomorrow = dateAt(16);
  const log = legacyActivityLog({ seed: 3, days: 20 });
  let n = 0;
  const deps = (now: string) => ({ now: () => now, newId: () => `zzzz-rec-${String(n++).padStart(3, '0')}` });

  it('validates the record against the instrument in force, writes the event and the cache row, and feeds the evaluators and the ledger', async () => {
    const harness = await loadLegacyDb(prefixOf(log, today), today);
    await activateBlueprint(withReading(LEGACY_ARC_ID, tomorrow), today, deps(harness.now()));
    const writer = deps(`${tomorrow}T09:00:00.000Z`);

    // Rejected without a trace: unknown instrument, a legacy instrument, a malformed record, and a day before the instrument existed.
    const before = (await getAllEvents()).length;
    await expect(recordInstrument('nope.nothing', { value: 1 }, tomorrow, writer)).rejects.toBeInstanceOf(InstrumentRecordError);
    await expect(recordInstrument('dsa.problems', { value: 1 }, tomorrow, writer)).rejects.toThrow('legacy instrument');
    await expect(recordInstrument('foundations.pages', { value: Number.NaN }, tomorrow, writer)).rejects.toMatchObject({ codes: ['I-THR-01'] });
    await expect(recordInstrument('foundations.pages', { value: 25 }, today, writer)).rejects.toThrow('not an instrument of the System in force');
    expect((await getAllEvents()).length).toBe(before);
    expect(await db.instrument_record.count()).toBe(0);

    const first = await recordInstrument('foundations.pages', { value: 35 }, tomorrow, writer); // at/over bonusAt: pays
    await recordInstrument('foundations.pages', { value: 12 }, tomorrow, writer); // under it: pays nothing
    const events = await getAllEvents();
    const written = events.find((e) => e.id === first)!;
    expect(written).toMatchObject({ type: 'INSTRUMENT_RECORDED', local_date: tomorrow, idem_key: `instrument:${first}`, payload: { instrumentId: 'foundations.pages', instrumentType: 'threshold', domainId: 'foundations', blueprintVersion: 2 } });

    // The cache equals what the log implies, and the records join the evaluators' view.
    expect(json(await db.instrument_record.toArray())).toEqual(json(instrumentRecordRows(events)));
    expect(allRecords(events).filter((r) => r.instrumentId === 'foundations.pages')).toHaveLength(2);
    expect(recordsFromEvents(events).get('foundations.pages')).toHaveLength(2);

    // The ledger pays the instrument's grant through its channel (LEARN), once.
    const { versions } = resolveBlueprints(events);
    const state = applyEvents(events, DEFAULT_CONFIG);
    const ledger = ledgerRowsV2(versions[1]!, events, state.quests, recordsFromEvents(events));
    const pages = ledger.filter((row) => row.reason === 'pages');
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ amount: 10, category: 'LEARN', event_id: first, local_date: tomorrow });
  }, 60_000);

  it('under ENGINE_V2 a record that satisfies a quest criterion completes the quest, once, and not when it falls short', async () => {
    setEngineV2Override(true);
    try {
      // Making a quest completable another way changes what completes it: a structural change, which begins the day after a checkpoint.
      const today = dateAt(29); // Day 30, a checkpoint day
      const tomorrow = dateAt(30);
      const harness = await loadLegacyDb(prefixOf(log, today), today);
      const next = withReading(LEGACY_ARC_ID, tomorrow);
      next.changeClass = 'structural';
      // Training is now also completed by reading 20+ pages.
      const training = next.quests.find((quest) => quest.id === 'training')!;
      training.criterion = { kind: 'any', of: [training.criterion, { kind: 'signal', instrumentId: 'foundations.pages', signal: 'hit', comparator: '>=', target: 1 }] };
      training.floor = training.criterion;
      await activateBlueprint(next, today, deps(harness.now()));
      const writer = deps(`${tomorrow}T09:00:00.000Z`);
      await loadTodayQuests(tomorrow, DEFAULT_CONFIG, writer);
      const completed = async () => (await db.quest_instance.where('local_date').equals(tomorrow).toArray()).find((instance) => instance.template_id.endsWith('::training'))!.state;
      expect(await completed()).toBe('available');
      await recordInstrument('foundations.pages', { value: 5 }, tomorrow, writer); // under the 20-page target
      expect(await completed()).toBe('available');
      await recordInstrument('foundations.pages', { value: 25 }, tomorrow, writer);
      expect(await completed()).toBe('complete');
      const completions = (await getAllEvents()).filter((e) => e.type === 'QUEST_COMPLETED' && e.local_date === tomorrow);
      expect(completions).toHaveLength(1);
      // The arc has explicit versions, so the completion carries the v2 payload.
      expect(completions[0]).toMatchObject({ schema_v: 2, payload: { questKey: 'training', questDefId: 'training', domainId: 'training', blueprintVersion: 2 } });
      await recordInstrument('foundations.pages', { value: 40 }, tomorrow, writer);
      expect((await getAllEvents()).filter((e) => e.type === 'QUEST_COMPLETED' && e.local_date === tomorrow)).toHaveLength(1);
    } finally {
      setEngineV2Override(undefined);
    }
  }, 60_000);

  it('an older build skips INSTRUMENT_RECORDED and BLUEPRINT_ACTIVATED without changing a single projection (rollback safety)', () => {
    const base = legacyActivityLog({ seed: 7, days: 30 });
    const newer: SystemEvent[] = [
      ...base,
      activationEvent(withReading('legacy-arc', dateAt(31)), { id: 'zzz-1', occurred_at: `${dateAt(30)}T10:00:00Z`, local_date: dateAt(30) }) as SystemEvent,
      { id: 'zzz-2', type: 'INSTRUMENT_RECORDED', occurred_at: `${dateAt(31)}T10:00:00Z`, local_date: dateAt(31), arc_id: 'legacy-arc', source: 'user', idem_key: 'instrument:zzz-2', schema_v: 1,
        payload: { instrumentId: 'foundations.pages', instrumentType: 'threshold', domainId: 'foundations', blueprintVersion: 2, record: { value: 40 } } },
    ];
    expect(json(buildProjections(newer, DEFAULT_CONFIG, fuzzDeps))).toEqual(json(buildProjections(base, DEFAULT_CONFIG, fuzzDeps)));
  });
});
