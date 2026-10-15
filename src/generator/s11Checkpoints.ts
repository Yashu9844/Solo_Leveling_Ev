// S11 checkpoint items + achievements (platform/02 §16.3-16.4, §15.4). A checkpoint freezes the evidence
// its gates read, asks the same short questionnaire every time, and compares before with now; achievements
// are the first-of-its-kind moments a System can celebrate.
import { clause, condition, glob } from '../blueprint/build';
import type { AchievementDef, CheckpointDef, ComparisonRowDef, EvidenceDef, GateCondition, ProgressionSection, RankGateDef } from '../blueprint/schema';
import { signalOf, type DomainContext } from './derive';

/** Two items every System asks (02 §16.4); the other four come from its top engine domains. */
const GLOBAL_SELF_EFFICACY = [
  'Keep a daily floor for two weeks during a hard week?',
  'Return after a missed day without a lapse becoming a streak?',
];

/** Used only when a System has fewer engine and guardrail domains than the four slots need. */
const FILLER_SELF_EFFICACY = [
  "Do what you planned today on a day you don't feel like it?",
  'Start the hard thing first, before anything easier?',
  'Finish this week with every floor met?',
  'Look back at this arc and name what changed?',
];

/** Four global automaticity items, unchanged from the owner's (02 §16.4). */
const AUTOMATICITY = ['Waking at my target time', 'Training', 'Daily study', 'Sleeping at my target time'];

export const SELF_EFFICACY_ITEMS = 6;
export const MAX_ENJOYMENT_ITEMS = 4;

/** What a condition is called in the before/after comparison when its template names no short form. */
function plainLabel(label: string): string {
  const stripped = label.replace(/{t?d+}w*/g, '').replace(/(need[^)]*)/g, '').replace(/s+/g, ' ').trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function buildCheckpoints(contexts: DomainContext[], gates: RankGateDef[]): CheckpointDef {
  const engines = contexts.filter((ctx) => ctx.resolved.archetype.role === 'engine' && ctx.resolved.archetype.quest);
  const guardrails = contexts.filter((ctx) => ctx.resolved.archetype.role === 'guardrail' && ctx.resolved.archetype.quest);

  const fromDomains = [...engines, ...guardrails].map((ctx) => ctx.resolved.archetype.checkpoint?.selfEfficacy).filter((prompt): prompt is string => !!prompt);
  const prompts = [...GLOBAL_SELF_EFFICACY, ...fromDomains, ...FILLER_SELF_EFFICACY].slice(0, SELF_EFFICACY_ITEMS);

  // Freeze every signal the gates read, once each, under the condition's own id.
  const shortNames = new Map<string, string>();
  for (const ctx of contexts) {
    const archetype = ctx.resolved.archetype;
    if (archetype.ladder) shortNames.set(`${ctx.domain.id}.${archetype.ladder.key}`, archetype.ladder.label);
    for (const template of archetype.conditions ?? []) shortNames.set(`${ctx.domain.id}.${template.id}`, template.short ?? plainLabel(template.label));
  }
  const evidence: EvidenceDef[] = [];
  const seen = new Set<string>();
  const comparison: ComparisonRowDef[] = [];
  const freeze = (key: string, source: GateCondition): void => {
    if (seen.has(key)) return;
    const first = source.clauses?.[0] ?? source;
    if (source.verifiability === 'structural') return; // seals and boss clears are facts of the log, not measurements
    seen.add(key);
    const ceiling = first.comparator === '<' || first.comparator === '<=';
    evidence.push({ key, signal: first.signal, zero: ceiling ? 999 : 0 });
  };
  evidence.push({ key: 'mvdConsistency14d', signal: glob('consistency_14'), zero: 0 }, { key: 'coreCompletion28d', signal: glob('consistency_28'), zero: 0 });
  seen.add('mvdConsistency14d').add('coreCompletion28d');
  for (const gate of gates) for (const gateCondition of gate.conditions) if (!['start', 'mvd-14', 'core', 'core-band'].includes(gateCondition.id)) freeze(gateCondition.id, gateCondition);

  // Before/after: each engine's headline count, each rate a gate asks for, and every guardrail's spread.
  for (const gate of gates.filter((candidate) => candidate.rank === 'S')) {
    for (const gateCondition of gate.conditions) {
      const first = gateCondition.clauses?.[0] ?? gateCondition;
      if (!seen.has(gateCondition.id) || gateCondition.verifiability === 'structural') continue;
      const ceiling = first.comparator === '<' || first.comparator === '<=';
      const percent = gateCondition.format === 'percent';
      comparison.push({
        id: gateCondition.id, label: shortNames.get(gateCondition.id) ?? plainLabel(gateCondition.label),
        evidenceKey: gateCondition.id, format: percent ? 'percent' : gateCondition.format === 'round' ? 'minutes' : 'int', direction: ceiling ? 'lower' : 'higher',
        ...(ceiling ? { onlyWhenBaselineBelow: 999 } : {}),
      });
    }
  }

  return {
    selfEfficacy: prompts.map((prompt, index) => ({ id: `self-efficacy-${index + 1}`, prompt })),
    automaticity: AUTOMATICITY.map((prompt, index) => ({ id: `automaticity-${index + 1}`, prompt })),
    enjoyment: engines.slice(0, MAX_ENJOYMENT_ITEMS).map((ctx) => ({ id: `enjoyment-${ctx.domain.id}`, domainId: ctx.domain.id, prompt: ctx.resolved.archetype.checkpoint?.enjoyment ?? ctx.domain.name })),
    evidence, comparison,
  };
}

