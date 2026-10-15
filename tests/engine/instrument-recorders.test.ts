// Loops 7.2+ - the recorders behind the generic instrument sheets. A legacy-bound
// instrument must keep writing its own legacy event (the owner's log never gains a
// shape an older build cannot read); a generic one appends INSTRUMENT_RECORDED.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import type { InstrumentConfig, SystemBlueprint } from '../../src/blueprint/schema';
import { db } from '../../src/db/db';
import { activateBlueprint } from '../../src/store/blueprint';
import { pipelineGateway } from '../../src/ui/instruments/recorders/pipeline';
import { recordPractice } from '../../src/ui/instruments/recorders/practiceItem';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';

const log = legacyActivityLog({ seed: 5, days: 20 });
const facts = { ...OWNER_ARC_DEFAULTS, id: LEGACY_ARC_ID };
const today = dateAt(16);

const drills: InstrumentConfig = {
  id: 'foundations.drills', domainId: 'foundations', type: 'practice_item', label: 'Drills', logVerb: 'Log Drill',
  params: { topics: ['Alpha', 'Beta'], difficultyScale: ['E', 'M', 'H'], outcomes: ['first_attempt', 'hint', 'editorial', 'unsolved'] },
  controllability: 'effort', eventBinding: { kind: 'generic' },
};
const leads: InstrumentConfig = {
  id: 'foundations.leads', domainId: 'foundations', type: 'pipeline', label: 'Leads', logVerb: 'Log Lead',
  params: { stages: ['contacted', 'replied'], qualityGate: 'legacy' }, controllability: 'effort', eventBinding: { kind: 'generic' },
};
const leadResumes: InstrumentConfig = {
  id: 'foundations.cvs', domainId: 'foundations', type: 'artifact', label: 'CVs', logVerb: 'Record CV',
  params: { kinds: ['resume', 'portfolio'] }, controllability: 'effort', eventBinding: { kind: 'generic' },
};
const leadWork: InstrumentConfig = {
  id: 'foundations.leadwork', domainId: 'foundations', type: 'duration', label: 'Lead work', logVerb: 'Log Lead Work',
  params: { minBlockMinutes: 10 }, controllability: 'effort', eventBinding: { kind: 'generic' },
};

function synthetic(): SystemBlueprint {
  const blueprint = legacyBlueprintFor(facts);
  blueprint.version = 2;
  blueprint.activeFrom = today;
  blueprint.changeClass = 'operational';
  const domain = blueprint.domains.find((candidate) => candidate.id === 'foundations')!;
  for (const instrument of [drills, leads, leadResumes, leadWork]) {
    domain.instrumentIds.push(instrument.id);
    blueprint.instruments.push(structuredClone(instrument));
  }
  return blueprint;
}

const deps = (now: string) => { let n = 0; return { now: () => now, newId: () => `zzzz-rec-${String(n++).padStart(6, '0')}` }; };
const ctx = { today, arcId: LEGACY_ARC_ID };

