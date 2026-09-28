import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { getTodayMaintenance, logMaintenance } from '../../store/lifestyle';

interface MaintenanceCardProps {
  today: string;
  arcId: string;
  arcStartDate: string;
  onChanged: () => void;
}

const ITEMS: { field: 'bath' | 'fuel' | 'laundry'; label: string }[] = [
  { field: 'bath', label: 'Bath' },
  { field: 'fuel', label: 'Ate to plan' },
  { field: 'laundry', label: 'Laundry' },
];

/** final/04 §6 — one zero-pressure row, excluded from core-completion %,
 * every attribute, and every rank gate. Ticking is auto-saved.
 * Redesigned into cut-corner HUD pills inside a dark glass panel without vertical overflow. */
export function MaintenanceCard({ today, arcId, arcStartDate, onChanged }: MaintenanceCardProps) {
  const [state, setState] = useState({ bath: false, fuel: false, laundry: false });
  const [laundryDue, setLaundryDue] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { row, laundryDue: due } = await getTodayMaintenance(today, arcStartDate, DEFAULT_CONFIG.maintenanceLaundryEveryDays);
      setState({ bath: row?.bath ?? false, fuel: row?.fuel ?? false, laundry: row?.laundry ?? false });
      setLaundryDue(due);
    })();
  }, [today, arcStartDate]);

  async function toggle(field: 'bath' | 'fuel' | 'laundry') {
    const next = { ...state, [field]: !state[field] };
    setState(next);
    setSaving(true);
    try {
      await logMaintenance(today, arcId, next, DEFAULT_CONFIG, realDeps);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  const visibleItems = ITEMS.filter((item) => item.field !== 'laundry' || laundryDue);

  return (
    <div
      className="cut-sm mt-2 flex flex-wrap items-center justify-between gap-2 p-2.5 transition-all duration-200"
      data-testid="maintenance-card"
      style={{
        border: '1px solid rgba(77, 163, 255, 0.32)',
        background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.85), rgba(5, 10, 20, 0.95))',
        boxShadow: '0 0 14px rgba(77, 163, 255, 0.1)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-mid shadow-[0_0_6px_#5fb2ff]" />
        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.22em] text-accent-mid">
          MAINT
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {visibleItems.map(({ field, label }) => {
          const active = state[field];
          return (
            <button
              key={field}
              type="button"
              onClick={() => void toggle(field)}
              disabled={saving}
              aria-pressed={active}
              // The button is a transparent 44px target that gives back
              // 10px of margin top and bottom, so its margin box still
              // occupies the strip's original height — Today is measured
              // to zero overflow at 412x915 and the sixth quest row has
              // to stay above the fold (final/06 §5.2), so the pill
              // cannot simply grow. The *visible* pill is the inner span:
              // putting the border on the button instead made the tap
              // area visible, and it broke out past the card's edges.
              className="-my-[10px] flex min-h-tap shrink-0 items-center disabled:opacity-60"
            >
              <span
                className={[
                  'cut-sm flex items-center gap-1.5 px-3 py-1 text-xs font-semibold tracking-wide transition-all duration-150',
                  active
                    ? 'text-accent-mid bg-accent-deep/45 border-accent/60 shadow-[0_0_10px_rgba(77,163,255,0.3)]'
                    : 'text-ink-300 bg-black/40 border-hair-faint',
                ].join(' ')}
                style={{ borderStyle: 'solid', borderWidth: '1px' }}
              >
                {active && <span className="text-[10px] font-bold text-accent-mid" aria-hidden>✓</span>}
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