export function buildAchievements(contexts: DomainContext[], progression: ProgressionSection, lengthDays: number): AchievementDef[] {
  const lastDay = progression.checkpointDays[progression.checkpointDays.length - 1]!;
  const achievements: AchievementDef[] = [
    { id: 'first_move', label: 'First Move', condition: condition('first-move', 'First Move', 'structural', [clause(glob('first_quest'), '>=', 1)]) },
    { id: 'two_weeks', label: 'Two Weeks', condition: condition('two-weeks', 'Two Weeks', 'count', [clause(glob('mvd_days', undefined, 'total'), '>=', 14)]) },
    { id: 'return', label: 'Return', condition: condition('return', 'Return', 'structural', [clause(glob('recovered_after_gap'), '>=', 1)]) },
  ];
  for (const ctx of contexts) {
    for (const template of ctx.resolved.archetype.achievements ?? []) {
      const id = `${ctx.domain.id}.${template.id}`;
      achievements.push({
        id, label: template.label, domainId: ctx.domain.id, ...(template.kind ? { kind: template.kind } : {}),
        condition: condition(id, template.label, template.verifiability, template.clauses.map((item) => clause(signalOf(item.signal, ctx.ids), item.comparator, item.threshold, item.format)), template.clauseMode),
      });
    }
  }
  achievements.push(
    { id: 'the_arc', label: 'The Arc', condition: condition('the-arc', 'The Arc', 'structural', [clause(glob('checkpoint_sealed', String(lastDay)), '>=', 1)]) },
    {
      id: 'consistent', label: 'Consistent', kind: 'identity',
      condition: lengthDays >= 90
        ? condition('consistent', 'Consistent', 'count', [clause(glob('mvd_days', undefined, 'window_90'), '>=', 60)])
        : condition('consistent', 'Consistent', 'count', [clause(glob('mvd_days', undefined, 'total'), '>=', Math.round(lengthDays * 0.66))]),
    },
    { id: 'keeps_promises', label: 'Someone Who Keeps Promises', kind: 'identity', condition: condition('keeps-promises', 'Someone Who Keeps Promises', 'count', [clause(glob('if_then_rate'), '>=', 0.8)]) }
  );
  return achievements;
}
