// LEGACY_BLUEPRINT_V1 — the owner's System, as data (platform/02 §21.1, §22.1).
//
// This reproduces what the code DOES, including the documented deviations
// from the spec (platform/02 §22.1): Reduced Mode does not collapse quests,
// the onboarding rhythm answers are ignored (08:30 / 60 min / 8,000 steps are
// pinned), MVD means "an opened day with a core completion", and so on. A
// fidelity test (tests/blueprint/legacy-v1.test.ts) cross-checks every value
// against the live constants, so the two cannot drift apart unnoticed.
//
// It is a function of the arc because four things belong to the arc, not to
// the System: its id, dates, timezone and day boundary. For the owner those
// equal the defaults in engine/config.ts; for anyone who started with the old
// onboarding they are the arc's own (platform/05 loop 1.3).
import type {
  AchievementDef, AttributeDef, BossDef, ComparisonRowDef, Criterion, DomainDefinition, EvidenceDef, GateClause, GateCondition, InstrumentConfig,
  MilestoneDef, QuestTemplateDef, RankGateDef, RealityRowDef, SignalRef, SkillTreeDef, SystemBlueprint,
} from '../schema';
import type { ConditionFormat, Comparator } from '../schema';

export interface LegacyArcFacts {
  id: string;
  start_date: string;
  end_date: string;
  timezone: string;
  day_boundary_hour: number;
  day_close_hour: number;
  main_quest_text: string;
  stake_text?: string;
}

/** The arc engine/config.ts hard-codes; LEGACY_BLUEPRINT_V1 is this arc's System. */
export const OWNER_ARC_DEFAULTS: LegacyArcFacts = {
  id: 'legacy-arc', start_date: '2026-09-01', end_date: '2026-12-29', timezone: 'Asia/Kolkata',
  day_boundary_hour: 4, day_close_hour: 3, main_quest_text: 'The owner’s arc.',
};

// ── Topic lists (engine/dsa.ts, engine/foundations.ts, store/skills.ts) ─────
const DSA_TOPICS = ['Arrays', 'Strings', 'Hashing', 'Two Pointers', 'Sliding Window', 'Stacks', 'Trees', 'Graphs', 'DP'];
const FOUNDATION_TOPICS = ['Operating Systems', 'Networking', 'Databases', 'Distributed Systems', 'Concurrency', 'Backend Engineering', 'System Design', 'Performance', 'Production Architecture'];
const AI_TOPICS = [
  'LLM Fundamentals', 'Prompting with Cache-Awareness', 'Structured Outputs', 'Tool Calling', 'Embeddings', 'RAG Basics',
  'Vector Store Selection', 'Model Landscape & Pricing', 'Evaluation Design', 'Agent Orchestration', 'Context Engineering',
  'MCP Protocol', 'Cost & Latency Optimization', 'Observability & Tracing', 'Guardrails & OWASP LLM Risks',
  'Sandboxing & Kill-Switches', 'Production Deployment', 'Async Job Architecture', 'Multi-Agent Coordination',
  'Computer-Use / Vision-Action Loops', 'Custom Fine-Tuning',
];
/** The six foundation topics Boss II names (engine/boss.ts BOSS_II_TOPICS). */
const BOSS_II_TOPICS = ['Operating Systems', 'Networking', 'Databases', 'Distributed Systems', 'Concurrency', 'Backend Engineering'];

// ── Signal and condition helpers ────────────────────────────────────────────
type Aggregate = Extract<SignalRef, { source: 'instrument' }>['aggregate'];
const inst = (instrumentId: string, signal: string, aggregate: Aggregate, filter?: Record<string, string>): SignalRef =>
  filter ? { source: 'instrument', instrumentId, signal, aggregate, filter } : { source: 'instrument', instrumentId, signal, aggregate };
const glob = (signal: Extract<SignalRef, { source: 'global' }>['signal'], id?: string, aggregate?: Aggregate): SignalRef => {
  const ref: Extract<SignalRef, { source: 'global' }> = { source: 'global', signal };
  if (id !== undefined) ref.id = id;
  if (aggregate !== undefined) ref.aggregate = aggregate;
  return ref;
};
const sum = (...of: SignalRef[]): SignalRef => ({ source: 'sum', of });
const ratio = (num: SignalRef, den: SignalRef): SignalRef => ({ source: 'ratio', num, den });
const clause = (signal: SignalRef, comparator: Comparator, threshold: number | [number, number], format?: ConditionFormat): GateClause =>
  format ? { signal, comparator, threshold, format } : { signal, comparator, threshold };
/** A condition; its top-level signal/comparator/threshold mirror the first clause. */
function condition(id: string, label: string, verifiability: GateCondition['verifiability'], clauses: GateClause[], clauseMode?: 'any'): GateCondition {
  const first = clauses[0] ?? clause(glob('first_quest'), '>=', 0);
  const result: GateCondition = { id, label, signal: first.signal, comparator: first.comparator, threshold: first.threshold, verifiability, clauses };
  if (first.format) result.format = first.format;
  if (clauseMode) result.clauseMode = clauseMode;
  return result;
}

// The evidence signals the gates, bosses and achievements read.
const PROBLEMS_TOTAL = inst('dsa.problems', 'count', 'total', { isRevisit: 'false' });
const FIRST_ATTEMPT_M_28 = inst('dsa.problems', 'first_attempt_rate', 'window_28', { difficulty: 'M', isRevisit: 'false' });
const FIRST_ATTEMPT_M_ALL = inst('dsa.problems', 'first_attempt_rate', 'total', { difficulty: 'M', isRevisit: 'false' });
const SESSIONS_TOTAL = inst('training.sessions', 'count', 'total');
const QUALITY_APPS = inst('career.applications', 'quality_count', 'total');
const FOLLOW_THROUGH = inst('career.applications', 'followthrough_rate', 'total');
const NETWORKING = inst('career.substitute', 'mode_counts', 'total', { mode: 'networking' });
const MOCKS = inst('career.substitute', 'mode_counts', 'total', { mode: 'mock' });
const AI_FEATURE = inst('build.artifacts', 'count', 'total', { kind: 'feature', hasUrl: 'true' });
const PROJECTS_TOTAL = inst('build.artifacts', 'projects_with', 'total', { kind: 'project' });
const PROJECTS_WITH_EVAL = inst('build.artifacts', 'projects_with_all_kinds', 'total', { kinds: 'project,eval' });
const DEPLOYED = inst('build.artifacts', 'count', 'total', { kind: 'deployment' });
const WRITEUPS = inst('build.artifacts', 'count', 'total', { kind: 'writeup' });
const COST_MEASURED = inst('build.artifacts', 'count', 'total', { kind: 'project', costPerTaskStated: 'true' });
const RESUMES = inst('career.resumes', 'count', 'total');
const RESUMES_REVIEWED = inst('career.resumes', 'count', 'total', { externalReview: 'true' });
const MASTERY = (state: 'introduced' | 'applied' | 'fluent' | 'retained', filter: Record<string, string> = { tree: 'foundations' }): SignalRef =>
  inst('foundations.blocks', 'topic_mastery', `mastery_count_at_least:${state}`, filter);
