import { motion } from 'framer-motion';
import { useId } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}

/**
 * A 2–3 way switch. The active pill slides between options via a shared
 * `layoutId`, so the control reads as one moving thing rather than two
 * separate states blinking.
 *
 * The options are plain `<button>` elements on purpose. `role="tab"`
 * would be defensible ARIA, but the e2e suite selects these with
 * `getByRole('button', { name: 'REALITY' })` and
 * `getByRole('button', { name: 'SHIP', exact: true })` — switching the
 * role would break six specs to gain nothing a user would notice.
 * `aria-pressed` carries the state instead, which is correct for a
 * button acting as a toggle.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedProps<T>) {
  // Scoped so two Segmented controls on one screen animate independently.
  const layoutId = useId();

  return (
    <div
      className={['flex overflow-hidden rounded-[6px]', className].join(' ')}
      style={{ border: '1px solid var(--hair-strong)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className="relative min-h-tap flex-1 px-2 text-center text-xs font-medium uppercase tracking-label"
            style={{ color: active ? 'var(--on-accent)' : 'var(--ink-700)' }}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-deep) 100%)',
                  boxShadow: 'var(--glow-sm)',
                }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
