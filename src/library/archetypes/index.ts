import { attentionControl } from './attentionControl';
import { careerPipeline } from './careerPipeline';
import { deepBuild } from './deepBuild';
import { examPrep } from './examPrep';
import { reading } from './reading';
import { sleepRegularity } from './sleepRegularity';
import { softwarePractice } from './softwarePractice';
import { strengthMovement } from './strengthMovement';
import type { ArchetypeDef } from './types';

export type { ArchetypeDef } from './types';

/**
 * Every archetype the library ships, by id. Batch 1 (loop 8.5): the six that describe the owner's System,
 * which the generator is checked against, then exam-prep and reading. Batch 2 (loop 8.6) completes the set.
 */
export const ARCHETYPES: Readonly<Record<string, ArchetypeDef>> = Object.fromEntries(
  [softwarePractice, careerPipeline, deepBuild, strengthMovement, sleepRegularity, attentionControl, examPrep, reading].map((archetype) => [archetype.id, archetype])
);
