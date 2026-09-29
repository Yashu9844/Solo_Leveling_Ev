// The runtime engine config — the arc's own (engine/config.ts#
// engineConfigFor), not the owner's DEFAULT_CONFIG constant
// (platform/05 loop 1.3).
//
// Set by ArcStatusProvider once, when it resolves the arc at boot or
// after onboarding creates one, strictly BEFORE it reports the arc as
// present, so no arc-dependent screen can ever render against the wrong
// timezone. It changes only at arc creation and reset, never during a
// screen's lifetime, which is why handlers and effects read it at call
// time with getEngineConfig() (no stale closures, no dependency-array
// churn) and only render-time values need the useEngineConfig() hook.
import { create } from 'zustand';
import { DEFAULT_CONFIG, engineConfigFor } from '../engine/config';
import type { EngineConfig } from '../engine/types';
import type { ArcRow } from '../db/schema';

interface EngineConfigStore {
  config: EngineConfig;
}

const useEngineConfigStore = create<EngineConfigStore>(() => ({ config: DEFAULT_CONFIG }));

/** Render-time read; re-renders if the arc (and so the config) changes. */
export function useEngineConfig(): EngineConfig {
  return useEngineConfigStore((s) => s.config);
}

/** Call-time read for handlers, effects and non-React code. */
export function getEngineConfig(): EngineConfig {
  return useEngineConfigStore.getState().config;
}

/** No arc (fresh install, or after a reset) falls back to the defaults,
 * which only the onboarding flow's initial form ever reads. */
export function setEngineConfigFromArc(arc: ArcRow | undefined): void {
  useEngineConfigStore.setState({ config: arc ? engineConfigFor(arc) : DEFAULT_CONFIG });
}
