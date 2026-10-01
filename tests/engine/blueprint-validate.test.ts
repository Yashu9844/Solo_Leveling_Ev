import { describe, expect, it } from 'vitest';
import { validateBlueprint } from '../../src/blueprint/validate';
import type { SystemBlueprint } from '../../src/blueprint/schema';

function fixture(): SystemBlueprint {
  const domains = [
    ['career', 'engine', 'ASCENSION'], ['logic', 'engine', 'LOGIC TRIAL'], ['forge', 'engine', 'FORGE'], ['sleep', 'guardrail', 'RECONSTITUTION'], ['care', 'support', 'MAINTENANCE'],
  ] as const;
  return {
    schema: 'system-blueprint/1', lineageId: 'arc', version: 1, arcId: 'arc', activeFrom: '2026-10-02', changeClass: 'genesis', provenance: { generator: 'test', libraryVersion: 'test' }, identity: { displayName: 'SYSTEM', primaryObjective: 'Build' },
    arc: { lengthDays: 120, startDate: '2026-10-02', endDate: '2027-01-29', timezone: 'Asia/Kolkata', dayBoundaryHour: 4, dayCloseHour: 3, wakeTime: '08:30', sleepTime: '02:00' },
    progression: { dailyCoreBudget: 500, dailyCap: 700, engineShare: .8, mvdXp: 35, recoveryXp: 40, bossXp: 500, weeklyQuestXp: 200, level: { base: 200, coefficient: 84, exponent: .98, roundTo: 10 }, grace: { daysPer28: 4 }, reducedMode: { triggerMisses: 2, exitDays: 2, collapsesQuests: false }, attributeWindowDays: 28, checkpointDays: [14, 30, 60, 90, 120], rankSchedule: [{ day: 14, rank: 'D' }] },
    domains: domains.map(([id, role, designation]) => ({ id, role, name: id, designation, description: 'One sentence.', priority: 1, presentation: { icon: 'x', hue: 'x' }, instrumentIds: [`${id}.log`], coreQuestId: role === 'support' ? undefined : `${id}.quest`, channel: { id, cap: 100 }, reviewPromptIds: [] })),
    instruments: [
      { id: 'career.log', domainId: 'career', type: 'duration', label: 'Career', logVerb: 'Log', params: {}, controllability: 'effort', eventBinding: { kind: 'generic' } },
      { id: 'logic.log', domainId: 'logic', type: 'practice_item', label: 'Logic', logVerb: 'Log', params: { topics: [], difficultyScale: [], outcomes: [] }, controllability: 'effort', eventBinding: { kind: 'generic' } },
      { id: 'forge.log', domainId: 'forge', type: 'artifact', label: 'Forge', logVerb: 'Log', params: { kinds: [] }, controllability: 'effort', eventBinding: { kind: 'generic' } },
      { id: 'sleep.log', domainId: 'sleep', type: 'time_window', label: 'Sleep', logVerb: 'Log', params: { targetTime: '08:30', toleranceMinutes: 30 }, controllability: 'effort', eventBinding: { kind: 'generic' } },
      { id: 'care.log', domainId: 'care', type: 'checklist', label: 'Care', logVerb: 'Log', params: { items: [] }, controllability: 'effort', eventBinding: { kind: 'generic' } },
    ],
    quests: domains.filter(([, role]) => role !== 'support').map(([id]) => ({ id: `${id}.quest`, domainId: id, type: 'core', designation: id.toUpperCase(), objective: 'Do the work.', criterion: { kind: 'signal', instrumentId: `${id}.log`, signal: id === 'sleep' ? 'hit' : id === 'logic' ? 'count' : id === 'forge' ? 'count' : 'minutes', comparator: '>=', target: 1 }, floor: { kind: 'signal', instrumentId: `${id}.log`, signal: id === 'sleep' ? 'hit' : id === 'logic' ? 'count' : id === 'forge' ? 'count' : 'minutes', comparator: '>=', target: 1 }, xp: 125, bonus: [], schedule: { kind: 'daily' }, evidenceMode: 'logged_only', recoverable: false, intentionAllowed: true })),
    metrics: [], skills: [], attributes: { groups: [], defs: [] }, milestones: [], gates: [], bosses: [], checkpoints: { selfEfficacy: [], automaticity: [], enjoyment: [] }, achievements: [], reviews: { domainPrompts: [] }, rules: [], messaging: { evidenceTemplates: [] }, vocabulary: {},
  };
}

