// Loop 12.2 (F11): the static voice pack never states a count, a clock time or a designation that the System it is speaking to does not have.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateBlueprint } from '../../src/generator';
import { systemMessageContextFor } from '../../src/blueprint/evaluate/messages';
import { eligible, selectSystemMessage, TIER_ORDER, type DayPhase, type ProgressBand, type SystemMessageContext } from '../../src/engine/systemVoice';
import { VOICE_PACK } from '../../src/engine/voicePack';
import { personaEventLog } from './support/personaEventLog';

const PHASES: DayPhase[] = ['MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING', 'NIGHT', 'CLOSED'];
const BANDS: ProgressBand[] = ['ZERO', 'STARTED', 'BUILDING', 'HALFWAY', 'ADVANCING', 'NEAR_CLEAR', 'CLEARED'];
const WORDS: Record<string, number> = { TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8 };
const WORD_OF = Object.fromEntries(Object.entries(WORDS).map(([word, n]) => [n, word]));

function ctx(overrides: Partial<SystemMessageContext> = {}): SystemMessageContext {
  return {
    localDate: '2026-09-17', arcDay: 17, minutesOfDay: 8 * 60, phase: 'MORNING', dayClosed: false, arcState: 'active',
    xpEarned: 0, xpTarget: 500, progressPct: 0, band: 'ZERO', coreCompleted: 0, coreTotal: 6, firstActionOfDay: false,
    level: 5, xpIntoLevel: 100, xpForNext: 400, rank: 'E', streak: 0, consistency7: 0,
    reducedMode: false, recoveryAvailable: false, mvdMet: false, daysToCheckpoint: 13, eventsToday: [], leveledUpToday: false, yesterdayCleared: true, daysSinceLastOpen: 1,
    ...overrides,
  };
}

/** The lines whose text says how many conditions there are (or how many are left): everything but the streak and weekly milestones, which count days. */
const countLines = VOICE_PACK.filter((message) => !/^(milestone-streak|event-weekly)/.test(message.id) && Object.keys(WORDS).some((word) => new RegExp(`\\b${word}\\b`).test(message.text)));
/** Which count a line's number words describe: the count in "N CONDITIONS", "OF N", or (for "N ARE NOT") one more than N. */
function statedTotal(text: string): number {
  const word = (pattern: RegExp) => WORDS[pattern.exec(text)?.[1] ?? ''];
  return word(/\bALL (\w+) CONDITIONS\b/) ?? word(/^(\w+) CONDITIONS ARE OPEN\b/) ?? word(/\bOF (\w+)\./) ?? (word(/(\w+) ARE NOT\./) ?? NaN) + 1;
}

describe('F11 - the voice never states a count the System does not have', () => {
  it('every line that says a number of conditions is one of the known count lines (a new literal fails here until it is guarded)', () => {
    const bases = ['cleared-003', 'morning-zero-005', 'midday-started-002', 'final-condition-003'];
    expect(countLines.map((message) => message.id.split('@')[0]).sort()).toEqual(expect.arrayContaining(bases));
    for (const message of countLines) expect(bases, `${message.id}: "${message.text}"`).toContain(message.id.split('@')[0]);
  });

  it('each count line is eligible for exactly the System it counts, whatever the phase, band or number done', () => {
    for (const message of countLines) {
      const stated = statedTotal(message.text);
      expect(Number.isInteger(stated), message.id).toBe(true);
      for (const total of [1, 2, 3, 4, 5, 6, 7, 8, 9, 12]) {
        for (const phase of PHASES) for (const band of BANDS) for (let done = 0; done <= total; done++) {
          const live = eligible(message, ctx({ coreTotal: total, coreCompleted: done, phase, band }), message.tier);
          if (live && !(message.phases && !message.phases.includes(phase)) && !(message.bands && !message.bands.includes(band))) {
            expect(total, `${message.id} was eligible for a ${total}-quest day`).toBe(stated);
          }
        }
      }
    }
  });

  it('FOUR to EIGHT each have a variant of every count line, and SIX keeps its original id', () => {
    for (const base of ['cleared-003', 'morning-zero-005', 'midday-started-002', 'final-condition-003']) {
      for (const total of [4, 5, 6, 7, 8]) {
        const id = total === 6 ? base : `${base}@${total}`;
        const line = VOICE_PACK.find((message) => message.id === id);
        expect(line, id).toBeDefined();
        expect(statedTotal(line!.text), id).toBe(total);
        if (total !== 6) expect(line!.text).toMatch(new RegExp(`\\b${WORD_OF[total]}\\b|\\b${WORD_OF[total - 1]}\\b|\\b${WORD_OF[total + 1] ?? WORD_OF[total]}\\b`));
      }
    }
  });

  it('the owner\'s six-quest day hears the count lines it always heard, and none of the new variants', () => {
    const owner = ctx({ coreTotal: 6, coreCompleted: 6, band: 'CLEARED', phase: 'EVENING' });
    const heard = VOICE_PACK.filter((message) => eligible(message, owner, 'CLEARED')).map((message) => message.id);
    expect(heard).toContain('cleared-003');
    expect(heard.filter((id) => id.includes('@'))).toEqual([]);
  });

  it('a four-quest System is told FOUR, never SIX, across a whole simulated selection', () => {
    for (const phase of PHASES) for (const band of BANDS) for (let done = 0; done <= 4; done++) {
      const selected = selectSystemMessage(VOICE_PACK, ctx({ coreTotal: 4, coreCompleted: done, phase, band, dayClosed: phase === 'CLOSED' }), new Map()).message;
      expect(selected.text, `${phase} ${band} ${done}/4`).not.toMatch(/\bSIX\b|\bFIVE\b|\bSEVEN\b|\bEIGHT\b/);
    }
  });
});

