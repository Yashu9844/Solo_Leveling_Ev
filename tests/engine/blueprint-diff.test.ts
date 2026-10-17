// Loop 14.1: what changed between two versions, in plain words, and the timeline of an arc's revisions.
import { describe, expect, it } from 'vitest';
import { describeChange, revisionTimeline } from '../../src/blueprint/diff';
import type { Criterion, SystemBlueprint } from '../../src/blueprint/schema';
import { legacyBlueprintFor } from '../../src/blueprint/legacy/legacyV1';
import { generateBlueprint } from '../../src/generator';
import { p1 } from '../fixtures/personas/p1';
import { p3 } from '../fixtures/personas/p3';

const { blueprint: base } = generateBlueprint(p3.draft);
const clone = (): SystemBlueprint => structuredClone(base);
const bump = (criterion: Criterion, by: number): Criterion => (criterion.kind === 'signal' ? { ...criterion, target: criterion.target + by } : { ...criterion, of: criterion.of.map((part) => bump(part, by)) });
const engine = base.domains.find((domain) => domain.role === 'engine')!;
const coreQuest = base.quests.find((quest) => quest.domainId === engine.id && quest.type === 'core')!;

describe('describeChange', () => {
  it('the genesis is bound, not compared', () => {
    expect(describeChange(undefined, base)).toEqual(['The System was bound.']);
  });

  it('a rename and a new designation are said with the old and new words', () => {
    const next = clone();
    const domain = next.domains.find((candidate) => candidate.id === engine.id)!;
    domain.designation = 'OUTPOST';
    domain.name = 'Outpost work';
    const lines = describeChange(base, next);
    expect(lines).toContain(`${engine.designation} is now called OUTPOST.`);
    expect(lines).toContain(`OUTPOST: renamed from “${engine.name}” to “Outpost work”.`);
  });

  it('a target, a hard-day floor, a weight and a schedule are each said as a number or a day list', () => {
    const next = clone();
    const quest = next.quests.find((candidate) => candidate.id === coreQuest.id)!;
    quest.criterion = bump(quest.criterion, 10);
    quest.floor = bump(quest.floor, 1);
    quest.xp += 5;
    quest.schedule = { kind: 'weekdays', days: ['Mon', 'Wed', 'Fri'] as never };
    const lines = describeChange(base, next).join('\n');
    expect(lines).toMatch(new RegExp(`${engine.designation}: target [\\d ·]+ → [\\d ·]+\\.`));
    expect(lines).toMatch(/hard-day floor [\d ·]+ → [\d ·]+\./);
    expect(lines).toContain(`weight ${coreQuest.xp} → ${coreQuest.xp + 5} XP.`);
    expect(lines).toContain('now Mon, Wed, Fri.');
  });

  it('an added and a retired domain are said, and a retirement promises the history stays', () => {
    const next = clone();
    const retired = next.domains.pop()!;
    next.domains.push({ ...engine, id: 'new-domain', designation: 'BEACON', name: 'Beacon' });
    const lines = describeChange(base, next);
    expect(lines).toContain('Added BEACON (Beacon).');
    expect(lines).toContain(`Retired ${retired.designation} (${retired.name}). Its history stays.`);
  });

  it('a gate threshold, a boss, an attribute weight, a rule and a prompt each get a line', () => {
    const next = clone();
    const gate = next.gates.find((candidate) => candidate.conditions.some((condition) => typeof (condition.clauses?.length ? condition.clauses[0]! : condition).threshold === 'number'))!;
    const condition = gate.conditions.find((candidate) => typeof (candidate.clauses?.length ? candidate.clauses[0]! : candidate).threshold === 'number')!;
    const clause = condition.clauses?.length ? condition.clauses[0]! : condition;
    clause.threshold = (clause.threshold as number) + 5;
    next.bosses[0] = { ...next.bosses[0]!, title: 'A NEW NAME' };
    next.attributes.defs[0]!.terms[0]!.weight += 0.1;
    next.rules[0] = { ...next.rules[0]!, enabled: !next.rules[0]!.enabled };
    next.reviews.domainPrompts[0] = { ...next.reviews.domainPrompts[0]!, prompt: 'Something else?' };
    const lines = describeChange(base, next).join('\n');
    expect(lines).toMatch(new RegExp(`Rank ${gate.rank} gate: “${condition.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}”`));
    expect(lines).toContain('is now “A NEW NAME”');
    expect(lines).toMatch(/counts [\d.]+ → [\d.]+\./);
    expect(lines).toMatch(/rule is (on|off)\./);
    expect(lines).toContain('Review prompts reworded.');
  });

  it('a change that touches no computation and no named thing says so', () => {
    expect(describeChange(base, clone())).toEqual(['Wording only; nothing that counts changed.']);
  });

  it('every line is plain: no ids, no JSON, no undefined', () => {
    const next = clone();
    next.domains.pop();
    next.quests[0]!.xp += 1;
    for (const line of describeChange(base, next)) {
      expect(line).not.toMatch(/undefined|\[object|\{|::/);
      expect(line.endsWith('.')).toBe(true);
    }
  });
});

describe('revisionTimeline', () => {
  const v1 = { ...clone(), version: 1, changeClass: 'genesis' as const, activeFrom: '2026-09-01' };
  const v2 = { ...clone(), version: 2, changeClass: 'cosmetic' as const, activeFrom: '2026-09-13' };
  const v3 = { ...clone(), version: 3, changeClass: 'structural' as const, activeFrom: '2026-10-01' };

  it('numbers each version by arc day and says where it stands as of today', () => {
    const timeline = revisionTimeline([v1, v2, v3], '2026-09-20');
    expect(timeline.map((revision) => [revision.version, revision.day, revision.changeClass, revision.state])).toEqual([
      [1, 0, 'genesis', 'SUPERSEDED'],
      [2, 13, 'cosmetic', 'ACTIVE'],
      [3, 31, 'structural', 'SCHEDULED'],
    ]);
    expect(timeline[0]!.lines).toEqual(['The System was bound.']);
  });

  it('with one version, that version is active', () => {
    expect(revisionTimeline([v1], '2026-09-01').map((revision) => revision.state)).toEqual(['ACTIVE']);
  });

  it('reads the owner\'s implicit version too', () => {
    const legacy = legacyBlueprintFor();
    const [only] = revisionTimeline([legacy], legacy.arc.startDate);
    expect(only).toMatchObject({ version: 1, day: 0, state: 'ACTIVE' });
  });

  it('a generated and a legacy Blueprint of different people never produce a nonsense diff', () => {
    const lines = describeChange(generateBlueprint(p1.draft).blueprint, base);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).not.toMatch(/undefined|NaN/);
  });
});
