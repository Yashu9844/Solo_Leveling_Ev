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
import { artifactSibling, recordArtifact, recordDuration } from '../../src/ui/instruments/recorders/duration';
import { recordSession, recordThreshold } from '../../src/ui/instruments/recorders/sessionAndThreshold';
import { checklistGateway, recordTimeWindow } from '../../src/ui/instruments/recorders/lifestyle';
import { recordStudy } from '../../src/ui/instruments/recorders/studyBlock';
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

function synthetic(extra: InstrumentConfig[] = [drills, leads, leadResumes, leadWork]): SystemBlueprint {
  const blueprint = legacyBlueprintFor(facts);
  blueprint.version = 2;
  blueprint.activeFrom = today;
  blueprint.changeClass = 'operational';
  const domain = blueprint.domains.find((candidate) => candidate.id === 'foundations')!;
  for (const instrument of extra) {
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

const focus: InstrumentConfig = {
  id: 'foundations.focus', domainId: 'foundations', type: 'duration', label: 'Focus', logVerb: 'Log Focus Block',
  params: { modes: ['STUDY', 'SHIP'], defaultMinutes: 30 }, controllability: 'effort', eventBinding: { kind: 'generic' },
};
const ships: InstrumentConfig = {
  id: 'foundations.ships', domainId: 'foundations', type: 'artifact', label: 'Shipped', logVerb: 'Record Shipment',
  params: { kinds: ['feature', 'project', 'resume'], bonusXp: 25 }, controllability: 'effort', eventBinding: { kind: 'generic' },
};
const lifting: InstrumentConfig = {
  id: 'foundations.lifting', domainId: 'foundations', type: 'session', label: 'Lifting', logVerb: 'Log Lift',
  params: { sessionTypes: ['Upper', 'Lower'], defaultMinutes: 40, defaultRpe: 7 }, controllability: 'effort', eventBinding: { kind: 'generic' },
};
const water: InstrumentConfig = {
  id: 'foundations.water', domainId: 'foundations', type: 'threshold', label: 'Water', logVerb: 'Log Water',
  params: { unit: 'glasses', comparator: '>=', target: 8 }, controllability: 'effort', eventBinding: { kind: 'generic' },
};

describe('instrument recorders (loop 7.3)', () => {
  it('a generic duration records the block, and what it shipped through the artifact sibling', async () => {
    const harness = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    await activateBlueprint(synthetic([focus, ships, lifting, water]), dateAt(15), deps(harness.now()));
    expect(artifactSibling([ships])?.id).toBe('foundations.ships');
    await recordDuration(focus, [ships], { minutes: 50, mode: 'SHIP', projectKey: 'atlas', shipped: { kind: 'project', title: 'Atlas 1.0', costPerTaskStated: true } }, ctx);
    const blocks = await db.instrument_record.where('instrument_id').equals('foundations.focus').toArray();
    expect(blocks.map((row) => row.record)).toEqual([{ minutes: 50, mode: 'SHIP', projectKey: 'atlas' }]);
    const shipped = await db.instrument_record.where('instrument_id').equals('foundations.ships').toArray();
    expect(shipped.map((row) => row.record)).toEqual([{ kind: 'project', title: 'Atlas 1.0', projectKey: 'atlas', costPerTaskStated: true }]);
  }, 60_000);

  it('a standalone artifact, a session and a threshold reading record against their instruments', async () => {
    const harness = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    await activateBlueprint(synthetic([focus, ships, lifting, water]), dateAt(15), deps(harness.now()));
    await recordArtifact(ships, { kind: 'feature', title: 'Search', projectKey: 'atlas', url: ' https://example.com/x ' }, ctx);
    await recordSession(lifting, { sessionType: 'Upper', minutes: 40, rpe: 7 }, ctx);
    await recordThreshold(water, 9, ctx);
    const rows = await db.instrument_record.toArray();
    const by = (id: string) => rows.filter((row) => row.instrument_id === id).map((row) => row.record);
    expect(by('foundations.ships')).toEqual([{ kind: 'feature', title: 'Search', projectKey: 'atlas', url: 'https://example.com/x' }]);
    expect(by('foundations.lifting')).toEqual([{ sessionType: 'Upper', minutes: 40, rpe: 7 }]);
    expect(by('foundations.water')).toEqual([{ value: 9 }]);
    await expect(recordSession(lifting, { sessionType: 'Sideways', minutes: 40 }, ctx)).rejects.toThrow(/session type/i);
  }, 60_000);

  it('legacy build, training and screen-time instruments keep writing their legacy events', async () => {
    await loadLegacyDb(prefixOf(log, today), today);
    const blueprint = legacyBlueprintFor(facts);
    const get = (id: string) => blueprint.instruments.find((instrument) => instrument.id === id)!;
    const count = (type: string) => db.event.where('type').equals(type).count();
    const before = { build: await count('BUILD_SESSION_LOGGED'), ship: await count('ARTIFACT_SHIPPED'), train: await count('TRAINING_SESSION_LOGGED'), steps: await count('STEPS_LOGGED'), screen: await count('SCREENTIME_LOGGED') };

    await recordDuration(get('build.sessions'), [get('build.artifacts')], { minutes: 45, mode: 'SHIP', projectKey: 'probe', shipped: { kind: 'feature', title: 'Probe' } }, ctx);
    await recordSession(get('training.sessions'), { sessionType: 'Push', minutes: 40, rpe: 7 }, ctx);
    await recordThreshold(get('training.steps'), 9000, ctx);
    await recordThreshold(get('attention.screen'), 50, ctx);

    expect(await count('BUILD_SESSION_LOGGED')).toBe(before.build + 1);
    expect(await count('ARTIFACT_SHIPPED')).toBe(before.ship + 1);
    expect(await count('TRAINING_SESSION_LOGGED')).toBe(before.train + 1);
    expect(await count('STEPS_LOGGED')).toBe(before.steps + 1);
    expect(await count('SCREENTIME_LOGGED')).toBe(before.screen + 1);
    expect(await count('INSTRUMENT_RECORDED')).toBe(0);
    await expect(recordArtifact(get('build.artifacts'), { kind: 'feature', title: 'x', projectKey: 'y' }, ctx)).rejects.toThrow(/legacy artifact/);
  }, 60_000);
});

// ── Loop 7.4 ────────────────────────────────────────────────────────────────
const rise: InstrumentConfig = {
  id: 'foundations.rise', domainId: 'foundations', type: 'time_window', label: 'Rising time', logVerb: 'Log Rising',
  params: { targetTime: '07:00', toleranceMinutes: 20, secondaryLabel: 'Bedtime' }, controllability: 'effort', eventBinding: { kind: 'generic' },
};
const routine: InstrumentConfig = {
  id: 'foundations.routine', domainId: 'foundations', type: 'checklist', label: 'Routine', logVerb: 'Tick Routine',
  params: { items: [{ id: 'stretch', label: 'Stretch' }, { id: 'water', label: 'Water', everyNDays: 2 }] }, controllability: 'effort', eventBinding: { kind: 'generic' },
};
const reading: InstrumentConfig = {
  id: 'foundations.reading', domainId: 'foundations', type: 'study_block', label: 'Reading', logVerb: 'Log Reading',
  params: { topics: ['Poetry', 'Prose'], blockXp: 10, designTopic: 'Prose' }, controllability: 'effort', eventBinding: { kind: 'generic' },
};
const essays: InstrumentConfig = {
  id: 'foundations.essays', domainId: 'foundations', type: 'study_block', label: 'Essays', logVerb: 'Log Essay',
  params: { topics: ['Prose'], modes: ['drafted', 'published'] }, controllability: 'effort', eventBinding: { kind: 'generic' },
};

describe('instrument recorders (loop 7.4)', () => {
  it('generic time window, study block, design study and checklist record against their instruments', async () => {
    const harness = await loadLegacyDb(prefixOf(log, dateAt(15)), dateAt(15));
    await activateBlueprint(synthetic([rise, routine, reading, essays]), dateAt(15), deps(harness.now()));

    await recordTimeWindow(rise, { time: '06:45', secondary: '23:10' }, ctx);
    const first = await recordStudy(reading, essays, { topic: 'Poetry', minutes: 20, note: 'sonnets' }, ctx);
    expect(first.masteryAdvance?.topic).toBe('Poetry');
    await recordStudy(reading, essays, { topic: 'Prose', minutes: 30, design: { system: 'Essay on memory', mode: 'drafted', artifactUrl: 'https://example.com/e' } }, ctx);

    const by = async (id: string) => (await db.instrument_record.where('instrument_id').equals(id).toArray()).map((row) => row.record);
    expect(await by('foundations.rise')).toEqual([{ minutes: 6 * 60 + 45, sleepMinutes: 23 * 60 + 10 }]);
    expect(await by('foundations.reading')).toEqual([{ topic: 'Poetry', minutes: 20, note: 'sonnets' }]);
    expect(await by('foundations.essays')).toEqual([{ topic: 'Prose', system: 'Essay on memory', mode: 'drafted', minutes: 30, artifactUrl: 'https://example.com/e' }]);

    const gateway = checklistGateway({ instrument: routine, ...ctx, arcStartDate: '2026-09-01' });
    expect((await gateway.load()).done).toEqual([]);
    await gateway.save(['stretch']);
    await gateway.save(['stretch', 'water']);
    const loaded = await gateway.load();
    expect(loaded.done).toEqual(['stretch', 'water']);
    expect(loaded.due).toContain('stretch');
  }, 60_000);

  it('legacy wake time, learning blocks, system design and maintenance keep writing their legacy events', async () => {
    await loadLegacyDb(prefixOf(log, today), today);
    const blueprint = legacyBlueprintFor(facts);
    const get = (id: string) => blueprint.instruments.find((instrument) => instrument.id === id)!;
    const count = (type: string) => db.event.where('type').equals(type).count();
    const before = { sleep: await count('SLEEP_LOGGED'), block: await count('LEARNING_BLOCK_LOGGED'), design: await count('SYSTEM_DESIGN_LOGGED'), maint: await count('MAINTENANCE_LOGGED') };

    await recordTimeWindow(get('sleep.wake'), { time: '08:20', secondary: '00:30' }, ctx);
    await recordStudy(get('foundations.blocks'), get('foundations.design'), { topic: 'Databases', minutes: 25 }, ctx);
    await recordStudy(get('foundations.blocks'), get('foundations.design'), { topic: 'System Design', minutes: 30, design: { system: 'Rate limiter', mode: 'studied' } }, ctx);
    const maintenance = checklistGateway({ instrument: get('maintenance.daily'), ...ctx, arcStartDate: '2026-09-01' });
    await maintenance.save(['bath', 'fuel']);

    expect(await count('SLEEP_LOGGED')).toBe(before.sleep + 1);
    expect(await count('LEARNING_BLOCK_LOGGED')).toBe(before.block + 1);
    expect(await count('SYSTEM_DESIGN_LOGGED')).toBe(before.design + 1);
    expect(await count('MAINTENANCE_LOGGED')).toBe(before.maint + 1);
    expect(await count('INSTRUMENT_RECORDED')).toBe(0);
    const loaded = await maintenance.load();
    expect(loaded.done).toEqual(['bath', 'fuel']);
    expect(loaded.due).toEqual(expect.arrayContaining(['bath', 'fuel']));
  }, 60_000);
});
