import { describe, it, expect } from 'vitest';
import { evaluateRules } from '../../src/engine/rules';
import type { QuestRecoveredPayload, SystemEvent } from '../../src/engine/types';

let seq = 0;
function nextId(): string {
  seq += 1;
  return `01H${String(seq).padStart(23, '0')}`;
}

function event<T extends Record<string, unknown>>(
  type: SystemEvent['type'],
  payload: T,
  idemKey: string,
  localDate: string
): SystemEvent {
  return {
    id: nextId(),
    type,
    occurred_at: `${localDate}T10:00:00Z`,
    local_date: localDate,
    arc_id: 'arc-1',
    payload,
    source: 'user',
    idem_key: idemKey,
    schema_v: 1,
  };
}

function buildSession(mode: 'LEARN' | 'SHIP', localDate: string, idx: number): SystemEvent {
  return event('BUILD_SESSION_LOGGED', { mode, minutes: 45 }, `build:${idx}`, localDate);
}

function recovery(localDate: string, reason: QuestRecoveredPayload['reason'], idx: number): SystemEvent {
  return event('QUEST_RECOVERED', { localDate, reason }, `recovery:${idx}`, localDate);
}

const ASOF = '2026-09-14';

describe('evaluateRules — LEARN_SHIP_RATIO', () => {
  it('does not fire at or below 3:1 over the trailing 14 days', () => {
    const history = [
      buildSession('LEARN', '2026-09-10', 1),
      buildSession('LEARN', '2026-09-10', 2),
      buildSession('LEARN', '2026-09-10', 3),
      buildSession('SHIP', '2026-09-11', 4),
    ];
    const proposals = evaluateRules(history, ASOF);
    expect(proposals.find((p) => p.rule === 'LEARN_SHIP_RATIO')).toBeUndefined();
  });

  it('fires when the ratio exceeds 3:1 over the trailing 14 days', () => {
    const history = [
      buildSession('LEARN', '2026-09-10', 1),
      buildSession('LEARN', '2026-09-10', 2),
      buildSession('LEARN', '2026-09-10', 3),
      buildSession('LEARN', '2026-09-10', 4),
      buildSession('SHIP', '2026-09-11', 5),
    ];
    const proposals = evaluateRules(history, ASOF);
    expect(proposals.find((p) => p.rule === 'LEARN_SHIP_RATIO')).toBeDefined();
  });

  it('ignores sessions outside the trailing 14-day window', () => {
    const history = [
      // 20 days before ASOF — outside the window, should not count.
      buildSession('LEARN', '2026-08-25', 1),
      buildSession('LEARN', '2026-08-25', 2),
      buildSession('LEARN', '2026-08-25', 3),
      buildSession('LEARN', '2026-08-25', 4),
    ];
    const proposals = evaluateRules(history, ASOF);
    expect(proposals.find((p) => p.rule === 'LEARN_SHIP_RATIO')).toBeUndefined();
  });
});

describe('evaluateRules — WRONG_TIME_PATTERN', () => {
  it('does not fire below 3 occurrences in 14 days', () => {
    const history = [
      recovery('2026-09-05', 'wrong_time', 1),
      recovery('2026-09-08', 'wrong_time', 2),
      recovery('2026-09-09', 'too_tired', 3),
    ];
    const proposals = evaluateRules(history, ASOF);
    expect(proposals.find((p) => p.rule === 'WRONG_TIME_PATTERN')).toBeUndefined();
  });

  it('fires at exactly 3 occurrences in 14 days', () => {
    const history = [
      recovery('2026-09-03', 'wrong_time', 1),
      recovery('2026-09-06', 'wrong_time', 2),
      recovery('2026-09-09', 'wrong_time', 3),
    ];
    const proposals = evaluateRules(history, ASOF);
    expect(proposals.find((p) => p.rule === 'WRONG_TIME_PATTERN')).toBeDefined();
  });

  it('does not count occurrences outside the trailing 14-day window', () => {
    const history = [
      recovery('2026-08-01', 'wrong_time', 1),
      recovery('2026-08-02', 'wrong_time', 2),
      recovery('2026-08-03', 'wrong_time', 3),
    ];
    const proposals = evaluateRules(history, ASOF);
    expect(proposals.find((p) => p.rule === 'WRONG_TIME_PATTERN')).toBeUndefined();
  });

  it('does not count other reasons toward the threshold', () => {
    const history = [
      recovery('2026-09-03', 'ran_out_of_time', 1),
      recovery('2026-09-06', 'too_tired', 2),
      recovery('2026-09-09', 'didnt_want_to', 3),
    ];
    const proposals = evaluateRules(history, ASOF);
    expect(proposals.find((p) => p.rule === 'WRONG_TIME_PATTERN')).toBeUndefined();
  });
});

describe('evaluateRules — no false positives on an empty or quiet history', () => {
  it('returns [] for an empty history', () => {
    expect(evaluateRules([], ASOF)).toEqual([]);
  });
});
