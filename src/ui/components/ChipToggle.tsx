import type { CSSProperties } from 'react';

interface ChipToggleProps {
  options: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  label?: string;
  /**
   * Lay the chips out as an equal-width grid of N columns instead of a
   * flowing row.
   *
   * Seven weekday chips cannot fit one line on any phone, and left to
   * flow they wrap 4 + 3 at ragged widths, which reads as an accident.
   * On a grid the same wrap reads as a calendar. Ragged labels
   * ("X / Twitter" beside "Reddit") still want the flow — a grid column
   * wide enough for the longest one wastes half the row on the rest.
   */
  columns?: number;
}

/**
 * A row of tappable chips for multi-select — no typing required.
 *
 * The unselected state is the one that had to change. Seven weekday
 * chips all sitting at `--surface-2` read as a wall of identical dead
 * slabs, which is most of why step 3 looked like a settings page: the
 * majority of the screen's area was mid-grey boxes carrying no state.
 *
 * Now an unselected chip is *recessed* — darker than the panel, lipped
 * at the top, with an empty node in it — and a selected one is *lit*,
 * raised out of the surface with a filled node and an edge light.
 * design/00 §7 wants every state to have a shape as well as a colour,
 * and the node is the shape: the difference survives a screenshot in
 * greyscale.
 */
export function ChipToggle({ options, selected, onChange, label, columns }: ChipToggleProps) {
  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div>
      {label && (
        <div className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
          {label}
        </div>
      )}
      <div
        className={columns ? 'grid gap-2' : 'flex flex-wrap gap-2'}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              aria-pressed={active}
              className={[
                'cut-sm relative flex min-h-tap items-center gap-1.5 overflow-hidden',
                'text-xs font-semibold uppercase tracking-[0.08em]',
                'transition-[border-color,background,color,box-shadow] duration-150',
                columns ? 'justify-center px-2' : 'px-3.5',
              ].join(' ')}
              style={
                {
                  // Scaled to the chip. The structural 10px bevel is sized
                  // for a card and chews both corners off a 44px box.
                  '--cut-sm': '6px',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--hair-faint)'}`,
                  background: active
                    ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 26%, transparent), color-mix(in srgb, var(--accent-deep) 16%, transparent))'
                    : 'linear-gradient(180deg, color-mix(in srgb, var(--void) 58%, var(--surface-2)), color-mix(in srgb, var(--void) 24%, var(--surface-2)))',
                  color: active ? 'var(--accent-core)' : 'var(--ink-500)',
                  boxShadow: active
                    ? '0 0 14px color-mix(in srgb, var(--accent) 30%, transparent), inset 0 1px 0 color-mix(in srgb, var(--accent) 30%, transparent)'
                    : 'inset 0 8px 12px -10px #000',
                  // Replays only on the render where `active` flips,
                  // because the property itself changes from undefined.
                  animation: active ? 'init-chip-pop 260ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
                } as CSSProperties
              }
            >
              {/* The edge light on a lit chip — the same tell every other
                  active surface in the app carries. */}
              {active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background:
                      'linear-gradient(to right, transparent, var(--accent-core), transparent)',
                  }}
                />
              )}

              {/* The shape half of the state. Filled node when on, empty
                  outline when off — readable without colour.

                  Dropped in grid mode, and only there. Four weekday
                  chips share ~206px at 320px, so each has ~51px; the
                  node and its gap take 11 of them and "MON" truncates
                  to "M…", which is worse for identifying a chip than
                  losing its second state cue. In that layout the lit
                  border, fill and glow already carry the state, and the
                  grid itself reads as a calendar. */}
              {!columns && (
                <span
                  aria-hidden
                  className="block shrink-0 rotate-45 transition-all duration-150"
                  style={{
                    width: 5,
                    height: 5,
                    background: active ? 'var(--accent-core)' : 'transparent',
                    border: `1px solid ${active ? 'var(--accent-core)' : 'var(--hair-strong)'}`,
                    boxShadow: active ? '0 0 6px var(--accent-core)' : 'none',
                  }}
                />
              )}
              <span className="min-w-0 truncate">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
