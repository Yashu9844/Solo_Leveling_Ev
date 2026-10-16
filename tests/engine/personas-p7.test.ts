// Loop 9.3: what is particular to P7, the fully custom persona (the shared assertions run in personas-p4-p7.test.ts).
import { describe, expect, it } from 'vitest';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { generateBlueprint } from '../../src/generator';
import { INSTRUMENT_DEFINITIONS } from '../../src/instruments/registry';
import { p7 } from '../fixtures/personas/p7';
import { personaEventLog } from './support/personaEventLog';

const blueprint = generateBlueprint(p7.draft).blueprint;
const deps = { now: () => '2027-12-31T00:00:00.000Z', newId: () => 'persona-id' };

describe('P7 - fully custom', () => {
  it('every instrument type the custom flow offers is represented across the five engines and the guardrail', () => {
    expect(blueprint.instruments.map((instrument) => instrument.type).sort()).toEqual(['checklist', 'pipeline', 'practice_item', 'threshold', 'threshold', 'time_window']);
  });

  it('the held threshold is a guardrail kept UNDER its limit; the pushed one is an engine kept over its target', () => {
    const limit = blueprint.instruments.find((instrument) => instrument.params.comparator === '<=')!;
    const count = blueprint.instruments.find((instrument) => instrument.type === 'threshold' && instrument.params.comparator === '>=')!;
    expect(limit.params.target).toBe(30);
    expect(blueprint.domains.find((domain) => domain.id === limit.domainId)!.role).toBe('guardrail');
    expect(blueprint.domains.find((domain) => domain.id === count.domainId)!.role).toBe('engine');
    expect(count.params.target).toBeGreaterThanOrEqual(1);
  });

  it('the routine and the hour are the person\'s own: their rows and their time', () => {
    expect(blueprint.instruments.find((instrument) => instrument.type === 'checklist')!.params.items).toEqual([
      { id: 'plan-tomorrow', label: 'Plan tomorrow' }, { id: 'clear-desk', label: 'Clear desk' }, { id: 'charge-devices', label: 'Charge devices' },
    ]);
    expect(blueprint.instruments.find((instrument) => instrument.type === 'time_window')!.params.targetTime).toBe('06:15');
  });

  it('sits on the 365-day calibration: checkpoints at 14/90/180/270/365 and the 365-day coefficient', () => {
    expect(blueprint.progression.checkpointDays).toEqual([14, 90, 180, 270, 365]);
    expect(blueprint.progression.level.coefficient).toBe(88);
  });

  it('its records are all ones their instruments accept, and a year of it rebuilds quickly', () => {
    const events = personaEventLog(blueprint, p7.seed, { kind: 'steady', days: 365 });
    for (const event of events.filter((candidate) => candidate.type === 'INSTRUMENT_RECORDED')) {
      const instrument = blueprint.instruments.find((candidate) => candidate.id === event.payload.instrumentId)!;
      expect(INSTRUMENT_DEFINITIONS[instrument.type].validateRecord(event.payload.record, instrument.params)).toEqual([]);
    }
    const start = performance.now();
    const built = buildProjectionsV2(events, deps);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(built.dayRollups).toHaveLength(365);
  });
});
