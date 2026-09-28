import { describe, it, expect } from 'vitest';
import { applyEvents } from '../../src/engine/reduce';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { arcDay } from '../../src/engine/time';
import type {
  ArcPausedPayload,
  ArcResumedPayload,
  ArcStartedPayload,
  MetricRecordedPayload,
  PlanAmendedPayload,
  QuestCompletedPayload,
  QuestRecoveredPayload,
  QuestUndonePayload,
  ReviewCompletedPayload,
  SystemEvent,
} from '../../src/engine/types';

let seq = 0;
function nextId(): string {
  seq += 1;
  return `01H${String(seq).padStart(23, '0')}`;
}

function event<T extends Record<string, unknown>>(
  type: SystemEvent['type'],
  payload: T,
  idemKey: string,
  overrides: Partial<SystemEvent> = {}
): SystemEvent {
  return {
    id: nextId(),
    type,
    occurred_at: '2026-09-01T04:30:00Z',
    local_date: '2026-09-01',
    arc_id: 'arc-1',
    payload,
    source: 'user',
    idem_key: idemKey,
    schema_v: 1,
    ...overrides,
  };
}

function arcStartedEvent(overrides: Partial<ArcStartedPayload> = {}, idemKey = 'arc-started:arc-1') {
  const payload: ArcStartedPayload = {
    arcId: 'arc-1',
    startDate: '2026-09-01',
    endDate: '2026-12-29',
    timezone: 'Asia/Kolkata',
    dayBoundaryHour: 4,
    dayCloseHour: 3,
    mainQuestText: 'Ship a working agent and get an offer.',
    ...overrides,
  };
  return event('ARC_STARTED', payload as unknown as Record<string, unknown>, idemKey);
}

/** A representative onboarding event log — ARC_STARTED, three
 * PLAN_AMENDED, and two METRIC_RECORDED — matching what
 * store/onboarding.ts's initialiseArc actually writes. */
function onboardingEventLog(): SystemEvent[] {
  const planEvent = (questKey: PlanAmendedPayload['questKey']) =>
    event(
      'PLAN_AMENDED',
      {
        questKey,
        implementationIntention: { time: '08:35', place: 'my desk', first_action: 'begin' },
      } satisfies PlanAmendedPayload,
      `plan:arc-1:${questKey}`
    );
  const metricEvent = (kind: string, value: number) =>
    event('METRIC_RECORDED', { kind, value, unit: 'unit' } satisfies MetricRecordedPayload, `baseline:arc-1:${kind}`);

  return [
    arcStartedEvent(),
    planEvent('career'),
    planEvent('dsa'),
    planEvent('training'),
    metricEvent('height_cm', 178),
    metricEvent('weight_kg', 72),
  ];
}

describe('applyEvents — Slice 0 acceptance criterion', () => {
  it('applyEvents([]) returns a valid empty state', () => {
    const state = applyEvents([], DEFAULT_CONFIG);
    expect(state.player.total_xp).toBe(0);
    expect(state.player.level).toBe(1);
    expect(state.player.rank).toBe('E');
    expect(state.days).toEqual({});
    expect(state.quests).toEqual({});
    expect(state.intentions).toEqual({});
    expect(state.baselineMetrics).toEqual({});
    expect(state.arc).toBeNull();
  });
});

describe('applyEvents — ARC_STARTED (Slice 1)', () => {
  it('applyEvents([ARC_STARTED]) yields state with the arc present', () => {
    const state = applyEvents([arcStartedEvent()], DEFAULT_CONFIG);
    expect(state.arc).not.toBeNull();
    expect(state.arc?.id).toBe('arc-1');
    expect(state.arc?.status).toBe('active');
  });

  it('arcDay computed from the resulting arc: startDate -> 1, endDate -> 120', () => {
    const state = applyEvents([arcStartedEvent()], DEFAULT_CONFIG);
    const arc = state.arc!;
    expect(arcDay(`${arc.start_date}T10:00:00Z`, arc.start_date, arc.timezone)).toBe(1);
    expect(arcDay(`${arc.end_date}T10:00:00Z`, arc.start_date, arc.timezone)).toBe(120);
  });

  it('duplicate ARC_STARTED with the same idem_key is a no-op', () => {
    const evt = arcStartedEvent();
    const stateOnce = applyEvents([evt], DEFAULT_CONFIG);
    const stateTwice = applyEvents([evt, { ...evt }], DEFAULT_CONFIG);
    expect(stateTwice).toEqual(stateOnce);
  });
});

