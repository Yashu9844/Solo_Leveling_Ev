// What an archetype is (platform/03 §25.2): a template the generator RESOLVES and COPIES into a
// Blueprint - no live reference survives (D8). This file holds the part loops 8.2 reads (domains,
// instruments, the core quest and its economy); the milestone ramp, skill tree, attribute, boss anchors,
// review prompts, rules, messaging and achievements join it in 8.3-8.4 and are optional until then.
import type { IconTokenName } from '../icons';
import type { HueToken } from '../hues';
import type { Aggregate } from '../../blueprint/build';
import type { AttributeDef, ConditionFormat, InstrumentParams, InstrumentType, SkillTreeDef, Weekday } from '../../blueprint/schema';

export type DomainRole = 'engine' | 'guardrail' | 'support';

/**
 * How much a channel may earn beyond its quest, as a multiple of the quest's XP (02 §9.4 rule 2):
 * a guardrail earns only its quest; a pipeline 1.4x; a session with a threshold 1.5x; a practice
 * item, or a duration with an artifact, 2x. A support channel is capped by its own unit instead:
 * `study` at 3 blocks, `checklist` at its one row.
 */
export type Headroom = 'guardrail' | 'pipeline' | 'session_threshold' | 'practice_or_artifact' | 'study' | 'checklist';

export const HEADROOM_MULTIPLE: Readonly<Record<Exclude<Headroom, 'study' | 'checklist'>, number>> = {
  guardrail: 1, pipeline: 1.4, session_threshold: 1.5, practice_or_artifact: 2,
};

export interface InstrumentTemplate {
  /** Unique within the archetype; the criterion templates refer to it. */
  key: string;
  type: InstrumentType;
  label: string;
  logVerb: string;
  /** Defaults; the generator may override some from the person's answers (rhythm, topics, limits). */
  params: InstrumentParams;
  /** 'wake': a time window whose target is the person's own wake time (rather than a time the archetype fixes). */
  adapt?: 'wake';
}

/** One comparison of a signal to a target. `answer` says which of the person's numbers replaces `target`. */
export interface LeafTemplate {
  instrument: string;
  signal: string;
  comparator: '>=' | '<=';
  target: number;
  filter?: Record<string, string>;
  answer?: 'goodDay' | 'hardDay';
  /** The smallest target the instrument allows (V-QST-02); a derived floor never goes below it. */
  min?: number;
}

export type CriterionTemplate =
  | ({ kind: 'signal' } & LeafTemplate)
  | { kind: 'any' | 'all'; of: CriterionTemplate[] };

export interface QuestTemplate {
  /** "{target}" is replaced with the good-day target of the first leaf that takes an answer. */
  objective: string;
  realityLabel: string;
  criterion: CriterionTemplate;
  /** Omitted: derived from the criterion (a third of each target, never below its `min`). 'same': the criterion itself. */
  floor?: CriterionTemplate | 'same';
  schedule: { kind: 'daily' } | { kind: 'weekdays'; days: Weekday[] };
  evidenceMode: 'self_report_allowed' | 'logged_only';
  recoverable: boolean;
  intentionAllowed: boolean;
}

export interface ArchetypeDef {
  id: string;
  /** The interview area that leads here (03 §23.3). */
  area: string;
  label: string;
  version: number;
  role: DomainRole;
  /** Share of its role's XP pool relative to its peers (1 = standard). A guardrail the owner ranks first is 1.5. */
  weight: number;
  headroom: Headroom;
  /** Offered designations, in the System's register; the first is the default (library/lexicon.ts). */
  designations: readonly string[];
  /** What the domain is called in plain words, and the one-line description. */
  name: string;
  description: string;
  /** The channel id the domain's XP is capped under. */
  channel: string;
  instruments: readonly InstrumentTemplate[];
  /** Core domains (engines, guardrails) have a quest; a support domain has none. */
  quest?: QuestTemplate;
  presentation: { icon: IconTokenName; hue: HueToken; artSlot?: string };
  /** Whether the person may attach an if-then reminder to this domain (the owner's: career, dsa, training). */
  intention?: boolean;
  evidenceSurface?: string;
  /** Loops 8.3-8.4. Optional until every archetype in the library carries them (8.6). */
  metrics?: readonly MetricTemplate[];
  ladder?: LadderTemplate;
  conditions?: readonly ConditionTemplate[];
  skillTree?: SkillTreeTemplate;
  attribute?: AttributeTemplate;
  bossAnchor?: BossAnchorTemplate;
  /** Loop 8.4: checkpoint items, one evening-review prompt, achievements and the themes its reflections draw on. */
  checkpoint?: { selfEfficacy: string; enjoyment: string };
  reviewPrompt?: { prompt: string; options: readonly string[] };
  achievements?: readonly AchievementTemplate[];
  reflectionThemes?: readonly string[];
}

