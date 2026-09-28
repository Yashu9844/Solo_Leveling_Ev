import { describe, it, expect } from 'vitest';
import {
  TIER_ORDER,
  bandFor,
  fingerprintFor,
  phaseFor,
  selectSystemMessage,
  tierFor,
  type DayPhase,
  type MessageTier,
  type ProgressBand,
  type ShowState,
  type SystemMessageContext,
} from '../../src/engine/systemVoice';
import { VOICE_PACK } from '../../src/engine/voicePack';

const PHASES: DayPhase[] = ['MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING', 'NIGHT', 'CLOSED'];
const BANDS: ProgressBand[] = [
  'ZERO',
  'STARTED',
  'BUILDING',
  'HALFWAY',
  'ADVANCING',
  'NEAR_CLEAR',
  'CLEARED',
];

/** A plain, unremarkable active day: morning, nothing done, no flags. */
function ctx(overrides: Partial<SystemMessageContext> = {}): SystemMessageContext {
  return {
    localDate: '2026-09-17',
    arcDay: 17,
    minutesOfDay: 8 * 60,
    phase: 'MORNING',
    dayClosed: false,
    arcState: 'active',

    xpEarned: 0,
    xpTarget: 500,
    progressPct: 0,
    band: 'ZERO',
    coreCompleted: 0,
    coreTotal: 6,
    firstActionOfDay: false,

    level: 5,
    xpIntoLevel: 100,
    xpForNext: 400,
    rank: 'E',
    streak: 0,
    consistency7: 0,

    reducedMode: false,
    recoveryAvailable: false,
    mvdMet: false,

    daysToCheckpoint: 13,
    eventsToday: [],
    leveledUpToday: false,
    yesterdayCleared: true,
    daysSinceLastOpen: 1,
    ...overrides,
  };
}

