import type { CSSProperties, ReactNode } from 'react';

/**
 * The onboarding vocabulary.
 *
 * Six steps used to be six identical framed boxes with a noun on top,
 * which is why the flow read as a web form wearing the app's colours.
 * The first pass gave each step a codename, an index and a shape of its
 * own. This pass gives them *instruments*: every step now owns one
 * console, one recessed readout and one hero figure, drawn from the
 * parts defined here, so the flow reads as a machine being calibrated
 * rather than as a questionnaire being filled in.
 */

export interface IntentionDraft {
  time: string;
  place: string;
  first_action: string;
}

/** One entry per step, in order. The codename is what the spine reads
 * out, so it is a single tracked word — a label, not a sentence. */
export const STEPS = [
  { code: 'IDENTITY', kicker: 'AWAKENING' },
  { code: 'ARC', kicker: 'DEFINE THE WINDOW' },
  { code: 'RHYTHM', kicker: 'CALIBRATE THE DAY' },
  { code: 'DIRECTIVE', kicker: 'PRIME DIRECTIVE' },
  { code: 'TRIGGERS', kicker: 'TRIGGER PROTOCOL' },
  { code: 'BASELINE', kicker: 'BASELINE CAPTURE' },
] as const;

export const TOTAL_STEPS = STEPS.length;

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Two digits, the way every readout in this app prints a small number. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `HH:MM` → minutes past midnight, or null if it isn't a time yet.
 * A `<input type="time">` can hand back an empty string mid-edit. */
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function dayCount(startDate: string, endDate: string): number | null {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const days = Math.round((end - start) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

/**
 * A staggered entrance for one block inside a step.
 *
 * Delay is capped at 240ms deliberately. The reduced-motion rules in
 * index.css collapse `animation-duration` but not `animation-delay`, so
 * a block delayed by half a second would sit at its `from` frame —
 * invisible — for half a second even for a user who asked for
 * stillness. Short enough not to matter, long enough to read as a
 * sequence.
 */
export function Rise({
  delay = 0,
  children,
  className = '',
  style,
}: {
  delay?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ animation: `init-rise 340ms ${EASE} ${Math.min(delay, 240)}ms both`, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * The step's number, set enormous and almost invisible behind the
 * content.
 *
 * It is the cheapest way to give six otherwise-identical panels a
 * distinct identity: peripheral vision registers "this is a different
 * screen" before any word is read. Cormorant rather than the mono face
 * because it is ceremony, not a figure anyone reads for precision.
 */
export function GhostIndex({ index }: { index: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute select-none font-display leading-[0.8]"
      style={{
        // Fully inside the frame. Bled off the right edge it looked
        // better in isolation and worse in place: a half-drawn glyph is
        // the exact thing design/00 §9.5 flags as reading like a
        // rendering fault rather than a decision.
        right: 4,
        top: 26,
        fontSize: 'clamp(92px, 30vw, 128px)',
        fontWeight: 300,
        color: 'var(--accent)',
        opacity: 0.07,
        letterSpacing: '-0.05em',
      }}
    >
      {pad2(index)}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * The console — the frame a step lives in
 * ══════════════════════════════════════════════════════════════════════ */

const CORNERS = [
  'left-0 top-0 border-l-2 border-t-2',
  'right-0 top-0 border-r-2 border-t-2',
  'left-0 bottom-0 border-b-2 border-l-2',
  'right-0 bottom-0 border-b-2 border-r-2',
] as const;

/**
 * One step's housing.
 *
 * Replaces the bare `SystemWindow` the flow used to wrap every step in.
 * Three things it adds, each aimed at a specific way the old panel read
 * as a printed card rather than a live instrument:
 *
 * - **A rail.** A tick strip across the top carrying the index and the
 *   kicker, so the panel has a machined edge instead of beginning at a
 *   heading.
 * - **A sweep that never stops.** `SystemWindow`'s scan line plays once
 *   on arrival and then the panel is inert forever. This one runs on a
 *   9s cycle and is mostly transparent — below conscious notice, but
 *   the screen is never dead.
 * - **A head that belongs to the frame.** Index, kicker, title and lead
 *   were being re-assembled by every step; here they are the frame's
 *   own, which is what makes six steps read as one machine.
 *
 * All CSS, all `both` (design/00 §5.1): every field on these screens
 * has a final state that matters, and a starved rAF would strand one at
 * `opacity: 0` — visible to a test, invisible to a person.
 */
export function StepConsole({
  index,
  kicker,
  title,
  lead,
  children,
}: {
  index: number;
  kicker: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        border: '1px solid var(--accent)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, transparent) 0%, transparent 48%), linear-gradient(180deg, var(--panel-top) 0%, var(--surface) 100%)',
        boxShadow:
          '0 0 26px color-mix(in srgb, var(--accent) 16%, transparent), inset 0 0 50px color-mix(in srgb, var(--accent) 5%, transparent)',
        transformOrigin: 'top center',
        animation: `system-frame-in 280ms ${EASE} both`,
      }}
    >
      {CORNERS.map((c, i) => (
        <span
          key={c}
          aria-hidden
          className={`pointer-events-none absolute z-20 ${c}`}
          style={{
            width: 14,
            height: 14,
            borderColor: 'var(--accent)',
            animation: `system-bracket-in 220ms ${EASE} ${120 + i * 26}ms both`,
          }}
        />
      ))}

      {/* The living sweep. The console's own overflow crops it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10"
        style={{
          background:
            'linear-gradient(180deg, transparent, color-mix(in srgb, var(--accent) 26%, transparent), transparent)',
          animation: 'init-console-sweep 9s linear 1.2s infinite',
        }}
      />

      <GhostIndex index={index} />

      {/* ── the rail ── */}
      <div
        className="relative flex items-center gap-2 px-4 py-2"
        style={{
          borderBottom: '1px solid var(--hair-faint)',
          background: 'color-mix(in srgb, var(--void) 45%, transparent)',
        }}
      >
        <span
          className="shrink-0 font-mono text-[9px] font-bold tabular-nums tracking-[0.1em]"
          style={{ color: 'var(--accent-mid)' }}
        >
          {pad2(index)}
        </span>
        <span aria-hidden className="shrink-0 text-faint">
          ·
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-accent-mid">
          {kicker}
        </span>
        {/* Tick marks. Pure machining — they say the panel was built
            rather than drawn. */}
        <span aria-hidden className="flex shrink-0 items-end gap-[3px]">
          {[4, 7, 4, 9, 4].map((h, i) => (
            <span
              key={i}
              className="block w-px"
              style={{ height: h, background: i === 3 ? 'var(--accent)' : 'var(--hair-strong)' }}
            />
          ))}
        </span>
      </div>

      <div className="relative px-5 pb-6 pt-5">
        {/* ── the head ── */}
        <Rise>
          <h1
            className="font-display text-title uppercase tracking-label text-ink-100"
            style={{ lineHeight: 1.06 }}
          >
            <span className="init-glint">{title}</span>
          </h1>
          <div
            aria-hidden
            className="mt-2.5 h-px w-full"
            style={{
              background:
                'linear-gradient(to right, var(--accent), color-mix(in srgb, var(--accent) 18%, transparent) 42%, transparent)',
            }}
          />
          {lead && <p className="mt-3 text-sm leading-[1.5] text-ink-500">{lead}</p>}
        </Rise>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * The console with no body.
 *
 * Steps 4-6 still call this while the migration to StepConsole's
 * children slot is in progress, and a missing export is not a local
 * problem: an ESM import that names something the module does not export
 * is a SyntaxError that takes down the whole graph, so four unfinished
 * imports render the entire app as a white screen. Restoring the name
 * keeps the app running while the migration finishes; delete it once
 * Steps 4-6 wrap their content instead.
 */
export function StepHead(props: {
  index: number;
  kicker: string;
  title: string;
  lead?: ReactNode;
}) {
  return <StepConsole {...props}>{null}</StepConsole>;
}

/* ══════════════════════════════════════════════════════════════════════
 * Instruments
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * A recessed readout inside a step.
 *
 * The old panels put every sub-surface *above* the panel's luminance —
 * a lighter box on a lighter box on a dark ground — so nothing had a
 * focal point and the whole screen sat at one value. An instrument goes
 * the other way: darker than its housing, lipped at the top, with its
 * own hairline label. The result is a hole in the panel for the eye to
 * land in, which is what the old screens gave it nowhere to do.
 */
export function Instrument({
  label,
  right,
  children,
  className = '',
  live = false,
}: {
  label?: string;
  /** Right-hand side of the label row — a count, a state, a unit. */
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Breathes the top edge light, for an instrument that is reporting
   * rather than waiting. */
  live?: boolean;
}) {
  const titled = Boolean(label || right);

  return (
    <div
      className={['cut-sm relative overflow-hidden', className].join(' ')}
      style={
        {
          '--cut-sm': '10px',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--void) 62%, var(--surface)) 0%, color-mix(in srgb, var(--void) 26%, var(--surface)) 100%)',
          border: '1px solid var(--hair-faint)',
          boxShadow: 'inset 0 12px 20px -16px #000',
        } as CSSProperties
      }
    >
      {/* The top edge light — the tell that this is a lit readout and
          not merely a darker box. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 55%, transparent), transparent)',
          animation: live ? 'init-breathe 3.6s ease-in-out infinite' : undefined,
        }}
      />

      {titled && (
        <div className="flex items-center gap-2.5 px-3.5 pt-3">
          {label && (
            <span className="min-w-0 truncate font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
              {label}
            </span>
          )}
          <span
            aria-hidden
            className="h-px min-w-[10px] flex-1"
            style={{ background: 'var(--hair-faint)' }}
          />
          {right}
        </div>
      )}

      <div className={titled ? 'px-3.5 pb-3.5 pt-3' : 'p-3.5'}>{children}</div>
    </div>
  );
}

/**
 * The one figure a step is actually about.
 *
 * Every step here has exactly one: the arc's length, the hours awake,
 * the count of armed triggers. Set at display scale in the mono face
 * with the app's glow, it gives the eye a place to land — the single
 * thing the old uniformly-weighted panels never offered.
 */
export function HeroFigure({
  value,
  unit,
  tone = 'accent',
}: {
  value: ReactNode;
  unit: string;
  tone?: 'accent' | 'quiet';
}) {
  const lit = tone === 'accent';
  return (
    <div className="flex items-baseline gap-2.5">
      <span
        key={String(value)}
        className="font-mono font-bold tabular-nums leading-[0.9]"
        style={{
          fontSize: 'calc(40px * var(--type-scale))',
          color: lit ? 'var(--accent-core)' : 'var(--ink-300)',
          textShadow: lit ? 'var(--glow-text)' : 'none',
          animation: `init-hero-in 420ms ${EASE} both`,
        }}
      >
        {value}
      </span>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink-700">
        {unit}
      </span>
    </div>
  );
}

/**
 * A sub-section divider inside a tall step.
 *
 * Step 3 asks six unrelated questions. Without these it is a wall of
 * controls; with them it is three short groups, which is the difference
 * between scrolling and abandoning.
 */
export function SubHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="block h-[5px] w-[5px] shrink-0 rotate-45"
        style={{ background: 'var(--accent)', boxShadow: 'var(--glow-sm)' }}
      />
      <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-300">
        {children}
      </span>
      <span
        aria-hidden
        className="h-px min-w-0 flex-1"
        style={{ background: 'var(--hair-faint)' }}
      />
      {right}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * The machined slot — onboarding's form control
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * The housing a control sits in.
 *
 * The styling lives in `.init-slot` (index.css) rather than here
 * because the lit state is `:focus-within`, which inline styles cannot
 * express — and it has to be `:focus-within` rather than `:focus` on
 * the input itself, since a native date or time picker moves focus into
 * its own internal segments.
 */
export function Slot({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={['init-slot px-3', className].join(' ')} style={{ minHeight: 48, ...style }}>
      {children}
    </div>
  );
}

/**
 * A labelled slot.
 *
 * The label carries a lit marker, so a stack of fields reads as a
 * column of instruments rather than as a web form's labels.
 */
export function SlotField({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={['block', className].join(' ')}>
      <span className="mb-2 flex items-center gap-1.5">
        <span
          aria-hidden
          className="block h-[4px] w-[4px] shrink-0 rotate-45"
          style={{ background: 'var(--accent-deep)' }}
        />
        <span className="min-w-0 truncate font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
          {label}
        </span>
      </span>
      <Slot>{children}</Slot>
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

/**
 * The System echoing back what it just heard.
 *
 * A live mono readout under an input turns typing into a transaction
 * with something that is listening. It carries no information the field
 * does not already show, so it is decorative in the accessibility sense
 * and hidden from the reader — the input's own value is the source of
 * truth for anyone using a screen reader.
 */
export function Echo({
  prefix,
  value,
  caret = true,
  tone = 'accent',
}: {
  prefix: string;
  value: string;
  caret?: boolean;
  tone?: 'accent' | 'faint';
}) {
  const colour = tone === 'accent' ? 'var(--accent-mid)' : 'var(--faint)';
  return (
    <div
      aria-hidden
      className="flex min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]"
      style={{ color: colour }}
    >
      <span className="shrink-0 opacity-60">{prefix}</span>
      <span className="min-w-0 truncate">{value}</span>
      {caret && (
        <span
          className="inline-block h-[12px] w-[7px] shrink-0"
          style={{ background: colour, animation: 'init-caret 1.1s steps(1) infinite' }}
        />
      )}
    </div>
  );
}
