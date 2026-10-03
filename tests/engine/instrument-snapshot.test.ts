import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildSignalSnapshot } from '../../src/instruments/snapshot';
import { buildDayOutcomes } from '../../src/db/projections';
import { applyEvents } from '../../src/engine/reduce';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { localDateAt, randomEventLog } from './support/randomEventLog';

describe('SignalSnapshot (loop 3.1)', () => {
  it('characterizes legacy day outcomes over randomized event logs', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 250 }), fc.integer({ min: 1, max: 40 }), (seed, dayCount) => {
      const events = randomEventLog(seed, dayCount);
      const state = applyEvents(events, DEFAULT_CONFIG);
      const arc = state.arc!;
      const uptoDate = localDateAt(dayCount - 1);
      const legacy = buildDayOutcomes(events, state.quests, arc.start_date, arc.paused_dates, uptoDate);
      const snapshot = buildSignalSnapshot({
        arcStartDate: arc.start_date,
        uptoDate,
        pausedDates: arc.paused_dates,
        events,
        coreCompletions: Object.values(state.quests).map((completion) => ({ questId: completion.instance_id, localDate: completion.local_date })),
        coreTotalOn: () => 6,
        streak: DEFAULT_CONFIG.streak,
      });
      expect(snapshot.days.map(({ local_date, mvd_met, paused }) => ({ local_date, mvd_met, paused }))).toEqual(legacy);
      expect(snapshot.value('mvd_days')).toBe(legacy.filter((day) => day.mvd_met).length);
    }), { numRuns: 500 });
  });

  it('exposes global boss, checkpoint, completion, and grace facts', () => {
    const events = randomEventLog(17, 4);
    const state = applyEvents(events, DEFAULT_CONFIG);
    events.push(
      { ...events[0]!, id: 'boss', idem_key: 'boss', type: 'BOSS_CLEARED', local_date: localDateAt(2) },
      { ...events[0]!, id: 'checkpoint', idem_key: 'checkpoint', type: 'CHECKPOINT_SEALED', local_date: localDateAt(3) },
    );
    const snapshot = buildSignalSnapshot({
      arcStartDate: state.arc!.start_date, uptoDate: localDateAt(3), pausedDates: [], events,
      coreCompletions: [{ questId: 'a', localDate: localDateAt(0) }, { questId: 'b', localDate: localDateAt(0) }],
      coreTotalOn: () => 4, streak: DEFAULT_CONFIG.streak,
    });
    expect(snapshot.value('bosses_cleared')).toBe(1);
    expect(snapshot.value('checkpoints_sealed')).toBe(1);
    expect(snapshot.value('core_completion')).toBe(2 / 16);
    expect(snapshot.value('grace_used')).toBeGreaterThanOrEqual(0);
  });
});
