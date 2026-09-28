// final/08-testing-slices-scope.md §3.1's "golden fixture": "A recorded
// 120-day event log, asserted against a snapshot of final state... same
// event log + same configuration = same resulting state. Any rule
// change that alters historical outcomes fails loudly. Regenerating the
// snapshot is a deliberate, reviewed act."
//
// The 120-day log itself is generated (tests/engine/support/
// randomEventLog.ts, fixed seed 42) rather than hand-authored day by
// day — a full arc's worth of quest churn hand-written here would be
// thousands of lines for no more rigor than a seeded, reproducible
// generator already gives: the SAME seed always produces the SAME log
// (see the determinism test below and fuzz.test.ts's own determinism
// check), so this is exactly "a recorded event log" in every way that
// matters, just recorded as a seed instead of a literal event array.
// What makes it "golden" is the committed snapshot file next to this
// test (tests/engine/__snapshots__/golden-120.test.ts.snap) — CI fails
// the moment a rule change alters this log's outcome, and updating the
// snapshot (`vitest run -u`) is the "deliberate, reviewed act" the spec
// asks for: a real commit, with the snapshot diff visible in review.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { buildProjections } from '../../src/db/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { fuzzDeps, randomEventLog } from './support/randomEventLog';

const GOLDEN_SEED = 42;
const ARC_LENGTH_DAYS = 120;

describe('Golden 120-day fixture', () => {
  it('same event log + same configuration = same resulting state', () => {
    const log = randomEventLog(GOLDEN_SEED, ARC_LENGTH_DAYS);
    const built = buildProjections(log, DEFAULT_CONFIG, fuzzDeps);

    // The full derived state, minus the naturally-varying template/
    // instance ids buried in `templates`/`instances` (stable per this
    // build's id scheme already, but the summary below is what a
    // reviewer actually reads on a snapshot diff — final state, not
    // internal row plumbing).
    expect({
      totalXp: built.playerState?.total_xp,
      level: built.playerState?.level,
      rank: built.playerState?.rank,
      arcStreak: built.playerState?.arc_streak,
      consistency7: built.playerState?.consistency_7,
      consistency28: built.playerState?.consistency_28,
      graceRemaining: built.playerState?.grace_remaining,
      templateCount: built.templates.length,
      instanceCount: built.instances.length,
      completedInstanceCount: built.instances.filter((i) => i.state === 'complete').length,
      ledgerRowCount: built.ledger.length,
      ledgerTotalByCategory: built.ledger.reduce<Record<string, number>>((acc, row) => {
        acc[row.category] = (acc[row.category] ?? 0) + row.amount;
        return acc;
      }, {}),
      dayRollupCount: built.dayRollups.length,
      lastDayRollup: built.dayRollups[built.dayRollups.length - 1],
    }).toMatchSnapshot();
  });

  it('is deterministic across repeated builds of the same recorded log', () => {
    const log = randomEventLog(GOLDEN_SEED, ARC_LENGTH_DAYS);
    const first = buildProjections(log, DEFAULT_CONFIG, fuzzDeps);
    const second = buildProjections(randomEventLog(GOLDEN_SEED, ARC_LENGTH_DAYS), DEFAULT_CONFIG, fuzzDeps);
    expect(second).toEqual(first);
  });
});
