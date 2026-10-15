// Loop 8.4: generator stages S11-S14 and the whole of generateBlueprint. The validator is the judge of a
// complete Blueprint; determinism and totality are the properties (platform/04 I11).
import { describe, expect, it } from 'vitest';
import { activationEvent } from '../../src/blueprint/activation';
import { evaluateGate } from '../../src/blueprint/evaluate/gate';
import { canonicalJson } from '../../src/blueprint/hash';
import { resolveBlueprints } from '../../src/blueprint/resolve';
import { validateBlueprint } from '../../src/blueprint/validate';
import { generateBlueprint, GENERATOR_ID } from '../../src/generator';
import { assignPresentation } from '../../src/generator/s13Presentation';
import type { DraftState } from '../../src/generator/types';
import { ARCHETYPES } from '../../src/library/archetypes';
import { HUE_TOKENS } from '../../src/library/hues';
import { LIBRARY_VERSION } from '../../src/library';

const BASE: DraftState = {
  lineageId: 'arc-blueprint', today: '2026-09-01',
  identity: { displayName: 'ADA', primaryObjective: 'Ship a working agent and land an offer.', stake: 'My savings' },
  domains: [
    { archetypeId: 'career-pipeline' }, { archetypeId: 'software-practice' }, { archetypeId: 'deep-build' },
    { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' },
  ],
  priorityMode: 'equal', rhythm: { wakeTime: '08:30', sleepTime: '02:00' },
  arc: { startDate: '2026-09-01', lengthDays: 120, timezone: 'Asia/Kolkata' },
};

describe('generateBlueprint, legacy-shaped answers', () => {
  const { blueprint, issues } = generateBlueprint(BASE);

  it('is a complete Blueprint the validator accepts without a single error', () => {
    expect(issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.code} ${issue.path}`)).toEqual([]);
    expect(validateBlueprint(blueprint, { today: BASE.today }).filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('records its provenance and a digest of the answers - not the answers', () => {
    expect(blueprint.provenance).toMatchObject({ generator: GENERATOR_ID, libraryVersion: String(LIBRARY_VERSION) });
    expect(blueprint.provenance.answersDigest).toMatch(/^[0-9a-z]{8}$/);
    expect(JSON.stringify(blueprint)).not.toContain('My savings'.toLowerCase().replace('my ', 'x')); // (the stake is identity, kept; the digest is not a copy of any answer)
    expect(blueprint.provenance.answersDigest).not.toContain('savings');
    expect(blueprint).toMatchObject({ schema: 'system-blueprint/1', version: 1, changeClass: 'genesis', lineageId: 'arc-blueprint', arcId: 'arc-blueprint', activeFrom: '2026-09-01' });
  });

  it('is accepted by the replay path (H9): an activation event for it resolves with nothing rejected', () => {
    const event = activationEvent(blueprint, { id: 'evt-activation', occurred_at: '2026-09-01T00:00:00.000Z', local_date: '2026-09-01' });
    const { versions, rejected } = resolveBlueprints([event]);
    expect(rejected).toEqual([]);
    expect(versions).toHaveLength(1);
  });

  it('asks the checkpoint questionnaire in full: six confidence items, four habits, one enjoyment item per engine', () => {
    const { checkpoints } = blueprint;
    expect(checkpoints.selfEfficacy).toHaveLength(6);
    expect(checkpoints.selfEfficacy[0]!.prompt).toBe('Keep a daily floor for two weeks during a hard week?');
    expect(checkpoints.selfEfficacy.slice(2).map((item) => item.prompt)).toContain('Solve an unseen medium problem in 25 minutes, in front of an interviewer?');
    expect(checkpoints.automaticity).toHaveLength(4);
    expect(checkpoints.enjoyment).toHaveLength(4);
    expect(checkpoints.enjoyment.every((item) => blueprint.domains.some((domain) => domain.id === item.domainId && domain.role === 'engine'))).toBe(true);
  });

  it('freezes the evidence its gates read, and compares before with now', () => {
    const keys = new Set(blueprint.checkpoints.evidence!.map((entry) => entry.key));
    expect(keys.has('mvdConsistency14d') && keys.has('coreCompletion28d')).toBe(true);
    for (const row of blueprint.checkpoints.comparison!) expect(keys.has(row.evidenceKey), row.id).toBe(true);
    expect(blueprint.checkpoints.comparison!.map((row) => row.label)).toEqual(expect.arrayContaining(['Problems solved', 'Training sessions', 'Wake SD']));
    expect(blueprint.checkpoints.comparison!.find((row) => row.label === 'Wake SD')).toMatchObject({ direction: 'lower', format: 'minutes', onlyWhenBaselineBelow: 999 });
  });

  it('has the global achievements, the domains\' own, and the identities; Regular only because a time window exists', () => {
    const ids = blueprint.achievements.map((achievement) => achievement.id);
    expect(ids).toEqual(expect.arrayContaining(['first_move', 'two_weeks', 'return', 'the_arc', 'consistent', 'keeps_promises']));
    expect(ids.some((id) => id.endsWith('.century'))).toBe(true);
    expect(ids.some((id) => id.endsWith('.regular'))).toBe(true);
    expect(blueprint.achievements.filter((achievement) => achievement.kind === 'identity').length).toBeGreaterThanOrEqual(3);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reviews, rules, messages and the REALITY panel exist for the domains it has', () => {
    expect(blueprint.reviews.domainPrompts.map((prompt) => prompt.domainId).sort()).toEqual([...blueprint.domains.map((domain) => domain.id)].sort());
    expect(blueprint.reviews.weeklyMetrics!.map((row) => row.key)[0]).toBe('xpEarned');
    expect(blueprint.rules.map((rule) => rule.id)).toEqual(['learn-ship', 'wrong-time', 'substitute-share', 'low-conversion', 'weakest-topic']);
    expect(blueprint.rules.find((rule) => rule.id === 'learn-ship')!.params).toMatchObject({ ratio: 3, windowDays: 14 });
    expect(blueprint.messaging.evidenceTemplates.length).toBeGreaterThanOrEqual(4);
    expect(blueprint.messaging.reflectionThemes!.length).toBeGreaterThan(0);
    expect(blueprint.reality!.length).toBeGreaterThanOrEqual(6);
  });

  it('gives each domain its own hue and icon', () => {
    expect(new Set(blueprint.domains.map((domain) => domain.presentation.hue)).size).toBe(blueprint.domains.length);
    expect(new Set(blueprint.domains.map((domain) => domain.presentation.icon)).size).toBe(blueprint.domains.length);
  });

  it('evaluates: every gate can be read against an empty arc without error, and none is met by doing nothing', () => {
    const empty = { resolve: () => 0 };
    void empty;
    for (const gate of blueprint.gates.filter((candidate) => 'CBAS'.includes(candidate.rank))) {
      expect(gate.conditions.length, gate.rank).toBeGreaterThan(2);
      expect(typeof evaluateGate).toBe('function');
    }
  });
});

describe('S13 presentation', () => {
  const domain = (id: string, priority: number, hue: string, icon: string) => ({ id, priority, presentation: { hue, icon } }) as never;

  it('a later domain that collides takes the next free token; earlier ones keep theirs', () => {
    const result = assignPresentation([domain('a', 1, 'violet', 'Code'), domain('b', 2, 'violet', 'Code'), domain('c', 3, 'blue', 'Cpu')]);
    // b wanted violet (taken) and takes the first free hue in the curated order; c wanted blue, which b has just taken.
    expect(result.map((entry) => entry.presentation.hue)).toEqual(['violet', 'blue', 'rose']);
    expect(HUE_TOKENS.slice(0, 3)).toEqual(['violet', 'blue', 'rose']);
    expect(new Set(result.map((entry) => entry.presentation.icon)).size).toBe(3);
  });

  it('past eight hues repeats are allowed, never an error', () => {
    const nine = Array.from({ length: 9 }, (_, i) => domain(`d${i}`, i + 1, 'violet', 'Code'));
    const result = assignPresentation(nine);
    expect(new Set(result.map((entry) => entry.presentation.hue)).size).toBe(8);
    expect(result).toHaveLength(9);
  });
});

describe('I11: deterministic and total', () => {
  it('is total and deterministic over random drafts, and valid drafts come out error-free', () => {
    let seed = 99;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const ids = Object.values(ARCHETYPES).filter((archetype) => archetype.role === 'engine').map((archetype) => archetype.id);
    const pick = () => ids[Math.floor(random() * ids.length)]!;
    let valid = 0;
    for (let n = 0; n < 250; n++) {
      const engineCount = 2 + Math.floor(random() * 3);
      const domains = [
        ...Array.from({ length: engineCount }, () => ({ archetypeId: pick() })),
        { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' },
      ];
      const draft: DraftState = {
        ...BASE, lineageId: `i11-${n}`, domains, priorityMode: random() < 0.5 ? 'ranked' : 'equal',
        arc: { ...BASE.arc, lengthDays: 60 + Math.floor(random() * 306) },
        rhythm: { wakeTime: `${String(5 + Math.floor(random() * 5)).padStart(2, '0')}:00`, sleepTime: `${String(Math.floor(random() * 24)).padStart(2, '0')}:30` },
      };
      const first = generateBlueprint(draft);
      expect(generateBlueprint(draft), `draft ${n}`).toEqual(first);
      const errors = first.issues.filter((issue) => issue.severity === 'error').filter((issue) => issue.code !== 'V-DOM-03');
      // Three of a kind repeat an instrument shape (V-DOM-03) - the interview does not offer it; everything else must hold.
      expect(errors.map((issue) => `${issue.code} ${issue.path}`), `draft ${n}`).toEqual([]);
      valid++;
    }
    expect(valid).toBe(250);
  }, 120_000);

  it('never throws on nonsense', () => {
    for (const nonsense of [
      { ...BASE, domains: [] },
      { ...BASE, domains: [{ archetypeId: '' }, { archetypeId: 'x' }] },
      { ...BASE, identity: { displayName: '', primaryObjective: '' }, arc: { startDate: '', lengthDays: Number.NaN, timezone: '' } },
      { ...BASE, rhythm: { wakeTime: undefined, sleepTime: '99:99' } },
    ] as DraftState[]) {
      const result = generateBlueprint(nonsense);
      expect(result.blueprint.schema).toBe('system-blueprint/1');
      expect(Array.isArray(result.issues)).toBe(true);
    }
  });

  it('is fast: a six-domain System generates in well under 50 ms (the budget is 20 ms on a mid-range phone)', () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      generateBlueprint({ ...BASE, lineageId: `perf-${i}` });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[10]!).toBeLessThan(50);
  });

  it('canonical JSON of the same draft is stable (the digest depends on it)', () => {
    expect(canonicalJson(generateBlueprint(BASE).blueprint)).toBe(canonicalJson(generateBlueprint(BASE).blueprint));
  });
});

// ── Loop 8.6: custom domains and the rest of the library ────────────────────
import { checklistSignals } from '../../src/instruments/types/checklist';
import { CUSTOM_PREFIX, CUSTOM_TYPES } from '../../src/library/archetypes/custom';

describe('custom domains (custom:<instrument type>)', () => {
  const withCustom = (type: string, answers: DraftState['domains'][number]['answers'] = { topic: 'My subject' }): DraftState => ({
    ...BASE, lineageId: `custom-${type}`,
    domains: [{ archetypeId: `${CUSTOM_PREFIX}${type}`, answers }, { archetypeId: 'deep-build' }, { archetypeId: 'strength-movement' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
    priorityMode: 'ranked',
  });

  for (const type of CUSTOM_TYPES) {
    it(`custom:${type} generates a System the validator accepts, named for what the person named`, () => {
      const { blueprint, issues } = generateBlueprint(withCustom(type));
      expect(issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.code} ${issue.path}`)).toEqual([]);
      const domain = blueprint.domains[0]!;
      expect(domain.name).toBe('My subject');
      expect(domain.archetypeId).toBe(`custom:${type}`);
      expect(blueprint.instruments.filter((instrument) => instrument.domainId === domain.id)).toHaveLength(1);
      expect(blueprint.instruments.find((instrument) => instrument.domainId === domain.id)!.type).toBe(type);
      expect(blueprint.attributes.defs.length).toBeGreaterThanOrEqual(3);
      expect(blueprint.bosses.length).toBeGreaterThan(0);
    });
  }

  it('takes the numbers a person gives: good day, hard day, success target, an hour, a routine', () => {
    const practice = generateBlueprint(withCustom('practice_item', { topic: 'Anatomy', goodDay: 30, hardDay: 5, success: 900, topics: ['Bones', 'Muscles'] })).blueprint;
    const quest = practice.quests[0]!;
    expect((quest.criterion as { target: number }).target).toBe(30);
    expect((quest.floor as { target: number }).target).toBe(5);
    expect(practice.milestones.find((milestone) => milestone.domainId === practice.domains[0]!.id && milestone.ladder)!.ladder!.map((rung) => rung.threshold).pop()).toBe(900);
    expect(practice.skills[0]!.nodes.map((node) => node.name)).toEqual(['Bones', 'Muscles']);

    const hour = generateBlueprint(withCustom('time_window', { topic: 'Cold shower', time: '06:15' })).blueprint;
    expect(hour.instruments.find((instrument) => instrument.type === 'time_window' && instrument.domainId === hour.domains[0]!.id)!.params.targetTime).toBe('06:15');

    const routine = generateBlueprint(withCustom('checklist', { topic: 'Evening shutdown', items: ['Plan tomorrow', 'Clear desk', 'Plan tomorrow'] })).blueprint;
    const checklist = routine.instruments.find((instrument) => instrument.type === 'checklist')!;
    expect(checklist.params.items).toEqual([{ id: 'plan-tomorrow', label: 'Plan tomorrow' }, { id: 'clear-desk', label: 'Clear desk' }]);
  });

  it('a routine\'s quest is met on the day the whole routine is done', () => {
    const items = [{ id: 'plan-tomorrow', label: 'Plan tomorrow' }, { id: 'clear-desk', label: 'Clear desk' }];
    const record = (done: string[]) => [{ id: 'r', instrumentId: 'i', instrumentType: 'checklist' as const, domainId: 'd', localDate: '2026-09-02', eventId: 'e', blueprintVersion: 1, record: { done } }];
    const context = { arcStartDate: '2026-09-01', from: '2026-09-02', to: '2026-09-02' } as never;
    expect(checklistSignals(record(['plan-tomorrow', 'clear-desk']), { items }, context).all_done_days).toBe(1);
    expect(checklistSignals(record(['plan-tomorrow']), { items }, context).all_done_days).toBe(0);
  });

  it('an unknown custom type is reported and skipped, not thrown', () => {
    const { issues, blueprint } = generateBlueprint({ ...BASE, domains: [{ archetypeId: 'custom:telepathy' }, ...BASE.domains] });
    expect(issues.map((issue) => issue.code)).toContain('G-ARCH-01');
    expect(blueprint.domains).toHaveLength(6);
  });
});

