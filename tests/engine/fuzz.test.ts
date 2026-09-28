// final/08-testing-slices-scope.md §3.4's "Reducer fuzz — 10,000 random
// valid event sequences, assert invariants (XP non-negative, level
// monotonic, streak bounded, no outcome-derived XP)" — the one item in
// the testing plan's "Data integrity" section this codebase never had a
// test for. Targets db/projections.ts's buildProjections directly: it's
// a pure function of (events, config, deps) with zero IndexedDB access
// (rebuildProjections and verifyIntegrity are the only callers that add
// I/O around it), so a fuzz run here needs no fake-indexeddb setup for
// the computation itself — only the module import graph pulls in db.ts,
// which is why the shim is still loaded below.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { buildProjections } from '../../src/db/projections';
import { levelFor } from '../../src/engine/level';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { CORE_KEYS, fuzzDeps, randomEventLog } from './support/randomEventLog';
import type { CoreQuestKey } from '../../src/engine/types';

const SEEDS = 10_000;

describe('Reducer fuzz — buildProjections over random valid event logs', () => {
  it(`holds every invariant across ${SEEDS} random seeds`, () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const log = randomEventLog(seed);
      const built = buildProjections(log, DEFAULT_CONFIG, fuzzDeps);
      const ctx = `seed=${seed}`;

      expect(built.playerState, ctx).not.toBeNull();
      const player = built.playerState!;

      // XP non-negative.
      expect(player.total_xp, ctx).toBeGreaterThanOrEqual(0);
      for (const row of built.ledger) {
        expect(row.amount, `${ctx} ledger=${row.id}`).toBeGreaterThanOrEqual(0);
      }

      // Level is always exactly the deterministic function of total_xp —
      // it cannot drift from it or regress independently ("monotonic").
      const recomputed = levelFor(player.total_xp, DEFAULT_CONFIG);
      expect(player.level, ctx).toBe(recomputed.level);
      expect(player.xp_into_level, ctx).toBe(recomputed.xpIntoLevel);
      expect(player.xp_for_next, ctx).toBe(recomputed.xpForNext);

      // Streak fields stay within their defined bounds.
      expect(player.consistency_7, ctx).toBeGreaterThanOrEqual(0);
      expect(player.consistency_7, ctx).toBeLessThanOrEqual(100);
      expect(player.consistency_28, ctx).toBeGreaterThanOrEqual(0);
      expect(player.consistency_28, ctx).toBeLessThanOrEqual(100);
      expect(player.arc_streak, ctx).toBeGreaterThanOrEqual(0);
      expect(player.grace_remaining, ctx).toBeGreaterThanOrEqual(0);

      // No outcome-derived XP: a core completion's grant is always
      // exactly the flat, questKey-keyed config amount (or less, if
      // capped) — never inflated by anything about how it was logged.
      for (const row of built.ledger) {
        if (!row.reason.startsWith('core:')) continue;
        const key = row.reason.slice('core:'.length) as CoreQuestKey;
        expect(row.amount, `${ctx} reason=${row.reason}`).toBeLessThanOrEqual(DEFAULT_CONFIG.coreQuests[key].xp);
      }

      // Every day rollup's XP is non-negative and its core-completed
      // count never exceeds the day's real core total.
      for (const rollup of built.dayRollups) {
        expect(rollup.xp_earned, `${ctx} day=${rollup.local_date}`).toBeGreaterThanOrEqual(0);
        expect(rollup.core_completed, `${ctx} day=${rollup.local_date}`).toBeLessThanOrEqual(CORE_KEYS.length);
      }
    }
  });

  it('is deterministic: the same seed rebuilds byte-identical output', () => {
    for (const seed of [0, 1, 42, 9999]) {
      const log = randomEventLog(seed);
      const first = buildProjections(log, DEFAULT_CONFIG, fuzzDeps);
      const second = buildProjections(log, DEFAULT_CONFIG, fuzzDeps);
      expect(second).toEqual(first);
    }
  });
});