describe('applyEvents — the onboarding log (Slice 2 Step 0 regression)', () => {
  it('replays without throwing', () => {
    expect(() => applyEvents(onboardingEventLog(), DEFAULT_CONFIG)).not.toThrow();
  });

  it('PLAN_AMENDED attaches the intention to the right quest key', () => {
    const state = applyEvents(onboardingEventLog(), DEFAULT_CONFIG);
    expect(state.intentions.career).toEqual({ time: '08:35', place: 'my desk', first_action: 'begin' });
    expect(state.intentions.dsa).toBeDefined();
    expect(state.intentions.training).toBeDefined();
    expect(state.intentions.build).toBeUndefined();
  });

  it('a later PLAN_AMENDED for the same key replaces the earlier one', () => {
    const log = [
      arcStartedEvent(),
      event(
        'PLAN_AMENDED',
        { questKey: 'career', implementationIntention: { time: '08:00', place: 'a', first_action: 'a' } } satisfies PlanAmendedPayload,
        'plan:arc-1:career:1'
      ),
      event(
        'PLAN_AMENDED',
        { questKey: 'career', implementationIntention: { time: '09:00', place: 'b', first_action: 'b' } } satisfies PlanAmendedPayload,
        'plan:arc-1:career:2'
      ),
    ];
    const state = applyEvents(log, DEFAULT_CONFIG);
    expect(state.intentions.career?.time).toBe('09:00');
  });

  it('METRIC_RECORDED accumulates baseline metrics', () => {
    const state = applyEvents(onboardingEventLog(), DEFAULT_CONFIG);
    expect(state.baselineMetrics).toEqual({ height_cm: 178, weight_kg: 72 });
  });
});

describe('applyEvents — QUEST_COMPLETED / QUEST_UNDONE (Slice 2)', () => {
  const complete = (instanceId: string, idemKey: string) =>
    event(
      'QUEST_COMPLETED',
      {
        instanceId,
        templateId: 'tpl-career',
        questKey: 'career',
        localDate: '2026-09-01',
      } satisfies QuestCompletedPayload,
      idemKey
    );
  const undo = (instanceId: string, idemKey: string) =>
    event('QUEST_UNDONE', { instanceId, localDate: '2026-09-01' } satisfies QuestUndonePayload, idemKey);

  it('QUEST_COMPLETED marks the instance complete', () => {
    const state = applyEvents([arcStartedEvent(), complete('inst-1', 'quest-complete:inst-1:0')], DEFAULT_CONFIG);
    expect(state.quests['inst-1']).toBeDefined();
    expect(state.quests['inst-1']?.template_id).toBe('tpl-career');
  });

  it('QUEST_UNDONE reverts it', () => {
    const log = [
      arcStartedEvent(),
      complete('inst-1', 'quest-complete:inst-1:0'),
      undo('inst-1', 'quest-undo:inst-1:1'),
    ];
    const state = applyEvents(log, DEFAULT_CONFIG);
    expect(state.quests['inst-1']).toBeUndefined();
  });

  it('complete -> undo -> complete leaves exactly one completion in effect', () => {
    const log = [
      arcStartedEvent(),
      complete('inst-1', 'quest-complete:inst-1:0'),
      undo('inst-1', 'quest-undo:inst-1:1'),
      complete('inst-1', 'quest-complete:inst-1:2'),
    ];
    const state = applyEvents(log, DEFAULT_CONFIG);
    expect(Object.keys(state.quests)).toEqual(['inst-1']);
    expect(state.quests['inst-1']).toBeDefined();
  });
});

describe('applyEvents — ARC_PAUSED / ARC_RESUMED (Slice 4)', () => {
  const pause = (localDate: string, days: number, idemKey: string) =>
    event('ARC_PAUSED', { localDate, days } satisfies ArcPausedPayload, idemKey);
  const resume = (localDate: string, idemKey: string) =>
    event('ARC_RESUMED', { localDate } satisfies ArcResumedPayload, idemKey);

  it('pausing marks the covered days and shifts end_date forward by the full length', () => {
    const state = applyEvents([arcStartedEvent(), pause('2026-09-10', 5, 'pause:1')], DEFAULT_CONFIG);
    expect(state.arc?.status).toBe('paused');
    expect(state.arc?.paused_dates).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
    ]);
    // original end_date 2026-12-29 + 5 days
    expect(state.arc?.end_date).toBe('2027-01-03');
  });

  it('an early resume un-pauses only future planned days, keeping the shifted end_date', () => {
    const log = [
      arcStartedEvent(),
      pause('2026-09-10', 5, 'pause:1'),
      resume('2026-09-12', 'resume:1'), // back after 2 of the 5 planned days
    ];
    const state = applyEvents(log, DEFAULT_CONFIG);
    expect(state.arc?.status).toBe('active');
    expect(state.arc?.paused_dates).toEqual(['2026-09-10', '2026-09-11']);
    expect(state.arc?.end_date).toBe('2027-01-03'); // shift is not clawed back
  });
});

describe('applyEvents — QUEST_RECOVERED (Slice 4)', () => {
  it('records a recovery claim for the missed local_date', () => {
    const recovered = event(
      'QUEST_RECOVERED',
      { localDate: '2026-09-05' } satisfies QuestRecoveredPayload,
      'recovery:2026-09-05'
    );
    const state = applyEvents([arcStartedEvent(), recovered], DEFAULT_CONFIG);
    expect(state.recoveries['2026-09-05']).toBe(true);
  });

  it('a duplicate claim for the same day (same idem_key) is a no-op', () => {
    const recovered = event(
      'QUEST_RECOVERED',
      { localDate: '2026-09-05' } satisfies QuestRecoveredPayload,
      'recovery:2026-09-05'
    );
    const state = applyEvents([arcStartedEvent(), recovered, { ...recovered }], DEFAULT_CONFIG);
    expect(Object.keys(state.recoveries)).toEqual(['2026-09-05']);
  });
});

