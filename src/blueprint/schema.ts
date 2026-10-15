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
  | 'day' | 'total' | 'window_7' | 'window_14' | 'window_28' | 'window_90' | 'eligible_28' | 'rate_28' | 'mean_28'
  | 'sd_28' | 'latest' | 'max' | `mastery_count_at_least:${MasteryState}`;
export type MasteryState = 'unseen' | 'introduced' | 'applied' | 'fluent' | 'retained';

export type SignalRef =
  | { source: 'instrument'; instrumentId: string; signal: string; aggregate: Aggregate; filter?: Record<string, string> }
  | { source: 'metric'; metricId: string; aggregate: Aggregate }
  | { source: 'global'; signal: GlobalSignalName; id?: string; aggregate?: Aggregate }
  | { source: 'quest'; questId: string; signal: 'completed_days'; aggregate?: Aggregate }
  | { source: 'sum'; of: SignalRef[] }
  | { source: 'ratio'; num: SignalRef; den: SignalRef };

/**
 * Arc-wide facts no single instrument owns. `id` selects one boss, checkpoint
 * day or the like. Anything that depends on a completed day (`mvd_days`,
 * `consistency_*`) is computed up to YESTERDAY, as the live streak is.
 */
export type GlobalSignalName =
  | 'mvd_days' | 'core_completion' | 'bosses_cleared' | 'checkpoints_sealed' | 'grace_used'
  | 'consistency_14' | 'consistency_28' | 'completion_days' | 'window_days' | 'first_quest'
  | 'recovered_after_gap' | 'if_then_rate' | 'boss_cleared' | 'checkpoint_sealed' | 'prior_checkpoints_sealed' | 'xp_earned';

export interface DomainDefinition {
  id: string; archetypeId?: string; role: 'engine' | 'guardrail' | 'support';
  name: string; designation: string; description: string; priority: number;
  presentation: { icon: IconToken; hue: DomainHueToken; artSlot?: ArtToken };
  instrumentIds: string[]; coreQuestId?: string; channel: { id: string; cap: number };
  intention?: { allowed: boolean }; reviewPromptIds: string[]; evidenceSurface?: string;
  /** Which app shortcut opens this domain's log: /log/primary or /log/evidence (the installed shortcuts keep their older paths). */
  shortcut?: 'primary' | 'evidence';
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
  /**
   * Legacy only: the descriptor the quest_template cache row has always held
   * (engine/quests.ts CORE_QUEST_CRITERIA). Kept so the V2 projections write
   * byte-identical rows for the owner; a generated System leaves it unset and
   * its row carries `criterion` itself. Goes away with the legacy paths (17.1).
   */
  rowCriterion?: Record<string, unknown>;
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
  /** A product attribute reports ONE component (the product), under this key. */
  productKey?: string;
  terms: { id: string; label: string; weight: number; signal: SignalRef; transform: { kind: 'ratio'; denominator: number } | { kind: 'rate' } | { kind: 'inverse_ratio'; denominator: number } }[];
}
export interface MetricDefinition {
  id: string; label: string; unit: string; domainId?: string; kind: 'effort' | 'performance' | 'external' | 'body';
  source: { instrumentId: string; signal: string } | { manual: true; cadence: 'checkpoint' | 'weekly' | 'any' };
  direction: 'higher' | 'lower' | 'neutral';
}
export type ConditionFormat = 'int' | 'percent' | 'round' | 'locale';
export type Comparator = '>=' | '<=' | '<' | '>' | 'between';
/** One test inside a compound condition; `format` renders its value into the label's {n} slot. */
export interface GateClause { signal: SignalRef; comparator: Comparator; threshold: number | [number, number]; format?: ConditionFormat }
/**
 * `label` is a template: {0}, {1}… take the formatted LIVE value of each clause and {t0}, {t1}… its threshold, so a threshold is never typed twice.
 * Without `clauses`, the condition is its own single clause. `clauseMode`
 * defaults to 'all'; an empty `clauses` list is always met.
 */
export interface GateCondition { id: string; label: string; signal: SignalRef; comparator: Comparator; threshold: number | [number, number]; verifiability: 'public_url' | 'recorded' | 'self_cert' | 'count' | 'structural'; format?: ConditionFormat; clauses?: GateClause[]; clauseMode?: 'all' | 'any' }
export interface MilestoneDef { id: string; domainId: string; label: string; condition: GateCondition; ladder?: { checkpointIndex: 1 | 2 | 3 | 4; threshold: number }[]; anchorsBoss?: string; declaredBy: 'user' | 'archetype' | 'legacy' }
export interface RankGateDef { rank: Rank; day: number; conditions: GateCondition[] }
export interface BossDef { id: string; title: string; anchorMilestoneId: string; windowStartDay: number; windowEndDay: number; conditions: GateCondition[]; gatesRank?: Rank }
export interface AchievementDef { id: string; label: string; condition: GateCondition; domainId?: string; kind?: 'achievement' | 'identity' }
/**
 * One value frozen into a checkpoint row when it is sealed (platform/02 §16.3).
 * `atLeast` turns a count into a flag ("has a public repo"); without it the
 * value is the signal itself. `zero` is the value an arc with no activity has.
 */
export interface EvidenceDef { key: string; signal: SignalRef; atLeast?: number; zero: number | boolean }
/** A before/after line of the checkpoint report, read from the frozen evidence by `evidenceKey`. */
export interface ComparisonRowDef {
  id: string; label: string; evidenceKey: string; format: 'int' | 'percent' | 'of9' | 'minutes'; direction: 'higher' | 'lower';
  /** Show the row only when the baseline is a real measurement (below this sentinel). */
  onlyWhenBaselineBelow?: number;
}
export interface CheckpointDef {
  selfEfficacy: { id: string; prompt: string }[]; automaticity: { id: string; prompt: string }[]; enjoyment: { id: string; domainId: string; prompt: string }[];
  evidence?: EvidenceDef[]; comparison?: ComparisonRowDef[];
}
/** A headline number of the REALITY tab: cumulative, real-world, never scored. */
export interface RealityRowDef {
  key: string; label: string; signal: SignalRef;
  /** How the REALITY tab shows the row; without it the row is a plain count that starts at 0. */
  display?: {
    /** A shorter label for the tab than the full one. */
    label?: string;
    format?: 'int' | 'percent' | 'fraction';
    /** The whole for a 'fraction' ("3 / 9"). */
    of?: number;
    /** Show a dash while the value is zero (a rate with nothing behind it yet). */
    dashWhenZero?: boolean;
    /** Show a dash until the row with this key is above zero (a quality rate needs applications). */
    dashUnless?: string;
    /** What the Day 0 column says; defaults to "0" ("0 / 9" for a fraction, a dash for a rate). */
    day0?: string;
  };
}
export interface ReviewDef {
  domainPrompts: { id: string; domainId: string; prompt: string; options: string[] }[];
  /** The weekly review's headline numbers, each read over the 7 days ending on the review day. */
  weeklyMetrics?: RealityRowDef[];
}
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
  reality?: RealityRowDef[];
  /** 'legacy' marks the owner's System: screens built for it before the platform keep their bespoke layouts for it. */
  origin?: 'legacy';
}