// ── What loops 8.3-8.4 read: metrics, the headline ladder, gate conditions, skills, attributes, bosses ──

/** A signal the archetype reads, by the archetype's own instrument key (the generator resolves it to the domain's instrument id). */
export interface SignalTemplate {
  instrument: string;
  signal: string;
  aggregate: Aggregate;
  filter?: Record<string, string>;
}

export type RankStep = 'C' | 'B' | 'A' | 'S';

/** A threshold that is a number, or a number read from the domain's instrument parameters (a screen-time limit). */
export type Threshold = number | { param: string; instrument: string; scale?: number };

/** A headline number the domain is judged and shown by (02 §12). */
export interface MetricTemplate {
  key: string;
  label: string;
  unit: string;
  kind: 'effort' | 'performance' | 'external' | 'body';
  direction: 'higher' | 'lower' | 'neutral';
  source: SignalTemplate | { manual: true; cadence: 'checkpoint' | 'weekly' | 'any' };
}

/**
 * The headline COUNT of a domain and the ladder it climbs (02 §14): "what would a successful arc look like?"
 * is the S target (`success`); C/B/A follow the standard ramp. Rounded to a step that reads naturally.
 */
export interface LadderTemplate {
  key: string;
  /** The milestone's label ("Problems solved"). */
  label: string;
  /** The word in a gate condition: "{0} problems (need {t0})". */
  noun: string;
  signal: SignalTemplate;
  success: number;
  verifiability: 'count' | 'recorded' | 'public_url';
}

/** Any other condition the domain adds to a gate: evidence flags, rate floors, guardrail consistency. */
export interface ConditionTemplate {
  id: string;
  label: string;
  /** The name the checkpoint comparison uses for this number ("Wake SD"); default: the label without its placeholders. */
  short?: string;
  verifiability: 'public_url' | 'recorded' | 'self_cert' | 'count';
  signal: SignalTemplate;
  comparator: '>=' | '<=' | '<';
  format?: ConditionFormat;
  /** The rank-by-rank threshold; a rank not listed does not carry the condition. */
  at: Partial<Record<RankStep, Threshold>>;
}

export interface SkillTreeTemplate {
  /** The instrument key whose topics are the nodes and whose records are the evidence. */
  instrument: string;
  name: string;
  designation: string;
  /** 'topics': the instrument's topic list (the person's answer, else the archetype's); or a fixed list. */
  nodes: 'topics' | readonly string[];
  policy: SkillTreeDef['policy'];
}

export interface AttributeTemplate {
  id: string;
  name: string;
  group: 'mind' | 'craft' | 'body';
  description: string;
  combine: 'sum' | 'product';
  productKey?: string;
  /** `ratioOf`: divide the signal by this (another signal, or the number of eligible days in the window). */
  terms: { id: string; label: string; weight: number; signal: SignalTemplate; ratioOf?: SignalTemplate | 'window_days'; transform: AttributeDef['terms'][number]['transform'] }[];
}

/**
 * What a boss of this domain is built on (02 §15): a real-world milestone the person can reach by their own
 * effort. A title never names an external outcome (rule B5); an external counterpart goes in `external`.
 */
export interface BossAnchorTemplate {
  id: string;
  title: string;
  /** The anchor milestone's label. */
  milestone: string;
  /** Which of the domain's gate pieces the boss bundles: the ladder, and/or condition ids. */
  uses: { ladder?: boolean; conditions?: string[] };
  verifiability: 'public_url' | 'recorded' | 'count';
  /** Outcomes only other people decide: recorded on the REALITY panel, never gating anything. */
  external?: { key: string; label: string; source: SignalTemplate };
}

/** A domain-derived achievement or identity (02 §15.4): "Century", "Shipped", "Someone Who Trains". */
export interface AchievementTemplate {
  id: string;
  label: string;
  kind?: 'identity';
  verifiability: 'public_url' | 'recorded' | 'self_cert' | 'count' | 'structural';
  clauses: { signal: SignalTemplate; comparator: '>=' | '<=' | '<'; threshold: number; format?: ConditionFormat }[];
  clauseMode?: 'any';
}
