// Loop 13.2: the weekly review of a generated System - rules, one proposal per instrument, the one correlation, the evidence nudge. All from
// its own Blueprint, saying nothing that is not in it.
import 'fake-indexeddb/auto';
import { v7 as uuidv7 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { correlationInsight, evidenceNudge, generalizedRules, weeklyMeasure, weeklyOffers } from '../../src/blueprint/evaluate/weeklyGeneral';
import { recordsFromEvents } from '../../src/blueprint/evaluate/env';
import { evaluateWeeklyReview } from '../../src/blueprint/evaluate/weeklyReview';
import { instrumentIdemKey } from '../../src/blueprint/events';
import { db } from '../../src/db/db';
import { getAllEvents } from '../../src/db/events';
import { engineConfigFor } from '../../src/engine/config';
import type { EngineDeps, SystemEvent } from '../../src/engine/types';
import { setEngineV2Override } from '../../src/flags';
import { generateBlueprint } from '../../src/generator';
import { activateNewSystem } from '../../src/store/activation';
import { getActiveArc } from '../../src/store/arc';
import { recordInstrument } from '../../src/store/instruments';
import { acceptWeeklyQuest, getActiveWeeklyQuest } from '../../src/store/weeklyQuest';
import { getWeeklyReview } from '../../src/store/weeklyReview';
import { p1 } from '../fixtures/personas/p1';
import { p2 } from '../fixtures/personas/p2';
import { p3 } from '../fixtures/personas/p3';
import { p4 } from '../fixtures/personas/p4';
import { p5 } from '../fixtures/personas/p5';
import { p6 } from '../fixtures/personas/p6';
import { p7 } from '../fixtures/personas/p7';
import { personaEventLog } from './support/personaEventLog';

const FOREIGN = /\b(weight|waist|body ?fat|kilograms|hired|customers?|revenue|forecast|you will|will reach|projected|DSA|deployment|resume|applications?)\b/i;
const day = (offset: number, start = '2026-09-01'): string => new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

const draft = {
  lineageId: 'weekly', today: '2026-09-01', identity: { displayName: 'ADA', primaryObjective: 'x' },
  domains: [{ archetypeId: 'deep-build' }, { archetypeId: 'reading' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }],
  rhythm: { wakeTime: '07:00', sleepTime: '23:00' }, arc: { startDate: '2026-09-01', lengthDays: 90, timezone: 'Asia/Kolkata' },
};
const { blueprint } = generateBlueprint(draft);
const build = blueprint.domains.find((domain) => domain.archetypeId === 'deep-build')!;
const durationId = build.instrumentIds.find((id) => blueprint.instruments.find((instrument) => instrument.id === id)?.type === 'duration')!;

let counter = 0;
function record(instrumentId: string, offset: number, payload: Record<string, unknown>, type = 'duration'): SystemEvent {
  const id = `w-${String(counter++).padStart(6, '0')}`;
  return {
    id, type: 'INSTRUMENT_RECORDED', occurred_at: `${day(offset)}T05:00:00Z`, local_date: day(offset), arc_id: blueprint.arcId, source: 'user', idem_key: instrumentIdemKey(id), schema_v: 1,
    payload: { instrumentId, instrumentType: type, domainId: blueprint.instruments.find((instrument) => instrument.id === instrumentId)!.domainId, blueprintVersion: 1, record: payload },
  };
}
const sessions = (mode: string, count: number, from = 0): SystemEvent[] => Array.from({ length: count }, (_, i) => record(durationId, from + i, { minutes: 45, mode, projectKey: 'p' }));
const recordsOf = (events: SystemEvent[]) => recordsFromEvents(events);

describe('rules, from the System\'s own rule list', () => {
  const rule = blueprint.rules.find((candidate) => candidate.kind === 'MODE_RATIO')!;

  it('the generator wrote a learn:ship rule for the build duration', () => {
    expect(rule.params).toMatchObject({ instrumentId: durationId, ratio: 3, windowDays: 14 });
  });

  it('fires on learning that never ships, names the instrument and the target, and not before there is a pattern', () => {
    const fired = generalizedRules(blueprint, [], recordsOf(sessions('LEARN', 6)), day(6));
    expect(fired).toHaveLength(1);
    expect(fired[0]!.message).toBe('Build sessions: 6 learn to 0 ship in 14 days. This week’s target: ship only.');
    expect(generalizedRules(blueprint, [], recordsOf(sessions('LEARN', 3)), day(3))).toEqual([]);
  });

  it('is quiet when shipping keeps up, and when the learning is older than the window', () => {
    expect(generalizedRules(blueprint, [], recordsOf([...sessions('LEARN', 6), ...sessions('SHIP', 3, 6)]), day(9))).toEqual([]);
    expect(generalizedRules(blueprint, [], recordsOf(sessions('LEARN', 6)), day(40))).toEqual([]);
  });

  it('a rule that is switched off says nothing', () => {
    const off = { ...blueprint, rules: blueprint.rules.map((candidate) => ({ ...candidate, enabled: false })) };
    expect(generalizedRules(off, [], recordsOf(sessions('LEARN', 6)), day(6))).toEqual([]);
  });

  it('wrong-time recoveries are counted over the window', () => {
    const recovered = (offset: number): SystemEvent => ({ id: `r${offset}`, type: 'QUEST_RECOVERED', occurred_at: `${day(offset)}T05:00:00Z`, local_date: day(offset), arc_id: blueprint.arcId, source: 'user', idem_key: `r${offset}`, schema_v: 1, payload: { localDate: day(offset - 1), reason: 'wrong_time', questKey: 'x' } });
    expect(generalizedRules(blueprint, [recovered(2), recovered(4), recovered(6)], new Map(), day(8)).map((proposal) => proposal.message)).toEqual(['Wrong time, 3 of the last 14 days. Worth moving the slot.']);
    expect(generalizedRules(blueprint, [recovered(2), recovered(4)], new Map(), day(8))).toEqual([]);
  });
});

describe('weekly quest proposals: one per instrument that can propose', () => {
  it('a duration proposes a stretch of last week, rounded to a quarter hour; with no history, three default blocks', () => {
    const none = weeklyOffers(blueprint, new Map(), day(6)).find((offer) => offer.instrumentId === durationId)!;
    expect(none).toMatchObject({ measure: 'minutes', target: 135, description: '135 minutes of build sessions this week' });
    const some = weeklyOffers(blueprint, recordsOf(sessions('SHIP', 4)), day(6)).find((offer) => offer.instrumentId === durationId)!;
    expect(some).toMatchObject({ measure: 'minutes', target: 225 });
  });

  it('measures minutes or records, leaving revisits out', () => {
    const recs = [...recordsOf([record(durationId, 0, { minutes: 30 }), record(durationId, 1, { minutes: 50 })]).values()].flat();
    expect(weeklyMeasure(recs, 'minutes')).toBe(80);
    expect(weeklyMeasure(recs, 'records')).toBe(2);
    expect(weeklyMeasure([{ ...recs[0]!, record: { minutes: 30, isRevisit: true } }], 'records')).toBe(0);
  });

  for (const persona of [p1, p2, p3, p4, p5, p6, p7]) {
    it(`${persona.id}: every instrument that can propose does, once, in the System's own words`, () => {
      const { blueprint: made } = generateBlueprint(persona.draft);
      const events = personaEventLog(made, persona.seed, { kind: 'steady', days: 21 });
      const offers = weeklyOffers(made, recordsFromEvents(events), day(20, made.arc.startDate));
      expect(offers.length, persona.id).toBeGreaterThan(0);
      expect(new Set(offers.map((offer) => offer.instrumentId)).size).toBe(offers.length);
      const labels = made.instruments.map((instrument) => instrument.label.toLowerCase());
      for (const offer of offers) {
        expect(made.instruments.some((instrument) => instrument.id === offer.instrumentId), offer.id).toBe(true);
        expect(offer.target, offer.id).toBeGreaterThan(0);
        expect(offer.description, offer.id).not.toMatch(FOREIGN);
        expect(labels.some((label) => offer.description.toLowerCase().includes(label)), offer.description).toBe(true);
      }
    });
  }

  it('a resume-only artifact proposes nothing - a resume version is not shipped work', () => {
    const career = generateBlueprint({ ...draft, lineageId: 'career', domains: [{ archetypeId: 'career-pipeline' }, { archetypeId: 'sleep-regularity' }] }).blueprint;
    const resumes = career.instruments.find((instrument) => instrument.type === 'artifact');
    expect(resumes).toBeDefined();
    expect(weeklyOffers(career, new Map(), '2026-09-07').some((offer) => offer.instrumentId === resumes!.id)).toBe(false);
  });
});

describe('the evidence nudge', () => {
  const shipped = blueprint.instruments.find((instrument) => instrument.domainId === build.id && instrument.type === 'artifact')!;

  it('counts what shipped this week and names the domain\'s own evidence surface', () => {
    const events = [0, 2, 4].map((offset) => record(shipped.id, offset, { kind: (shipped.params.kinds as string[])[0], url: 'https://example.org' }, 'artifact'));
    expect(evidenceNudge(blueprint, recordsOf(events), day(6))).toBe('You shipped 3 artifacts this week. Does your portfolio say so?');
    expect(evidenceNudge(blueprint, recordsOf(events.slice(0, 1)), day(6))).toBe('You shipped 1 artifact this week. Does your portfolio say so?');
  });

  it('says nothing when nothing shipped, or when no domain declares an evidence surface', () => {
    expect(evidenceNudge(blueprint, new Map(), day(6))).toBeNull();
    const bare = { ...blueprint, domains: blueprint.domains.map((domain) => ({ ...domain, evidenceSurface: undefined })) };
    const events = [record(shipped.id, 0, { kind: (shipped.params.kinds as string[])[0], url: 'https://example.org' }, 'artifact')];
    expect(evidenceNudge(bare, recordsOf(events), day(6))).toBeNull();
  });
});

describe('the one correlation', () => {
  it('is the guardrail effect on the lead engine when the person\'s days show one, and nothing otherwise', () => {
    expect(correlationInsight(blueprint, [], day(30))).toBeNull();
    for (const persona of [p1, p3]) {
      const { blueprint: made } = generateBlueprint(persona.draft);
      const events = personaEventLog(made, persona.seed, { kind: 'steady', days: 60 });
      const text = correlationInsight(made, events, day(59, made.arc.startDate));
      if (text) {
        expect(text).toMatch(/done the day after a kept/);
        expect(text).not.toMatch(FOREIGN);
      }
    }
  });
});

describe('the report', () => {
  it('a generated System\'s review carries its own rows - the labels of its Blueprint, real numbers, no NaN - and the owner\'s carries none', () => {
    const { blueprint: made } = generateBlueprint(p1.draft);
    const events = personaEventLog(made, p1.seed, { kind: 'steady', days: 30 });
    const review = evaluateWeeklyReview(made, { events, checkpoints: [] }, day(20, made.arc.startDate));
    expect(review.generated).toBeDefined();
    expect(review.generated!.rows.map((row) => row.label)).toEqual((made.reviews.weeklyMetrics ?? []).map((row) => row.label));
    for (const row of review.generated!.rows) { expect(Number.isFinite(row.thisWeek), row.key).toBe(true); expect(Number.isFinite(row.lastWeek), row.key).toBe(true); }
    expect(review.generated!.offers.length).toBeGreaterThan(0);
    expect(review.sleepDsaCorrelation).toBeNull();
    for (const proposal of review.review.proposals) expect(proposal.message).not.toMatch(FOREIGN);
    for (const label of Object.values(review.generated!.attributeLabels)) expect(label.length).toBeGreaterThan(0);
  });
});

describe('accept one, do it, complete it', () => {
  const TODAY = '2026-09-01';
  const NOW = `${TODAY}T14:00:00Z`;
  const deps: EngineDeps = { now: () => NOW, newId: () => uuidv7() };
  const TABLES = [db.event, db.arc, db.checkpoint, db.profile, db.blueprint_version, db.quest_template, db.quest_instance, db.xp_ledger, db.day_rollup, db.player_state, db.weekly_quest, db.instrument_record];

  beforeEach(async () => {
    setEngineV2Override(true);
    await db.transaction('rw', TABLES, async () => { for (const table of TABLES) await table.clear(); });
    await activateNewSystem({ blueprint: generateBlueprint({ ...draft, lineageId: uuidv7() }).blueprint, name: 'Ada', baseline: {} }, deps);
  });
  afterEach(() => setEngineV2Override(undefined));

  it('the review offers one quest per proposing instrument; accepted, its progress is read from the instrument and it pays once', async () => {
    const arc = (await getActiveArc())!;
    const config = engineConfigFor(arc);
    const report = await getWeeklyReview(TODAY, config, deps);
    expect(report.generated).toBeDefined();
    expect(report.weeklyQuestProposal).toBeNull();
    expect(report.weeklyQuestOffers!.length).toBeGreaterThan(1);
    expect(new Set(report.weeklyQuestOffers!.map((offer) => offer.instrumentId)).size).toBe(report.weeklyQuestOffers!.length);

    const live = (await db.blueprint_version.toArray())[0]!.blueprint;
    const durationOf = live.instruments.find((instrument) => instrument.type === 'duration' && instrument.domainId === live.domains.find((domain) => domain.archetypeId === 'deep-build')!.id)!;
    const offer = report.weeklyQuestOffers!.find((candidate) => candidate.instrumentId === durationOf.id)!;
    expect(offer.kind).toBe('instrument_volume');
    expect(await acceptWeeklyQuest(TODAY, offer, deps)).not.toBeNull();
    // At most one: a second acceptance is refused.
    expect(await acceptWeeklyQuest(TODAY, report.weeklyQuestOffers!.find((candidate) => candidate.instrumentId !== durationOf.id)!, deps)).toBeNull();

    let active = await getActiveWeeklyQuest(TODAY, arc.id, config, deps);
    expect(active).toMatchObject({ progress: 0, justCompleted: false });
    let logged = 0;
    while (logged < offer.target) { await recordInstrument(durationOf.id, { minutes: 60, mode: 'SHIP', projectKey: 'p' }, TODAY, deps); logged += 60; }
    active = await getActiveWeeklyQuest(TODAY, arc.id, config, deps);
    expect(active).toMatchObject({ justCompleted: true });
    expect(active!.progress).toBeGreaterThanOrEqual(offer.target);
    expect(active!.row.xp).toBe(config.weeklyQuestXp);

    // Claimed once, however often it is read.
    await getActiveWeeklyQuest(TODAY, arc.id, config, deps);
    expect((await getAllEvents()).filter((event) => event.type === 'WEEKLY_QUEST_COMPLETED')).toHaveLength(1);
  });
});