const DESIGNS = inst('foundations.design', 'blocks', 'total');
const DESIGNS_WRITTEN = inst('foundations.design', 'blocks', 'total', { mode: 'written_up' });
const DESIGNS_EXPLAINED = inst('foundations.design', 'blocks', 'total', { mode: 'explained_aloud' });
const EST_1RM_GAIN = inst('training.sessions', 'strength_gain_pct', 'total');
const MEAN_STEPS = inst('training.steps', 'mean_value', 'window_28');
const WAKE_SD = inst('sleep.wake', 'sd_minutes_failsafe', 'window_28');
const SCREEN_AVG = inst('attention.screen', 'mean_value_failsafe', 'window_28');
const BENCHMARK: SignalRef = { source: 'metric', metricId: 'interview_benchmark', aggregate: 'max' };
const CORE_COMPLETION_28 = glob('consistency_28');
const BOSS_CLEARED = (id: string) => glob('boss_cleared', id);

// Frequently repeated condition shapes (labels are the owner's exact words).
const need = (id: string, noun: string, signal: SignalRef, n: number) => condition(id, `{0} ${noun} (need ${n})`, 'count', [clause(signal, '>=', n, 'int')]);
const coreCompletion = (id: string, floor: number) => condition(id, `Core completion {0} (need ${floor}%)`, 'count', [clause(CORE_COMPLETION_28, '>=', floor / 100, 'percent')]);
const flag = (id: string, label: string, verifiability: GateCondition['verifiability'], signal: SignalRef, n = 1) => condition(id, label, verifiability, [clause(signal, '>=', n)]);
const firstAttempt = (id: string, floor: number, signal: SignalRef = FIRST_ATTEMPT_M_28) => condition(id, `First-attempt M {0} (need ${floor}%)`, 'count', [clause(signal, '>=', floor / 100, 'percent')]);
const SYSTEM_DESIGNS_120 = condition('designs', '{0} designs studied (need 12), {1} written (need 4), {2} explained (need 2)', 'count', [clause(DESIGNS, '>=', 12, 'int'), clause(DESIGNS_WRITTEN, '>=', 4, 'int'), clause(DESIGNS_EXPLAINED, '>=', 2, 'int')]);
const RESUME_V3 = condition('resume-v3', 'Resume v3 with an external review', 'recorded', [clause(RESUMES, '>=', 3), clause(RESUMES_REVIEWED, '>=', 1)]);
const FOUNDATIONS_90 = condition('foundations-90', '{0} Fluent (need 5), {1} Retained (need 2)', 'count', [clause(MASTERY('fluent'), '>=', 5, 'int'), clause(MASTERY('retained'), '>=', 2, 'int')]);


// ── What a sealed checkpoint freezes (engine/rank.ts GateEvidence, field for field) ──
const evidence = (key: string, signal: SignalRef, zero: number | boolean = 0, atLeast?: number): EvidenceDef =>
  atLeast === undefined ? { key, signal, zero } : { key, signal, atLeast, zero };
const EVIDENCE: EvidenceDef[] = [
  evidence('mvdConsistency14d', glob('consistency_14')),
  evidence('coreCompletion28d', CORE_COMPLETION_28),
  evidence('problemsTotal', PROBLEMS_TOTAL),
  evidence('firstAttemptRateM28d', FIRST_ATTEMPT_M_28),
  evidence('trainingSessionsTotal', SESSIONS_TOTAL),
  evidence('meanSteps', MEAN_STEPS),
  evidence('wakeSdMin', WAKE_SD, 999),
  evidence('screenTimeAvgMin', SCREEN_AVG),
  evidence('qualityApplicationsTotal', QUALITY_APPS),
  evidence('followThroughRate', FOLLOW_THROUGH),
  evidence('networkingConversations', NETWORKING),
  evidence('recordedMocks', MOCKS),
  evidence('aiFeaturePublicRepo', AI_FEATURE, false, 1),
  evidence('publicProjectsTotal', PROJECTS_TOTAL),
  evidence('publicProjectsWithEvalSuite', PROJECTS_WITH_EVAL),
  evidence('publicProjectsDeployedReachable', DEPLOYED),
  evidence('publishedWriteups', WRITEUPS),
  evidence('resumeVersionsTotal', RESUMES),
  evidence('resumeExternallyReviewed', RESUMES_REVIEWED, false, 1),
  evidence('foundationTopicsIntroducedPlus', MASTERY('introduced')),
  evidence('foundationTopicsFluentPlus', MASTERY('fluent')),
  evidence('foundationTopicsRetainedPlus', MASTERY('retained')),
  evidence('systemDesignsStudied', DESIGNS),
  evidence('systemDesignsWrittenUp', DESIGNS_WRITTEN),
  evidence('systemDesignsExplainedAloud', DESIGNS_EXPLAINED),
  evidence('trainingEst1RmGainPct', EST_1RM_GAIN),
  evidence('costPerTaskMeasured', COST_MEASURED, false, 1),
  evidence('interviewBenchmarkPassed', BENCHMARK, false, 1),
  evidence('bossICleared', BOSS_CLEARED('I'), false, 1),
  evidence('bossIICleared', BOSS_CLEARED('II'), false, 1),
  evidence('bossIIICleared', BOSS_CLEARED('III'), false, 1),
  evidence('bossIVCleared', BOSS_CLEARED('IV'), false, 1),
  evidence('arcSealed', glob('prior_checkpoints_sealed'), false, 4),
];

