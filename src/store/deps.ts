// The one place the real clock and id generator are instantiated. Every
// other module that needs them takes an EngineDeps parameter instead of
// reading Date.now()/crypto.randomUUID() itself — this is what the
// engine boundary's "inject the clock" rule is protecting.
import { v7 as uuidv7 } from 'uuid';
import type { EngineDeps } from '../engine/types';

export const realDeps: EngineDeps = {
  now: () => new Date().toISOString(),
  newId: () => uuidv7(),
};
