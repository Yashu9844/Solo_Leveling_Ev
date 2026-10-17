// The assertions every persona owes (platform/04 §32.2), run by describePersona(persona). Reviewed numbers come from the
// persona file; everything else is a property of ANY generated System, which is why the same suite serves P1-P7 and X1-X4.
import { describe, expect, it } from 'vitest';
import { buildProjectionsV2 } from '../../../src/blueprint/engine/projections';
import { evaluateAttributes } from '../../../src/blueprint/evaluate/attribute';
import { evaluateBosses } from '../../../src/blueprint/evaluate/boss';
import { evaluateCriterion } from '../../../src/blueprint/evaluate/criterion';
import { recordsFromEvents, signalEnv } from '../../../src/blueprint/evaluate/env';
import { evaluateGate } from '../../../src/blueprint/evaluate/gate';
import { readModelEnv } from '../../../src/blueprint/evaluate/readModel';
import { resolveBlueprints } from '../../../src/blueprint/resolve';
import type { Criterion, SystemBlueprint } from '../../../src/blueprint/schema';
import { computeChangeClass, validateBlueprint, validateTransition } from '../../../src/blueprint/validate';
import { activationEvent } from '../../../src/blueprint/activation';
import type { SystemEvent } from '../../../src/engine/types';
import { generateBlueprint } from '../../../src/generator';
import type { DomainChoice } from '../../../src/generator/types';
import { practiceItemMastery, type PracticeItemRecord } from '../../../src/instruments/types/practiceItem';
import { studyBlockMastery, type StudyBlockRecord } from '../../../src/instruments/types/studyBlock';
import type { InstrumentRecord } from '../../../src/instruments/framework';
import { localDate } from '../../../src/engine/time';
import { checkpointDaysFor } from '../../../src/library/calibration';
import { ARCHETYPES } from '../../../src/library/archetypes';
import { namesExternalOutcome } from '../../../src/library/lexicon';
import { priorityOptions } from '../../../src/ui/presentation/plan';
import type { Persona } from '../../fixtures/personas/types';
import { personaEventLog } from './personaEventLog';

const deps = { now: () => '2027-12-31T00:00:00.000Z', newId: () => 'persona-id' };
const ISO = (start: string, offset: number): string => new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

const leaves = (criterion: Criterion): Extract<Criterion, { kind: 'signal' }>[] => (criterion.kind === 'signal' ? [criterion] : criterion.of.flatMap(leaves));

/** The words a message may never use about this persona: another System's designations, and the body and the market. */
const OWNER_WORDS = ['DSA', 'ASCENSION', 'LOGIC TRIAL', 'FORGE', 'RECONSTITUTION', 'WILL TRIAL', 'VITALITY TRIAL'];
const BODY_AND_MARKET = /\b(weight|waist|body ?fat|kilograms|interview offer|hired|customers?|revenue|forecast|you will|will reach|projected)\b/i;

/** Voice-pack lines that name a designation of the owner's System. Each carries `requiresDesignation` (12.2), so a System without it never hears them. */
export const KNOWN_OWNER_WORDING_IN_VOICE_PACK = ['morning-zero-004'];