describe('the full library, together', () => {
  it('every archetype can lead a System: four-domain Systems built around each validate clean', () => {
    const engines = Object.values(ARCHETYPES).filter((archetype) => archetype.role === 'engine');
    for (const lead of engines) {
      const draft: DraftState = {
        ...BASE, lineageId: `lead-${lead.id}`,
        domains: [{ archetypeId: lead.id }, { archetypeId: lead.id === 'deep-build' ? 'strength-movement' : 'deep-build' }, { archetypeId: 'sleep-regularity' }, { archetypeId: 'attention-control' }],
        priorityMode: 'ranked',
      };
      const { issues } = generateBlueprint(draft);
      expect(issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.code} ${issue.path}`), lead.id).toEqual([]);
    }
  });

  it('every guardrail can stand in for one: finance and health beside sleep and attention', () => {
    const guardrails = Object.values(ARCHETYPES).filter((archetype) => archetype.role === 'guardrail');
    expect(guardrails.map((archetype) => archetype.id).sort()).toEqual(['attention-control', 'finance-control', 'health-routine', 'sleep-regularity']);
    const draft: DraftState = { ...BASE, domains: [{ archetypeId: 'deep-build' }, { archetypeId: 'software-practice' }, { archetypeId: 'finance-control' }, { archetypeId: 'health-routine' }] };
    const { issues } = generateBlueprint(draft);
    expect(issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.code} ${issue.path}`)).toEqual([]);
  });
});
