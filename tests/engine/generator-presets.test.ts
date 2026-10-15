// Loop 8.7: presets, and the guarantee that no reachable answer yields an empty System (platform/04 I17, 03 §25.5).
// LEGACY is not a preset: it is a pinned fixture. SOFTWARE ENGINEER is its nearest *generated* analogue, and this file
// documents exactly where the two differ, so drift between "what we would generate for the owner" and "what the owner
// has" stays visible - a change to either side fails here and has to be looked at.
import { describe, expect, it } from 'vitest';
import { LEGACY_BLUEPRINT_V1 } from '../../src/blueprint/legacy/legacyV1';
import type { SystemBlueprint } from '../../src/blueprint/schema';
import { draftFromAreas, draftFromPreset, generateBlueprint, type DraftContext } from '../../src/generator';
import { AREAS, PRESETS } from '../../src/library/presets';

const CONTEXT: DraftContext = {
  lineageId: 'arc-preset', today: '2026-09-01', displayName: 'ADA', primaryObjective: 'Become someone who keeps promises.', timezone: 'Asia/Kolkata',
  rhythm: { wakeTime: '07:00', sleepTime: '23:30' },
};

/** The clauses of the "never empty" guarantee (03 §25.5). Returns the ones a Blueprint fails. */
function neverEmpty(blueprint: SystemBlueprint): string[] {
  const failed: string[] = [];
  const core = blueprint.quests.filter((quest) => quest.type === 'core');
  if (core.length < 4) failed.push(`only ${core.length} core quests`);
  if (blueprint.attributes.defs.length < 3) failed.push(`only ${blueprint.attributes.defs.length} attributes`);
  if (blueprint.skills.length === 0 && blueprint.milestones.length === 0) failed.push('no skill tree and no milestone panel');
  if (blueprint.gates.map((gate) => gate.rank).join('') !== 'EDCBAS') failed.push('incomplete gate schedule');
  if (blueprint.bosses.length < 2 || blueprint.bosses.length > 4) failed.push(`${blueprint.bosses.length} bosses`);
  for (const domain of blueprint.domains) {
    if (!blueprint.reviews.domainPrompts.some((prompt) => prompt.domainId === domain.id)) failed.push(`no review prompt for ${domain.id}`);
    if (!domain.designation || !domain.name) failed.push(`no label for ${domain.id}`);
  }
  for (const quest of core) if (!quest.realityLabel || !quest.objective) failed.push(`no wording for ${quest.id}`);
  for (const domain of blueprint.domains.filter((candidate) => candidate.role === 'engine')) {
    if (!blueprint.messaging.evidenceTemplates.some((template) => template.id.startsWith(`${domain.id}.`))) failed.push(`no message for ${domain.id}`);
  }
  return failed;
}

