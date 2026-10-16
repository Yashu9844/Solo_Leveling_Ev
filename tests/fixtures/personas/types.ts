// A persona (platform/04 §32.1): the answers that build a System, the activity that lives in it, and what must hold.
import type { DraftState } from '../../../src/generator/types';
import type { PersonaProfile } from '../../engine/support/personaEventLog';

export interface PersonaExpectations {
  arcLength: number;
  /** role:DESIGNATION in priority order. */
  domains: string[];
  coreXp: number[];
  caps: number[];
  checkpointDays: number[];
  bossTitles: string[];
  /** Skill trees the System holds, by node count. */
  skillTreeSizes: number[];
  /** Attribute ids, in order. */
  attributes: string[];
  /** Metric ids of kind external or body: recorded and shown, never scored. */
  unscoredMetrics: string[];
  /** The XP earned in the first seven days of the steady script (a reviewed number: it moves only when the economy does). */
  firstWeekXp: number;
}

export interface Persona {
  id: string;
  label: string;
  draft: DraftState;
  profile: PersonaProfile;
  seed: number;
  expect: PersonaExpectations;
}