describe('applyEvents — REVIEW_COMPLETED (Slice 5)', () => {
  it('records the review payload for the reviewed local_date', () => {
    const reviewed = event(
      'REVIEW_COMPLETED',
      {
        localDate: '2026-09-05',
        energy: 3,
        focus: 4,
        blocker: 'tired',
      } satisfies ReviewCompletedPayload,
      'review:2026-09-05'
    );
    const state = applyEvents([arcStartedEvent(), reviewed], DEFAULT_CONFIG);
    expect(state.reviews['2026-09-05']).toEqual({
      localDate: '2026-09-05',
      energy: 3,
      focus: 4,
      blocker: 'tired',
    });
  });

  it('a duplicate review for the same day (same idem_key) is a no-op', () => {
    const reviewed = event(
      'REVIEW_COMPLETED',
      { localDate: '2026-09-05', energy: 3, focus: 4, blocker: 'nothing' } satisfies ReviewCompletedPayload,
      'review:2026-09-05'
    );
    const state = applyEvents([arcStartedEvent(), reviewed, { ...reviewed }], DEFAULT_CONFIG);
    expect(Object.keys(state.reviews)).toEqual(['2026-09-05']);
  });
});

describe('applyEvents — career logging events are handled no-ops (Slice 6)', () => {
  // A regression guard: every one of these was written by store/career.ts
  // before a case existed here, which meant db/projections.ts's
  // rebuildProjections threw on replay every time — the exact bug this
  // test would have caught. See the Slice 6 report.
  it.each([
    'APPLICATION_LOGGED',
    'CAREER_SUBSTITUTE_LOGGED',
    'CAREER_EVENT_LOGGED',
    'RESUME_VERSION_CREATED',
    'FOLLOWUP_LOGGED',
  ] as const)('%s does not throw during replay', (type) => {
    const log = [arcStartedEvent(), event(type, {}, `${type}:1`)];
    expect(() => applyEvents(log, DEFAULT_CONFIG)).not.toThrow();
  });
});

describe('applyEvents — physical/lifestyle logging events are handled no-ops (Slice 9)', () => {
  it.each([
    'TRAINING_SESSION_LOGGED',
    'STEPS_LOGGED',
    'SLEEP_LOGGED',
    'SCREENTIME_LOGGED',
    'MAINTENANCE_LOGGED',
  ] as const)('%s does not throw during replay', (type) => {
    const log = [arcStartedEvent(), event(type, {}, `${type}:1`)];
    expect(() => applyEvents(log, DEFAULT_CONFIG)).not.toThrow();
  });
});

describe('applyEvents — BOSS_CLEARED is a handled no-op (Slice 13)', () => {
  it('does not throw during replay', () => {
    const log = [arcStartedEvent(), event('BOSS_CLEARED', { bossId: 'I' }, 'boss:I')];
    expect(() => applyEvents(log, DEFAULT_CONFIG)).not.toThrow();
  });
});

describe('applyEvents — WEEK_REVIEWED and WEEKLY_QUEST_COMPLETED are handled no-ops (Slice 14)', () => {
  it.each(['WEEK_REVIEWED', 'WEEKLY_QUEST_COMPLETED'] as const)('%s does not throw during replay', (type) => {
    const log = [arcStartedEvent(), event(type, {}, `${type}:1`)];
    expect(() => applyEvents(log, DEFAULT_CONFIG)).not.toThrow();
  });
});

describe('applyEvents — determinism and the boundary rule', () => {
  it('replaying the full log twice is deep-equal', () => {
    const log = onboardingEventLog();
    expect(applyEvents(log, DEFAULT_CONFIG)).toEqual(applyEvents(log, DEFAULT_CONFIG));
  });

  it('an unhandled event type still throws — no silent default case', () => {
    // CHECKPOINT_SEALED has no EngineState fold: sealing writes directly
    // to db.checkpoint (store/checkpoint.ts), a row this app's rebuild
    // never touches, same as self-efficacy — so it stays genuinely
    // unhandled here, unlike BOSS_CLEARED which became a handled no-op
    // in Slice 13.
    const unhandled = event('CHECKPOINT_SEALED', {}, 'idem-unhandled');
    expect(() => applyEvents([unhandled], DEFAULT_CONFIG)).toThrow('Not implemented');
  });

  it('APP_OPENED is a handled no-op, not a silent default — Slice 3', () => {
    const opened = event('APP_OPENED', { seconds: 0 }, 'app-opened:2026-09-05');
    expect(() => applyEvents([arcStartedEvent(), opened], DEFAULT_CONFIG)).not.toThrow();
  });
});
