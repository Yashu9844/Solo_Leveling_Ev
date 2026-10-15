// S6 metrics + milestones, S7 skills (platform/03 §29). A metric is a headline number a domain is shown
// and judged by; a milestone is its ladder - what a successful arc looks like, and the way up to it.
import { clause, condition } from '../blueprint/build';
import type { MetricDefinition, MilestoneDef, SkillTreeDef } from '../blueprint/schema';
import type { Issue } from '../blueprint/validate';
import { ladderSuccess, ladderThresholds, signalOf, type DomainContext } from './derive';
import { generatorIssue } from './types';

export const MAX_SKILL_TREES = 5;
export const MAX_TREE_NODES = 30;

export function buildMetrics(contexts: DomainContext[]): MetricDefinition[] {
  const metrics: MetricDefinition[] = [];
  const seen = new Set<string>();
  for (const ctx of contexts) {
    for (const template of ctx.resolved.archetype.metrics ?? []) {
      const manual = 'manual' in template.source;
      // A manual measurement (weight, a benchmark) is one number for the whole System; an instrument metric belongs to its domain.
      const id = manual ? template.key : `${ctx.domain.id}.${template.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const source = 'manual' in template.source
        ? { manual: true as const, cadence: template.source.cadence }
        : { instrumentId: ctx.ids[template.source.instrument]!, signal: template.source.signal };
      metrics.push({
        id, label: template.label, unit: template.unit, domainId: ctx.domain.id, kind: template.kind, source,
        direction: template.direction,
      });
    }
  }
  return metrics;
}

/** Every domain's headline ladder as a milestone: its S condition, and the C/B/A/S thresholds on the way. */
export function buildLadders(contexts: DomainContext[]): { milestones: MilestoneDef[]; thresholds: Map<string, number[]> } {
  const milestones: MilestoneDef[] = [];
  const thresholds = new Map<string, number[]>();
  for (const ctx of contexts) {
    const ladder = ctx.resolved.archetype.ladder;
    if (!ladder) continue;
    const steps = ladderThresholds(ladderSuccess(ladder, ctx.resolved.answers.success));
    thresholds.set(ctx.domain.id, steps);
    milestones.push({
      id: `${ctx.domain.id}.${ladder.key}`, domainId: ctx.domain.id, label: ladder.label,
      condition: condition(`${ctx.domain.id}.${ladder.key}`, `{0} ${ladder.noun} (need {t0})`, ladder.verifiability, [clause(signalOf(ladder.signal, ctx.ids), '>=', steps[3]!, 'int')]),
      ladder: steps.map((threshold, index) => ({ checkpointIndex: (index + 1) as 1 | 2 | 3 | 4, threshold })),
      declaredBy: 'archetype',
    });
  }
  return { milestones, thresholds };
}

export function buildSkills(contexts: DomainContext[]): { skills: SkillTreeDef[]; issues: Issue[] } {
  const skills: SkillTreeDef[] = [];
  const issues: Issue[] = [];
  for (const ctx of contexts) {
    const template = ctx.resolved.archetype.skillTree;
    if (!template) continue;
    if (skills.length >= MAX_SKILL_TREES) {
      issues.push(generatorIssue('G-SKL-01', 'info', `domains.${ctx.domain.id}`, 'A SKILL TREE WAS LEFT OUT.', `A System holds at most ${MAX_SKILL_TREES} skill trees.`));
      continue;
    }
    const instrument = ctx.instruments.find((candidate) => candidate.id === ctx.ids[template.instrument]);
    const topics = template.nodes === 'topics' ? ((instrument?.params.topics as string[] | undefined) ?? []) : [...template.nodes];
    if (topics.length > MAX_TREE_NODES) {
      issues.push(generatorIssue('G-SKL-02', 'warning', `domains.${ctx.domain.id}`, 'A SKILL TREE WAS TRIMMED.', `A tree holds at most ${MAX_TREE_NODES} topics; the first ${MAX_TREE_NODES} were kept.`));
    }
    skills.push({
      id: `${ctx.domain.id}.tree`, domainId: ctx.domain.id, instrumentId: ctx.ids[template.instrument]!, name: template.name, designation: template.designation,
      nodes: topics.slice(0, MAX_TREE_NODES).map((topic) => ({ id: topic, name: topic })), policy: structuredClone(template.policy),
    });
  }
  return { skills, issues };
}
