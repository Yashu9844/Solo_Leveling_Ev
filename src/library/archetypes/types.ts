// What an archetype is (platform/03 §25.2): a template the generator RESOLVES and COPIES into a
// Blueprint - no live reference survives (D8). This file holds the part loops 8.2 reads (domains,
// instruments, the core quest and its economy); the milestone ramp, skill tree, attribute, boss anchors,
// review prompts, rules, messaging and achievements join it in 8.3-8.4 and are optional until then.
import type { IconTokenName } from '../icons';
import type { HueToken } from '../hues';
import type { InstrumentParams, InstrumentType, Weekday } from '../../blueprint/schema';

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
}
