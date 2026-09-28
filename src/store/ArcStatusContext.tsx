import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { hasArc } from './onboarding';

export type ArcStatus = 'loading' | 'yes' | 'no';

interface ArcStatusValue {
  status: ArcStatus;
  /** Onboarding calls this right after a successful initialiseArc(). */
  markArcCreated: () => void;
  /** The DEV-only Reset arc action calls this after clearing the db. */
  markArcReset: () => void;
}

const ArcStatusContext = createContext<ArcStatusValue | null>(null);

export function ArcStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ArcStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    hasArc().then((exists) => {
      if (!cancelled) {
        setStatus(exists ? 'yes' : 'no');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ArcStatusValue>(
    () => ({
      status,
      markArcCreated: () => setStatus('yes'),
      markArcReset: () => setStatus('no'),
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
