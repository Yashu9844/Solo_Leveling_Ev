import { useState } from 'react';
import type { ComparisonRow, GateCondition } from '../../engine/rank';
import { Moment } from '../kit';

interface CheckpointMomentProps {
  day: number;
  rankBefore: string;
  rankAfter: string;
  rows: ComparisonRow[];
  conditions: GateCondition[];
  verdictText: string;
  onDismiss: () => void;
}

/**
 * final/05 §2.1's CHECKPOINT Moment: "Sequence, self-paced" — the one
 * Moment with no timer anywhere. Every other Moment auto-resolves
 * (700ms–1100ms full-screen, 600ms card); this is deliberately the
 * opposite, since final/06 §5.8 calls the checkpoint report "the most
 * important screen in the product" and that is not something to read on
 * a clock. Three steps, advanced by tap: the rank line, the comparison
 * against the previous checkpoint, then the gate checklist and verdict —
 * tapping the last step dismisses.
 *
 * Gold Horizon, on the `checkpoint` plate, matching the screen it comes
 * out of: a sealed checkpoint is the app's one statement that something
 * in the real world changed.
 */
export function CheckpointMoment({
  day,
  rankBefore,
  rankAfter,
  rows,
  conditions,
  verdictText,
  onDismiss,
}: CheckpointMomentProps) {
  const [step, setStep] = useState(0);
  const rankAdvanced = rankAfter !== rankBefore;
  const lastStep = 2;

  function advance() {
    if (step >= lastStep) {
      onDismiss();
    } else {
      setStep(step + 1);
    }
  }

  return (
    <Moment
      label="Checkpoint report. Tap to continue."
      onDismiss={advance}
      tone="dawn"
      slot="checkpoint"
      hint="tap to continue"
      testId="checkpoint-moment"
      dataStep={step}
    >
      {step === 0 && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-xxs uppercase tracking-wide text-ink-700">
            CHECKPOINT · DAY {day}
          </span>
          {rankAdvanced ? (
            <span className="glow-text font-display text-display leading-none text-dawn-core">
              {rankBefore} → {rankAfter}
            </span>
          ) : (
            <span className="glow-text font-mono text-3xl tabular-nums text-ink-100">SEALED</span>
          )}
          <span
            className="mt-1 h-px w-16"
            style={{ background: 'var(--dawn)', boxShadow: '0 0 20px rgba(232,161,60,0.35)' }}
            aria-hidden
          />
        </div>
      )}

      {step === 1 && (
        <div className="w-full">
          <p className="mb-4 text-center text-xxs uppercase tracking-wide text-ink-700">
            vs previous checkpoint
          </p>
          <div className="flex flex-col">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline gap-3 py-2.5"
                style={{ borderBottom: '1px solid var(--hair-faint)' }}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink-500">{row.label}</span>
                <span
                  className={[
                    'shrink-0 font-mono text-sm tabular-nums',
                    row.improved ? 'text-dawn-bright' : 'text-ink-700',
                  ].join(' ')}
                >
                  {row.before} → {row.after}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="w-full">
          <p className="mb-5 text-center font-display text-[calc(16px*var(--type-scale))] leading-[1.45] text-ink-100">
            {verdictText}
          </p>
          <ul className="flex flex-col gap-2">
            {conditions.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs leading-[1.45]">
                {/* Same shape language as the checkpoint screen's gate —
                    filled square with a tick, hollow with a cross, so
                    the list reads without relying on colour. */}
                <span
                  aria-hidden
                  className="mt-[1px] flex h-[16px] w-[16px] shrink-0 items-center justify-center text-[10px] leading-none"
                  style={{
                    background: c.met ? 'var(--dawn)' : 'transparent',
                    border: `1px solid ${c.met ? 'var(--dawn)' : 'var(--hair)'}`,
                    color: c.met ? 'var(--void)' : 'var(--ink-500)',
                  }}
                >
                  {c.met ? '✓' : '✗'}
                </span>
                <span className={c.met ? 'text-ink-300' : 'text-ink-700'}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Moment>
  );
}