export function describePersona(persona: Persona): void {
  describe(`${persona.id} - ${persona.label}`, () => {
    const generated = generateBlueprint(persona.draft);
    const blueprint = generated.blueprint;
    const events = personaEventLog(blueprint, persona.seed, persona.profile);
    const built = buildProjectionsV2(events, deps);
    const lastDate = events.filter((event) => event.type === 'APP_OPENED').at(-1)!.local_date;
    const readEnv = (asOf: string, upTo = events) => readModelEnv({ blueprint, events: upTo.filter((event) => event.local_date <= asOf), checkpoints: [], asOf });

    it('onboarding configuration: the answers become a valid System with no error, on the arc they asked for', () => {
      expect(generated.issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.code} ${issue.path}`)).toEqual([]);
      expect(validateBlueprint(blueprint, { today: persona.draft.today }).filter((issue) => issue.severity === 'error')).toEqual([]);
      expect(blueprint.arc.lengthDays).toBe(persona.expect.arcLength);
      const asked = persona.draft.domains.map((choice: DomainChoice) => choice.archetypeId);
      expect(blueprint.domains.map((domain) => domain.archetypeId)).toEqual(asked);
    });

    it('time (I19): every event\'s local date is the local date of its own instant, in the arc\'s zone and at its day boundary', () => {
      for (const event of events) {
        expect(localDate(event.occurred_at, blueprint.arc.timezone, blueprint.arc.dayBoundaryHour), `${event.type} ${event.id}`).toBe(event.local_date);
      }
      const opened = events.filter((event) => event.type === 'APP_OPENED').map((event) => event.local_date);
      expect(new Set(opened).size).toBe(opened.length);
    });

    it('generated domains: roles, designations and channel caps are the reviewed ones', () => {
      expect(blueprint.domains.map((domain) => `${domain.role}:${domain.designation}`)).toEqual(persona.expect.domains);
      expect(blueprint.domains.map((domain) => domain.channel.cap)).toEqual(persona.expect.caps);
      expect(new Set(blueprint.domains.map((domain) => domain.designation)).size).toBe(blueprint.domains.length);
    });

    it('generated quests: criteria and floors read the domain\'s own instruments, XP is the reviewed split of 500', () => {
      const core = blueprint.quests.filter((quest) => quest.type === 'core');
      expect(core.map((quest) => quest.xp)).toEqual(persona.expect.coreXp);
      expect(core.reduce((sum, quest) => sum + quest.xp, 0)).toBe(500);
      for (const quest of core) {
        const own = new Set(blueprint.domains.find((domain) => domain.id === quest.domainId)!.instrumentIds);
        for (const leaf of [...leaves(quest.criterion), ...leaves(quest.floor)]) expect(own.has(leaf.instrumentId), `${quest.id} reads ${leaf.instrumentId}`).toBe(true);
        for (const leaf of leaves(quest.floor)) expect(leaf.target, `${quest.id} floor`).toBeGreaterThanOrEqual(1);
      }
    });

    it('XP: the first scripted week is the reviewed number; no day beats the cap; every completed quest paid its price', () => {
      const week = buildProjectionsV2(personaEventLog(blueprint, persona.seed, { kind: 'steady', days: 7 }), deps);
      expect(week.ledger.reduce((sum, row) => sum + row.amount, 0)).toBe(persona.expect.firstWeekXp);
      const perDay = new Map<string, number>();
      for (const row of built.ledger) perDay.set(row.local_date, (perDay.get(row.local_date) ?? 0) + row.amount);
      const price = new Map(blueprint.quests.map((quest) => [`${blueprint.arcId}::${quest.id}`, quest.xp]));
      for (const day of built.dayRollups) {
        const paid = built.instances.filter((instance) => instance.local_date === day.local_date && instance.state === 'complete').reduce((sum, instance) => sum + (price.get(instance.template_id) ?? 0), 0);
        expect(perDay.get(day.local_date) ?? 0, day.local_date).toBeGreaterThanOrEqual(paid);
        expect(day.xp_earned).toBeLessThanOrEqual(blueprint.progression.dailyCap + 40 + 500 + 400);
      }
    });

    it('daily progress: nothing done is 0, everything done is 1, and a quest part-done is between', () => {
      const day = ISO(blueprint.arc.startDate, 3);
      for (const quest of blueprint.quests.filter((candidate) => candidate.type === 'core')) {
        expect(evaluateCriterion(quest.criterion, signalEnv(blueprint, new Map(), day)).progress, quest.id).toBe(0);
      }
      const upToDay = events.filter((event) => event.local_date <= day);
      const records = recordsFromEvents(upToDay);
      const completedToday = new Set(upToDay.filter((event) => event.type === 'QUEST_COMPLETED' && event.local_date === day).map((event) => String(event.payload.questKey)));
      for (const quest of blueprint.quests.filter((candidate) => candidate.type === 'core')) {
        const result = evaluateCriterion(quest.criterion, signalEnv(blueprint, records, day));
        if (completedToday.has(quest.id)) expect(result.progress, quest.id).toBe(1);
        else expect(result.progress, quest.id).toBeLessThan(1);
      }
      // Half of the first count-like leaf's target is half the meter.
      const target = leaves(blueprint.quests[0]!.criterion)[0]!;
      expect(target.target).toBeGreaterThanOrEqual(1);
    });

    it('attributes: three to six, each explained by its components, each in range, and DISCIPLINE has moved after four weeks', () => {
      expect(blueprint.attributes.defs.map((definition) => definition.id)).toEqual(persona.expect.attributes);
      const values = evaluateAttributes(blueprint, readEnv(ISO(blueprint.arc.startDate, 27)));
      expect(values.length).toBeGreaterThanOrEqual(3);
      expect(values.length).toBeLessThanOrEqual(6);
      for (const value of values) {
        expect(value.value, value.attribute).toBeGreaterThanOrEqual(0);
        expect(value.value, value.attribute).toBeLessThanOrEqual(100);
        expect(Object.values(value.components).reduce((sum, part) => sum + part, 0) * 100, value.attribute).toBeCloseTo(value.value, 6);
      }
      expect(values.find((value) => value.attribute === 'DISCIPLINE')!.value).toBeGreaterThan(0);
    });

    it('skills: the reviewed trees, and under the scripted log a topic moves off unseen', () => {
      expect(blueprint.skills.map((tree) => tree.nodes.length)).toEqual(persona.expect.skillTreeSizes);
      const records = recordsFromEvents(events);
      for (const tree of blueprint.skills) {
        const list = records.get(tree.instrumentId) ?? [];
        const states = tree.nodes.map((node) => (tree.policy.kind === 'practice_rate'
          ? practiceItemMastery(node.id, list as InstrumentRecord<PracticeItemRecord>[])
          : studyBlockMastery(node.id, list as InstrumentRecord<StudyBlockRecord>[], tree.policy)));
        expect(states.some((state) => state !== 'unseen'), tree.id).toBe(true);
      }
    });

    it('evidence: every gate from C upward holds something a stranger could check (E1), and none reads an outcome others decide (E2)', () => {
      for (const gate of blueprint.gates.filter((candidate) => 'CBAS'.includes(candidate.rank))) {
        expect(gate.conditions.some((condition) => condition.verifiability === 'public_url' || condition.verifiability === 'recorded'), gate.rank).toBe(true);
      }
      const unscored = blueprint.metrics.filter((metric) => metric.kind === 'external' || metric.kind === 'body').map((metric) => metric.id);
      expect(unscored).toEqual(persona.expect.unscoredMetrics);
      const scored = JSON.stringify([blueprint.gates, blueprint.bosses, blueprint.attributes, blueprint.messaging, blueprint.checkpoints.comparison]);
      for (const id of unscored) expect(scored, id).not.toContain(id);
    });

    it('checkpoints: the schedule is the length\'s table; comparison rows are headline evidence only', () => {
      expect(blueprint.progression.checkpointDays).toEqual(persona.expect.checkpointDays);
      expect(blueprint.progression.checkpointDays).toEqual(checkpointDaysFor(persona.expect.arcLength));
      const evidenceKeys = new Set(blueprint.checkpoints.evidence!.map((entry) => entry.key));
      for (const row of blueprint.checkpoints.comparison!) expect(evidenceKeys.has(row.evidenceKey), row.id).toBe(true);
      expect(blueprint.checkpoints.selfEfficacy).toHaveLength(6);
    });

    it('bosses: anchored, opening a week before the checkpoint that needs them, titled without naming an outside outcome (B5)', () => {
      expect(blueprint.bosses.map((boss) => boss.title)).toEqual(persona.expect.bossTitles);
      const milestones = new Set(blueprint.milestones.map((milestone) => milestone.id));
      for (const boss of blueprint.bosses) {
        expect(milestones.has(boss.anchorMilestoneId), boss.id).toBe(true);
        expect(namesExternalOutcome(boss.title), boss.title).toBe(false);
        const gated = boss.gatesRank ? blueprint.gates.find((gate) => gate.rank === boss.gatesRank)!.day : undefined;
        if (gated !== undefined) expect(boss.windowStartDay, boss.id).toBeLessThanOrEqual(gated - 7);
      }
      const statuses = evaluateBosses(blueprint.bosses, readEnv(lastDate), events);
      expect(statuses).toHaveLength(blueprint.bosses.length);
    });

    it('reviews: the priority options are exactly the engine domains, in priority order; every domain has a prompt', () => {
      const engineQuests = blueprint.domains.filter((domain) => domain.role === 'engine').sort((a, b) => a.priority - b.priority).map((domain) => domain.coreQuestId);
      expect(priorityOptions(blueprint).map((option) => option.questId)).toEqual(engineQuests);
      expect(blueprint.reviews.domainPrompts.map((prompt) => prompt.domainId).sort()).toEqual(blueprint.domains.map((domain) => domain.id).sort());
    });

    it('messages (I20): its templates name nothing of another System and nothing of the body or the market', () => {
      const labels = JSON.stringify(blueprint.messaging.evidenceTemplates.map((template) => template.template));
      for (const word of OWNER_WORDS) {
        if (blueprint.domains.some((domain) => domain.designation === word)) continue;
        expect(labels.toUpperCase(), word).not.toContain(word);
      }
      for (const template of blueprint.messaging.evidenceTemplates) expect(template.template, template.id).not.toMatch(BODY_AND_MARKET);
      for (const template of blueprint.messaging.evidenceTemplates) {
        expect(template.signal, template.id).toBeDefined();
        expect(blueprint.metrics.filter((metric) => metric.kind === 'body' || metric.kind === 'external').some((metric) => JSON.stringify(template.signal).includes(metric.id))).toBe(false);
      }
    });

    it('historical integrity: an operational amendment at Day 10 and a structural one at the first checkpoint change nothing before they begin (I3, I4, I7, I18)', async () => {
      const start = blueprint.arc.startDate;
      const opDay = ISO(start, 9); // Day 10
      const firstCheckpoint = ISO(start, blueprint.progression.checkpointDays[0]! - 1);

      const v2 = structuredClone(blueprint);
      v2.version = 2;
      v2.activeFrom = ISO(start, 10);
      // An operational amendment (02 §19.2): a daily target nudged within a quarter.
      const nudged = v2.quests.find((quest) => quest.type === 'core')!;
      const bump = (criterion: Criterion): Criterion => (criterion.kind === 'signal' ? { ...criterion, target: criterion.target + 1 } : { ...criterion, of: criterion.of.map(bump) });
      nudged.criterion = bump(nudged.criterion);
      v2.changeClass = await computeChangeClass(blueprint, v2);
      expect(v2.changeClass).toBe('operational');
      expect((await validateTransition(blueprint, v2, { today: opDay, arcDay: 10, nextCheckpointDay: blueprint.progression.checkpointDays[0]! })).filter((issue) => issue.severity === 'error')).toEqual([]);

      const insertAfter = (log: SystemEvent[], next: SystemBlueprint, date: string): SystemEvent[] => {
        const index = log.map((event) => event.local_date <= date).lastIndexOf(true);
        const anchor = log[index]!;
        const activation = activationEvent(next, { id: `${anchor.id}~`, occurred_at: anchor.occurred_at, local_date: date });
        return [...log.slice(0, index + 1), activation, ...log.slice(index + 1)];
      };

      // A structural amendment: one more kind of domain, with the same lineage so every existing id stays.
      const present = new Set(persona.draft.domains.map((choice) => choice.archetypeId));
      const extra = Object.values(ARCHETYPES).find((archetype) => archetype.role === 'engine' && !present.has(archetype.id) && ['writing', 'reading', 'public-speaking', 'creative-practice'].includes(archetype.id))!;
      const widenedResult = generateBlueprint({ ...persona.draft, domains: [...persona.draft.domains, { archetypeId: extra.id }] });
      if (widenedResult.issues.some((issue) => issue.code === 'V-DOM-01' && issue.severity === 'error')) {
        // A System at its upper bound (X2) cannot be widened at all: the validator refuses it, and only the operational amendment is left to check.
        expect(blueprint.domains.filter((domain) => domain.role !== 'support')).toHaveLength(8);
        const onlyV2 = insertAfter(events, v2, opDay);
        const afterV2 = buildProjectionsV2(onlyV2, deps);
        const beforeV2 = buildProjectionsV2(events, deps);
        const rowsTo = (rows: { local_date: string }[], date: string) => JSON.stringify(rows.filter((row) => row.local_date <= date));
        expect(rowsTo(afterV2.ledger, opDay)).toBe(rowsTo(beforeV2.ledger, opDay));
        expect(rowsTo(afterV2.instances, opDay)).toBe(rowsTo(beforeV2.instances, opDay));
        return;
      }
      const widened = widenedResult.blueprint;
      const v3 = structuredClone(widened);
      v3.version = 3;
      v3.activeFrom = ISO(start, blueprint.progression.checkpointDays[0]!);
      v3.changeClass = await computeChangeClass(v2, v3);
      expect(v3.changeClass).toBe('structural');

      const amended = insertAfter(insertAfter(events, v2, opDay), v3, firstCheckpoint);

      // I4: configuration never mutates a past event - the log before each activation is a byte-for-byte prefix.
      const firstActivation = amended.findIndex((event) => event.type === 'BLUEPRINT_ACTIVATED' && (event.payload.blueprint as SystemBlueprint).version === 2);
      expect(JSON.stringify(amended.slice(0, firstActivation))).toBe(JSON.stringify(events.slice(0, firstActivation)));
      expect(resolveBlueprints(amended).rejected).toEqual([]);

      // I3/I7: every projection row dated before the amendment takes effect is unchanged.
      const before = buildProjectionsV2(events, deps);
      const after = buildProjectionsV2(amended, deps);
      const upTo = (date: string) => <T extends { local_date: string }>(rows: T[]) => JSON.stringify(rows.filter((row) => row.local_date <= date));
      expect(upTo(opDay)(after.ledger)).toBe(upTo(opDay)(before.ledger));
      expect(upTo(opDay)(after.instances)).toBe(upTo(opDay)(before.instances));
      expect(upTo(opDay)(after.dayRollups)).toBe(upTo(opDay)(before.dayRollups));
      // Between the two activations v2 is in force, so its rows say so; nothing else about them differs from the unamended run.
      const unstamped = (rows: { local_date: string }[], date: string) => JSON.stringify(rows.filter((row) => row.local_date <= date).map((row) => ({ ...row, blueprint_version: undefined })));
      expect(unstamped(after.ledger, firstCheckpoint)).toBe(unstamped(before.ledger, firstCheckpoint));
      const newQuest = v3.quests.find((quest) => !blueprint.quests.some((old) => old.id === quest.id))!;
      const newTemplate = `${blueprint.arcId}::${newQuest.id}`;
      expect(after.instances.filter((instance) => instance.template_id === newTemplate && instance.local_date <= firstCheckpoint)).toEqual([]);
      expect(after.instances.some((instance) => instance.template_id === newTemplate && instance.local_date > firstCheckpoint)).toBe(true);
      // I18: a continuing quest keeps its instance ids across the versions.
      const ids = (rows: typeof before.instances) => new Set(rows.filter((row) => row.template_id.endsWith(blueprint.quests[0]!.id)).map((row) => row.id));
      for (const id of ids(before.instances)) expect(ids(after.instances).has(id)).toBe(true);
    });

    it('body and outside outcomes never move XP, gates or rank: erasing every manual measurement changes nothing scored (I6)', () => {
      const without = events.filter((event) => event.type !== 'METRIC_RECORDED');
      // A persona with no manual measurement (P7) has nothing to erase, and the equalities below hold trivially.
      if (blueprint.metrics.some((metric) => 'manual' in metric.source)) expect(without.length).toBeLessThan(events.length);
      expect(JSON.stringify(buildProjectionsV2(without, deps).ledger)).toBe(JSON.stringify(built.ledger));
      const env = readEnv(lastDate);
      const envWithout = readEnv(lastDate, without);
      for (const gate of blueprint.gates) expect(evaluateGate(gate, 'E', envWithout)).toEqual(evaluateGate(gate, 'E', env));
      expect(evaluateAttributes(blueprint, envWithout)).toEqual(evaluateAttributes(blueprint, env));
    });
  });
}
