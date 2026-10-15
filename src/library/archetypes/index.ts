import { attentionControl } from './attentionControl';
import { careerPipeline } from './careerPipeline';
import { businessBuilding } from './businessBuilding';
import { creativePractice } from './creativePractice';
import { endurance } from './endurance';
import { financeControl } from './financeControl';
import { healthRoutine } from './healthRoutine';
import { languageLearning } from './languageLearning';
import { publicSpeaking } from './publicSpeaking';
import { relationships } from './relationships';
import { spiritualPractice } from './spiritualPractice';
import { writing } from './writing';
import { deepBuild } from './deepBuild';
import { examPrep } from './examPrep';
import { reading } from './reading';
import { sleepRegularity } from './sleepRegularity';
import { softwarePractice } from './softwarePractice';
import { strengthMovement } from './strengthMovement';
import type { ArchetypeDef } from './types';

export type { ArchetypeDef } from './types';

/**
 * Every archetype the library ships, by id (platform/03 §25.3). Batch 1 (loop 8.5): the six that describe the
 * owner's System, which the generator is checked against, then exam-prep and reading. Batch 2 (loop 8.6): the
 * rest of the table. A `custom:<instrument type>` archetype is built on demand (custom.ts).
 */
export const ARCHETYPES: Readonly<Record<string, ArchetypeDef>> = Object.fromEntries(
  [softwarePractice, careerPipeline, deepBuild, strengthMovement, sleepRegularity, attentionControl, examPrep, reading, businessBuilding, creativePractice, endurance, financeControl, healthRoutine, languageLearning, publicSpeaking, relationships, spiritualPractice, writing].map((archetype) => [archetype.id, archetype])
);