const COMPARISON: ComparisonRowDef[] = [
  { id: 'problems', label: 'Problems solved', evidenceKey: 'problemsTotal', format: 'int', direction: 'higher' },
  { id: 'quality-applications', label: 'Quality applications', evidenceKey: 'qualityApplicationsTotal', format: 'int', direction: 'higher' },
  { id: 'public-projects', label: 'Public projects', evidenceKey: 'publicProjectsTotal', format: 'int', direction: 'higher' },
  { id: 'foundations', label: 'Foundations >= Introduced', evidenceKey: 'foundationTopicsIntroducedPlus', format: 'of9', direction: 'higher' },
  { id: 'training', label: 'Training sessions', evidenceKey: 'trainingSessionsTotal', format: 'int', direction: 'higher' },
  { id: 'first-attempt', label: 'First-attempt rate (M)', evidenceKey: 'firstAttemptRateM28d', format: 'percent', direction: 'higher' },
  { id: 'wake-sd', label: 'Wake SD', evidenceKey: 'wakeSdMin', format: 'minutes', direction: 'lower', onlyWhenBaselineBelow: 999 },
];

// ── The REALITY tab: cumulative, real-world numbers, never scored ───────────
const REALITY: RealityRowDef[] = [
  { key: 'problems', label: 'Problems', signal: PROBLEMS_TOTAL },
  { key: 'firstAttemptRateM', label: 'First-attempt rate (M)', signal: FIRST_ATTEMPT_M_ALL },
  { key: 'publicProjects', label: 'Public projects', signal: inst('build.artifacts', 'count', 'total', { kind: 'project' }) },
  { key: 'evals', label: 'Eval suites', signal: inst('build.artifacts', 'count', 'total', { kind: 'eval' }) },
  { key: 'applications', label: 'Applications', signal: inst('career.applications', 'submitted', 'total') },
  { key: 'qualityRate', label: 'Quality rate', signal: inst('career.applications', 'quality_rate', 'total') },
  { key: 'followThroughRate', label: 'Follow-through', signal: FOLLOW_THROUGH },
  { key: 'foundationsFluentOrBetter', label: 'Foundations at Fluent or better', signal: MASTERY('fluent') },
];

// ── The weekly review's headline numbers (7 days ending on the review day) ──
const W7 = 'window_7' as const;
const WEEKLY_METRICS: RealityRowDef[] = [
  { key: 'xpEarned', label: 'XP earned', signal: glob('xp_earned', undefined, W7) },
  { key: 'deepWorkMinutes', label: 'Deep work (minutes)', signal: sum(inst('build.sessions', 'minutes', W7), inst('foundations.blocks', 'minutes', W7), inst('foundations.design', 'minutes', W7)) },
  { key: 'applications', label: 'Applications', signal: inst('career.applications', 'submitted', W7) },
  { key: 'qualityApplications', label: 'Quality applications', signal: inst('career.applications', 'quality_count', W7) },
  { key: 'problems', label: 'Problems', signal: inst('dsa.problems', 'count', W7, { isRevisit: 'false' }) },
  { key: 'buildSessions', label: 'Build sessions', signal: inst('build.sessions', 'records', W7) },
  { key: 'learnBlocks', label: 'Learning blocks', signal: inst('foundations.blocks', 'blocks', W7) },
  { key: 'trainingSessions', label: 'Training sessions', signal: inst('training.sessions', 'count', W7) },
  { key: 'meanSteps', label: 'Mean steps', signal: inst('training.steps', 'mean_value', W7) },
];

function gates(): RankGateDef[] {
  return [
    { rank: 'E', day: 0, conditions: [condition('start', 'Start', 'structural', [])] },
    { rank: 'D', day: 14, conditions: [condition('mvd-14', 'MVD consistency {0} (need 70%)', 'count', [clause(glob('consistency_14'), '>=', 0.7, 'percent')])] },
    {
      rank: 'C', day: 30,
      conditions: [
        coreCompletion('core', 60),
        need('problems', 'problems', PROBLEMS_TOTAL, 55),
        need('training', 'training sessions', SESSIONS_TOTAL, 12),
        flag('ai-feature', 'AI feature committed to a public repo', 'public_url', AI_FEATURE),
        need('quality-apps', 'quality applications', QUALITY_APPS, 70),
        condition('foundations-introduced', '{0} foundation topics at Introduced (need 3)', 'count', [clause(MASTERY('introduced'), '>=', 3, 'int')]),
      ],
    },
    {
      rank: 'B', day: 60,
      conditions: [
        coreCompletion('core', 65),
        need('problems', 'problems', PROBLEMS_TOTAL, 130),
        firstAttempt('first-attempt-m', 50),
        need('training', 'training sessions', SESSIONS_TOTAL, 28),
        flag('project-eval', 'Public project with README + eval suite', 'public_url', PROJECTS_WITH_EVAL),
        need('quality-apps', 'quality applications', QUALITY_APPS, 150),
        condition('resume-v2', 'Resume v2 with an external review', 'recorded', [clause(RESUMES, '>=', 2), clause(RESUMES_REVIEWED, '>=', 1)]),
        condition('foundations-fluent', '{0} foundation topics at Fluent (need 3)', 'count', [clause(MASTERY('fluent'), '>=', 3, 'int')]),
        flag('boss-i', 'Boss I cleared', 'structural', BOSS_CLEARED('I')),
      ],
    },
    {
      rank: 'A', day: 90,
      conditions: [
        coreCompletion('core', 65),
        need('problems', 'problems', PROBLEMS_TOTAL, 200),
        firstAttempt('first-attempt-m', 60),
        need('training', 'training sessions', SESSIONS_TOTAL, 42),
        condition('projects-deployed', '{0} public projects, >= 1 deployed (need 2)', 'public_url', [clause(PROJECTS_TOTAL, '>=', 2, 'int'), clause(DEPLOYED, '>=', 1)]),
        flag('writeup', 'Published technical write-up', 'public_url', WRITEUPS),
        need('quality-apps', 'quality applications', QUALITY_APPS, 230),
        condition('follow-through', 'Follow-through {0} (need 70%)', 'count', [clause(FOLLOW_THROUGH, '>=', 0.7, 'percent')]),
        need('networking', 'networking conversations', NETWORKING, 8),
        need('mocks', 'recorded mocks', MOCKS, 2),
        condition('wake-sd', 'Wake SD {0}min (need < 60)', 'recorded', [clause(WAKE_SD, '<', 60, 'round')]),
        FOUNDATIONS_90,
        condition('bosses-i-ii', 'Bosses I-II cleared', 'structural', [clause(BOSS_CLEARED('I'), '>=', 1), clause(BOSS_CLEARED('II'), '>=', 1)]),
      ],
    },
    {
      rank: 'S', day: 120,
      conditions: [
        need('problems', 'problems', PROBLEMS_TOTAL, 240),
        firstAttempt('first-attempt-m', 60),
        flag('benchmark', 'Interview-readiness benchmark passed', 'self_cert', BENCHMARK),
        condition('foundations-120', '{0}/9 foundations >= Applied, {1} Fluent (need 8), {2} Retained (need 3)', 'count', [clause(MASTERY('introduced'), '>=', 9, 'int'), clause(MASTERY('fluent'), '>=', 8, 'int'), clause(MASTERY('retained'), '>=', 3, 'int')]),
        SYSTEM_DESIGNS_120,
        condition('projects-eval', '{0} public projects with evals (need 3)', 'public_url', [clause(PROJECTS_WITH_EVAL, '>=', 3, 'int')]),
        flag('deployed', '>= 1 project deployed and reachable', 'public_url', DEPLOYED),
        flag('cost-per-task', 'Cost-per-task measured on >= 1 project', 'self_cert', COST_MEASURED),
        flag('writeup', 'Published technical write-up', 'public_url', WRITEUPS),
        RESUME_V3,
        need('quality-apps', 'quality applications', QUALITY_APPS, 280),
        condition('follow-through', 'Follow-through {0} (need 70%)', 'count', [clause(FOLLOW_THROUGH, '>=', 0.7, 'percent')]),
        need('networking', 'networking conversations', NETWORKING, 8),
        need('mocks', 'recorded mocks', MOCKS, 4),
        need('training', 'training sessions', SESSIONS_TOTAL, 55),
        condition('est-1rm', 'Est. 1RM aggregate {0} (need +12%)', 'recorded', [clause(EST_1RM_GAIN, '>=', 0.12, 'percent')]),
        condition('mean-steps', 'Mean steps {0} (need >= 8,000)', 'recorded', [clause(MEAN_STEPS, '>=', 8000, 'locale')]),
        condition('core-band', 'Core completion {0} (need 60-85%)', 'count', [clause(CORE_COMPLETION_28, 'between', [0.6, 0.85], 'percent')]),
        condition('wake-sd', 'Wake SD {0}min (need < 45)', 'recorded', [clause(WAKE_SD, '<', 45, 'round')]),
        condition('screen', 'Screen time {0}min/day (need <= 60)', 'recorded', [clause(SCREEN_AVG, '<=', 60, 'round')]),
        condition('bosses-all', 'Bosses I-IV cleared', 'structural', ['I', 'II', 'III', 'IV'].map((id) => clause(BOSS_CLEARED(id), '>=', 1))),
        flag('arc-sealed', 'Arc data sealed and exported', 'structural', glob('prior_checkpoints_sealed'), 4),
      ],
    },
  ];
}

