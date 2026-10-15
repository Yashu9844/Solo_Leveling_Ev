// Loops 8.5-8.6: every archetype the library ships is held to the checklist of platform/03 §25.2 - the shape a
// generator can build a System from, and the voice the System speaks in. A new archetype that skips a section,
// reads a signal its instrument does not have, or praises, fails here before it reaches a person.
import { describe, expect, it } from 'vitest';
import { INSTRUMENT_CATALOGUE, isKnownInstrumentSignal } from '../../src/instruments/catalog';
import { ARCHETYPES } from '../../src/library/archetypes';
import type { ArchetypeDef, CriterionTemplate, InstrumentTemplate, SignalTemplate } from '../../src/library/archetypes/types';
import { isHueToken } from '../../src/library/hues';
import { isIconToken } from '../../src/library/icons';
import { isValidDesignation, namesExternalOutcome } from '../../src/library/lexicon';
import { ladderThresholds } from '../../src/generator/derive';

const ALL = Object.values(ARCHETYPES);
const PLACEHOLDERS = new Set(['target', 'tolerance', 'wake', 'window']);
/** The System never praises and never predicts (design/04 §25): none of this may appear in anything it says. */
const PRAISE = /(great|awesome|amazing|crush|congrat|well done|fantastic|you got this|keep it up|!)/i;

const leaves = (criterion: CriterionTemplate): Extract<CriterionTemplate, { kind: 'signal' }>[] => (criterion.kind === 'signal' ? [criterion] : criterion.of.flatMap(leaves));

function signalsOf(archetype: ArchetypeDef): { where: string; signal: SignalTemplate }[] {
  const found: { where: string; signal: SignalTemplate }[] = [];
  const add = (where: string, signal: SignalTemplate) => found.push({ where, signal });
  if (archetype.quest) for (const leaf of leaves(archetype.quest.criterion)) add('quest', leaf);
  if (archetype.ladder) add('ladder', archetype.ladder.signal);
  for (const condition of archetype.conditions ?? []) add(`condition ${condition.id}`, condition.signal);
  for (const metric of archetype.metrics ?? []) if (!('manual' in metric.source)) add(`metric ${metric.key}`, metric.source);
  for (const term of archetype.attribute?.terms ?? []) {
    add(`attribute ${term.id}`, term.signal);
    if (term.ratioOf && term.ratioOf !== 'window_days') add(`attribute ${term.id} ratio`, term.ratioOf);
  }
  for (const achievement of archetype.achievements ?? []) for (const item of achievement.clauses) add(`achievement ${achievement.id}`, item.signal);
  if (archetype.bossAnchor?.external) add('external outcome', archetype.bossAnchor.external.source);
  return found;
}

const texts = (archetype: ArchetypeDef): string[] => [
  archetype.description, archetype.quest?.objective ?? '', archetype.quest?.realityLabel ?? '', archetype.reviewPrompt?.prompt ?? '', ...(archetype.reviewPrompt?.options ?? []),
  archetype.checkpoint?.selfEfficacy ?? '', archetype.checkpoint?.enjoyment ?? '', archetype.bossAnchor?.milestone ?? '', ...(archetype.metrics ?? []).map((metric) => metric.label),
  ...(archetype.conditions ?? []).map((condition) => condition.label), ...(archetype.achievements ?? []).map((achievement) => achievement.label),
];