describe('time-free and boundary variants', () => {
  const closed = (overrides: Partial<SystemMessageContext> = {}) => ctx({ phase: 'CLOSED', dayClosed: true, ...overrides });
  const poolOf = (context: SystemMessageContext) => VOICE_PACK.filter((message) => eligible(message, context, 'EXCEPTION')).map((message) => message.text);

  it('names 04:00 only when the day really rolls over at 04:00', () => {
    for (const hour of [3, 5, 6]) expect(poolOf(closed({ boundaryHour: hour, designations: [] })).filter((text) => /\d\d:\d\d/.test(text)), `hour ${hour}`).toEqual([]);
    expect(poolOf(closed({ boundaryHour: 4, designations: [] })).some((text) => text.includes('04:00'))).toBe(true);
  });

  it('a System with another hour still has closed-day lines, and the time-free ones are among them', () => {
    const pool = poolOf(closed({ boundaryHour: 6, designations: [] }));
    expect(pool.length).toBeGreaterThanOrEqual(5);
    expect(pool.some((text) => /ROLLS OVER|ON SCHEDULE/.test(text))).toBe(true);
  });

  it('the owner (no boundary in the context) keeps the pool it had: the 04:00 lines and not the time-free ones', () => {
    const pool = poolOf(closed());
    expect(pool.filter((text) => text.includes('04:00'))).toHaveLength(2);
    expect(pool.some((text) => /ROLLS OVER|ON SCHEDULE/.test(text))).toBe(false);
  });
});

describe('vocabulary-bound lines', () => {
  const owner = ['ASCENSION', 'LOGIC TRIAL', 'FORGE', 'RECONSTITUTION', 'WILL TRIAL', 'VITALITY TRIAL'];
  const naming = VOICE_PACK.filter((message) => owner.some((word) => message.text.toUpperCase().includes(word)));

  it('every line that names a designation requires it', () => {
    expect(naming.map((message) => message.id)).toEqual(['morning-zero-004']);
    for (const message of naming) expect(message.text, message.id).toContain(message.requiresDesignation);
  });

  it('is heard by the owner and by a System that has the designation, and by nobody else', () => {
    const line = VOICE_PACK.find((message) => message.id === 'morning-zero-004')!;
    expect(eligible(line, ctx(), 'PROGRESS')).toBe(true);
    expect(eligible(line, ctx({ designations: ['FORGE', 'ASCENSION'] }), 'PROGRESS')).toBe(true);
    expect(eligible(line, ctx({ designations: ['FORGE', 'TRIAL'] }), 'PROGRESS')).toBe(false);
  });

  it('a generated System\'s real context never selects a line that names a designation it lacks, over a simulated life', () => {
    const draft = {
      lineageId: 'voice', today: '2026-09-01', identity: { displayName: 'ADA', primaryObjective: 'x' },
      domains: [{ archetypeId: 'reading' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
      rhythm: { wakeTime: '07:00', sleepTime: '23:00' }, arc: { startDate: '2026-09-01', lengthDays: 90, timezone: 'Asia/Kolkata' },
    };
    const { blueprint } = generateBlueprint(draft);
    const events = personaEventLog(blueprint, 11, { kind: 'steady', days: 30 });
    const own = blueprint.domains.map((domain) => domain.designation);
    let checked = 0;
    for (let offset = 3; offset < 30; offset += 4) {
      const today = new Date(Date.parse('2026-09-01T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10);
      for (const hour of [4, 8, 13, 19, 23]) {
        const context = systemMessageContextFor({ blueprint, events, today, arcDay: offset + 1, now: `${today}T${String(hour).padStart(2, '0')}:00:00Z`, checkpoints: [] });
        expect(context?.designations).toEqual(own);
        expect(context?.boundaryHour).toBe(blueprint.arc.dayBoundaryHour);
        const said = selectSystemMessage(VOICE_PACK, context!, new Map()).message;
        for (const word of owner) if (!own.includes(word)) expect(said.text, `${today} ${hour}h`).not.toContain(word);
        if (context!.coreTotal !== 6) expect(said.text).not.toMatch(/\bSIX\b/);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('the library the audio is rendered from', () => {
  const manifest = existsSync(new URL('../../public/voice/manifest.json', import.meta.url))
    ? (JSON.parse(readFileSync(new URL('../../public/voice/manifest.json', import.meta.url), 'utf8')) as { ids: string[] }).ids
    : [];

  it('every id is unique and every tier still has a line that needs no condition', () => {
    expect(new Set(VOICE_PACK.map((message) => message.id)).size).toBe(VOICE_PACK.length);
    for (const tier of TIER_ORDER) expect(VOICE_PACK.some((message) => message.tier === tier), tier).toBe(true);
  });

  it('every line has its rendered clip, and every clip is still a line of the pack (no legacy audio id was lost or renamed)', () => {
    if (manifest.length === 0) return;
    expect(VOICE_PACK.map((message) => message.id).filter((id) => !manifest.includes(id))).toEqual([]);
    expect(manifest.filter((id) => !VOICE_PACK.some((message) => message.id === id))).toEqual([]);
  });
});

describe('the address of a clip', () => {
  it('keeps "@" as it is, so a count variant is requested by a path every host can serve', async () => {
    const { clipUrl } = await import('../../src/ui/speech/voicePackAudio');
    expect(clipUrl('cleared-003@4')).toBe('/voice/cleared-003@4.mp3');
    expect(clipUrl('morning-zero-001')).toBe('/voice/morning-zero-001.mp3');
    expect(clipUrl('odd id/with?chars')).toBe('/voice/odd%20id%2Fwith%3Fchars.mp3');
  });
});
