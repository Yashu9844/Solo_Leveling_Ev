import { DSA_TOPICS } from '../engine/dsa';
import { FOUNDATION_TOPICS } from '../engine/foundations';
import { getDsaTopicMastery, getFoundationTopicMastery } from './mastery';
import { db } from '../db/db';
import type { MasteryState, EngineConfig, EngineDeps } from '../engine/types';
import { logLearningBlock } from './build';
import type { SkillTreeDef, SystemBlueprint } from '../blueprint/schema';
import { practiceItemMastery, type PracticeItemRecord } from '../instruments/types/practiceItem';
import { studyBlockMastery, type StudyBlockRecord } from '../instruments/types/studyBlock';
import type { InstrumentRecord } from '../instruments/framework';
import { milestonesV2 } from './v2Reads';
import { foundationMasteryFor } from '../engine/foundations';

export interface TopicMastery {
  topic: string;
  state: MasteryState;
}

export const AI_TIER_TOPICS = [
  'LLM Fundamentals',
  'Prompting with Cache-Awareness',
  'Structured Outputs',
  'Tool Calling',
  'Embeddings',
  'RAG Basics',
  'Vector Store Selection',
  'Model Landscape & Pricing',
  'Evaluation Design',
  'Agent Orchestration',
  'Context Engineering',
  'MCP Protocol',
  'Cost & Latency Optimization',
  'Observability & Tracing',
  'Guardrails & OWASP LLM Risks',
  'Sandboxing & Kill-Switches',
  'Production Deployment',
  'Async Job Architecture',
  'Multi-Agent Coordination',
  'Computer-Use / Vision-Action Loops',
  'Custom Fine-Tuning',
] as const;

export async function getDsaSkillsOverview(): Promise<TopicMastery[]> {
  return Promise.all(DSA_TOPICS.map(async (topic) => ({ topic, state: await getDsaTopicMastery(topic) })));
}

export async function getFoundationSkillsOverview(): Promise<TopicMastery[]> {
  return Promise.all(FOUNDATION_TOPICS.map(async (topic) => ({ topic, state: await getFoundationTopicMastery(topic) })));
}

export async function getAiSkillsOverview(): Promise<TopicMastery[]> {
  const blocks = await db.learning_block.toArray();
  return AI_TIER_TOPICS.map((topic) => ({
    topic,
    state: foundationMasteryFor(
      topic,
      blocks.map((b) => ({ topic: b.topic, local_date: b.local_date }))
    ),
  }));
}

export interface TodayAutoFillSummary {
  dsaCount: number;
  learningBlockCount: number;
  buildMinutes: number;
  recentTopics: string[];
}

export async function getTodayAutoFillSummary(today: string): Promise<TodayAutoFillSummary> {
  const [dsaAttempts, learningBlocks, buildSessions] = await Promise.all([
    db.dsa_attempt.where('local_date').equals(today).toArray(),
    db.learning_block.where('local_date').equals(today).toArray(),
    db.build_session.where('local_date').equals(today).toArray(),
  ]);

  const dsaProblems = await db.dsa_problem.toArray();
  const problemMap = new Map(dsaProblems.map((p) => [p.id, p]));

  const dsaTopicsToday = dsaAttempts.map((a) => problemMap.get(a.problem_id)?.topic).filter((t): t is string => Boolean(t));
  const learnTopicsToday = learningBlocks.map((b) => b.topic);

  const uniqueTopics = Array.from(new Set([...dsaTopicsToday, ...learnTopicsToday]));
  const buildMinutes = buildSessions.reduce((sum, s) => sum + s.minutes, 0);

  return {
    dsaCount: dsaAttempts.length,
    learningBlockCount: learningBlocks.length,
    buildMinutes,
    recentTopics: uniqueTopics,
  };
}

export async function logQuickSkillPractice(
  today: string,
  arcId: string,
  topic: string,
  minutes: number,
  config: EngineConfig,
  deps: EngineDeps,
  note?: string
): Promise<void> {
  await logLearningBlock(today, arcId, topic, minutes, config, deps, note);
}

export interface CareerTreeOverview {
  applications: number;
  qualityApplications: number;
  resumeVersions: number;
  interviews: number;
  offers: number;
  artifactsByKind: Partial<Record<'feature' | 'eval' | 'project' | 'deployment' | 'writeup', number>>;
}

export async function getCareerTreeOverview(): Promise<CareerTreeOverview> {
  const [applications, resumeVersions, careerEvents, artifacts] = await Promise.all([
    db.application.toArray(),
    db.resume_version.toArray(),
    db.career_event.toArray(),
    db.artifact.toArray(),
  ]);

  const artifactsByKind: CareerTreeOverview['artifactsByKind'] = {};
  for (const kind of ['feature', 'eval', 'project', 'deployment', 'writeup'] as const) {
    artifactsByKind[kind] = artifacts.filter((a) => a.kind === kind).length;
  }

  return {
    applications: applications.length,
    qualityApplications: applications.filter((a) => a.quality_pass).length,
    resumeVersions: resumeVersions.length,
    interviews: careerEvents.filter((e) => e.kind === 'interview' || e.kind === 'onsite').length,
    offers: careerEvents.filter((e) => e.kind === 'offer').length,
    artifactsByKind,
  };
}

/**
 * The mastery of every node of a skill tree (platform/03 §27.3). The owner's trees read the
 * domain tables their instruments have always filled; a generic tree reads the instrument's
 * records through its mastery policy.
 */
export async function getTreeMastery(blueprint: SystemBlueprint, tree: SkillTreeDef): Promise<TopicMastery[]> {
  const instrument = blueprint.instruments.find((candidate) => candidate.id === tree.instrumentId);
  if (instrument?.eventBinding.kind === 'legacy') {
    if (tree.id === 'dsa') return getDsaSkillsOverview();
    if (tree.id === 'foundations') return getFoundationSkillsOverview();
    if (tree.id === 'ai') return getAiSkillsOverview();
    return tree.nodes.map((node) => ({ topic: node.name, state: 'unseen' as MasteryState }));
  }
  const rows = await db.instrument_record.where('instrument_id').equals(tree.instrumentId).toArray();
  const records = rows.map((row) => ({
    id: row.id, instrumentId: row.instrument_id, instrumentType: instrument?.type ?? 'study_block', domainId: row.domain_id, localDate: row.local_date,
    eventId: row.event_id, blueprintVersion: row.blueprint_version, record: row.record,
  })) as InstrumentRecord[];
  return tree.nodes.map((node) => ({
    topic: node.name,
    state: tree.policy.kind === 'practice_rate'
      ? practiceItemMastery(node.id, records as InstrumentRecord<PracticeItemRecord>[])
      : studyBlockMastery(node.id, records as InstrumentRecord<StudyBlockRecord>[], { introducedAt: tree.policy.introducedAt, appliedAt: tree.policy.appliedAt, fluentAt: tree.policy.fluentAt, retainedGapDays: tree.policy.retainedGapDays }),
  }));
}

/** The Blueprint's milestones with their live progress; empty when there is no arc. */
export async function getMilestonePanel(today: string): Promise<{ id: string; label: string; progress: string; met: boolean }[]> {
  return (await milestonesV2(today)) ?? [];
}