describe('the library\'s archetypes', () => {
  it('batch 1 is present: the owner\'s six, exam preparation and reading', () => {
    expect(Object.keys(ARCHETYPES).sort()).toEqual(expect.arrayContaining([
      'attention-control', 'career-pipeline', 'deep-build', 'exam-prep', 'reading', 'sleep-regularity', 'software-practice', 'strength-movement',
    ]));
  });

  it('ids are unique kebab-case and each is keyed by its own id', () => {
    expect(new Set(ALL.map((archetype) => archetype.id)).size).toBe(ALL.length);
    for (const archetype of ALL) {
      expect(ARCHETYPES[archetype.id]).toBe(archetype);
      expect(archetype.id).toMatch(/^[a-z]+(-[a-z]+)*$|^custom:[a-z_]+$/);
      expect(archetype.version, archetype.id).toBeGreaterThanOrEqual(1);
    }
  });

  for (const archetype of ALL) {
    describe(archetype.id, () => {
      it('offers three designations in the System\'s register, each valid and none repeated', () => {
        expect(archetype.designations.length).toBeGreaterThanOrEqual(3);
        expect(new Set(archetype.designations).size).toBe(archetype.designations.length);
        for (const designation of archetype.designations) expect(isValidDesignation(designation), designation).toBe(true);
      });

      it('has instruments the catalogue knows, with the parameters their type requires, and unique keys', () => {
        expect(archetype.instruments.length).toBeGreaterThan(0);
        expect(new Set(archetype.instruments.map((instrument) => instrument.key)).size).toBe(archetype.instruments.length);
        for (const instrument of archetype.instruments as readonly InstrumentTemplate[]) {
          const entry = INSTRUMENT_CATALOGUE[instrument.type];
          expect(entry, instrument.type).toBeDefined();
          for (const required of entry.requiredParams) expect(Object.keys(instrument.params), `${instrument.key} needs ${required}`).toContain(required);
          for (const [key, bound] of Object.entries(entry.numericBounds)) {
            const value = instrument.params[key];
            if (typeof value === 'number') {
              expect(value, `${instrument.key}.${key}`).toBeGreaterThanOrEqual(bound.min);
              expect(value, `${instrument.key}.${key}`).toBeLessThanOrEqual(bound.max);
            }
          }
          expect(instrument.label.length).toBeGreaterThan(0);
          expect(instrument.logVerb.length).toBeGreaterThan(0);
        }
      });

      it('reads only instruments it declares, and only signals those instruments have', () => {
        const byKey = new Map(archetype.instruments.map((instrument) => [instrument.key, instrument]));
        for (const { where, signal } of signalsOf(archetype)) {
          const instrument = byKey.get(signal.instrument);
          expect(instrument, `${where} reads "${signal.instrument}"`).toBeDefined();
          expect(isKnownInstrumentSignal(instrument!.type, signal.signal), `${where}: ${instrument!.type} has no signal "${signal.signal}"`).toBe(true);
        }
      });

      it('has a quest exactly when it is a core domain, with wording that fills and a floor that can be met', () => {
        if (archetype.role === 'support') {
          expect(archetype.quest).toBeUndefined();
          return;
        }
        const quest = archetype.quest!;
        expect(quest).toBeDefined();
        for (const text of [quest.objective, quest.realityLabel]) {
          for (const match of text.matchAll(/\{(\w+)\}/g)) expect(PLACEHOLDERS.has(match[1]!), `{${match[1]}} in "${text}"`).toBe(true);
        }
        expect(quest.objective.endsWith('.')).toBe(true);
        expect(quest.realityLabel.endsWith('.')).toBe(false);
        for (const leaf of leaves(quest.criterion)) {
          if (leaf.comparator === '>=') expect(leaf.min ?? leaf.target, `${leaf.signal} minimum`).toBeGreaterThanOrEqual(1);
          expect(leaf.target).toBeGreaterThanOrEqual(leaf.min ?? 0);
        }
      });

      it('is complete for its role: engines climb a ladder with attribute, boss and metrics; guardrails keep a consistency condition', () => {
        if (archetype.role === 'engine') {
          expect(archetype.ladder, 'ladder').toBeDefined();
          expect(archetype.attribute, 'attribute').toBeDefined();
          expect(archetype.bossAnchor, 'boss anchor').toBeDefined();
          expect((archetype.metrics ?? []).some((metric) => metric.kind === 'effort'), 'an effort metric').toBe(true);
          expect(ladderThresholds(archetype.ladder!.success).every((value, i, all) => i === 0 || value > all[i - 1]!)).toBe(true);
          expect(archetype.bossAnchor!.uses.ladder || (archetype.bossAnchor!.uses.conditions ?? []).length > 0).toBe(true);
          for (const id of archetype.bossAnchor!.uses.conditions ?? []) expect((archetype.conditions ?? []).some((condition) => condition.id === id), `boss uses ${id}`).toBe(true);
        } else if (archetype.role === 'guardrail') {
          expect((archetype.conditions ?? []).length, 'a consistency condition').toBeGreaterThan(0);
          expect((archetype.metrics ?? []).length, 'a metric').toBeGreaterThan(0);
        }
        expect(archetype.checkpoint, 'checkpoint items').toBeDefined();
        expect(archetype.reviewPrompt!.options.length).toBeGreaterThanOrEqual(3);
        expect((archetype.reflectionThemes ?? []).length).toBeGreaterThan(0);
      });

      it('has a balanced attribute: sum weights total 1, a product has at most three factors', () => {
        const attribute = archetype.attribute;
        if (!attribute) return;
        if (attribute.combine === 'sum') expect(attribute.terms.reduce((sum, term) => sum + term.weight, 0)).toBeCloseTo(1, 6);
        else expect(attribute.terms.length).toBeLessThanOrEqual(3);
      });

      it('uses curated presentation tokens', () => {
        expect(isIconToken(archetype.presentation.icon)).toBe(true);
        expect(isHueToken(archetype.presentation.hue)).toBe(true);
      });

      it('speaks in the System\'s voice: no praise, no exclamation, no prediction', () => {
        for (const text of texts(archetype)) expect(text, text).not.toMatch(PRAISE);
        if (archetype.bossAnchor) {
          expect(archetype.bossAnchor.title).toBe(archetype.bossAnchor.title.toUpperCase());
          expect(archetype.bossAnchor.title.length).toBeLessThanOrEqual(24);
          // B5: a boss never names an outcome other people decide; that outcome is recorded beside it.
          expect(namesExternalOutcome(archetype.bossAnchor.title), archetype.bossAnchor.title).toBe(false);
        }
      });
    });
  }
});

describe('rule B5', () => {
  it('refuses a title that names an outcome other people decide, and allows its controlled counterpart', () => {
    for (const refused of ['FIRST CUSTOMER', 'First Interview Loop', 'OFFER ACCEPTED', 'HIRED', 'PAYING CUSTOMER', 'FIRST SALE']) expect(namesExternalOutcome(refused), refused).toBe(true);
    for (const allowed of ['INTERVIEW READY', 'THE OFFER STANDS', 'FIRST PUBLIC RELEASE', 'FIRST MOCK EXAM', 'LOGIC GAUNTLET']) expect(namesExternalOutcome(allowed), allowed).toBe(false);
  });
});
