// Immutable configuration for a System arc.  This module is deliberately
// data-only: evaluators and persistence arrive in later platform phases.

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type IconToken = string;
export type DomainHueToken = string;
export type ArtToken = string;
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type InstrumentType =
  | 'practice_item' | 'pipeline' | 'duration' | 'session' | 'threshold'
  | 'time_window' | 'artifact' | 'study_block' | 'checklist';
export type Aggregate =
  | 'day' | 'total' | 'window_14' | 'window_28' | 'rate_28' | 'mean_28'
  | 'sd_28' | 'latest' | `mastery_count_at_least:${MasteryState}`;
export type MasteryState = 'unseen' | 'introduced' | 'applied' | 'fluent' | 'retained';

export type SignalRef =
  | { source: 'instrument'; instrumentId: string; signal: string; aggregate: Aggregate; filter?: Record<string, string> }
  | { source: 'metric'; metricId: string; aggregate: Aggregate }
  | { source: 'global'; signal: 'mvd_days' | 'core_completion' | 'bosses_cleared' | 'checkpoints_sealed' | 'grace_used' };

export interface DomainDefinition {
  id: string; archetypeId?: string; role: 'engine' | 'guardrail' | 'support';
  name: string; designation: string; description: string; priority: number;
  presentation: { icon: IconToken; hue: DomainHueToken; artSlot?: ArtToken };
  instrumentIds: string[]; coreQuestId?: string; channel: { id: string; cap: number };
  intention?: { allowed: boolean }; reviewPromptIds: string[]; evidenceSurface?: string;
}

export type InstrumentParams = Record<string, unknown>;
export interface InstrumentConfig {
  id: string; domainId: string; type: InstrumentType; label: string; logVerb: string;
  params: InstrumentParams; controllability: 'effort';
  eventBinding: { kind: 'generic' } | { kind: 'legacy'; eventType: string };
}

export type Criterion =
  | { kind: 'signal'; instrumentId: string; signal: string; comparator: '>=' | '<='; target: number; filter?: Record<string, string> }
  | { kind: 'any'; of: Criterion[] }
  | { kind: 'all'; of: Criterion[] };
export interface BonusRule { instrumentId: string; per: string; amount: number; maxPerDay: number; filter?: Record<string, string> }
export interface QuestTemplateDef {
  id: string; domainId: string; type: 'core' | 'weekly'; designation: string; realityLabel?: string;
  objective: string; criterion: Criterion; floor: Criterion; xp: number; bonus: BonusRule[];
  schedule: { kind: 'daily' } | { kind: 'weekdays'; days: Weekday[] };
  timeWindow?: { notBefore?: string; notAfter?: string }; evidenceMode: 'self_report_allowed' | 'logged_only';
  recoverable: boolean; intentionAllowed: boolean;
}

export interface ProgressionSection {
  dailyCoreBudget: 500; dailyCap: number; engineShare: number; mvdXp: number; recoveryXp: number;
  bossXp: number; weeklyQuestXp: number; level: { base: number; coefficient: number; exponent: number; roundTo: number };
  grace: { daysPer28: number }; reducedMode: { triggerMisses: number; exitDays: number; collapsesQuests: boolean };
  attributeWindowDays: number; checkpointDays: number[]; rankSchedule: { day: number; rank: Rank }[];
}

export interface SkillTreeDef {
  id: string; domainId: string; instrumentId: string; name: string; designation: string;
  nodes: { id: string; name: string; tier?: string; dependsOn?: string[] }[];
  policy: { kind: 'practice_rate'; appliedAt: number; fluent: { minAttempts: number; minRate: number; minAboveEasiest: number }; retainedGapDays: number; allowRegression: boolean }
    | { kind: 'block_count'; introducedAt: number; appliedAt: number; fluentAt: number; retainedGapDays: number };
}
export interface AttributeGroupDef { id: string; heading: string; tagline: string; layout: 'body' | 'mind' | 'craft'; icon: IconToken }
export interface AttributeDef {
  id: string; name: string; groupId: string; description: string; combine: 'sum' | 'product';
  terms: { id: string; label: string; weight: number; signal: SignalRef; transform: { kind: 'ratio'; denominator: number } | { kind: 'rate' } | { kind: 'inverse_ratio'; denominator: number } }[];
}
export interface MetricDefinition {
  id: string; label: string; unit: string; domainId?: string; kind: 'effort' | 'performance' | 'external' | 'body';
  source: { instrumentId: string; signal: string } | { manual: true; cadence: 'checkpoint' | 'weekly' | 'any' };
  direction: 'higher' | 'lower' | 'neutral';
}
export interface GateCondition { id: string; label: string; signal: SignalRef; comparator: '>=' | '<=' | 'between'; threshold: number | [number, number]; verifiability: 'public_url' | 'recorded' | 'self_cert' | 'count' | 'structural' }
export interface MilestoneDef { id: string; domainId: string; label: string; condition: GateCondition; ladder?: { checkpointIndex: 1 | 2 | 3 | 4; threshold: number }[]; anchorsBoss?: string; declaredBy: 'user' | 'archetype' | 'legacy' }
export interface RankGateDef { rank: Rank; day: number; conditions: GateCondition[] }
export interface BossDef { id: string; title: string; anchorMilestoneId: string; windowStartDay: number; windowEndDay: number; conditions: GateCondition[]; gatesRank?: Rank }
export interface AchievementDef { id: string; label: string; condition: GateCondition; domainId?: string }
export interface CheckpointDef { selfEfficacy: { id: string; prompt: string }[]; automaticity: { id: string; prompt: string }[]; enjoyment: { id: string; domainId: string; prompt: string }[] }
export interface ReviewDef { domainPrompts: { id: string; domainId: string; prompt: string; options: string[] }[] }
export interface RuleDef { id: string; kind: 'MODE_RATIO' | 'WRONG_TIME' | 'SUBSTITUTE_SHARE' | 'LOW_CONVERSION' | 'WEAKEST_TOPIC'; enabled: boolean; params?: Record<string, unknown> }
export interface MessagingDef { evidenceTemplates: { id: string; tier: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'; signal?: SignalRef; template: string }[]; reflectionThemes?: string[] }
export interface VocabularyOverrides { [key: string]: string | undefined }

export interface SystemBlueprint {
  schema: 'system-blueprint/1'; lineageId: string; version: number; arcId: string; activeFrom: string;
  changeClass: 'genesis' | 'cosmetic' | 'operational' | 'structural';
  provenance: { generator: string; libraryVersion: string; presetId?: string; answersDigest?: string };
  identity: { displayName: string; primaryObjective: string; stake?: string };
  arc: { lengthDays: number; startDate: string; endDate: string; timezone: string; dayBoundaryHour: number; dayCloseHour: number; wakeTime: string; sleepTime: string };
  progression: ProgressionSection; domains: DomainDefinition[]; instruments: InstrumentConfig[]; quests: QuestTemplateDef[];
  metrics: MetricDefinition[]; skills: SkillTreeDef[]; attributes: { groups: AttributeGroupDef[]; defs: AttributeDef[] };
  milestones: MilestoneDef[]; gates: RankGateDef[]; bosses: BossDef[]; checkpoints: CheckpointDef;
  achievements: AchievementDef[]; reviews: ReviewDef; rules: RuleDef[]; messaging: MessagingDef; vocabulary: VocabularyOverrides;
}
