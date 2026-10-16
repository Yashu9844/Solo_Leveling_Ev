// Loop 9.4: edge personas X1-X4 - the lower bound, the upper bound, a night shift and a DST traveller (I19).
import { describe, expect, it } from 'vitest';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { generateBlueprint } from '../../src/generator';
import { localDate } from '../../src/engine/time';
import { x1, x2, x3, x4 } from '../fixtures/personas/x';
import { personaEventLog } from './support/personaEventLog';
import { describePersona } from './support/personaSuite';

for (const persona of [x1, x2, x3, x4]) describePersona(persona);

const deps = { now: () => '2027-12-31T00:00:00.000Z', newId: () => 'persona-id' };
const make = (persona: typeof x1) => generateBlueprint(persona.draft).blueprint;

describe('X1 - minimum System', () => {
  it('four core domains, one guardrail, 60 days, and every bound at its floor still balances', () => {
    const blueprint = make(x1);
    expect(blueprint.quests.filter((quest) => quest.type === 'core')).toHaveLength(4);
    expect(blueprint.domains.filter((domain) => domain.role === 'guardrail')).toHaveLength(1);
    expect(blueprint.arc.lengthDays).toBe(60);
    expect(blueprint.bosses).toHaveLength(2);
    expect(blueprint.attributes.defs.length).toBeGreaterThanOrEqual(3);
    expect(blueprint.quests.every((quest) => quest.xp >= 30 && quest.xp <= 150)).toBe(true);
  });
});

describe('X2 - maximum System', () => {
  const blueprint = make(x2);

  it('eight core domains and three support domains, two guardrails, at the upper bounds', () => {
    expect(blueprint.domains.filter((domain) => domain.role !== 'support')).toHaveLength(8);
    expect(blueprint.domains.filter((domain) => domain.role === 'support')).toHaveLength(3);
    expect(blueprint.domains.filter((domain) => domain.role === 'guardrail')).toHaveLength(2);
    expect(blueprint.attributes.defs).toHaveLength(6);
    expect(blueprint.skills.length).toBeLessThanOrEqual(5);
    expect(blueprint.bosses).toHaveLength(4);
  });

  it('a support domain has no quest, earns no more than its own unit, and gates nothing', () => {
    const gated = JSON.stringify([blueprint.gates, blueprint.bosses]);
    for (const domain of blueprint.domains.filter((candidate) => candidate.role === 'support')) {
      expect(domain.coreQuestId).toBeUndefined();
      expect(blueprint.quests.some((quest) => quest.domainId === domain.id)).toBe(false);
      expect(domain.channel.cap).toBeLessThanOrEqual(75);
      expect(gated).not.toContain(domain.id);
    }
  });

  it('a full 120 days of it rebuilds quickly, and a domain that cannot be support says so and keeps its quest', () => {
    const events = personaEventLog(blueprint, x2.seed, { kind: 'steady', days: 120 });
    const start = performance.now();
    const built = buildProjectionsV2(events, deps);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(built.dayRollups).toHaveLength(120);
    const refused = generateBlueprint({ ...x2.draft, domains: [{ archetypeId: 'deep-build', answers: { support: true } }, ...x2.draft.domains.slice(1)] });
    expect(refused.issues.map((issue) => issue.code)).toContain('G-ARCH-02');
    expect(refused.blueprint.quests.some((quest) => quest.designation === 'FORGE')).toBe(true);
  });
});

describe('X3 - night shift', () => {
  const blueprint = make(x3);

  it('asleep from 08:00 means the day turns over at 10:00 and closes at 09:00', () => {
    expect(blueprint.arc).toMatchObject({ dayBoundaryHour: 10, dayCloseHour: 9, wakeTime: '16:00', sleepTime: '08:00' });
    expect(blueprint.instruments.find((instrument) => instrument.type === 'time_window')!.params.targetTime).toBe('16:00');
  });

  it('an 08:30 log belongs to the day before; a 10:30 log to the day it is on', () => {
    expect(localDate('2026-09-10T03:00:00Z', blueprint.arc.timezone, 10)).toBe('2026-09-09'); // 08:30 IST
    expect(localDate('2026-09-10T05:00:00Z', blueprint.arc.timezone, 10)).toBe('2026-09-10'); // 10:30 IST
  });
});

describe('X4 - DST traveller', () => {
  const blueprint = make(x4);
  const events = personaEventLog(blueprint, x4.seed, { kind: 'steady', days: 90 });

  it('the arc runs in New York across the November change with no day skipped or repeated', () => {
    expect(blueprint.arc.timezone).toBe('America/New_York');
    const opened = events.filter((event) => event.type === 'APP_OPENED').map((event) => event.local_date);
    expect(opened).toHaveLength(90);
    expect(opened).toContain('2026-11-01'); // the day the clocks go back
    expect(opened.slice(1).every((date, i) => date > opened[i]!)).toBe(true);
    expect(new Set(opened).size).toBe(90);
  });

  it('events either side of the change are filed under the right local date', () => {
    const around = events.filter((event) => event.local_date >= '2026-10-31' && event.local_date <= '2026-11-02');
    expect(around.length).toBeGreaterThan(3);
    for (const event of around) expect(localDate(event.occurred_at, 'America/New_York', blueprint.arc.dayBoundaryHour)).toBe(event.local_date);
  });

  it('the projections count 90 days and the change day is an ordinary day', () => {
    const built = buildProjectionsV2(events, deps);
    expect(built.dayRollups).toHaveLength(90);
    expect(built.dayRollups.find((day) => day.local_date === '2026-11-01')!.core_total).toBeGreaterThan(0);
  });
});
