// The generator's vocabulary (platform/03 §29). The generator is a PURE function of a DraftState and the
// library: no clock (today is an input), no randomness, no I/O. Same draft + same library version ->
// deep-equal Blueprint; every draft yields a Blueprint (possibly with issues); it never throws.
import type { Issue } from '../blueprint/validate';
import type {
  AttributeDef, AttributeGroupDef, BossDef, DomainDefinition, InstrumentConfig, MetricDefinition, MilestoneDef, ProgressionSection, QuestTemplateDef, RankGateDef, SkillTreeDef, SystemBlueprint,
} from '../blueprint/schema';
import type { ArchetypeDef } from '../library/archetypes/types';

/** What the person said about one domain. Everything is optional: the archetype has a default for each. */
export interface DomainAnswers {
  /** A designation of their own (validated); otherwise the archetype's first offer that is still free. */
  designation?: string;
  /** "How much on a good day?" - replaces the target the archetype tags `goodDay`. */
  goodDay?: number;
  /** "How much on a hard day?" - the floor's target. */
  hardDay?: number;
  /** The topics of a practice or study domain. */
  topics?: string[];
  /** The limit of a threshold kept under (screen time), or the target of one kept over. */
  limit?: number;
  /** A subject the domain is about ("Medical licensing"); part of its id and its name. */
  topic?: string;
  /** A custom domain the person wants kept as a guardrail (a limit or a rhythm to hold) rather than an engine to push. */
  guardrail?: boolean;
  /** A time of day (HH:MM) for a time window that is not the wake time: the hour a practice is kept. */
  time?: string;
  /** The rows of a routine (a checklist domain). */
  items?: string[];
  /** "What would a successful arc look like?": the headline ladder's S target (problems solved, sessions done). */
  success?: number;
}

export interface DomainChoice {
  archetypeId: string;
  answers?: DomainAnswers;
}

export interface DraftState {
  /** The arc this System belongs to; also the Blueprint's lineage. */
  lineageId: string;
  /** The local date the draft is generated on (V-ARC-03 is relative to it). */
  today: string;
  identity: { displayName: string; primaryObjective: string; stake?: string };
  /** Domains in priority order (the rank question's answer): the first is the one that matters most. */
  domains: DomainChoice[];
  /** 'equal': every peer weighs the same. 'ranked' (default): earlier peers earn a little more (02 §9.4 rule 1). */
  priorityMode?: 'ranked' | 'equal';
  rhythm?: { wakeTime?: string; sleepTime?: string };
  arc: { startDate: string; lengthDays: number; timezone: string };
  /** Draft paths the person pinned by hand; later stages never overwrite them. */
  pinned?: string[];
}

/** S1's output: every field present, clamped and valid. */
export interface NormalizedDraft {
  lineageId: string;
  today: string;
  identity: { displayName: string; primaryObjective: string; stake?: string };
  domains: { archetypeId: string; answers: DomainAnswers }[];
  priorityMode: 'ranked' | 'equal';
  rhythm: { wakeTime: string; sleepTime: string };
  arc: SystemBlueprint['arc'];
  pinned: string[];
}

/** S2's output: a domain choice with its archetype resolved and its priority fixed. */
export interface ResolvedDomain {
  archetype: ArchetypeDef;
  answers: DomainAnswers;
  /** 1-based position in the person's ranking. */
  priority: number;
  /** Position among peers of the same role (0 = first): what the priority tilt reads. */
  rolePosition: number;
}

/** S3's output. */
export interface BuiltDomains {
  domains: DomainDefinition[];
  instruments: InstrumentConfig[];
  /** Instrument ids by `${domainId}` then template key, for the criteria to resolve against. */
  instrumentIds: Record<string, Record<string, string>>;
}

export interface CoreGeneration {
  draft: NormalizedDraft;
  resolved: ResolvedDomain[];
  domains: DomainDefinition[];
  instruments: InstrumentConfig[];
  quests: QuestTemplateDef[];
  progression: ProgressionSection;
  issues: Issue[];
}

/** What S6-S10 add to the core: the sections that make a System more than a list of quests. */
export interface DerivedSections {
  metrics: MetricDefinition[];
  milestones: MilestoneDef[];
  skills: SkillTreeDef[];
  attributes: { groups: AttributeGroupDef[]; defs: AttributeDef[] };
  gates: RankGateDef[];
  bosses: BossDef[];
  issues: Issue[];
}

export const generatorIssue = (code: string, severity: Issue['severity'], path: string, system: string, plain: string): Issue => ({ code, severity, path, system, plain });
