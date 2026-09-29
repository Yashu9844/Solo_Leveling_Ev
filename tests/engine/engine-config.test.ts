// platform/05-ROADMAP.md loop 1.3 — the engine config comes from the arc,
// not from the owner's hard-coded DEFAULT_CONFIG.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, engineConfigFor } from '../../src/engine/config';
import { canonicalTimeZone, isDayClosed, isValidTimeZone, localDate } from '../../src/engine/time';
import { buildProjections } from '../../src/db/projections';
import { getEngineConfig, setEngineConfigFromArc } from '../../src/store/engineConfig';
import type { ArcRow } from '../../src/db/schema';
import type { SystemEvent } from '../../src/engine/types';

const OWNER_ARC: ArcRow = {
  id: 'owner',
  start_date: '2026-09-01',
  end_date: '2026-12-29',
  timezone: 'Asia/Kolkata',
  day_boundary_hour: 4,
  day_close_hour: 3,
  main_quest_text: 'x',
  status: 'active',
};

const NEW_YORK_ARC: ArcRow = {
  ...OWNER_ARC,
  id: 'ny',
  start_date: '2026-08-20',
  end_date: '2026-12-17',
  timezone: 'America/New_York',
};

describe('engineConfigFor', () => {
  it("the owner's arc yields exactly DEFAULT_CONFIG — nothing changes for them", () => {
    expect(engineConfigFor(OWNER_ARC)).toEqual(DEFAULT_CONFIG);
  });

  it('takes the arc section from the arc and every gameplay constant from the base', () => {
    const config = engineConfigFor(NEW_YORK_ARC);
    expect(config.arc).toEqual({
      timezone: 'America/New_York',
      dayBoundaryHour: 4,
      dayCloseHour: 3,
      startDate: '2026-08-20',
      endDate: '2026-12-17',
    });
    expect({ ...config, arc: undefined }).toEqual({ ...DEFAULT_CONFIG, arc: undefined });
  });

  it("computes the arc's own local day, not Kolkata's", () => {
    // 2026-09-10T01:00Z is 21:00 on the 9th in New York, but 06:30 on
    // the 10th in Kolkata (past its 04:00 boundary).
    const instant = '2026-09-10T01:00:00Z';
    const ny = engineConfigFor(NEW_YORK_ARC).arc;
    expect(localDate(instant, ny.timezone, ny.dayBoundaryHour)).toBe('2026-09-09');
    expect(localDate(instant, DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour)).toBe('2026-09-10');
  });

  it("closes the day at the arc's own 03:00, not Kolkata's", () => {
    // 07:30Z = 03:30 in New York (closed) but 13:00 in Kolkata (open).
    const instant = '2026-09-10T07:30:00Z';
    expect(isDayClosed(instant, engineConfigFor(NEW_YORK_ARC))).toBe(true);
    expect(isDayClosed(instant, DEFAULT_CONFIG)).toBe(false);
  });
});

describe('buildProjections — templates start on the arc start date', () => {
  function arcLog(startDate: string, openedOn: string): SystemEvent[] {
    const base = { arc_id: 'early', source: 'user' as const, schema_v: 1 };
    return [
      {
        ...base,
        id: 'e1',
        type: 'ARC_STARTED',
        occurred_at: `${startDate}T06:00:00Z`,
        local_date: startDate,
        payload: { arcId: 'early', startDate, endDate: '2026-12-17', timezone: 'Asia/Kolkata', dayBoundaryHour: 4, dayCloseHour: 3, mainQuestText: 'x' },
        idem_key: 'arc-started:early',
      },
      { ...base, id: 'e2', type: 'APP_OPENED', occurred_at: `${openedOn}T06:00:00Z`, local_date: openedOn, payload: { seconds: 0 }, idem_key: `app-opened:${openedOn}` },
    ];
  }
  const deps = { now: () => '2026-08-21T06:00:00Z', newId: () => 'x' };

  it('an arc that starts before 2026-09-01 still gets its six quests on day one', () => {
    // Before loop 1.3, every rebuild stamped DEFAULT_CONFIG's 2026-09-01
    // as each template's active_from, so this day generated nothing.
    const built = buildProjections(arcLog('2026-08-20', '2026-08-20'), DEFAULT_CONFIG, deps);
    expect(built.templates.every((t) => t.active_from === '2026-08-20')).toBe(true);
    expect(built.instances.filter((i) => i.local_date === '2026-08-20')).toHaveLength(6);
  });

  it("is unchanged for an arc starting on the owner's date", () => {
    const built = buildProjections(arcLog('2026-09-01', '2026-09-01'), DEFAULT_CONFIG, deps);
    expect(built.templates.every((t) => t.active_from === DEFAULT_CONFIG.arc.startDate)).toBe(true);
  });
});

describe('timezone canonicalisation (loop 1.5)', () => {
  it("maps the legacy ids browsers still report — Chromium reports India as 'Asia/Calcutta'", () => {
    expect(canonicalTimeZone('Asia/Calcutta')).toBe('Asia/Kolkata');
    expect(canonicalTimeZone('Europe/Kiev')).toBe('Europe/Kyiv');
    expect(canonicalTimeZone('America/New_York')).toBe('America/New_York');
  });

  it('the legacy and current ids compute identical dates', () => {
    const instant = '2026-09-10T22:45:00Z';
    expect(localDate(instant, 'Asia/Calcutta', 4)).toBe(localDate(instant, 'Asia/Kolkata', 4));
  });

  it('validates zones', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Asia/Kathmandu')).toBe(true);
    expect(isValidTimeZone('Nope/Nowhere')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('runtime config store', () => {
  it('defaults, follows the arc, and resets', () => {
    setEngineConfigFromArc(undefined);
    expect(getEngineConfig()).toBe(DEFAULT_CONFIG);
    setEngineConfigFromArc(NEW_YORK_ARC);
    expect(getEngineConfig().arc.timezone).toBe('America/New_York');
    setEngineConfigFromArc(undefined);
    expect(getEngineConfig()).toBe(DEFAULT_CONFIG);
  });
});
