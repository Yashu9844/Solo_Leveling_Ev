import type { Icon } from '@phosphor-icons/react';

interface DotPickerProps {
  label: string;
  value: number; // 1-5
  onChange: (value: number) => void;
  description?: string;
  icon?: Icon;
}

/** A 1-5 rating card — matching the exact reference image with HUD container and glowing purple dots */
export function DotPicker({ label, value, onChange, description, icon: Glyph }: DotPickerProps) {
  return (
    <div
      className="cut-sm p-3.5 transition-all duration-200"
      style={{
        border: '1px solid rgba(77, 163, 255, 0.25)',
        background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.8), rgba(5, 10, 20, 0.9))',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Glyph && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-accent/40 bg-accent-deep/30 text-accent-mid shadow-[0_0_10px_rgba(77,163,255,0.3)]">
              <Glyph size={18} weight="fill" color="#5fb2ff" />
            </div>
          )}
          <div>
            <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-ink-100">
              {label}
            </h3>
            {description && (
              <p className="text-[10px] italic text-ink-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {/* 1-5 Rating Dots */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = value === n;
            return (
              <div key={n} className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange(n)}
                  aria-label={`${label} ${n} of 5`}
                  aria-pressed={active}
                  className="flex h-8 w-8 items-center justify-center rounded-pill transition-all duration-200"
                  style={{
                    border: `1.5px solid ${active ? '#c084fc' : 'rgba(120, 140, 165, 0.4)'}`,
                    background: active
                      ? 'radial-gradient(circle, #c084fc 35%, #9333ea 100%)'
                      : 'transparent',
                    boxShadow: active ? '0 0 12px rgba(192, 132, 252, 0.75)' : 'none',
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-pill transition-transform duration-200"
                    style={{
                      background: active ? '#ffffff' : 'transparent',
                      transform: active ? 'scale(1)' : 'scale(0.5)',
                    }}
                  />
                </button>
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{ color: active ? '#c084fc' : 'var(--ink-700)', fontWeight: active ? 700 : 400 }}
                >
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