const codes = (blueprint: SystemBlueprint) => validateBlueprint(blueprint, { today: '2026-10-02' }).map((entry) => entry.code);

describe('Blueprint validator part 1 (loop 2.3)', () => {
  it('accepts a valid minimal Blueprint', () => expect(codes(fixture())).toEqual([]));
  it('reports each arc rule', () => {
    const timezone = fixture(); timezone.arc.timezone = 'Nope/Nowhere'; expect(codes(timezone)).toContain('V-ARC-01');
    const length = fixture(); length.arc.endDate = '2027-01-28'; expect(codes(length)).toContain('V-ARC-02');
    const start = fixture(); start.arc.startDate = '2026-08-01'; expect(codes(start)).toContain('V-ARC-03');
    const boundary = fixture(); boundary.arc.dayCloseHour = 8; expect(codes(boundary)).toContain('V-ARC-04');
  });
  it('reports each domain rule', () => {
    const count = fixture(); count.domains = count.domains.slice(0, 3); expect(codes(count)).toContain('V-DOM-01');
    const designation = fixture(); designation.domains[1]!.designation = 'ASCENSION'; expect(codes(designation)).toContain('V-DOM-02');
    const duplicate = fixture(); duplicate.instruments[1]!.type = 'duration'; duplicate.instruments[1]!.params = {}; expect(codes(duplicate)).toContain('V-DOM-03');
    const quest = fixture(); quest.quests = quest.quests.slice(1); expect(codes(quest)).toContain('V-DOM-04');
  });
  it('reports invalid instrument contracts and missing reality labels', () => {
    const contract = fixture(); contract.instruments[3]!.params.toleranceMinutes = 5; expect(codes(contract)).toContain('V-INS-02');
    const missing = fixture(); missing.instruments[1]!.params = {}; expect(codes(missing)).toContain('V-INS-01');
    const vocabulary = fixture(); vocabulary.domains[0]!.name = ''; expect(codes(vocabulary)).toContain('V-VOC-01');
  });
  it('reports dangling references', () => {
    const bad = fixture(); bad.quests[0]!.criterion = { kind: 'signal', instrumentId: 'gone', signal: 'minutes', comparator: '>=', target: 1 };
    expect(codes(bad)).toContain('V-REF-01');
  });
  it('reports evaluator, economy, and evidence violations', () => {
    const quest = fixture(); (quest.quests[0]!.criterion as { target: number }).target = 0; expect(codes(quest)).toContain('V-QST-02');
    const economy = fixture(); economy.quests[0]!.xp = 200; expect(codes(economy)).toContain('V-XP-02');
    const gate = fixture(); gate.gates = [{ rank: 'C', day: 30, conditions: [] }]; expect(codes(gate)).toContain('V-GATE-01');
    const boss = fixture(); boss.bosses = [{ id: 'I', title: 'TEST', anchorMilestoneId: 'gone', windowStartDay: 1, windowEndDay: 14, conditions: [] }]; expect(codes(boss)).toContain('V-BOSS-01');
    const message = fixture(); message.metrics = [{ id: 'weight', label: 'Weight', unit: 'kg', kind: 'body', source: { manual: true, cadence: 'any' }, direction: 'neutral' }]; message.messaging.evidenceTemplates = [{ id: 'bad', tier: 'P1', signal: { source: 'metric', metricId: 'weight', aggregate: 'latest' }, template: 'x' }]; expect(codes(message)).toContain('V-MSG-01');
  });
});
