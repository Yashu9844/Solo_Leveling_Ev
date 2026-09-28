import { CaretRight, Check } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * The settings grouped list — transformed into Solo Leveling System Control Panel style.
 *
 * Maintains full accessibility (role="radiogroup", role="radio", aria-checked, data-testid)
 * while elevating the visual design with electric blue mana hairlines, cyber cuts,
 * and high-responsiveness Framer Motion interactions.
 */

interface SettingsGroupProps {
  /** Uppercase header above the card. Omit for an unlabelled group. */
  title?: string;
  /** Sits under the card in small type — the place for "why this
   * exists", so a row's own label can stay short. */
  footnote?: ReactNode;
  children: ReactNode;
  /** Destructive groups (reset arc) take --state-alert. */
  tone?: 'default' | 'alert';
  /** The card holds a set of mutually exclusive choices. Makes it a
   * radiogroup, which is what the `selected` rows inside it need as a
   * parent to mean anything to a screen reader. */
  choice?: boolean;
  className?: string;
}

export function SettingsGroup({
  title,
  footnote,
  children,
  tone = 'default',
  choice = false,
  className = '',
}: SettingsGroupProps) {
  const alert = tone === 'alert';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={['mt-5', className].join(' ')}
    >
      {title && (
        <div className="mb-2 px-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={[
                'h-1.5 w-1.5 rounded-full',
                alert ? 'bg-state-alert shadow-[0_0_8px_#d95c5c]' : 'bg-accent-mid shadow-[0_0_8px_#5fb2ff]',
              ].join(' ')}
            />
            <span
              className={[
                'text-[10px] font-mono font-bold uppercase tracking-[0.2em]',
                alert ? 'text-state-alert' : 'text-accent-mid glow-text',
              ].join(' ')}
            >
              {title}
            </span>
          </div>
        </div>
      )}
      <div
        role={choice ? 'radiogroup' : undefined}
        aria-label={choice ? title : undefined}
        className="cut-sm overflow-hidden transition-all duration-200"
        style={{
          border: alert
            ? '1px solid rgba(217, 92, 92, 0.45)'
            : '1px solid rgba(77, 163, 255, 0.28)',
          background: alert
            ? 'linear-gradient(180deg, rgba(30, 10, 15, 0.9), rgba(15, 5, 8, 0.96))'
            : 'linear-gradient(180deg, rgba(12, 22, 38, 0.88), rgba(6, 11, 20, 0.96))',
          boxShadow: alert
            ? '0 0 20px rgba(217, 92, 92, 0.15)'
            : '0 0 20px rgba(77, 163, 255, 0.08)',
        }}
      >
        {children}
      </div>
      {footnote && (
        <p className="mt-2 px-1 text-xs leading-[1.5] text-ink-500 font-medium">
          {footnote}
        </p>
      )}
    </motion.div>
  );
}

interface SettingsRowProps {
  icon?: Icon;
  label: string;
  /** Second line under the label, for a row that needs a sentence. */
  description?: string;
  /** Current value, shown trailing. */
  value?: ReactNode;
  /** Makes the row a button. Shows a chevron unless `selected` is set. */
  onClick?: () => void;
  /**
   * Marks the row as one option in a list you choose from.
   */
  selected?: boolean;
  chevron?: boolean;
  control?: ReactNode;
  tone?: 'default' | 'alert';
  disabled?: boolean;
  testId?: string;
}

export function SettingsRow({
  icon: Glyph,
  label,
  description,
  value,
  onClick,
  selected,
  chevron = true,
  control,
  tone = 'default',
  disabled = false,
  testId,
}: SettingsRowProps) {
  const alert = tone === 'alert';

  const body = (
    <>
      <div className="flex w-full items-center gap-3">
        {Glyph && (
          <div
            className={[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] transition-all duration-200',
              alert
                ? 'border border-state-alert/40 bg-state-alert/10 text-state-alert shadow-[0_0_8px_rgba(217,92,92,0.3)]'
                : selected
                ? 'border border-accent/60 bg-accent-deep/50 text-accent-mid shadow-[0_0_12px_rgba(77,163,255,0.4)]'
                : 'border border-accent/20 bg-accent-deep/20 text-accent-mid/80 group-hover:border-accent/50 group-hover:bg-accent-deep/35',
            ].join(' ')}
          >
            <Glyph
              size={17}
              weight={selected ? 'fill' : 'regular'}
              color={alert ? 'var(--state-alert)' : selected ? '#5fb2ff' : '#90a8c2'}
              aria-hidden
            />
          </div>
        )}
        <span className="min-w-0 flex-1">
          <span
            className={[
              'block text-sm font-semibold tracking-wide leading-[1.35] transition-colors',
              alert
                ? 'text-state-alert'
                : selected
                ? 'text-ink-100 glow-text'
                : 'text-ink-100 group-hover:text-accent-bright',
            ].join(' ')}
          >
            {label}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs leading-[1.4] text-ink-500 font-normal">
              {description}
            </span>
          )}
        </span>
        {value !== undefined && (
          <span className="shrink-0 text-right font-mono text-xs font-bold text-accent-mid glow-text">
            {value}
          </span>
        )}
        {selected !== undefined ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-accent/40 bg-accent-deep/40 shadow-[0_0_8px_rgba(77,163,255,0.3)]">
            {selected && <Check size={14} weight="bold" color="#5fb2ff" aria-hidden />}
          </span>
        ) : (
          onClick &&
          chevron && (
            <motion.div
              whileHover={{ x: 3 }}
              transition={{ duration: 0.15 }}
              className="shrink-0 text-accent-mid/60 group-hover:text-accent-mid drop-shadow-[0_0_6px_rgba(77,163,255,0.4)]"
            >
              <CaretRight size={15} weight="bold" aria-hidden />
            </motion.div>
          )
        )}
      </div>
      {control && <div className="mt-3 w-full">{control}</div>}
    </>
  );

  const shared = 'group flex w-full flex-col px-4 py-3 text-left transition-all duration-150 relative';
  const style = { minHeight: 'var(--row-min, 56px)' } as const;

  if (!onClick) {
    return (
      <div
        className={[shared, 'justify-center', disabled ? 'opacity-40' : ''].join(' ')}
        style={style}
        data-testid={testId}
      >
        {body}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role={selected !== undefined ? 'radio' : undefined}
      aria-checked={selected !== undefined ? selected : undefined}
      whileTap={{ scale: 0.985 }}
      whileHover={{ backgroundColor: 'rgba(77, 163, 255, 0.06)' }}
      className={[shared, 'justify-center', disabled ? 'opacity-40' : ''].join(' ')}
      style={style}
      data-testid={testId}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1 bg-accent-mid shadow-[0_0_10px_#5fb2ff]"
        />
      )}
      {body}
    </motion.button>
  );
}

/** A hairline between rows, inset past the icon column. */
export function SettingsDivider() {
  return (
    <div
      className="ml-4 h-px"
      style={{ background: 'linear-gradient(90deg, rgba(77,163,255,0.2) 0%, rgba(77,163,255,0.05) 100%)' }}
      aria-hidden
    />
  );
}

/** Joins rows with dividers */
export function SettingsList({ children }: { children: ReactNode[] }) {
  const rows = children.filter(Boolean);
  return (
    <>
      {rows.map((row, i) => (
        <div key={i}>
          {i > 0 && <SettingsDivider />}
          {row}
        </div>
      ))}
    </>
  );
}