const errorsOf = (blueprint: SystemBlueprint, issues: { severity: string; code: string; path: string }[]) => issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.code} ${issue.path}`);

describe('presets', () => {
  it('there are eight, with unique ids and labels, none of them LEGACY', () => {
    expect(PRESETS.map((preset) => preset.label)).toEqual([
      'SOFTWARE ENGINEER', 'CAREER BUILDER', 'STUDENT', 'EXAM PREPARATION', 'FITNESS', 'ENTREPRENEUR', 'CREATIVE', 'GENERAL SELF-DEVELOPMENT',
    ]);
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(8);
  });

  for (const preset of PRESETS) {
    it(`${preset.label} generates a System that is never empty and passes the validator`, () => {
      const draft = draftFromPreset(preset.id, CONTEXT)!;
      const { blueprint, issues } = generateBlueprint(draft);
      expect(errorsOf(blueprint, issues)).toEqual([]);
      expect(neverEmpty(blueprint)).toEqual([]);
      expect(blueprint.arc.lengthDays).toBe(preset.lengthDays === 'exam' ? 90 : preset.lengthDays);
    });
  }

  it('an exam-aligned arc takes its length from the exam date, here 94 days', () => {
    const draft = draftFromPreset('exam-preparation', { ...CONTEXT, lengthDays: 94 })!;
    const { blueprint, issues } = generateBlueprint(draft);
    expect(errorsOf(blueprint, issues)).toEqual([]);
    expect(blueprint.arc.lengthDays).toBe(94);
    expect(blueprint.progression.checkpointDays[4]).toBe(94);
    // Two subjects of one kind are two domains with their own topics, so neither duplicates the other (V-DOM-03).
    expect(blueprint.domains.filter((domain) => domain.archetypeId === 'exam-prep').map((domain) => domain.name)).toEqual(['Exam preparation: Subject one', 'Exam preparation: Subject two']);
  });

  it('an unknown preset is undefined, not a throw', () => {
    expect(draftFromPreset('astrologer', CONTEXT)).toBeUndefined();
  });
});

describe('I17: never empty, over the Quick-reachable answers', () => {
  const REACHABLE = AREAS.filter((area) => area.archetypeId !== undefined).map((area) => area.id);

  /** Every k-subset of the areas, in a stable order. */
  function subsets(items: string[], size: number): string[][] {
    const out: string[][] = [];
    const walk = (start: number, chosen: string[]) => {
      if (chosen.length === size) { out.push([...chosen]); return; }
      for (let i = start; i < items.length; i++) { chosen.push(items[i]!); walk(i + 1, chosen); chosen.pop(); }
    };
    walk(0, []);
    return out;
  }

  it('every 3-8 area choice, in the order given, at every preset arc length, yields a System that is never empty', () => {
    let checked = 0;
    const lengths = [60, 90, 120, 180, 365];
    for (let size = 3; size <= 8; size++) {
      const all = subsets(REACHABLE, size);
      // Every 3rd subset, rotating the ranking and the length: the whole product is ~14,000 Systems; this samples it evenly.
      all.forEach((areas, index) => {
        if (index % 3 !== 0) return;
        const rotated = [...areas.slice(index % areas.length), ...areas.slice(0, index % areas.length)];
        const lengthDays = lengths[(index + size) % lengths.length]!;
        const { blueprint, issues } = generateBlueprint(draftFromAreas(rotated, { ...CONTEXT, lineageId: `i17-${size}-${index}`, lengthDays, priorityMode: index % 2 === 0 ? 'ranked' : 'equal' }));
        const label = `${rotated.join('+')} @${lengthDays}`;
        expect(errorsOf(blueprint, issues), label).toEqual([]);
        expect(neverEmpty(blueprint), label).toEqual([]);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(300);
  }, 120_000);

  it('a choice of nothing but guardrail areas still gets two engines to stand on', () => {
    const { blueprint, issues } = generateBlueprint(draftFromAreas(['health', 'financial', 'discipline'], CONTEXT));
    expect(errorsOf(blueprint, issues)).toEqual([]);
    expect(blueprint.domains.filter((domain) => domain.role === 'engine').length).toBeGreaterThanOrEqual(2);
    expect(neverEmpty(blueprint)).toEqual([]);
  });

  it('a custom area needs an action, so Quick leaves it out rather than inventing one', () => {
    const { blueprint } = generateBlueprint(draftFromAreas(['custom', 'career', 'body', 'craft'], CONTEXT));
    expect(blueprint.domains.map((domain) => domain.archetypeId)).not.toContain('custom');
    expect(neverEmpty(blueprint)).toEqual([]);
  });
});

describe('SOFTWARE ENGINEER next to the owner\'s System', () => {
  const draft = draftFromPreset('software-engineer', {
    lineageId: 'legacy-arc', today: '2026-09-01', displayName: 'SYSTEM', primaryObjective: 'x', timezone: 'Asia/Kolkata', rhythm: { wakeTime: '08:30', sleepTime: '02:00' },
  })!;
  const { blueprint: generated, issues } = generateBlueprint(draft);

  const summary = (blueprint: SystemBlueprint) => ({
    domains: blueprint.domains.map((domain) => `${domain.role}:${domain.designation}`),
    coreXp: blueprint.quests.map((quest) => quest.xp),
    caps: blueprint.domains.map((domain) => domain.channel.cap),
    attributes: blueprint.attributes.defs.map((definition) => definition.id),
    skills: blueprint.skills.map((tree) => tree.nodes.length),
    gates: blueprint.gates.map((gate) => `${gate.rank}${gate.day}:${gate.conditions.length}`),
    bosses: blueprint.bosses.map((boss) => `${boss.id}:${boss.title}:${boss.windowStartDay}-${boss.windowEndDay}:${boss.gatesRank ?? '-'}`),
    achievements: blueprint.achievements.length,
    progression: { coefficient: blueprint.progression.level.coefficient, checkpointDays: blueprint.progression.checkpointDays, collapsesQuests: blueprint.progression.reducedMode.collapsesQuests },
  });

  it('is a valid, never-empty System', () => {
    expect(errorsOf(generated, issues)).toEqual([]);
    expect(neverEmpty(generated)).toEqual([]);
  });

  it('what the owner has (pinned): eight domains, the owner\'s economy, three skill trees, four bosses', () => {
    expect(summary(LEGACY_BLUEPRINT_V1)).toEqual({
      domains: ['engine:ASCENSION', 'engine:LOGIC TRIAL', 'engine:FORGE', 'engine:VITALITY TRIAL', 'guardrail:RECONSTITUTION', 'guardrail:WILL TRIAL', 'support:ARCANE STUDY', 'support:MAINTENANCE'],
      coreXp: [100, 100, 100, 100, 60, 40],
      caps: [140, 200, 200, 150, 60, 40, 75, 20],
      attributes: ['DISCIPLINE', 'DEPTH', 'PROBLEM_SOLVING', 'ENGINEERING', 'MOMENTUM', 'VITALITY'],
      skills: [9, 9, 21],
      gates: ['E0:1', 'D14:1', 'C30:6', 'B60:9', 'A90:13', 'S120:22'],
      bosses: ['I:FIRST EVIDENCE:25-35:B', 'II:STRONG ENGINEERING BASE:50-70:A', 'III:AI ENGINEER:75-95:-', 'IV:INTERVIEW READY:100-120:S'],
      achievements: 13,
      progression: { coefficient: 84, checkpointDays: [14, 30, 60, 90, 120], collapsesQuests: false },
    });
  });

  it('what we would generate for them (pinned)', () => {
    expect(summary(generated)).toEqual({
      domains: ['engine:LOGIC TRIAL', 'engine:FORGE', 'engine:ASCENSION', 'engine:VITALITY TRIAL', 'guardrail:RECONSTITUTION', 'guardrail:WILL TRIAL'],
      coreXp: [110, 100, 100, 90, 60, 40],
      caps: [200, 190, 140, 135, 60, 40],
      attributes: ['DISCIPLINE', 'PROBLEM_SOLVING', 'ENGINEERING', 'MOMENTUM', 'VITALITY'],
      skills: [9],
      gates: ['E0:1', 'D14:1', 'C30:7', 'B60:10', 'A90:14', 'S120:18'],
      bosses: ['I:LOGIC GAUNTLET:25-45:B', 'II:FIRST PUBLIC RELEASE:50-70:A', 'III:INTERVIEW READY:75-95:-', 'IV:STEADY STRENGTH:100-120:S'],
      achievements: 14,
      progression: { coefficient: 84, checkpointDays: [14, 30, 60, 90, 120], collapsesQuests: true },
    });
  });

  it('and the differences, in words (each is a decision, not an accident)', () => {
    const owner = summary(LEGACY_BLUEPRINT_V1);
    const ours = summary(generated);
    // Same where it matters: the level curve, the checkpoints, six core domains, the guardrails' XP.
    expect(ours.progression.coefficient).toBe(owner.progression.coefficient);
    expect(ours.progression.checkpointDays).toEqual(owner.progression.checkpointDays);
    expect(ours.coreXp.slice(4)).toEqual(owner.coreXp.slice(4));
    // Different, deliberately:
    expect(ours.coreXp.slice(0, 4)).not.toEqual(owner.coreXp.slice(0, 4)); // a ranked preset tilts the engines (110/100/100/90); the owner's four are equal
    expect(ours.domains).toHaveLength(owner.domains.length - 2); // the owner's two support domains (foundations study, maintenance row) are not a preset's
    expect(ours.skills).toEqual([9]); // one practice tree; the owner's foundations and AI trees belong to the support domain
    expect(ours.attributes).not.toContain('DEPTH'); // DEPTH needs the owner's learning blocks
    expect(ours.progression.collapsesQuests).toBe(true); // a generated System's Reduced Mode collapses to the floor; the owner's never has
    expect(ours.bosses.map((boss) => boss.split(':')[2])).toEqual(['25-45', '50-70', '75-95', '100-120']); // the same rhythm of windows, one wider
  });
});