describe('instrument recorders (loop 7.2)', () => {
  it('a generic practice_item appends INSTRUMENT_RECORDED, flags a revisit, and reports a mastery advance', async () => {
    const harness = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    await activateBlueprint(synthetic(), dateAt(15), deps(harness.now()));

    const first = await recordPractice(drills, { title: 'Two Sum', topic: 'Alpha', difficulty: 'M', outcome: 'first_attempt', minutes: 20 }, ctx);
    expect(first.masteryAdvance?.topic).toBe('Alpha');
    const second = await recordPractice(drills, { title: ' two  sum ', topic: 'Alpha', difficulty: 'M', outcome: 'hint', minutes: 10, insight: 'again' }, ctx);
    expect(second.masteryAdvance?.state ?? 'none').not.toBe('retained');

    const rows = await db.instrument_record.where('instrument_id').equals('foundations.drills').toArray();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.record).toMatchObject({ problemId: 'two-sum', topic: 'Alpha', isRevisit: false, minutes: 20 });
    expect(rows[1]!.record).toMatchObject({ problemId: 'two-sum', isRevisit: true, insight: 'again' });
    const events = await db.event.where('type').equals('INSTRUMENT_RECORDED').toArray();
    expect(events).toHaveLength(2);
  }, 60_000);

  it('rejects a record the instrument type would not accept, writing nothing', async () => {
    const harness = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    await activateBlueprint(synthetic(), dateAt(15), deps(harness.now()));
    await expect(recordPractice(drills, { title: 'x', topic: 'Gamma', difficulty: 'M', outcome: 'first_attempt', minutes: 5 }, ctx)).rejects.toThrow(/topic/i);
    expect(await db.instrument_record.count()).toBe(0);
  }, 60_000);

  it('a legacy-bound practice_item still writes PROBLEM_LOGGED, never INSTRUMENT_RECORDED', async () => {
    await loadLegacyDb(prefixOf(log, today), today);
    const dsa = legacyBlueprintFor(facts).instruments.find((instrument) => instrument.id === 'dsa.problems')!;
    const before = await db.event.where('type').equals('PROBLEM_LOGGED').count();
    await recordPractice(dsa, { title: 'Recorder Probe', topic: 'Arrays', difficulty: 'E', outcome: 'first_attempt', minutes: 15 }, ctx);
    expect(await db.event.where('type').equals('PROBLEM_LOGGED').count()).toBe(before + 1);
    expect(await db.event.where('type').equals('INSTRUMENT_RECORDED').count()).toBe(0);
    expect(await db.dsa_problem.where('slug').equals('recorder-probe').count()).toBe(1);
  }, 60_000);

  it('a generic pipeline gateway records applications, resume versions and substitute work', async () => {
    const harness = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    await activateBlueprint(synthetic(), dateAt(15), deps(harness.now()));
    const gateway = pipelineGateway({ instrument: leads, siblings: [leadResumes, leadWork], ...ctx });

    expect(gateway.resumes).not.toBeNull();
    expect(gateway.logSubstitute).not.toBeNull();
    const resumeId = await gateway.resumes!.create('v1 - general');
    expect(await gateway.resumes!.list()).toEqual([{ id: resumeId, label: 'v1 - general' }]);

    const passed = await gateway.logApplication({ company: 'Acme', role: 'Engineer', category: 'other', source: 'other', resumeVersionId: resumeId, whyLine: 'Their evaluation tooling is what I want to build.' });
    expect(typeof passed).toBe('boolean');
    await gateway.logSubstitute!(25, 'mock');

    const applications = (await db.instrument_record.where('instrument_id').equals('foundations.leads').toArray()).map((row) => row.record);
    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({ kind: 'application', company: 'Acme', resumeVersionId: resumeId, qualityPass: passed });
    const work = await db.instrument_record.where('instrument_id').equals('foundations.leadwork').toArray();
    expect(work[0]!.record).toMatchObject({ minutes: 25, mode: 'mock' });
  }, 60_000);

  it('a pipeline with no duration sibling offers no substitute tab, and none without a resume artifact offers no resume field', () => {
    const gateway = pipelineGateway({ instrument: leads, siblings: [], ...ctx });
    expect(gateway.logSubstitute).toBeNull();
    expect(gateway.resumes).toBeNull();
  });

  it('the legacy career gateway offers both', () => {
    const blueprint = legacyBlueprintFor(facts);
    const applications = blueprint.instruments.find((instrument) => instrument.id === 'career.applications')!;
    const siblings = blueprint.instruments.filter((instrument) => instrument.domainId === 'career' && instrument !== applications);
    const gateway = pipelineGateway({ instrument: applications, siblings, ...ctx });
    expect(gateway.resumes).not.toBeNull();
    expect(gateway.logSubstitute).not.toBeNull();
  });
});
