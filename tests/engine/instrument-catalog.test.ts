import { describe, expect, it } from 'vitest';
import { INSTRUMENT_CATALOGUE, isKnownInstrumentSignal } from '../../src/instruments/catalog';

describe('instrument catalogue (loop 2.2)', () => {
  it('covers every finite instrument type with a signal contract', () => {
    expect(Object.keys(INSTRUMENT_CATALOGUE)).toHaveLength(9);
    for (const entry of Object.values(INSTRUMENT_CATALOGUE)) expect(Object.keys(entry.signals).length).toBeGreaterThan(0);
  });

  it('includes every legacy signal used by the Blueprint DSL', () => {
    expect(isKnownInstrumentSignal('pipeline', 'quality_count')).toBe(true);
    expect(isKnownInstrumentSignal('duration', 'minutes')).toBe(true);
    expect(isKnownInstrumentSignal('practice_item', 'count')).toBe(true);
    expect(isKnownInstrumentSignal('session', 'count')).toBe(true);
    expect(isKnownInstrumentSignal('threshold', 'hit')).toBe(true);
    expect(isKnownInstrumentSignal('time_window', 'hit')).toBe(true);
    expect(isKnownInstrumentSignal('checklist', 'all_done_days')).toBe(true);
    expect(isKnownInstrumentSignal('session', 'invented')).toBe(false);
  });
});