function bosses(): { bosses: BossDef[]; milestones: MilestoneDef[] } {
  const defs: BossDef[] = [
    {
      id: 'I', title: 'FIRST EVIDENCE', anchorMilestoneId: 'm-first-evidence', windowStartDay: 25, windowEndDay: 35, gatesRank: 'B',
      conditions: [
        need('problems', 'problems', PROBLEMS_TOTAL, 55),
        need('training', 'training sessions', SESSIONS_TOTAL, 12),
        need('quality-apps', 'quality applications', QUALITY_APPS, 70),
        flag('ai-feature', 'AI feature in a public repo with a README', 'public_url', AI_FEATURE),
        flag('day-30', 'Day-30 checkpoint sealed', 'structural', glob('checkpoint_sealed', '30')),
      ],
    },
    {
      id: 'II', title: 'STRONG ENGINEERING BASE', anchorMilestoneId: 'm-engineering-base', windowStartDay: 50, windowEndDay: 70, gatesRank: 'A',
      conditions: [
        condition('applied', '{0}/6 of OS/networking/databases/distributed/concurrency/backend at >= Applied', 'count', [clause(MASTERY('applied', { tree: 'foundations', topics: BOSS_II_TOPICS.join('|') }), '>=', BOSS_II_TOPICS.length, 'int')]),
        condition('fluent', '{0} of those six at Fluent (need 3)', 'count', [clause(MASTERY('fluent', { tree: 'foundations', topics: BOSS_II_TOPICS.join('|') }), '>=', 3, 'int')]),
        need('designs', 'system designs studied', DESIGNS, 6),
        need('designs-written', 'written up', DESIGNS_WRITTEN, 2),
      ],
    },
    {
      id: 'III', title: 'AI ENGINEER', anchorMilestoneId: 'm-ai-engineer', windowStartDay: 75, windowEndDay: 95,
      conditions: [
        flag('project-eval', 'Public repo project with README + eval suite (golden set)', 'public_url', PROJECTS_WITH_EVAL),
        flag('deployed', 'Deployed and reachable', 'public_url', DEPLOYED),
        flag('cost-per-task', 'Cost-per-task measured', 'self_cert', COST_MEASURED),
        flag('writeup', 'Technical write-up published', 'public_url', WRITEUPS),
      ],
    },
    {
      id: 'IV', title: 'INTERVIEW READY', anchorMilestoneId: 'm-interview-ready', windowStartDay: 100, windowEndDay: 120, gatesRank: 'S',
      conditions: [
        need('problems', 'problems', PROBLEMS_TOTAL, 200),
        firstAttempt('first-attempt-m', 60, FIRST_ATTEMPT_M_ALL),
        condition('foundations', '{0} topics Fluent (need 8), {1} Retained (need 3)', 'count', [clause(MASTERY('fluent'), '>=', 8, 'int'), clause(MASTERY('retained'), '>=', 3, 'int')]),
        SYSTEM_DESIGNS_120,
        RESUME_V3,
        need('mocks', 'recorded mocks', MOCKS, 4),
        flag('benchmark', 'Interview-readiness benchmark passed', 'self_cert', BENCHMARK),
        flag('arc-sealed', 'Arc data sealed', 'structural', glob('prior_checkpoints_sealed'), 4),
      ],
    },
  ];
  // Each boss is anchored to a milestone (rule B1); the legacy milestone is the boss's headline condition.
  const milestones: MilestoneDef[] = defs.map((boss, index) => ({
    id: boss.anchorMilestoneId, domainId: ['dsa', 'foundations', 'build', 'career'][index]!, label: boss.title,
    condition: boss.conditions[0]!, declaredBy: 'legacy',
  }));
  return { bosses: defs, milestones };
}

