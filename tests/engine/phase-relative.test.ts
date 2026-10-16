// Loop 12.3: the System's day is laid over the person's own waking hours, its milestones sit at fractions of the arc, and its reflections
// are about the life it was built for. The owner's System hears everything exactly as before.
import { describe, expect, it } from 'vitest';
import { systemMessageContextFor } from '../../src/blueprint/evaluate/messages';
import { generateBlueprint } from '../../src/generator';
import { dayRangeFor, REFLECTIONS, selectReflection, type ReflectionContext, type ReflectionSelectionContext } from '../../src/engine/reflections';
import { arcDayAt, eligible, LEGACY_PHASE_MARKS, phaseFor, phaseMarksFor, selectSystemMessage, tierFor, type DayPhase, type SystemMessageContext } from '../../src/engine/systemVoice';
import { VOICE_PACK } from '../../src/engine/voicePack';
import { p2 } from '../fixtures/personas/p2';
import { x3 } from '../fixtures/personas/x';
import { personaEventLog } from './support/personaEventLog';

/** The function Phase 12 replaced, verbatim. */
function legacyPhase(minutesOfDay: number, dayClosed: boolean): DayPhase {
  if (dayClosed) return 'CLOSED';
  const bounds: { phase: DayPhase; from: number; to: number }[] = [
    { phase: 'MORNING', from: 4 * 60, to: 11 * 60 }, { phase: 'MIDDAY', from: 11 * 60, to: 14 * 60 },
    { phase: 'AFTERNOON', from: 14 * 60, to: 18 * 60 }, { phase: 'EVENING', from: 18 * 60, to: 22 * 60 },
  ];
  return bounds.find((b) => minutesOfDay >= b.from && minutesOfDay < b.to)?.phase ?? 'NIGHT';
}
const clock = (minute: number): string => `${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

describe('phases, laid over the waking day', () => {
  it('the owner\'s windows are the ones it always had, at every minute of the day, closed or not', () => {
    for (let minute = 0; minute < 1440; minute++) for (const closed of [false, true]) {
      expect(phaseFor(minute, closed), `${minute}`).toBe(legacyPhase(minute, closed));
      expect(phaseFor(minute, closed, LEGACY_PHASE_MARKS), `${minute}`).toBe(legacyPhase(minute, closed));
    }
  });

  it('for any rhythm: MORNING shortly after waking, EVENING before sleep, NIGHT after, and the windows run in order from the boundary', () => {
    for (let wake = 4 * 60; wake <= 20 * 60; wake += 30) for (const waking of [13 * 60, 15 * 60, 16 * 60, 18 * 60]) {
      const sleep = (wake + waking) % 1440;
      const boundaryHour = (Math.floor(sleep / 60) + 2) % 24;
      const marks = phaseMarksFor({ dayBoundaryHour: boundaryHour, wakeTime: clock(wake), sleepTime: clock(sleep) });
      const label = `wake ${clock(wake)} sleep ${clock(sleep)}`;
      expect(phaseFor(wake + 10, false, marks), label).toBe('MORNING');
      expect(phaseFor(sleep - 10 + 1440, false, marks), label).toBe('EVENING');
      expect(phaseFor(sleep + 10, false, marks), label).toBe('NIGHT');
      // Walking the day from the boundary, the phases never go backwards until NIGHT, and every live window exists.
      const order = ['MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING', 'NIGHT'];
      const seen = Array.from({ length: 1440 }, (_, i) => phaseFor(boundaryHour * 60 + i, false, marks)).map((phase) => order.indexOf(phase));
      expect(seen.every((phase, i) => i === 0 || phase >= seen[i - 1]!), label).toBe(true);
      expect(new Set(seen).size, label).toBe(5);
    }
  });
});

describe('X3, the night shift: the morning is after waking', () => {
  const { blueprint } = generateBlueprint(x3.draft);
  const events = personaEventLog(blueprint, x3.seed, x3.profile);
  const today = '2026-09-05';
  /** 18:00 IST on the fifth is two hours after waking at 16:00; the day turned over at 10:00. */
  const now = `${today}T12:30:00Z`;
  const context = systemMessageContextFor({ blueprint, events: events.filter((event) => event.local_date < today), today, arcDay: 5, now, checkpoints: [] })!;

  it('reads MORNING at two hours after waking - the fixed clock hours would have said EVENING', () => {
    expect(blueprint.arc.wakeTime).toBe('16:00');
    expect(context.phase).toBe('MORNING');
    expect(phaseFor(18 * 60, false, LEGACY_PHASE_MARKS)).toBe('EVENING');
  });

  it('and so receives MORNING lines', () => {
    // An untouched day (the simulated persona missed a day, so the tier here is RECOVERY; the day's progress lines are the PROGRESS pool).
    const progress = VOICE_PACK.filter((message) => eligible(message, context, 'PROGRESS'));
    expect(context.band).toBe('ZERO');
    expect(progress.some((message) => message.id === 'morning-zero-001')).toBe(true);
    expect(progress.every((message) => !message.phases || message.phases.includes('MORNING'))).toBe(true);
    const said = selectSystemMessage(VOICE_PACK, context, new Map()).message;
    expect(said.phases === undefined || said.phases.includes('MORNING')).toBe(true);
    expect(tierFor(context)).toBe('RECOVERY');
  });

  it('is in the afternoon of its own day at 03:00, when the owner\'s clock hours would say NIGHT', () => {
    const late = systemMessageContextFor({ blueprint, events: events.filter((event) => event.local_date < today), today: '2026-09-06', arcDay: 6, now: '2026-09-05T21:30:00Z', checkpoints: [] })!;
    expect(late.phase).toBe('AFTERNOON');
    expect(phaseFor(3 * 60, false, LEGACY_PHASE_MARKS)).toBe('NIGHT');
  });
});

describe('checkpoints and arc positions come from the System, not from 120 days', () => {
  const { blueprint } = generateBlueprint(p2.draft);
  const events = personaEventLog(blueprint, p2.seed, p2.profile);
  const at = (arcDay: number): SystemMessageContext => {
    const today = new Date(Date.parse(`${blueprint.arc.startDate}T00:00:00Z`) + (arcDay - 1) * 86_400_000).toISOString().slice(0, 10);
    return systemMessageContextFor({ blueprint, events: events.filter((event) => event.local_date < today), today, arcDay, now: `${today}T06:00:00Z`, checkpoints: [] })!;
  };

  it('counts down to the Blueprint\'s own checkpoint days', () => {
    expect(blueprint.progression.checkpointDays).toEqual([14, 38, 75, 113, 150]);
    expect(at(36).daysToCheckpoint).toBe(2);
    expect(at(73).daysToCheckpoint).toBe(2);
    expect(at(20).daysToCheckpoint).toBe(18);
    expect(at(36).arcLength).toBe(150);
  });

  it('the midpoint and the final segment sit at the same fractions of any arc', () => {
    const mid = (arcLength: number) => VOICE_PACK.find((message) => message.id === 'milestone-midarc-001' && eligible(message, { ...at(1), arcLength, arcDay: Math.ceil(arcLength / 2) }, 'MILESTONE'));
    for (const length of [60, 90, 120, 150, 365]) expect(mid(length), `${length}`).toBeDefined();
    expect(VOICE_PACK.find((message) => message.id === 'milestone-midarc-001' && eligible(message, { ...at(1), arcLength: 90, arcDay: 60 }, 'MILESTONE'))).toBeUndefined();
    expect([60, 90, 120, 150, 365].map((length) => arcDayAt(113 / 120, { arcLength: length }))).toEqual([57, 85, 113, 142, 344]);
    const finalLine = VOICE_PACK.find((message) => message.id === 'milestone-final-001')!;
    expect(eligible(finalLine, { ...at(1), arcLength: 90, arcDay: 85 }, 'MILESTONE')).toBe(true);
    expect(eligible(finalLine, { ...at(1), arcLength: 90, arcDay: 84 }, 'MILESTONE')).toBe(false);
    // The owner's context has no arcLength: 60/61 and 113 exactly as before.
    const owner = { ...at(1), arcLength: undefined };
    expect(eligible(VOICE_PACK.find((message) => message.id === 'milestone-midarc-001')!, { ...owner, arcDay: 60 }, 'MILESTONE')).toBe(true);
    expect(eligible(VOICE_PACK.find((message) => message.id === 'milestone-midarc-001')!, { ...owner, arcDay: 59 }, 'MILESTONE')).toBe(false);
    expect(eligible(finalLine, { ...owner, arcDay: 112 }, 'MILESTONE')).toBe(false);
    expect(eligible(finalLine, { ...owner, arcDay: 113 }, 'MILESTONE')).toBe(true);
  });
});

describe('reflections', () => {
  const CONTEXTS: ReflectionContext[] = ['MORNING', 'PRE_DEEP', 'POST_COMPLETE', 'POST_LAPSE', 'EVENING', 'LEVEL_UP', 'BOSS', 'CHECKPOINT'];
  /** Every line any (context, day, lapse) can surface, once nothing has been shown. */
  function everything(extra: Partial<ReflectionSelectionContext>, arcLength = extra.arcLength ?? 120): Set<string> {
    const seen = new Set<string>();
    for (const context of CONTEXTS) for (let arcDay = 1; arcDay <= arcLength; arcDay += 1) for (const isPostLapse of [false, true]) {
      // Take lines out one at a time by showing each, so the whole eligible pool is walked.
      const shown = new Map<string, { times_shown: number; last_shown_at?: string }>();
      for (let n = 0; n < 40; n++) {
        const line = selectReflection(REFLECTIONS, shown, { context, arcDay, isPostLapse, today: '2026-09-01', ...extra, arcLength });
        if (!line) break;
        seen.add(line.id);
        shown.set(line.id, { times_shown: 1, last_shown_at: '2026-09-01' });
      }
    }
    return seen;
  }
  const owner = everything({});

  it('the owner hears the whole library as written: every day range is its own, and none of the new generic lines', () => {
    for (const reflection of REFLECTIONS) expect(dayRangeFor(reflection), reflection.id).toEqual({ from: reflection.min_day, to: reflection.max_day });
    for (const id of ['long-horizon-6', 'long-horizon-7', 'consistency-6', 'boss-3']) expect(owner.has(id), id).toBe(false);
    for (const id of ['long-horizon-1', 'long-horizon-5', 'training-1', 'career-1', 'study-1', 'boss-2', 'consistency-1']) expect(owner.has(id), id).toBe(true);
    expect(owner.size).toBe(64);
  });

  it('a System about reading and rest hears no training, career or application lines', () => {
    const heard = everything({ themes: ['reading', 'attention', 'rest', 'rhythm'], arcLength: 90, coreTotal: 3 });
    for (const reflection of REFLECTIONS.filter((candidate) => /^(training|career)-/.test(candidate.id) || candidate.id === 'courage-4')) expect(heard.has(reflection.id), reflection.id).toBe(false);
    expect(heard.has('study-1')).toBe(true);
    expect(heard.size).toBeGreaterThan(40);
  });

  it('a body System hears training and not study or career', () => {
    const heard = everything({ themes: ['strength', 'body'], arcLength: 90, coreTotal: 4 });
    expect(heard.has('training-1')).toBe(true);
    for (const id of ['career-1', 'study-1', 'focus-3']) expect(heard.has(id), id).toBe(false);
  });

  it('a System with no themes at all still has a library: the universal lines', () => {
    expect(everything({ themes: [], arcLength: 90, coreTotal: 5 }).size).toBeGreaterThan(30);
  });

  it('lines that state a number are heard only where it is true', () => {
    const ninety = everything({ themes: ['reading'], arcLength: 90, coreTotal: 5 });
    for (const id of ['long-horizon-1', 'long-horizon-5', 'consistency-1', 'boss-2']) expect(ninety.has(id), id).toBe(false);
    for (const id of ['long-horizon-6', 'long-horizon-7', 'consistency-6', 'boss-3']) expect(ninety.has(id), id).toBe(true);
    const longer = everything({ themes: ['strength'], arcLength: 180, coreTotal: 6 });
    expect(longer.has('consistency-1')).toBe(true);
    expect(longer.has('long-horizon-1')).toBe(false);
    expect(everything({ themes: ['strength'], arcLength: 60, coreTotal: 6 }).has('training-4')).toBe(false);
  });

  it('day ranges are fractions of the arc: stages arrive proportionally sooner in a short arc, the evidence floor never moves up, the end stretches', () => {
    const identity = REFLECTIONS.find((reflection) => reflection.id === 'identity-3')!;
    expect(dayRangeFor(identity, 120)).toEqual({ from: 30, to: 120 });
    expect(dayRangeFor(identity, 60)).toEqual({ from: 15, to: 60 });
    expect(dayRangeFor(identity, 365)).toEqual({ from: 30, to: 365 });
    const first = REFLECTIONS.find((reflection) => reflection.min_day === 1)!;
    for (const length of [30, 60, 90, 365]) expect(dayRangeFor(first, length).from).toBe(1);
  });
});
