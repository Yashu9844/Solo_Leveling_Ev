import { useEffect, useRef, useState } from 'react';
import { useWakeLock } from '../hooks/useWakeLock';

interface DeepWorkTimerProps {
  /** Called with the elapsed whole minutes (minimum 1) once stopped. */
  onStop: (minutes: number) => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * final/07 §6.2's "deep-work timer" — the justification the spec gives
 * for using the Screen Wake Lock API, but never itself designed as a
 * screen (final/06's 12-screen V1 list has no timer). Scoped here as
 * the minimal thing that gives the wake lock something real to hold:
 * an optional stopwatch a Log*Sheet can offer alongside its manual
 * minutes field. Never mandatory — final/07 §6's "no mandatory timers,
 * no photo proof" anti-friction rule means a person who just knows they
 * worked for 45 minutes can still type 45 directly and never touch this.
 */
export function DeepWorkTimer({ onStop }: DeepWorkTimerProps) {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const { acquire, release } = useWakeLock();

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startRef.current !== null) setElapsedMs(Date.now() - startRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Release the wake lock on unmount even if the sheet is closed mid-run.
  useEffect(() => () => void release(), [release]);

  function handleStart() {
    startRef.current = Date.now() - elapsedMs;
    setRunning(true);
    void acquire();
  }

  function handleStop() {
    setRunning(false);
    void release();
    const minutes = Math.max(1, Math.round(elapsedMs / 60000));
    onStop(minutes);
    setElapsedMs(0);
    startRef.current = null;
  }

  return (
    <div
      className="cut-sm flex items-center justify-between gap-3 px-3 py-2"
      style={{ border: '1px solid var(--hair)', background: 'var(--surface)' }}
    >
      <span
        className={[
          'shrink-0 font-mono text-sm tabular-nums',
          // Lit while it is counting, so a glance says whether the clock
          // is running without reading the button on the other side.
          running ? 'glow-text text-accent-mid' : 'text-ink-700',
        ].join(' ')}
        data-testid="deep-work-elapsed"
      >
        {formatElapsed(elapsedMs)}
      </span>
      {!running ? (
        <button
          type="button"
          onClick={handleStart}
          className="cut-sm min-h-tap px-3 text-xs text-accent"
          style={{ border: '1px solid var(--accent)' }}
        >
          Start deep work
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStop}
          className="cut-sm min-h-tap px-3 text-xs text-ink-500"
          style={{ border: '1px solid var(--hair)' }}
        >
          Stop · use {Math.max(1, Math.round(elapsedMs / 60000))} min
        </button>
      )}
    </div>
  );
}