const achievementsAndIdentities: AchievementDef[] = [
  { id: 'first_move', label: 'First Move', condition: condition('first-move', 'First Move', 'structural', [clause(glob('first_quest'), '>=', 1)]) },
  { id: 'two_weeks', label: 'Two Weeks', condition: condition('two-weeks', 'Two Weeks', 'count', [clause(glob('mvd_days', undefined, 'total'), '>=', 14)]) },
  { id: 'century', label: 'Century', condition: condition('century', 'Century', 'count', [clause(PROBLEMS_TOTAL, '>=', 100)]) },
  { id: 'shipped', label: 'Shipped', condition: condition('shipped', 'Shipped', 'public_url', [clause(AI_FEATURE, '>=', 1)]) },
  { id: 'return', label: 'Return', condition: condition('return', 'Return', 'structural', [clause(glob('recovered_after_gap'), '>=', 1)]) },
  { id: 'regular', label: 'Regular', condition: condition('regular', 'Regular', 'recorded', [clause(WAKE_SD, '<', 45)]) },
  { id: 'in_public', label: 'In Public', condition: condition('in-public', 'In Public', 'public_url', [clause(DEPLOYED, '>=', 1), clause(WRITEUPS, '>=', 1)], 'any') },
  { id: 'the_arc', label: 'The Arc', condition: condition('the-arc', 'The Arc', 'structural', [clause(glob('checkpoint_sealed', '120'), '>=', 1)]) },
  { id: 'problem_solver', label: 'Problem Solver', kind: 'identity', condition: condition('problem-solver', 'Problem Solver', 'count', [clause(PROBLEMS_TOTAL, '>=', 100), clause(FIRST_ATTEMPT_M_28, '>=', 0.45)]) },
  { id: 'builder', label: 'Builder', kind: 'identity', condition: condition('builder', 'Builder', 'public_url', [clause(PROJECTS_TOTAL, '>=', 2)]) },
  { id: 'consistent', label: 'Consistent', kind: 'identity', condition: condition('consistent', 'Consistent', 'count', [clause(glob('mvd_days', undefined, 'window_90'), '>=', 60)]) },
  { id: 'trains', label: 'Someone Who Trains', kind: 'identity', condition: condition('trains', 'Someone Who Trains', 'recorded', [clause(SESSIONS_TOTAL, '>=', 40)]) },
  { id: 'keeps_promises', label: 'Someone Who Keeps Promises', kind: 'identity', condition: condition('keeps-promises', 'Someone Who Keeps Promises', 'count', [clause(glob('if_then_rate'), '>=', 0.8)]) },
];

// ── Attributes: the six formulas of engine/attributes.ts ────────────────────
const WINDOW_DAYS = glob('window_days', undefined, 'eligible_28');
const E28 = 'eligible_28' as const;
const deepMinutes = sum(inst('build.sessions', 'minutes', E28), inst('foundations.blocks', 'minutes', E28), inst('foundations.design', 'minutes', E28));
const deepRecords = sum(inst('build.sessions', 'records', E28), inst('foundations.blocks', 'blocks', E28), inst('foundations.design', 'blocks', E28));
const term = (id: string, label: string, weight: number, signal: SignalRef, transform: AttributeDef['terms'][number]['transform']): AttributeDef['terms'][number] => ({ id, label, weight, signal, transform });
const attributeDefs: AttributeDef[] = [
  {
    id: 'DISCIPLINE', name: 'DISCIPLINE', groupId: 'mind', description: 'Showing up: minimum-viable days, waking on time, staying off the screen.', combine: 'sum',
    terms: [
      term('mvd', 'MVD days', 0.4, ratio(glob('completion_days', undefined, E28), WINDOW_DAYS), { kind: 'rate' }),
      term('sleep', 'Sleep window hits', 0.35, ratio({ source: 'quest', questId: 'sleep', signal: 'completed_days', aggregate: E28 }, WINDOW_DAYS), { kind: 'rate' }),
      term('attention', 'Screen-time hits', 0.25, ratio({ source: 'quest', questId: 'attention', signal: 'completed_days', aggregate: E28 }, WINDOW_DAYS), { kind: 'rate' }),
    ],
  },
  {
    id: 'DEPTH', name: 'DEPTH', groupId: 'mind', description: 'Sustained deep work: daily minutes multiplied by block length.', combine: 'product', productKey: 'deep_minutes',
    terms: [
      term('daily_minutes', 'Mean daily deep minutes', 1, ratio(deepMinutes, WINDOW_DAYS), { kind: 'ratio', denominator: 150 }),
      term('block_length', 'Mean block length', 1, ratio(deepMinutes, deepRecords), { kind: 'ratio', denominator: 45 }),
    ],
  },
  {
    id: 'PROBLEM_SOLVING', name: 'PROBLEM SOLVING', groupId: 'mind', description: 'Volume, first-attempt accuracy on Mediums, and revisit success.', combine: 'sum',
    terms: [
      term('volume', 'Weighted problems', 0.45, inst('dsa.problems', 'weighted_volume', E28, { isRevisit: 'false' }), { kind: 'ratio', denominator: 110 }),
      term('first_attempt_m', 'First-attempt rate (M)', 0.35, inst('dsa.problems', 'first_attempt_rate', E28, { difficulty: 'M', isRevisit: 'false' }), { kind: 'rate' }),
      term('revisit_success', 'Revisit success', 0.2, inst('dsa.problems', 'revisit_success_rate', E28), { kind: 'rate' }),
    ],
  },
  {
    id: 'ENGINEERING', name: 'ENGINEERING', groupId: 'craft', description: 'Foundations mastered, units shipped, and how much of it is eval-grade.', combine: 'sum',
    terms: [
      term('foundation_mastery', 'Foundation mastery', 0.35, inst('foundations.blocks', 'mastery_points', 'total', { tree: 'foundations' }), { kind: 'ratio', denominator: 24 }),
      term('shipped_units', 'Units shipped', 0.4, inst('build.artifacts', 'count', E28), { kind: 'ratio', denominator: 6 }),
      term('eval_coverage', 'Eval coverage', 0.25, ratio(inst('build.artifacts', 'count', E28, { kind: 'eval' }), inst('build.artifacts', 'count', E28)), { kind: 'rate' }),
    ],
  },
  {
    id: 'MOMENTUM', name: 'MOMENTUM', groupId: 'career', description: 'Applications sent, their quality, and following through.', combine: 'sum',
    terms: [
      term('applications', 'Applications', 0.4, inst('career.applications', 'submitted', E28), { kind: 'ratio', denominator: 70 }),
      term('quality', 'Quality rate', 0.35, inst('career.applications', 'quality_rate', E28), { kind: 'rate' }),
      term('follow_through', 'Follow-through', 0.25, inst('career.applications', 'followthrough_rate', E28), { kind: 'rate' }),
    ],
  },
  {
    id: 'VITALITY', name: 'VITALITY', groupId: 'body', description: 'Training sessions, daily movement, and a steady wake time.', combine: 'sum',
    terms: [
      term('sessions', 'Training sessions', 0.4, inst('training.sessions', 'count', E28), { kind: 'ratio', denominator: 16 }),
      term('steps', 'Mean steps', 0.3, inst('training.steps', 'mean_value', E28), { kind: 'ratio', denominator: 8000 }),
      term('wake_consistency', 'Wake consistency', 0.3, inst('sleep.wake', 'sd_minutes_neutral', E28), { kind: 'inverse_ratio', denominator: 90 }),
    ],
  },
];

