import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { versionFor } from '../blueprint/resolve';
import type { SystemBlueprint } from '../blueprint/schema';
import { localDate } from '../engine/time';
import type { EngineConfig } from '../engine/types';
import { realDeps } from './deps';
import { useEngineConfig } from './engineConfig';
import { useBlueprintVersions } from './systemBlueprint';

export interface SystemValue {
  /** Every version in force for the arc, ordered by start date. */
  versions: readonly SystemBlueprint[];
  /** The version in force today. Screens that show another day use resolveVersion(date). */
  blueprint: SystemBlueprint;
  /** The version that governed `localDate` (the first version for a date before the arc began). */
  resolveVersion: (localDate: string) => SystemBlueprint;
  engineConfig: EngineConfig;
}

const SystemContext = createContext<SystemValue | null>(null);

/**
 * Exposes the Blueprint to the UI (platform/03 §27.4): components read
 * `useSystem()` instead of importing the owner's constants. It re-renders its
 * subtree when a version is activated (store/systemBlueprint.ts) or the arc's
 * engine config changes; both are loaded before the arc is reported present.
 */
export function SystemProvider({ children }: { children: ReactNode }) {
  const versions = useBlueprintVersions();
  const engineConfig = useEngineConfig();

  const value = useMemo<SystemValue>(() => {
    const resolveVersion = (date: string): SystemBlueprint => versionFor(versions, date) ?? versions[0]!;
    const today = localDate(realDeps.now(), engineConfig.arc.timezone, engineConfig.arc.dayBoundaryHour);
    return { versions, blueprint: resolveVersion(today), resolveVersion, engineConfig };
  }, [versions, engineConfig]);

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem(): SystemValue {
  const ctx = useContext(SystemContext);
  if (!ctx) {
    throw new Error('useSystem must be used within SystemProvider');
  }
  return ctx;
}
