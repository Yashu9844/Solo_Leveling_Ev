import { useEffect, useState } from 'react';
import { CheckCircle, Sword } from '@phosphor-icons/react';
import type { MetricDefinition } from '../../blueprint/schema';
import { localDate } from '../../engine/time';
import { getActiveArc } from '../../store/arc';
import { realDeps } from '../../store/deps';
import { getEngineConfig } from '../../store/engineConfig';
import { getSelfCertHistory, logSelfCert } from '../../store/training';
import { ArtLayer, FramedPanel, PrimaryButton, SecondaryButton } from '../kit';
import type { SelfCertCopy } from '../instruments/legacy/skillsCopy';

/** What a self-certified metric says when nothing names it better. */
export function genericSelfCertCopy(metric: MetricDefinition): SelfCertCopy {
  return {
    tab: metric.label.toUpperCase(), tabIcon: Sword, title: metric.label, tagline: 'SELF-CERTIFIED',
    heading: metric.label.toUpperCase(), rules: '', statusLabel: 'STATUS:', cleared: '✓ PASSED', uncleared: 'NOT YET PASSED',
    passButton: 'PASSED', failButton: 'NOT YET', recording: 'RECORDING...', logsHeading: 'ATTEMPTS', rowPassed: '✓ PASSED', rowFailed: 'NOT YET', glyph: Sword,
  };
}

/**
 * A self-certified pass/fail metric as a card (platform/03 §27.3, "benchmark as a self_cert
 * metric card"): the rules, whether it has ever been passed, two buttons and the attempt log.
 * The owner's Interview Readiness Benchmark is one; nothing here knows that.
 */
export function SelfCertCard({ metric, copy }: { metric: MetricDefinition; copy: SelfCertCopy }) {
  const [history, setHistory] = useState<{ local_date: string; passed: boolean }[]>([]);
  const [arcId, setArcId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passed = history.some((attempt) => attempt.passed);
  const Glyph = copy.glyph;

  async function refresh() {
    const [h, arc] = await Promise.all([getSelfCertHistory(metric.id), getActiveArc()]);
    setHistory(h);
    setArcId(arc?.id ?? null);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric.id]);

  async function handleLog(didPass: boolean) {
    if (!arcId || submitting) return;
    setSubmitting(true);
    try {
      const today = localDate(realDeps.now(), getEngineConfig().arc.timezone, getEngineConfig().arc.dayBoundaryHour);
      await logSelfCert(today, arcId, metric.id, didPass, getEngineConfig(), realDeps);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!arcId) return null;

  return (
    <FramedPanel className="px-4 py-4 relative overflow-hidden cut-sm border border-accent/40 bg-surface-2/90 shadow-[0_0_20px_rgba(77,163,255,0.2)]">
      {copy.artSlot && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            mixBlendMode: 'lighten',
            maskImage: 'radial-gradient(100% 100% at 50% 50%, #000 20%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(100% 100% at 50% 50%, #000 20%, transparent 80%)',
          }}
        >
          <ArtLayer slot={copy.artSlot} scrim="quiet" focal="50% 40%" />
        </div>
      )}

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Glyph size={16} weight="fill" color="#5fb2ff" className="animate-bounce drop-shadow-[0_0_8px_#5fb2ff]" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-100">{copy.heading}</span>
        </div>

        {copy.rules && <p className="text-xs leading-relaxed text-ink-200 font-medium">{copy.rules}</p>}

        <div className="mt-4 p-2.5 rounded cut-sm border border-accent/30 bg-accent-deep/20 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest font-mono text-ink-500 font-bold">{copy.statusLabel}</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle size={15} weight="fill" color={passed ? '#5fb2ff' : '#90a8c2'} />
            <p className={['text-xs font-bold tracking-wider uppercase font-mono', passed ? 'glow-text text-accent-mid font-extrabold' : 'text-ink-500'].join(' ')}>
              {passed ? copy.cleared : copy.uncleared}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <PrimaryButton size="md" disabled={submitting} onClick={() => void handleLog(true)} className="flex-1 shadow-[0_0_16px_rgba(77,163,255,0.4)] font-mono uppercase font-bold tracking-wider">
            {submitting ? copy.recording : copy.passButton}
          </PrimaryButton>
          <SecondaryButton disabled={submitting} onClick={() => void handleLog(false)} className="flex-1 font-mono uppercase tracking-wider">
            {copy.failButton}
          </SecondaryButton>
        </div>

        {history.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-hair-faint pt-3">
            <div className="text-[9px] uppercase font-mono font-bold text-ink-700 tracking-wider mb-1">
              {copy.logsHeading} ({history.length})
            </div>
            {history.map((h, i) => (
              <li
                key={i}
                className="flex items-center justify-between font-mono text-xxs tabular-nums px-2 py-1 rounded bg-surface/50 border border-hair-faint"
              >
                <span className="text-ink-500">{h.local_date}</span>
                <span className={h.passed ? 'text-accent-mid font-bold glow-text uppercase' : 'text-ink-700 uppercase'}>
                  {h.passed ? copy.rowPassed : copy.rowFailed}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FramedPanel>
  );
}
