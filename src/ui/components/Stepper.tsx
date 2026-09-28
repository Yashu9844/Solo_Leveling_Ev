interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  label?: string;
}

/** A numeric +/- stepper — no keyboard typing required. */
export function Stepper({ value, onChange, step = 1, min = 0, suffix, label }: StepperProps) {
  return (
    <div>
      {/* Same mono micro-label as ChipToggle and Field, so a form built
          from three different primitives still reads as one surface. */}
      {label && (
        <div className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
          {label}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="cut-sm min-h-tap min-w-[44px] text-lg text-ink-100"
          style={{ border: '1px solid var(--hair)', background: 'var(--surface-2)' }}
          aria-label="Decrease"
        >
          −
        </button>
        <span className="min-w-[64px] text-center font-mono text-md tabular-nums text-ink-100">
          {value}
          {suffix ? ` ${suffix}` : ''}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="cut-sm min-h-tap min-w-[44px] text-lg text-ink-100"
          style={{ border: '1px solid var(--hair)', background: 'var(--surface-2)' }}
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}
