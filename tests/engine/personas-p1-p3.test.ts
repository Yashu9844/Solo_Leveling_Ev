// Loop 9.2: persona suites P1-P3 (platform/04 §32). The assertions live in support/personaSuite.ts; the numbers in the persona files.
import { describe, expect, it } from 'vitest';
import { VOICE_PACK } from '../../src/engine/voicePack';
import { p1 } from '../fixtures/personas/p1';
import { p2 } from '../fixtures/personas/p2';
import { p3 } from '../fixtures/personas/p3';
import { describePersona, KNOWN_OWNER_WORDING_IN_VOICE_PACK } from './support/personaSuite';

for (const persona of [p1, p2, p3]) describePersona(persona);

describe('persona specifics', () => {
  it('P2 aligns its checkpoints to a non-anchor length (150) and keeps them ten days apart', () => {
    expect(p2.expect.checkpointDays).toEqual([14, 38, 75, 113, 150]);
    expect(p2.expect.checkpointDays.every((day, i, all) => i === 0 || day - all[i - 1]! >= 10)).toBe(true);
  });

  it('P3 sits on the 90-day anchor and has one guardrail', () => {
    expect(p3.expect.checkpointDays).toEqual([14, 30, 50, 70, 90]);
    expect(p3.expect.domains.filter((domain) => domain.startsWith('guardrail:'))).toHaveLength(1);
  });

  it('the voice pack names the owner\'s designations in exactly the known lines (Phase 12 retires them)', () => {
    const owner = ['ASCENSION', 'LOGIC TRIAL', 'FORGE', 'RECONSTITUTION', 'WILL TRIAL', 'VITALITY TRIAL'];
    const named = VOICE_PACK.filter((message) => owner.some((word) => message.text.toUpperCase().includes(word))).map((message) => message.id);
    expect(named).toEqual(KNOWN_OWNER_WORDING_IN_VOICE_PACK);
  });
});
