import {
  Barbell,
  BatteryLow,
  Cloud,
  Code,
  Cpu,
  HourglassMedium,
  Prohibit,
  Target,
  Warning,
  type Icon,
} from '@phosphor-icons/react';

const CHIP_ICON: Record<string, Icon> = {
  time: HourglassMedium,
  tired: BatteryLow,
  wrong_time: Warning,
  didnt_want_to: Prohibit,
  nothing: Cloud,
  career: Target,
  dsa: Code,
  build: Cpu,
  training: Barbell,
};

interface SingleChipSelectProps<T extends string> {
  label: string;
  options: readonly T[];
  labelFor: (option: T) => string;
  selected: T | null;
  onSelect: (option: T) => void;
  iconFor?: (option: T) => Icon | undefined;
}

/** A row of cut-corner HUD chips where exactly one can be selected — matching Image 1 */
export function SingleChipSelect<T extends string>({
  label,
  options,
  labelFor,
  selected,
  onSelect,
  iconFor,
}: SingleChipSelectProps<T>) {
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase font-bold tracking-[0.18em] text-ink-700">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === selected;
          const Glyph = iconFor ? iconFor(option) : CHIP_ICON[option];

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              aria-pressed={active}
              className="cut-sm flex min-h-[42px] items-center gap-2 px-3.5 text-xs font-semibold tracking-wider transition-all duration-200"
              style={{
                border: active ? '1px solid rgba(192, 132, 252, 0.8)' : '1px solid rgba(77, 163, 255, 0.25)',
                background: active
                  ? 'linear-gradient(180deg, rgba(88, 28, 135, 0.75), rgba(45, 10, 80, 0.85))'
                  : 'linear-gradient(180deg, rgba(12, 22, 38, 0.75), rgba(7, 13, 24, 0.85))',
                color: active ? '#ffffff' : 'var(--ink-300)',
                boxShadow: active ? '0 0 14px rgba(168, 85, 247, 0.5)' : 'none',
              }}
            >
              {Glyph && (
                <Glyph
                  size={15}
                  weight={active ? 'fill' : 'regular'}
                  color={active ? '#c084fc' : '#5fb2ff'}
                />
              )}
              <span>{labelFor(option)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