// ── Quests ──────────────────────────────────────────────────────────────────
const leaf = (instrumentId: string, signal: string, comparator: '>=' | '<=', target: number, filter?: Record<string, string>): Criterion =>
  filter ? { kind: 'signal', instrumentId, signal, comparator, target, filter } : { kind: 'signal', instrumentId, signal, comparator, target };
const CRITERIA: Record<string, Criterion> = {
  career: { kind: 'any', of: [leaf('career.applications', 'quality_count', '>=', 3), leaf('career.substitute', 'minutes', '>=', 25)] },
  dsa: { kind: 'any', of: [leaf('dsa.problems', 'count', '>=', 1, { isRevisit: 'false' }), leaf('dsa.problems', 'minutes', '>=', 25, { isRevisit: 'false' })] },
  build: leaf('build.sessions', 'minutes', '>=', 45),
  training: { kind: 'any', of: [leaf('training.sessions', 'count', '>=', 1), leaf('training.steps', 'total_value', '>=', 8000)] },
  sleep: leaf('sleep.wake', 'hit', '>=', 1),
  attention: leaf('attention.screen', 'hit', '>=', 1),
};
/** engine/quests.ts CORE_QUEST_CRITERIA, the descriptor the quest_template cache row holds. */
const ROW_CRITERIA: Record<string, Record<string, unknown>> = {
  career: { kind: 'applications_or_substitute', applications: 3, substituteMinutes: 25 },
  dsa: { kind: 'problems_or_minutes', problems: 1, minutes: 25 },
  build: { kind: 'minutes_with_mode', minutes: 45, modes: ['LEARN', 'SHIP'] },
  training: { kind: 'session_or_steps', steps: 8000 },
  sleep: { kind: 'wake_window', toleranceMinutes: 30 },
  attention: { kind: 'screen_time_under', minutes: 60 },
};
const QUESTS: { key: string; designation: string; label: string; objective: string; xp: number; intention: boolean }[] = [
  { key: 'career', designation: 'ASCENSION', label: '3 despatches / 25m focus', objective: '3 verified despatches, or 25 minutes of substitute ascension focus.', xp: 100, intention: true },
  { key: 'dsa', designation: 'LOGIC TRIAL', label: '1 logic problem / 25m', objective: '1 logic problem logged, or 25 minutes of algorithm analysis.', xp: 100, intention: true },
  { key: 'build', designation: 'FORGE', label: '45m construct session', objective: '45+ minutes of construct work, tagged ASSIMILATE or MANIFEST.', xp: 100, intention: false },
  { key: 'training', designation: 'VITALITY TRIAL', label: 'conditioning or 8k steps', objective: 'A physical conditioning session, or 8,000+ steps registered.', xp: 100, intention: true },
  { key: 'sleep', designation: 'RECONSTITUTION', label: 'sync window 08:00–09:00', objective: 'Synchronization active: wake within 30 minutes of 08:30 (08:00–09:00).', xp: 60, intention: false },
  { key: 'attention', designation: 'WILL TRIAL', label: 'friction control ≤ 60m', objective: 'Cognitive friction control: 60 minutes or under screen time.', xp: 40, intention: false },
];

// ── Domains and instruments ─────────────────────────────────────────────────
const dom = (id: string, role: DomainDefinition['role'], name: string, designation: string, description: string, priority: number, icon: string, hue: string, channel: string, cap: number, instrumentIds: string[], extra: Partial<DomainDefinition> = {}): DomainDefinition => ({
  id, role, name, designation, description, priority, presentation: { icon, hue }, instrumentIds, channel: { id: channel, cap }, reviewPromptIds: [], ...extra,
});
const DOMAINS: DomainDefinition[] = [
  dom('career', 'engine', 'Job search', 'ASCENSION', 'Applications and the work that substitutes for them.', 1, 'Briefcase', 'violet', 'CAREER', 140, ['career.applications', 'career.substitute', 'career.resumes'], { coreQuestId: 'career', intention: { allowed: true }, evidenceSurface: 'resume' }),
  dom('dsa', 'engine', 'Algorithms', 'LOGIC TRIAL', 'Problems solved, revisited and mastered.', 2, 'Code', 'violet', 'MIND', 200, ['dsa.problems'], { coreQuestId: 'dsa', intention: { allowed: true } }),
  dom('build', 'engine', 'Building', 'FORGE', 'Construct sessions and shipped work.', 3, 'Cpu', 'blue', 'CRAFT', 200, ['build.sessions', 'build.artifacts'], { coreQuestId: 'build', intention: { allowed: false }, evidenceSurface: 'portfolio' }),
  dom('training', 'engine', 'Training', 'VITALITY TRIAL', 'Conditioning sessions and daily movement.', 4, 'Barbell', 'rose', 'BODY', 150, ['training.sessions', 'training.steps'], { coreQuestId: 'training', intention: { allowed: true } }),
  dom('sleep', 'guardrail', 'Sleep', 'RECONSTITUTION', 'Waking inside the window.', 5, 'MoonStars', 'violet', 'SLEEP', 60, ['sleep.wake'], { coreQuestId: 'sleep', intention: { allowed: false } }),
  dom('attention', 'guardrail', 'Attention', 'WILL TRIAL', 'Screen time under the limit.', 6, 'Eye', 'blue', 'ATTENTION', 40, ['attention.screen'], { coreQuestId: 'attention', intention: { allowed: false } }),
  dom('foundations', 'support', 'Foundations', 'ARCANE STUDY', 'Systems foundations and the AI tier, by learning block.', 7, 'BookOpen', 'blue', 'LEARN', 75, ['foundations.blocks', 'foundations.design']),
  dom('maintenance', 'support', 'Maintenance', 'MAINTENANCE', 'One zero-pressure daily row.', 8, 'Broom', 'slate', 'MAINT', 20, ['maintenance.daily']),
];

