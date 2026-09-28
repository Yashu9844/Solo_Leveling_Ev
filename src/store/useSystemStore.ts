// Thin orchestration shell over the engine. Owns the clock and id
// generator — the engine never reads them ambiently — and holds the
// derived EngineState for the UI to read. No domain logic lives here;
// it only wires db <-> engine <-> React.
import { create } from 'zustand';
import { applyEvents, DEFAULT_CONFIG, type EngineDeps, type EngineState } from '../engine';
import { getAllEvents } from '../db/events';
import { realDeps } from './deps';

interface SystemStore {
  deps: EngineDeps;
  state: EngineState | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
}

export const useSystemStore = create<SystemStore>((set) => ({
  deps: realDeps,
  state: null,
  hydrated: false,
  hydrate: async () => {
    const events = await getAllEvents();
    // applyEvents throws on the first event type it doesn't yet handle
    // (Slice 1: anything past ARC_STARTED) — Today doesn't read `state`
    // until Slice 2, so the store stays un-hydrated rather than crashing.
    try {
      const state = applyEvents(events, DEFAULT_CONFIG);
      set({ state, hydrated: true });
    } catch {
      set({ hydrated: false });
    }
  },
}));