describe('VOICE_PACK — content integrity', () => {
  it('has unique ids', () => {
    const ids = VOICE_PACK.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries at least one line in every tier', () => {
    for (const tier of TIER_ORDER) {
      expect(VOICE_PACK.some((m) => m.tier === tier)).toBe(true);
    }
  });

  it('is a library, not a handful of lines', () => {
    expect(VOICE_PACK.length).toBeGreaterThanOrEqual(100);
  });

  it('speaks in the System voice: capitals, one or two clauses, full stop', () => {
    for (const message of VOICE_PACK) {
      expect(message.text).toBe(message.text.toUpperCase());
      expect(message.text.endsWith('.')).toBe(true);
      expect(message.text.length).toBeLessThanOrEqual(80);
      expect(message.text.trim()).toBe(message.text);
    }
  });

  it('never coaches', () => {
    // The register this feature exists to avoid. Not exhaustive — it
    // catches the specific failure mode that "motivational quotes" are.
    const banned = [
      'AMAZING',
      'CRUSH',
      'SMASH',
      'BELIEVE IN YOURSELF',
      'RISE AND GRIND',
      'YOU GOT THIS',
      'KEEP IT UP',
      'GREAT JOB',
      'WELL DONE',
      '!',
    ];
    for (const message of VOICE_PACK) {
      for (const phrase of banned) {
        expect(message.text.includes(phrase)).toBe(false);
      }
    }
  });

  it('gives every live phase x band cell at least two PROGRESS candidates', () => {
    // CLOSED is EXCEPTION-tier and CLEARED is CLEARED-tier, so neither
    // ever reaches the PROGRESS pool.
    const livePhases = PHASES.filter((p) => p !== 'CLOSED');
    const liveBands = BANDS.filter((b) => b !== 'CLEARED');

    for (const phase of livePhases) {
      for (const band of liveBands) {
        const pool = VOICE_PACK.filter(
          (m) =>
            m.tier === 'PROGRESS' &&
            (!m.phases || m.phases.includes(phase)) &&
            (!m.bands || m.bands.includes(band)) &&
            !m.when &&
            m.minStreak === undefined
        );
        expect(
          pool.length,
          `phase ${phase} x band ${band} has ${pool.length} unconditional candidates`
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('phaseFor — IST windows', () => {
  it('maps the wall clock to the five live windows', () => {
    expect(phaseFor(4 * 60, false)).toBe('MORNING');
    expect(phaseFor(7 * 60 + 15, false)).toBe('MORNING');
    expect(phaseFor(10 * 60 + 59, false)).toBe('MORNING');
    expect(phaseFor(11 * 60, false)).toBe('MIDDAY');
    expect(phaseFor(13 * 60 + 59, false)).toBe('MIDDAY');
    expect(phaseFor(14 * 60 + 30, false)).toBe('AFTERNOON');
    expect(phaseFor(17 * 60 + 59, false)).toBe('AFTERNOON');
    expect(phaseFor(20 * 60, false)).toBe('EVENING');
    expect(phaseFor(21 * 60 + 59, false)).toBe('EVENING');
    expect(phaseFor(22 * 60, false)).toBe('NIGHT');
    expect(phaseFor(1 * 60, false)).toBe('NIGHT');
  });

  it('lets the closed day override the clock entirely', () => {
    // 03:00-04:00 is engine/time.ts's window, and nothing can be logged
    // in it — so no hour of the day may produce an urgency phase.
    for (const minute of [0, 3 * 60, 8 * 60, 14 * 60, 20 * 60, 23 * 60]) {
      expect(phaseFor(minute, true)).toBe('CLOSED');
    }
  });
});

describe('bandFor — progress narrative', () => {
  it('maps every boundary value', () => {
    expect(bandFor(0, 0, 6)).toBe('ZERO');
    expect(bandFor(1, 0, 6)).toBe('STARTED');
    expect(bandFor(20, 1, 6)).toBe('STARTED');
    expect(bandFor(21, 1, 6)).toBe('BUILDING');
    expect(bandFor(49, 2, 6)).toBe('BUILDING');
    expect(bandFor(50, 3, 6)).toBe('HALFWAY');
    expect(bandFor(64, 3, 6)).toBe('HALFWAY');
    expect(bandFor(65, 4, 6)).toBe('ADVANCING');
    expect(bandFor(79, 4, 6)).toBe('ADVANCING');
    expect(bandFor(80, 5, 6)).toBe('NEAR_CLEAR');
    expect(bandFor(99, 5, 6)).toBe('NEAR_CLEAR');
  });

  it('treats CLEARED as quest truth, not XP truth', () => {
    // Bonus grants can carry a day past its target without every core
    // quest being cleared. The System must not announce a clear the
    // quest engine has not granted.
    expect(bandFor(100, 5, 6)).toBe('NEAR_CLEAR');
    expect(bandFor(140, 5, 6)).toBe('NEAR_CLEAR');
    expect(bandFor(60, 6, 6)).toBe('CLEARED');
  });

  it('does not claim a clear on a day with no quests at all', () => {
    expect(bandFor(0, 0, 0)).toBe('ZERO');
  });
});

describe('tierFor — priority', () => {
  it('puts a closed day and a dormant arc above everything', () => {
    expect(tierFor(ctx({ dayClosed: true, band: 'NEAR_CLEAR' }))).toBe('EXCEPTION');
    expect(tierFor(ctx({ arcState: 'before' }))).toBe('EXCEPTION');
    expect(tierFor(ctx({ arcState: 'after', band: 'CLEARED' }))).toBe('EXCEPTION');
  });

  it('puts an irreversible event above a cleared day', () => {
    expect(tierFor(ctx({ band: 'CLEARED', eventsToday: ['BOSS_CLEARED'] }))).toBe('EVENT');
    expect(tierFor(ctx({ leveledUpToday: true, band: 'ADVANCING' }))).toBe('EVENT');
  });

  it('lets a cleared day outrank recovery framing', () => {
    // Recovery frames an unfinished day. A reduced-mode day that is
    // nonetheless cleared gets the clear.
    expect(tierFor(ctx({ band: 'CLEARED', reducedMode: true }))).toBe('CLEARED');
    expect(tierFor(ctx({ band: 'CLEARED', recoveryAvailable: true }))).toBe('CLEARED');
  });

  it('puts recovery above ordinary progress', () => {
    expect(tierFor(ctx({ reducedMode: true, band: 'BUILDING' }))).toBe('RECOVERY');
    expect(tierFor(ctx({ recoveryAvailable: true, band: 'ZERO' }))).toBe('RECOVERY');
    expect(tierFor(ctx({ daysSinceLastOpen: 4 }))).toBe('RECOVERY');
  });

  it('never announces proximity to someone who has not moved', () => {
    const near = { xpIntoLevel: 380, xpForNext: 400 };
    expect(tierFor(ctx({ ...near, band: 'ZERO' }))).toBe('PROGRESS');
    expect(tierFor(ctx({ ...near, band: 'BUILDING' }))).toBe('MILESTONE');
    expect(tierFor(ctx({ streak: 7, band: 'ZERO' }))).toBe('PROGRESS');
    expect(tierFor(ctx({ streak: 7, band: 'STARTED' }))).toBe('MILESTONE');
  });

  it('falls through to PROGRESS on an ordinary day', () => {
    expect(tierFor(ctx({ band: 'BUILDING', phase: 'AFTERNOON' }))).toBe('PROGRESS');
  });
});

describe('selectSystemMessage', () => {
  const empty = () => new Map<string, ShowState>();

  it('is deterministic — the same state on the same day always says the same thing', () => {
    const context = ctx({ phase: 'AFTERNOON', band: 'ZERO' });
    const first = selectSystemMessage(VOICE_PACK, context, empty());
    for (let i = 0; i < 200; i += 1) {
      expect(selectSystemMessage(VOICE_PACK, context, empty()).message.id).toBe(first.message.id);
    }
  });

  it('returns a message for every phase x band x flag combination', () => {
    for (const phase of PHASES) {
      for (const band of BANDS) {
        for (const flags of [
          {},
          { reducedMode: true },
          { recoveryAvailable: true },
          { leveledUpToday: true },
          { firstActionOfDay: true },
          { arcState: 'before' as const },
          { arcState: 'after' as const },
          { streak: 30 },
        ]) {
          const context = ctx({ phase, band, dayClosed: phase === 'CLOSED', ...flags });
          const selected = selectSystemMessage(VOICE_PACK, context, empty());
          expect(selected.message.text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('says something different at 07:15 with nothing done than at 14:30 with nothing done', () => {
    const morning = selectSystemMessage(VOICE_PACK, ctx({ phase: 'MORNING', band: 'ZERO' }), empty());
    const afternoon = selectSystemMessage(
      VOICE_PACK,
      ctx({ phase: 'AFTERNOON', band: 'ZERO' }),
      empty()
    );
    expect(morning.message.id).not.toBe(afternoon.message.id);
    expect(morning.fingerprint).not.toBe(afternoon.fingerprint);
  });

  it('says something different at 0% than at 50% in the same hour', () => {
    const zero = selectSystemMessage(VOICE_PACK, ctx({ phase: 'AFTERNOON', band: 'ZERO' }), empty());
    const half = selectSystemMessage(
      VOICE_PACK,
      ctx({ phase: 'AFTERNOON', band: 'HALFWAY', progressPct: 50, coreCompleted: 3 }),
      empty()
    );
    expect(zero.message.id).not.toBe(half.message.id);
  });

  it('never tells a cleared day to start, and never tells an empty day it is nearly done', () => {
    const cleared = selectSystemMessage(
      VOICE_PACK,
      ctx({ band: 'CLEARED', coreCompleted: 6, phase: 'EVENING' }),
      empty()
    );
    expect(cleared.tier).toBe('CLEARED');

    const zero = selectSystemMessage(VOICE_PACK, ctx({ phase: 'EVENING', band: 'ZERO' }), empty());
    expect(zero.tier).toBe('PROGRESS');
    expect(zero.message.bands).toContain('ZERO');
  });

  it('keeps recovery states out of the push-harder pool', () => {
    for (const flags of [{ reducedMode: true }, { recoveryAvailable: true }]) {
      const selected = selectSystemMessage(
        VOICE_PACK,
        ctx({ ...flags, phase: 'AFTERNOON', band: 'STARTED' }),
        empty()
      );
      expect(selected.tier).toBe('RECOVERY');
    }
  });

  it('works through the library rather than repeating one line', () => {
    // Thirty consecutive days in the identical state. A large apparent
    // vocabulary is the whole point of the cooldown + least-shown ranking.
    const history = new Map<string, ShowState>();
    const seen = new Set<string>();
    for (let day = 1; day <= 30; day += 1) {
      const localDate = `2026-10-${String(day).padStart(2, '0')}`;
      const selected = selectSystemMessage(
        VOICE_PACK,
        ctx({ localDate, phase: 'MORNING', band: 'ZERO' }),
        history
      );
      seen.add(selected.message.id);
      const prior = history.get(selected.message.id);
      history.set(selected.message.id, {
        times_shown: (prior?.times_shown ?? 0) + 1,
        last_shown_date: localDate,
      });
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('yields rather than starves when every candidate is inside its cooldown', () => {
    const context = ctx({ phase: 'MORNING', band: 'ZERO' });
    const history = new Map<string, ShowState>(
      VOICE_PACK.map((m) => [m.id, { times_shown: 1, last_shown_date: context.localDate }])
    );
    const selected = selectSystemMessage(VOICE_PACK, context, history);
    expect(selected.tier).toBe('PROGRESS');
    expect(selected.message.text.length).toBeGreaterThan(0);
  });

  it('prefers the line it has shown least', () => {
    const context = ctx({ phase: 'MORNING', band: 'ZERO' });
    const baseline = selectSystemMessage(VOICE_PACK, context, new Map());
    const history = new Map<string, ShowState>([[baseline.message.id, { times_shown: 3 }]]);
    expect(selectSystemMessage(VOICE_PACK, context, history).message.id).not.toBe(
      baseline.message.id
    );
  });
});

describe('fingerprintFor — the stability contract', () => {
  it('is identical for two opens in the same state', () => {
    const a = ctx({ phase: 'EVENING', band: 'ADVANCING' });
    const b = ctx({ phase: 'EVENING', band: 'ADVANCING', minutesOfDay: 21 * 60, xpEarned: 340 });
    expect(fingerprintFor(a, tierFor(a))).toBe(fingerprintFor(b, tierFor(b)));
  });

  it('changes when the band, the phase or a flag moves', () => {
    const base = ctx({ phase: 'EVENING', band: 'ADVANCING' });
    const fp = fingerprintFor(base, tierFor(base));

    for (const changed of [
      ctx({ phase: 'NIGHT', band: 'ADVANCING' }),
      ctx({ phase: 'EVENING', band: 'NEAR_CLEAR' }),
      ctx({ phase: 'EVENING', band: 'ADVANCING', reducedMode: true }),
      ctx({ phase: 'EVENING', band: 'ADVANCING', streak: 7 }),
    ]) {
      expect(fingerprintFor(changed, tierFor(changed))).not.toBe(fp);
    }
  });

  it('carries the tier, so the surface can explain itself', () => {
    const cleared = ctx({ band: 'CLEARED' });
    expect(fingerprintFor(cleared, tierFor(cleared)).startsWith('CLEARED|')).toBe(true);
  });
});

describe('the worked cases from the brief', () => {
  const cases: { name: string; context: SystemMessageContext; tier: MessageTier }[] = [
    {
      name: '07:15, 0/500 — a new day, not a scolding',
      context: ctx({ phase: 'MORNING', band: 'ZERO', minutesOfDay: 7 * 60 + 15 }),
      tier: 'PROGRESS',
    },
    {
      name: '08:00, 100/500 — already moving',
      context: ctx({
        phase: 'MORNING',
        band: 'STARTED',
        progressPct: 20,
        xpEarned: 100,
        coreCompleted: 1,
        firstActionOfDay: true,
      }),
      tier: 'PROGRESS',
    },
    {
      name: '14:30, 0/500 — half the day gone',
      context: ctx({ phase: 'AFTERNOON', band: 'ZERO', minutesOfDay: 14 * 60 + 30 }),
      tier: 'PROGRESS',
    },
    {
      name: '20:00, 425/500 — the final condition',
      context: ctx({
        phase: 'EVENING',
        band: 'NEAR_CLEAR',
        progressPct: 85,
        xpEarned: 425,
        coreCompleted: 5,
      }),
      tier: 'PROGRESS',
    },
    {
      name: '500/500 — the clear',
      context: ctx({ band: 'CLEARED', coreCompleted: 6, xpEarned: 500, progressPct: 100 }),
      tier: 'CLEARED',
    },
    {
      name: 'reduced mode — the floor, never "push harder"',
      context: ctx({ reducedMode: true, phase: 'MIDDAY', band: 'STARTED' }),
      tier: 'RECOVERY',
    },
  ];

  for (const { name, context, tier } of cases) {
    it(name, () => {
      const selected = selectSystemMessage(VOICE_PACK, context, new Map());
      expect(selected.tier).toBe(tier);
      expect(selected.message.text).toBe(selected.message.text.toUpperCase());
    });
  }

  it('gives the six cases six different lines', () => {
    const ids = cases.map((c) => selectSystemMessage(VOICE_PACK, c.context, new Map()).message.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
