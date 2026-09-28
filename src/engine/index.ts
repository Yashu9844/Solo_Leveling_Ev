// Barrel export for the domain engine. Everything re-exported here is
// pure, deterministic, and free of React/Dexie/Zustand/DOM/ambient-clock
// dependencies — enforced by eslint.config.js's engine-boundary rules.
export * from './types';
export * from './config';
export * from './time';
export * from './xp';
export * from './level';
export * from './rank';
export * from './quests';
export * from './streak';
export * from './attributes';
export * from './career';
export * from './dsa';
export * from './srs';
export * from './rules';
export * from './messages';
export * from './reduce';
