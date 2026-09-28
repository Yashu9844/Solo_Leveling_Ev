import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * final/00 §C9 / final/07 §6.2: "Screen Wake Lock for the deep-work
 * timer... Use for the deep-work timer. Re-acquire on visibilitychange."
 * Silently no-ops where the API is unsupported or permission is denied
 * — a deep-work session still runs and still logs minutes without the
 * lock, it just won't hold the screen on, which is strictly better than
 * throwing or blocking the timer on an optional capability.
 */
export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const [active, setActive] = useState(false);
  const wantLockRef = useRef(false);

  const acquire = useCallback(async () => {
    wantLockRef.current = true;
    if (!('wakeLock' in navigator)) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener('release', () => setActive(false));
    } catch {
      // Not visible, permission denied, or unsupported in this context —
      // the caller's timer keeps running regardless.
    }
  }, []);

  const release = useCallback(async () => {
    wantLockRef.current = false;
    try {
      await sentinelRef.current?.release();
    } catch {
      // Already released — nothing to do.
    }
    sentinelRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      // A backgrounded tab auto-releases the lock; re-acquire once
      // visible again, but only if the caller still wants it held.
      if (wantLockRef.current && document.visibilityState === 'visible' && !sentinelRef.current) {
        void acquire();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinelRef.current?.release().catch(() => {});
    };
  }, [acquire]);

  return { active, acquire, release };
}
