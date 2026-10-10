// The read-model cache (loop 6.2) must make repeated reads cheap WITHOUT ever
// serving a stale answer: any write, checkpoint seal, rebuild or change of day
// has to show up in the very next read.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/db';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { setEngineV2Override } from '../../src/flags';
import { getAchievementsReport } from '../../src/store/achievements';
import { getAttributes } from '../../src/store/attributes';
import { getBossStatus } from '../../src/store/boss';
import { markExported, sealCheckpoint } from '../../src/store/checkpoint';
import { logProblem } from '../../src/store/dsa';
import { getRealitySummary } from '../../src/store/reality';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';
import { readInputs } from '../../src/store/v2Reads';

afterEach(() => setEngineV2Override(undefined));

const log = legacyActivityLog({ seed: 4, days: 20 });
const today = dateAt(15);

describe('v2 read cache (loop 6.2)', () => {
  it('serves the same inputs while nothing changed, and fresh ones after a write, a seal or a new day', async () => {
    setEngineV2Override(true);
    const harness = await loadLegacyDb(prefixOf(log, today), today);
    const deps = { now: harness.now, newId: (() => { let n = 0; return () => `zzzz-cache-${String(n++).padStart(4, '0')}`; })() };

    const first = await readInputs(today);
    expect(await readInputs(today)).toBe(first); // no write in between: the very same object
    const attributesBefore = await getAttributes(today, DEFAULT_CONFIG);
    expect(await readInputs(today)).toBe(first); // reads themselves do not invalidate

    // A write (and its rebuild) invalidates.
    await logProblem(today, LEGACY_ARC_ID, { slug: 'cache-p', title: 'Cache', topic: 'Arrays', difficulty: 'H', outcome: 'first_attempt', minutes: 30 }, DEFAULT_CONFIG, deps);
    const second = await readInputs(today);
    expect(second).not.toBe(first);
    expect(await getRealitySummary(today)).toMatchObject({ problems: (await getRealitySummary(today)).problems });
    expect((await getAttributes(today, DEFAULT_CONFIG)).find((a) => a.attribute === 'PROBLEM_SOLVING')!.value).toBeGreaterThan(attributesBefore.find((a) => a.attribute === 'PROBLEM_SOLVING')!.value - 1e-9);

    // Another day is another key.
    expect(await readInputs(dateAt(16))).not.toBe(second);

    // Sealing a checkpoint changes a row, not the log, and must still invalidate.
    const beforeSeal = await readInputs(today);
    await markExported(14, deps);
    await sealCheckpoint(14, today, DEFAULT_CONFIG, { now: () => `${today}T09:00:00.000Z` });
    const afterSeal = await readInputs(today);
    expect(afterSeal).not.toBe(beforeSeal);
    expect(afterSeal!.checkpoints.some((row) => row.day === 14 && row.sealed_at)).toBe(true);
    expect((await getBossStatus('I', today)).boss.id).toBe('I');
    expect((await getAchievementsReport(today, DEFAULT_CONFIG)).achievements).toHaveLength(8);
  }, 60_000);

  it('never leaks one database into the next: a different log is a different answer even with the same shape', async () => {
    setEngineV2Override(true);
    await loadLegacyDb(prefixOf(log, today), today);
    const a = await getRealitySummary(today);
    await Promise.all(db.tables.map((table) => table.clear()));
    await loadLegacyDb(prefixOf(legacyActivityLog({ seed: 99, days: 20 }), today), today);
    const b = await getRealitySummary(today);
    expect(b).not.toEqual(a);
  }, 60_000);
});
