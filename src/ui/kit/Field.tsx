import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
  /** Quiet line under the control — units, constraints, consequences. */
  hint?: string;
  className?: string;
}

/** A labelled control. The label is the same tracked uppercase micro-type
 * used for section labels, so a form reads as part of the system rather
 * than as a web form dropped into it. */
export function Field({ label, children, hint, className = '' }: FieldProps) {
  return (
    <label className={['block', className].join(' ')}>
      <span className="mb-2 block font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

type InputProps = ComponentPropsWithoutRef<'input'>;

/**
 * The text/date/time input.
 *
 * 48px tall rather than the 44px floor: a form field is a target you aim
 * at while reading, not one you tap by muscle memory, and the extra 4px
 * costs nothing on a screen the user is already scrolling.
 *
 * Focus is a bordered glow rather than a ring, because a ring outside a
 * bordered box on a dark ground reads as two borders.
 */
export function TextInput({ className = '', ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={[
        'w-full rounded-sm px-3 text-md text-ink-100 outline-none',
        'placeholder:text-faint',
        'transition-[border-color,box-shadow] duration-150',
        'focus:border-accent focus:shadow-glow-sm',
        className,
      ].join(' ')}
      style={{
        minHeight: 48,
        background: 'var(--surface-2)',
        border: '1px solid var(--hair)',
        ...rest.style,
      }}
    />
  );
}

type TextAreaProps = ComponentPropsWithoutRef<'textarea'>;

export function TextArea({ className = '', ...rest }: TextAreaProps) {
  return (
    <textarea
      {...rest}
      className={[
        'w-full rounded-sm px-3 py-3 text-md leading-[1.5] text-ink-100 outline-none',
        'placeholder:text-faint',
        'transition-[border-color,box-shadow] duration-150',
        'focus:border-accent focus:shadow-glow-sm',
        className,
      ].join(' ')}
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--hair)',
        ...rest.style,
      }}
    />
  );
}

/** The ceremonial heading inside a step or sheet — Cormorant, tracked,
 * distinct from a screen title so a step reads as a chapter. */
/**
 * A step's heading, in the System's register.
 *
 * The `kicker` is the System saying what it is doing before it asks for
 * anything — the same move the rest of the app makes with its ⟨ … ⟩
 * labels. Onboarding used to open each step with a bare noun, which read
 * as a web form's fieldset legend rather than as a machine bringing
 * itself online around you.
 */
export function StepTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div className="mb-1">
      {kicker && (
        <div className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-accent-mid">
          ⟨ {kicker} ⟩
        </div>
      )}
      <h1 className="font-display text-title uppercase tracking-label text-ink-100">{children}</h1>
      <div
        aria-hidden
        className="mt-2 h-px w-full"
        style={{
          background:
            'linear-gradient(to right, var(--accent), color-mix(in srgb, var(--accent) 20%, transparent) 45%, transparent)',
        }}
      />
    </div>
  );
}
