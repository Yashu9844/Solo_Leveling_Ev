import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getActiveArc } from './arc';
import { setEngineConfigFromArc } from './engineConfig';

export type ArcStatus = 'loading' | 'yes' | 'no';

interface ArcStatusValue {
  status: ArcStatus;
  /** Onboarding awaits this right after a successful initialiseArc(). It
   * resolves only once the new arc's engine config is in place, so the
   * Today screen it navigates to never sees the defaults. */
  markArcCreated: () => Promise<void>;
  /** The DEV-only Reset arc action calls this after clearing the db. */
  markArcReset: () => void;
}

const ArcStatusContext = createContext<ArcStatusValue | null>(null);

/**
 * Loads the arc row, installs its engine config (store/engineConfig.ts),
 * and only THEN reports whether an arc exists. The ordering is the point:
 * every arc-dependent route renders behind status === 'yes', so none of
 * them can read the config before it matches the arc's own timezone and
 * day boundaries (platform/05 loop 1.3).
 */
async function resolveArc(): Promise<ArcStatus> {
  const arc = await getActiveArc();
  setEngineConfigFromArc(arc);
  return arc ? 'yes' : 'no';
}

export function ArcStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ArcStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    void resolveArc().then((resolved) => {
      if (!cancelled) {
        setStatus(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ArcStatusValue>(
    () => ({
      status,
      markArcCreated: async () => {
        setStatus(await resolveArc());
      },
      markArcReset: () => {
        setEngineConfigFromArc(undefined);
        setStatus('no');
      },
    }),
    [status]
  );

  return <ArcStatusContext.Provider value={value}>{children}</ArcStatusContext.Provider>;
}

export function useArcStatus(): ArcStatusValue {
  const ctx = useContext(ArcStatusContext);
  if (!ctx) {
    throw new Error('useArcStatus must be used within ArcStatusProvider');
  }
  return ctx;
}
