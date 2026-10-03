import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { learnShipRatio, learnShipRuleFires, type BuildSessionFixture } from '../../src/engine/build';
import { artifactSignals, artifactVerifiability, validateArtifactRecord, type ArtifactKind, type ArtifactRecord } from '../../src/instruments/types/artifact';
import { durationLearnShipRuleFires, durationSignals, validateDurationRecord, type DurationRecord } from '../../src/instruments/types/duration';
import type { InstrumentRecord } from '../../src/instruments/framework';

const modes = ['LEARN', 'SHIP'] as const;
const kinds = ['feature', 'eval', 'project', 'deployment', 'writeup', 'resume', 'portfolio'] as const;
const durationParams = { minBlockMinutes: 1 } as const;
const artifactParams = { kinds } as const;

function durationRecord(session: BuildSessionFixture & { minutes: number }, id: number): InstrumentRecord<DurationRecord> {
  return { id: `duration-${id}`, eventId: `event-${id}`, instrumentId: 'build.duration', instrumentType: 'duration', domainId: 'build', blueprintVersion: 1, localDate: session.local_date, record: { mode: session.mode, minutes: session.minutes, projectKey: 'project' } };
}
function artifactRecord(record: ArtifactRecord, localDate: string, id: number): InstrumentRecord<ArtifactRecord> {
  return { id: `artifact-${id}`, eventId: `artifact-event-${id}`, instrumentId: 'build.artifact', instrumentType: 'artifact', domainId: 'build', blueprintVersion: 1, localDate, record };
}

describe('duration and artifact instruments (loop 3.4)', () => {
  it('enforces their record contracts and evidence flags', () => {
    expect(validateDurationRecord({ minutes: 45, mode: 'LEARN' }, durationParams)).toEqual([]);
    expect(validateDurationRecord({ minutes: 0 }, durationParams)).toHaveLength(1);
    expect(validateArtifactRecord({ kind: 'project', title: 'Tool', projectKey: 'tool', costPerTaskStated: true }, artifactParams)).toEqual([]);
    expect(validateArtifactRecord({ kind: 'feature', title: 'Tool', projectKey: 'tool', costPerTaskStated: true }, artifactParams)).toHaveLength(1);
    expect(artifactVerifiability({ kind: 'feature', title: 'Tool', projectKey: 'tool', url: 'https://example.test' })).toBe('public_url');
    expect(artifactVerifiability({ kind: 'feature', title: 'Tool', projectKey: 'tool' })).toBe('recorded');
  });

  it('matches legacy LEARN/SHIP behavior and checkpoint artifact queries over 10,000 corpora', () => {
    const sessionArb = fc.record({ local_date: fc.integer({ min: 1, max: 28 }).map((day) => `2026-09-${String(day).padStart(2, '0')}`), mode: fc.constantFrom(...modes), minutes: fc.integer({ min: 1, max: 240 }) });
    const artifactArb = fc.record({ kind: fc.constantFrom<ArtifactKind>(...kinds), title: fc.string({ minLength: 1, maxLength: 20 }), projectKey: fc.string({ minLength: 1, maxLength: 8 }), url: fc.option(fc.webUrl(), { nil: undefined }), costPerTaskStated: fc.boolean() });
    fc.assert(fc.property(fc.array(sessionArb, { maxLength: 40 }), fc.array(artifactArb, { maxLength: 40 }), (sessions, artifacts) => {
      const durationRecords = sessions.map(durationRecord);
      const legacySessions = sessions.map(({ local_date, mode }) => ({ local_date, mode }));
      const signals = durationSignals(durationRecords, { localDate: '2026-09-28', from: '2026-09-01', to: '2026-09-28' });
      expect(signals.input_output_ratio).toBe(learnShipRatio(legacySessions));
      expect(durationLearnShipRuleFires(durationRecords)).toBe(learnShipRuleFires(legacySessions));
      expect(signals.minutes).toBe(sessions.reduce((sum, session) => sum + session.minutes, 0));
      const artifactRecords = artifacts.map((artifact, index) => artifactRecord(artifact, `2026-09-${String((index % 28) + 1).padStart(2, '0')}`, index));
      const artifactSignal = artifactSignals(artifactRecords, { localDate: '2026-09-28', from: '2026-09-01', to: '2026-09-28' });
      expect(artifactSignal.count).toBe(artifacts.length);
      expect(artifactSignal.projects_with).toBe(new Set(artifacts.map((artifact) => artifact.projectKey)).size);
      for (const kind of kinds) {
        const filtered = artifactSignals(artifactRecords, { localDate: '2026-09-28', from: '2026-09-01', to: '2026-09-28', filter: { kind } });
        expect(filtered.count).toBe(artifacts.filter((artifact) => artifact.kind === kind).length);
      }
    }), { numRuns: 10_000 });
  });
});
