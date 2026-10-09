// platform/05 loop 2.6 — LEGACY_BLUEPRINT_V1 is the owner's System as data.
// It is only trustworthy while it equals the code it describes, so every
// value is cross-checked against the live constants here. If one of them is
// ever changed on purpose, this test fails first and says which.
import { describe, expect, it } from 'vitest';
import { hashesFor } from '../../src/blueprint/hash';
import { LEGACY_BLUEPRINT_V1, legacyBlueprintFor, OWNER_ARC_DEFAULTS } from '../../src/blueprint/legacy/legacyV1';
import { validateBlueprint } from '../../src/blueprint/validate';
import { isKnownInstrumentSignal } from '../../src/instruments/catalog';
import { LEGACY_INSTRUMENTS } from '../../src/instruments/legacy/ids';
import { achievementsFrom, identitiesFrom, type AchievementEvidence } from '../../src/engine/achievements';
import { BOSS_II_TOPICS, BOSSES } from '../../src/engine/boss';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { DSA_TOPICS } from '../../src/engine/dsa';
import { FOUNDATION_TOPICS } from '../../src/engine/foundations';
import { generateCoreQuestTemplates } from '../../src/engine/quests';
import { evaluateGates, ZERO_EVIDENCE } from '../../src/engine/rank';
import { AI_TIER_TOPICS } from '../../src/store/skills';
import { AUTOMATICITY_QUESTIONS, ENJOYMENT_QUESTIONS, SELF_EFFICACY_QUESTIONS } from '../../src/ui/components/InstrumentSliders';
import { CRITERION_TEXT, ROW_SUMMARY } from '../../src/ui/today/criterionText';
import type { Criterion, SignalRef } from '../../src/blueprint/schema';

const bp = LEGACY_BLUEPRINT_V1;
const CORE_KEYS = ['career', 'dsa', 'build', 'training', 'sleep', 'attention'] as const;

function criterionLeaves(c: Criterion): Extract<Criterion, { kind: 'signal' }>[] {
  return c.kind === 'signal' ? [c] : c.of.flatMap(criterionLeaves);
}
function instrumentSignals(ref: SignalRef): { instrumentId: string; signal: string }[] {
  switch (ref.source) {
    case 'instrument': return [{ instrumentId: ref.instrumentId, signal: ref.signal }];
    case 'sum': return ref.of.flatMap(instrumentSignals);
    case 'ratio': return [...instrumentSignals(ref.num), ...instrumentSignals(ref.den)];
    default: return [];
  }
}

