// The generator (platform/03 §29): DraftState -> Blueprint, S1-S14. See pipeline.ts (S1-S10) and generate.ts (S11-S14).
export * from './types';
export { generateCore, deriveSections } from './pipeline';
export { generateBlueprint, GENERATOR_ID, type GeneratedBlueprint } from './generate';