const ins = (id: string, domainId: string, type: InstrumentConfig['type'], label: string, logVerb: string, params: InstrumentConfig['params'], eventType: string): InstrumentConfig => ({
  id, domainId, type, label, logVerb, params, controllability: 'effort', eventBinding: { kind: 'legacy', eventType },
});
const DSA_OUTCOMES = ['first_attempt', 'hint', 'editorial', 'unsolved'];
const INSTRUMENTS: InstrumentConfig[] = [
  ins('career.applications', 'career', 'pipeline', 'Applications', 'Despatch Ascension', { stages: ['applied', 'responded', 'call', 'interview', 'onsite', 'offer'], qualityGate: 'legacy', followupAfterDays: 10 }, 'APPLICATION_LOGGED'),
  ins('career.substitute', 'career', 'duration', 'Substitute work', 'Log Focus', {}, 'CAREER_SUBSTITUTE_LOGGED'),
  ins('career.resumes', 'career', 'artifact', 'Resume versions', 'Record Resume', { kinds: ['resume'] }, 'RESUME_VERSION_CREATED'),
  ins('dsa.problems', 'dsa', 'practice_item', 'Problems', 'Record Logic Trial', { topics: DSA_TOPICS, difficultyScale: ['E', 'M', 'H'], outcomes: DSA_OUTCOMES, revisitGrant: { amount: 20, reason: 'revisit' }, maxRevisitsPerDay: 3 }, 'PROBLEM_LOGGED'),
  ins('build.sessions', 'build', 'duration', 'Build sessions', 'Log Construct', { modes: ['LEARN', 'SHIP'] }, 'BUILD_SESSION_LOGGED'),
  ins('build.artifacts', 'build', 'artifact', 'Shipped units', 'Forge Artifact', { kinds: ['feature', 'eval', 'project', 'deployment', 'writeup', 'resume', 'portfolio'], bonusXp: 50, grant: { amount: 50, reason: 'ship' } }, 'ARTIFACT_SHIPPED'),
  ins('training.sessions', 'training', 'session', 'Sessions', 'Log Conditioning', { sessionTypes: ['strength', 'cardio', 'mobility', 'sport', 'other'], estimator: 'epley' }, 'TRAINING_SESSION_LOGGED'),
  ins('training.steps', 'training', 'threshold', 'Steps', 'Register Steps', { unit: 'steps', comparator: '>=', target: 8000, bonusAt: 10000, bonusXp: 20, grant: { amount: 20, reason: 'steps_bonus' } }, 'STEPS_LOGGED'),
  ins('sleep.wake', 'sleep', 'time_window', 'Wake time', 'Log Wake', { targetTime: '08:30', toleranceMinutes: 30 }, 'SLEEP_LOGGED'),
  ins('attention.screen', 'attention', 'threshold', 'Screen time', 'Log Screen Time', { unit: 'min', comparator: '<=', target: 60 }, 'SCREENTIME_LOGGED'),
  ins('foundations.blocks', 'foundations', 'study_block', 'Learning blocks', 'Log Block', { topics: [...FOUNDATION_TOPICS, ...AI_TOPICS], blockXp: 25, grant: { amount: 25, reason: 'learning_block' } }, 'LEARNING_BLOCK_LOGGED'),
  ins('foundations.design', 'foundations', 'study_block', 'System design', 'Log Design Study', { topics: [], modes: ['studied', 'written_up', 'explained_aloud'], blockXp: 25, grant: { amount: 25, reason: 'system_design' } }, 'SYSTEM_DESIGN_LOGGED'),
  ins('maintenance.daily', 'maintenance', 'checklist', 'Maintenance', 'Tick Maintenance', { items: [{ id: 'bath', label: 'Bath' }, { id: 'fuel', label: 'Ate to plan' }, { id: 'laundry', label: 'Laundry', everyNDays: 3 }], xp: 20, grant: { amount: 20, reason: 'maintenance' } }, 'MAINTENANCE_LOGGED'),
];

const SKILLS: SkillTreeDef[] = [
  {
    id: 'dsa', domainId: 'dsa', instrumentId: 'dsa.problems', name: 'Algorithms', designation: 'LOGIC TRIAL',
    nodes: DSA_TOPICS.map((topic) => ({ id: topic, name: topic })),
    policy: { kind: 'practice_rate', appliedAt: 3, fluent: { minAttempts: 5, minRate: 0.6, minAboveEasiest: 2 }, retainedGapDays: 21, allowRegression: true },
  },
  {
    id: 'foundations', domainId: 'foundations', instrumentId: 'foundations.blocks', name: 'Foundations', designation: 'FOUNDATIONS',
    nodes: FOUNDATION_TOPICS.map((topic) => ({ id: topic, name: topic })),
    policy: { kind: 'block_count', introducedAt: 1, appliedAt: 3, fluentAt: 5, retainedGapDays: 21 },
  },
  {
    id: 'ai', domainId: 'foundations', instrumentId: 'foundations.blocks', name: 'AI tier', designation: 'AI',
    nodes: AI_TOPICS.map((topic) => ({ id: topic, name: topic })),
    policy: { kind: 'block_count', introducedAt: 1, appliedAt: 3, fluentAt: 5, retainedGapDays: 21 },
  },
];

/**
 * The owner's System for an arc. `legacyBlueprintFor(OWNER_ARC_DEFAULTS)` is
 * LEGACY_BLUEPRINT_V1. Every call returns a FRESH deep copy: the tables above
 * are module state, and a caller that edits its Blueprint (a test, a future
 * amendment) must never edit anyone else's.
 */