describe('LEGACY_BLUEPRINT_V1 (loop 2.6)', () => {
  it('passes the validator with no exemptions', () => {
    expect(validateBlueprint(bp, { today: OWNER_ARC_DEFAULTS.start_date })).toEqual([]);
  });

  it('is genesis version 1 of provenance "legacy", active from the arc start', () => {
    expect(bp).toMatchObject({ version: 1, changeClass: 'genesis', activeFrom: DEFAULT_CONFIG.arc.startDate, provenance: { generator: 'legacy' } });
    expect(bp.arc).toMatchObject({
      timezone: DEFAULT_CONFIG.arc.timezone, dayBoundaryHour: DEFAULT_CONFIG.arc.dayBoundaryHour, dayCloseHour: DEFAULT_CONFIG.arc.dayCloseHour,
      startDate: DEFAULT_CONFIG.arc.startDate, endDate: DEFAULT_CONFIG.arc.endDate, lengthDays: 120, wakeTime: DEFAULT_CONFIG.wakeTargetTime,
    });
  });

  it('takes the arc-owned fields from the arc it is built for', () => {
    const other = legacyBlueprintFor({ ...OWNER_ARC_DEFAULTS, id: 'x', start_date: '2026-10-01', end_date: '2027-01-28', timezone: 'America/New_York' });
    expect(other.arcId).toBe('x');
    expect(other.arc).toMatchObject({ startDate: '2026-10-01', timezone: 'America/New_York', lengthDays: 120 });
    expect(other.activeFrom).toBe('2026-10-01');
  });

  it('matches the economy in engine/config.ts', () => {
    const p = bp.progression;
    expect(p).toMatchObject({
      dailyCap: DEFAULT_CONFIG.dailyCap, mvdXp: DEFAULT_CONFIG.mvdXp, recoveryXp: DEFAULT_CONFIG.recoveryXp, bossXp: DEFAULT_CONFIG.bossXp,
      weeklyQuestXp: DEFAULT_CONFIG.weeklyQuestXp, level: DEFAULT_CONFIG.level, attributeWindowDays: DEFAULT_CONFIG.attributes.windowDays,
      grace: { daysPer28: DEFAULT_CONFIG.streak.graceDaysPer28 },
      reducedMode: { triggerMisses: DEFAULT_CONFIG.streak.reducedModeTriggerMisses, exitDays: DEFAULT_CONFIG.streak.reducedModeExitDays, collapsesQuests: false },
    });
    expect(Object.values(DEFAULT_CONFIG.coreQuests).reduce((sum, q) => sum + q.xp, 0)).toBe(p.dailyCoreBudget);
  });

  it('declares each core quest with the legacy key, title, XP, channel, cap and wording', () => {
    const templates = generateCoreQuestTemplates('a', {}, DEFAULT_CONFIG, { now: () => '', newId: () => '' });
    expect(bp.quests.map((q) => q.id)).toEqual(CORE_KEYS);
    for (const template of templates) {
      const quest = bp.quests.find((q) => q.id === template.key)!;
      const domain = bp.domains.find((d) => d.id === quest.domainId)!;
      expect(quest.designation, template.key).toBe(template.title);
      expect(quest.xp, template.key).toBe(template.xp);
      expect(domain.channel.id, template.key).toBe(template.category);
      expect(domain.channel.cap, template.key).toBe(DEFAULT_CONFIG.categoryCaps[template.category as keyof typeof DEFAULT_CONFIG.categoryCaps]);
      expect(quest.objective, template.key).toBe(CRITERION_TEXT[template.key]);
      expect(quest.realityLabel, template.key).toBe(ROW_SUMMARY[template.key]);
      expect(domain.coreQuestId).toBe(template.key);
    }
  });

  it('declares the support channels with their legacy caps', () => {
    expect(bp.domains.find((d) => d.id === 'foundations')!.channel).toEqual({ id: 'LEARN', cap: DEFAULT_CONFIG.categoryCaps.LEARN });
    expect(bp.domains.find((d) => d.id === 'maintenance')!.channel).toEqual({ id: 'MAINT', cap: DEFAULT_CONFIG.categoryCaps.MAINT });
  });

  it('encodes the legacy completion thresholds in the quest criteria', () => {
    const leafOf = (key: string) => criterionLeaves(bp.quests.find((q) => q.id === key)!.criterion).map((l) => [l.instrumentId, l.signal, l.comparator, l.target]);
    expect(leafOf('career')).toEqual([['career.applications', 'quality_count', '>=', 3], ['career.substitute', 'minutes', '>=', 25]]);
    expect(leafOf('dsa')).toEqual([['dsa.problems', 'count', '>=', 1], ['dsa.problems', 'minutes', '>=', 25]]);
    expect(leafOf('build')).toEqual([['build.sessions', 'minutes', '>=', 45]]);
    expect(leafOf('training')).toEqual([['training.sessions', 'count', '>=', 1], ['training.steps', 'total_value', '>=', 8000]]);
    expect(leafOf('sleep')).toEqual([['sleep.wake', 'hit', '>=', 1]]);
    expect(leafOf('attention')).toEqual([['attention.screen', 'hit', '>=', 1]]);
  });

  it('parameterises instruments with the legacy rhythm and grant amounts', () => {
    const params = (id: string) => bp.instruments.find((i) => i.id === id)!.params;
    expect(params('sleep.wake')).toMatchObject({ targetTime: DEFAULT_CONFIG.wakeTargetTime, toleranceMinutes: 30 });
    expect(params('attention.screen')).toMatchObject({ comparator: '<=', target: 60 });
    expect(params('training.steps')).toMatchObject({ target: 8000, bonusAt: DEFAULT_CONFIG.stepsBonusThreshold, grant: { amount: DEFAULT_CONFIG.stepsBonusXp } });
    expect(params('dsa.problems')).toMatchObject({ revisitGrant: { amount: DEFAULT_CONFIG.revisitXp }, maxRevisitsPerDay: DEFAULT_CONFIG.srs.maxRevisitsPerDay });
    expect(params('build.artifacts')).toMatchObject({ grant: { amount: DEFAULT_CONFIG.shipBonusXp } });
    expect(params('foundations.blocks')).toMatchObject({ grant: { amount: DEFAULT_CONFIG.learningBlockXp } });
    expect(params('foundations.design')).toMatchObject({ grant: { amount: DEFAULT_CONFIG.learningBlockXp } });
    expect(params('maintenance.daily')).toMatchObject({ grant: { amount: DEFAULT_CONFIG.maintenanceXp } });
    const laundry = (params('maintenance.daily').items as { id: string; everyNDays?: number }[]).find((i) => i.id === 'laundry');
    expect(laundry?.everyNDays).toBe(DEFAULT_CONFIG.maintenanceLaundryEveryDays);
  });

  it('binds exactly the instruments the upcasters know, to the right types and legacy events', () => {
    expect(bp.instruments.map((i) => i.id).sort()).toEqual(Object.keys(LEGACY_INSTRUMENTS).sort());
    for (const instrument of bp.instruments) {
      const known = LEGACY_INSTRUMENTS[instrument.id as keyof typeof LEGACY_INSTRUMENTS];
      expect(instrument.type, instrument.id).toBe(known.type);
      expect(instrument.domainId, instrument.id).toBe(known.domainId);
      expect(instrument.eventBinding.kind, instrument.id).toBe('legacy');
    }
  });

  it('lists the legacy topic sets', () => {
    const tree = (id: string) => bp.skills.find((s) => s.id === id)!.nodes.map((n) => n.name);
    expect(tree('dsa')).toEqual([...DSA_TOPICS]);
    expect(tree('foundations')).toEqual([...FOUNDATION_TOPICS]);
    expect(tree('ai')).toEqual([...AI_TIER_TOPICS]);
    expect(bp.skills.find((s) => s.id === 'foundations')!.policy).toMatchObject({ introducedAt: 1, appliedAt: 3, fluentAt: 5, retainedGapDays: 21 });
    expect(bp.skills.find((s) => s.id === 'dsa')!.policy).toMatchObject({ appliedAt: 3, retainedGapDays: DEFAULT_CONFIG.srs.retainedMinGapDays });
  });

  it('declares the four bosses with the legacy titles and windows', () => {
    expect(bp.bosses.map((b) => [b.id, b.title, b.windowStartDay, b.windowEndDay])).toEqual(BOSSES.map((b) => [b.id, b.title, b.windowStartDay, b.windowEndDay]));
    expect(bp.bosses.every((b) => bp.milestones.some((m) => m.id === b.anchorMilestoneId))).toBe(true);
    expect(BOSS_II_TOPICS).toEqual(['Operating Systems', 'Networking', 'Databases', 'Distributed Systems', 'Concurrency', 'Backend Engineering']);
  });

  it('declares the rank schedule and one gate per checkpoint day', () => {
    expect(bp.gates.map((g) => [g.day, g.rank])).toEqual([[0, 'E'], [14, 'D'], [30, 'C'], [60, 'B'], [90, 'A'], [120, 'S']]);
    for (const gate of bp.gates) {
      const legacy = evaluateGates({ day: gate.day as 0 | 14 | 30 | 60 | 90 | 120, previousRank: 'E' }, ZERO_EVIDENCE);
      expect(gate.rank, `day ${gate.day}`).toBe(legacy.targetRank);
      expect(gate.conditions.length, `day ${gate.day} condition count`).toBe(legacy.conditions.length);
    }
    expect(bp.progression.rankSchedule.map((r) => r.day)).toEqual(bp.progression.checkpointDays.slice(0, 5));
  });

  it('declares the 13 achievements and identities with the legacy ids and labels', () => {
    const evidence = {} as AchievementEvidence;
    const legacy = [...achievementsFrom(evidence), ...identitiesFrom(evidence)].map((a) => [a.id, a.label]);
    expect(bp.achievements.map((a) => [a.id, a.label])).toEqual(legacy);
  });

  it('declares the six attributes with weights that match engine/attributes.ts', () => {
    expect(bp.attributes.defs.map((d) => d.id)).toEqual(['DISCIPLINE', 'DEPTH', 'PROBLEM_SOLVING', 'ENGINEERING', 'MOMENTUM', 'VITALITY']);
    const weights = (id: string) => bp.attributes.defs.find((d) => d.id === id)!.terms.map((t) => t.weight);
    expect(weights('DISCIPLINE')).toEqual([0.4, 0.35, 0.25]);
    expect(weights('PROBLEM_SOLVING')).toEqual([0.45, 0.35, 0.2]);
    expect(weights('ENGINEERING')).toEqual([0.35, 0.4, 0.25]);
    expect(weights('MOMENTUM')).toEqual([0.4, 0.35, 0.25]);
    expect(weights('VITALITY')).toEqual([0.4, 0.3, 0.3]);
    expect(bp.attributes.defs.find((d) => d.id === 'DEPTH')).toMatchObject({ combine: 'product', productKey: 'deep_minutes' });
  });

  it('carries the legacy checkpoint instruments', () => {
    expect(bp.checkpoints.selfEfficacy.map((i) => i.prompt)).toEqual([...SELF_EFFICACY_QUESTIONS]);
    expect(bp.checkpoints.automaticity.map((i) => i.prompt)).toEqual([...AUTOMATICITY_QUESTIONS]);
    expect(bp.checkpoints.enjoyment.map((i) => i.prompt)).toEqual([...ENJOYMENT_QUESTIONS]);
  });

  it('enables only the two rules that fire today', () => {
    expect(bp.rules.filter((r) => r.enabled).map((r) => r.kind).sort()).toEqual(['MODE_RATIO', 'WRONG_TIME']);
  });

  it('reads only signals its instruments declare (every legacy signal exists)', () => {
    const types = new Map(bp.instruments.map((i) => [i.id, i.type]));
    const refs: SignalRef[] = [];
    for (const gate of bp.gates) for (const c of gate.conditions) refs.push(...(c.clauses ?? []).map((cl) => cl.signal));
    for (const boss of bp.bosses) for (const c of boss.conditions) refs.push(...(c.clauses ?? []).map((cl) => cl.signal));
    for (const a of bp.achievements) refs.push(...(a.condition.clauses ?? []).map((cl) => cl.signal));
    for (const def of bp.attributes.defs) for (const t of def.terms) refs.push(t.signal);
    for (const quest of bp.quests) for (const leaf of criterionLeaves(quest.criterion)) refs.push({ source: 'instrument', instrumentId: leaf.instrumentId, signal: leaf.signal, aggregate: 'day' });
    expect(refs.length).toBeGreaterThan(100);
    for (const ref of refs) {
      for (const { instrumentId, signal } of instrumentSignals(ref)) {
        expect(types.has(instrumentId), instrumentId).toBe(true);
        expect(isKnownInstrumentSignal(types.get(instrumentId)!, signal), `${instrumentId}.${signal}`).toBe(true);
      }
    }
  });

  it('has stable, distinct hashes', async () => {
    const a = await hashesFor(bp);
    expect(await hashesFor(legacyBlueprintFor(OWNER_ARC_DEFAULTS))).toEqual(a);
    expect(a.computationalHash).not.toBe(a.presentationHash);
  });
});
