import { Echo, EASE, Rise, Slot } from './shared';

const CORNERS = [
  'left-0 top-0 border-l-2 border-t-2',
  'right-0 top-0 border-r-2 border-t-2',
  'left-0 bottom-0 border-b-2 border-l-2',
  'right-0 bottom-0 border-b-2 border-r-2',
] as const;

/**
 * Step 1 — the awakening.
 *
 * The one step that does not wear a console rail. It is the first thing
 * anyone ever sees of this app after the Start screen, and its job is
 * not to collect a name — it is to establish that something is
 * addressing you. The name field is almost incidental; the sentence
 * above it carries the entire premise of the product, so it is set in
 * the display face at display weight rather than as body copy.
 *
 * Art sits behind this step (design/00 §2.5, slot `onboarding`), so the
 * plate is heavier than a console: a rail and a ghosted index would
 * compete with the illustration, where a plain lit plate reads as a
 * window opened over it.
 */
export function Step1Identity({
  name,
  onChangeName,
}: {
  name: string;
  onChangeName: (v: string) => void;
}) {
  const designation = name.trim().toUpperCase();

  return (
    <div
      className="relative overflow-hidden px-5 py-6"
      style={{
        border: '1px solid var(--accent)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 52%), linear-gradient(180deg, color-mix(in srgb, var(--void) 24%, var(--panel-top)) 0%, color-mix(in srgb, var(--void) 34%, var(--surface)) 100%)',
        boxShadow:
          '0 0 34px color-mix(in srgb, var(--accent) 20%, transparent), inset 0 0 60px color-mix(in srgb, var(--accent) 6%, transparent)',
        backdropFilter: 'blur(3px)',
        transformOrigin: 'top center',
        animation: `system-frame-in 300ms ${EASE} both`,
      }}
    >
      {CORNERS.map((c, i) => (
        <span
          key={c}
          aria-hidden
          className={`pointer-events-none absolute z-20 ${c}`}
          style={{
            width: 16,
            height: 16,
            borderColor: 'var(--accent)',
            animation: `system-bracket-in 220ms ${EASE} ${140 + i * 30}ms both`,
          }}
        />
      ))}

      {/* The plate is a window opened over the art, so it gets the same
          slow sweep every console carries. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10"
        style={{
          background:
            'linear-gradient(180deg, transparent, color-mix(in srgb, var(--accent) 26%, transparent), transparent)',
          animation: 'init-console-sweep 9s linear 1.4s infinite',
        }}
      />

      <div className="relative space-y-6">
        <Rise>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="block h-[6px] w-[6px] shrink-0 rotate-45"
              style={{ background: 'var(--accent-core)', boxShadow: 'var(--glow-sm)' }}
            />
            <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-accent-mid">
              AWAKENING
            </span>
            <span
              aria-hidden
              className="h-px min-w-0 flex-1"
              style={{
                background:
                  'linear-gradient(to right, var(--hair-strong), transparent)',
              }}
            />
          </div>
        </Rise>

        <Rise delay={70}>
          {/* The premise. Two sentences, weighted apart so the eye takes
              the claim first and the consequence second. */}
          <p className="font-display text-title leading-[1.2] text-ink-100">
            <span className="init-glint">This system asks for evidence, not effort.</span>
          </p>
          <p className="mt-3 text-sm leading-[1.5] text-ink-500">
            It will tell you whether four months changed anything.
          </p>
        </Rise>

        <Rise delay={140}>
          <div
            aria-hidden
            className="h-px w-full"
            style={{
              background:
                'linear-gradient(to right, var(--accent), color-mix(in srgb, var(--accent) 16%, transparent) 46%, transparent)',
            }}
          />
        </Rise>

        <Rise delay={200} className="space-y-3">
          <label className="block">
            <span className="mb-2 flex items-center gap-1.5">
              <span
                aria-hidden
                className="block h-[4px] w-[4px] shrink-0 rotate-45"
                style={{ background: 'var(--accent-deep)' }}
              />
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
                Designation
              </span>
            </span>
            <Slot style={{ minHeight: 52 }}>
              <input
                type="text"
                value={name}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="Your name"
                autoComplete="given-name"
                autoCapitalize="words"
              />
            </Slot>
          </label>

          {/* The System repeating the name back. It costs one line and it
              is the moment the flow stops being a form. */}
          <Echo
            prefix="▸"
            value={designation || 'AWAITING DESIGNATION'}
            tone={designation ? 'accent' : 'faint'}
          />
        </Rise>
      </div>
    </div>
  );
}