export function legacyBlueprintFor(arc: LegacyArcFacts = OWNER_ARC_DEFAULTS): SystemBlueprint {
  return structuredClone(assembleLegacyBlueprint(arc));
}

function assembleLegacyBlueprint(arc: LegacyArcFacts): SystemBlueprint {
  const { bosses: bossDefs, milestones } = bosses();
  const lengthDays = Math.round((Date.parse(`${arc.end_date}T00:00:00Z`) - Date.parse(`${arc.start_date}T00:00:00Z`)) / 86_400_000) + 1;
  return {
    schema: 'system-blueprint/1', lineageId: arc.id, version: 1, arcId: arc.id, activeFrom: arc.start_date, changeClass: 'genesis',
    provenance: { generator: 'legacy', libraryVersion: 'legacy' },
    identity: { displayName: 'SYSTEM', primaryObjective: arc.main_quest_text, ...(arc.stake_text ? { stake: arc.stake_text } : {}) },
    arc: { lengthDays, startDate: arc.start_date, endDate: arc.end_date, timezone: arc.timezone, dayBoundaryHour: arc.day_boundary_hour, dayCloseHour: arc.day_close_hour, wakeTime: '08:30', sleepTime: '02:00' },
    progression: {
      dailyCoreBudget: 500, dailyCap: 700, engineShare: 0.8, mvdXp: 35, recoveryXp: 40, bossXp: 500, weeklyQuestXp: 200,
      level: { base: 200, coefficient: 84, exponent: 0.98, roundTo: 10 },
      grace: { daysPer28: 4 }, reducedMode: { triggerMisses: 2, exitDays: 2, collapsesQuests: false }, attributeWindowDays: 28,
      checkpointDays: [14, 30, 60, 90, 120],
      rankSchedule: [{ day: 14, rank: 'D' }, { day: 30, rank: 'C' }, { day: 60, rank: 'B' }, { day: 90, rank: 'A' }, { day: 120, rank: 'S' }],
    },
    domains: DOMAINS,
    instruments: INSTRUMENTS,
    quests: QUESTS.map((quest): QuestTemplateDef => ({
      id: quest.key, domainId: quest.key, type: 'core', designation: quest.designation, realityLabel: quest.label, objective: quest.objective,
      criterion: CRITERIA[quest.key]!, floor: CRITERIA[quest.key]!, xp: quest.xp, bonus: [], schedule: { kind: 'daily' },
      evidenceMode: 'self_report_allowed', recoverable: true, intentionAllowed: quest.intention, rowCriterion: ROW_CRITERIA[quest.key]!,
    })),
    metrics: [
      { id: 'weight_kg', label: 'Weight', unit: 'kg', kind: 'body', source: { manual: true, cadence: 'any' }, direction: 'neutral' },
      { id: 'waist_cm', label: 'Waist', unit: 'cm', kind: 'body', source: { manual: true, cadence: 'any' }, direction: 'neutral' },
      { id: 'bodyfat_pct', label: 'Body fat', unit: '%', kind: 'body', source: { manual: true, cadence: 'any' }, direction: 'neutral' },
      { id: 'interview_benchmark', label: 'Interview-readiness benchmark', unit: 'pass', domainId: 'career', kind: 'performance', source: { manual: true, cadence: 'any' }, direction: 'higher' },
    ],
    skills: SKILLS,
    attributes: {
      groups: [
        { id: 'mind', heading: 'MIND', tagline: 'How you think and show up.', layout: 'mind', icon: 'Brain' },
        { id: 'craft', heading: 'CRAFT', tagline: 'What you build.', layout: 'craft', icon: 'Cpu' },
        { id: 'career', heading: 'CAREER', tagline: 'Where you are headed.', layout: 'craft', icon: 'Briefcase' },
        { id: 'body', heading: 'BODY', tagline: 'What carries you.', layout: 'body', icon: 'Barbell' },
      ],
      defs: attributeDefs,
    },
    milestones,
    gates: gates(),
    bosses: bossDefs,
    checkpoints: {
      selfEfficacy: [
        'Solve an unseen medium DSA problem in 25 minutes, in front of an interviewer?',
        "Explain your last project's architecture to a senior engineer for 10 minutes?",
        'Design an evaluation suite for an agent from a blank file?',
        "Complete your planned training session on a day you don't feel like it?",
        'Hold your wake time within 30 minutes for the next 14 days?',
        'Apply to 5 roles above your current level this week?',
      ].map((prompt, index) => ({ id: `self-efficacy-${index + 1}`, prompt })),
      automaticity: ['Waking at my target time', 'Training', 'Daily study', 'Sleeping at my target time'].map((prompt, index) => ({ id: `automaticity-${index + 1}`, prompt })),
      enjoyment: [['dsa', 'DSA'], ['build', 'Building/AI'], ['training', 'Training']].map(([domainId, prompt]) => ({ id: `enjoyment-${domainId}`, domainId: domainId!, prompt: prompt! })),
      evidence: EVIDENCE,
      comparison: COMPARISON,
    },
    achievements: achievementsAndIdentities,
    reviews: { domainPrompts: [], weeklyMetrics: WEEKLY_METRICS },
    rules: [
      { id: 'learn-ship', kind: 'MODE_RATIO', enabled: true, params: { instrumentId: 'build.sessions', ratio: 3, windowDays: 14 } },
      { id: 'wrong-time', kind: 'WRONG_TIME', enabled: true, params: { count: 3, windowDays: 14 } },
      { id: 'substitute-share', kind: 'SUBSTITUTE_SHARE', enabled: false },
      { id: 'low-conversion', kind: 'LOW_CONVERSION', enabled: false },
      { id: 'weakest-topic', kind: 'WEAKEST_TOPIC', enabled: false },
    ],
    messaging: { evidenceTemplates: [] },
    vocabulary: {},
    reality: REALITY,
  };
}

/** The owner's System at its default arc: the golden master the platform must reproduce. */
export const LEGACY_BLUEPRINT_V1: SystemBlueprint = deepFreeze(legacyBlueprintFor(OWNER_ARC_DEFAULTS));

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/** Instrument-level facts the grant economy reads, kept beside the data they describe. */
export const LEGACY_FOUNDATION_TOPICS = FOUNDATION_TOPICS;
