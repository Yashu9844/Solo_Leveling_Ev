import { attentionControl } from './attentionControl';
import { careerPipeline } from './careerPipeline';
import { deepBuild } from './deepBuild';
import { sleepRegularity } from './sleepRegularity';
import { softwarePractice } from './softwarePractice';
import { strengthMovement } from './strengthMovement';
import type { ArchetypeDef } from './types';

export type { ArchetypeDef } from './types';

/**
 * Every archetype the library ships, by id. Batch 1 is landing (loop 8.5): the six that describe
 * the owner's System come first, because they are what the generator is checked against.
 */
export const ARCHETYPES: Readonly<Record<string, ArchetypeDef>> = Object.fromEntries(
  [softwarePractice, careerPipeline, deepBuild, strengthMovement, sleepRegularity, attentionControl].map((archetype) => [archetype.id, archetype])
);
