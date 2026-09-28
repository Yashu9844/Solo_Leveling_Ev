import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyToRoot,
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  type Settings,
} from './settings';

interface SettingsValue {
  settings: Settings;
  /** Patch one or more fields. Applies immediately — there is no Save
   * button anywhere in the settings UI (design/03 §4). */
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * The inline bootstrap in index.html has already stamped the root before
 * first paint, so this reads the same key and takes over without any
 * flash. Initial state is computed lazily rather than in an effect for
 * the same reason: an effect would run a frame too late.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const apply = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
    if (typeof document !== 'undefined') {
      applyToRoot(document.documentElement, next);
    }
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      update: (patch) => apply({ ...settings, ...patch }),
      reset: () => apply({ ...DEFAULT_SETTINGS }),
    }),
    [settings, apply]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
