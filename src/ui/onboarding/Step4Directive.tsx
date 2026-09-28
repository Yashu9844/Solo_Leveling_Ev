import { EASE, Instrument, Rise, Slot, StepConsole } from './shared';

const SOFT_LIMIT = 140;

/**
 * The end date, written the way a person would say it.
 *
 * The arc's end arrives here as a raw ISO string, and printing
 * "2026-12-29" in the middle of an English sentence is the single most
 * machine-readable thing on a screen whose whole job is to make someone
 * commit to a date. Falls back to the ISO string rather than throwing
 * if it is ever handed something unparseable.
 */
function spokenDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Step 4 — the one sentence the whole arc is judged against.
 *
 * This is the highest-stakes text box in the app, and it used to look
 * exactly like every other text box in the app. Three things carry it:
 *
 * 1. A struck seal. What the user types is echoed underneath in the
 *    display face — the same face the app will use when it quotes this
 *    sentence back at them on the checkpoint report. Seeing the words
 *    in their final dress while writing them raises the bar on the
 *    writing, every time.
 * 2. A soft length counter. Not a hard cap — truncating someone's
 *    stated purpose would be absurd — but a visible nudge, because a
 *    main quest that does not fit in one line is not one quest.
 * 3. **The seal is always on the screen.** The first pass rendered it
 *    only once there was something to seal, on the reasoning that an
 *    empty ceremonial frame is worse than no frame. On a phone that was
 *    the wrong call: it left the step at roughly half the height of
 *    every other one, floating in the middle of an empty column, which
 *    read as content that had failed to load. Empty, the plate is the
 *    System waiting — which is a state worth drawing.
 */
export function Step4Directive({
  value,
  onChange,
  endDate,
}: {
  value: string;
  onChange: (v: string) => void;
  endDate: string;
}) {
  const text = value.trim();
  const over = text.length > SOFT_LIMIT;

  return (
    <StepConsole
      index={4}
      kicker="Prime directive"
      title="Main quest"
      lead={<>One sentence. What has to be true on {spokenDate(endDate)}?</>}
    >
      <div className="space-y-5">
        <Rise delay={70} className="space-y-2">
          <Slot style={{ alignItems: 'stretch', paddingTop: 12, paddingBottom: 12 }}>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={4}
              className="resize-none leading-[1.5]"
              placeholder="This is the only thing the app judges you against."
            />
          </Slot>

          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-faint">
              One quest. Not a list.
            </span>
            <span
              className="shrink-0 font-mono text-[10px] tabular-nums"
              style={{ color: over ? 'var(--state-recover)' : 'var(--ink-700)' }}
            >
              {text.length}/{SOFT_LIMIT}
            </span>
          </div>
        </Rise>

        {/* The seal. */}
        <Rise delay={140}>
          <Instrument
            label={text.length > 0 ? 'Sealed' : 'Awaiting directive'}
            live={text.length > 0}
            right={
              <span
                aria-hidden
                className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
                style={{ color: text.length > 0 ? 'var(--accent-mid)' : 'var(--faint)' }}
              >
                {text.length > 0 ? '◆' : '◇'}
              </span>
            }
          >
            <div className="relative min-h-[84px]">
              {/* The lit spine down the left edge of a sealed quote —
                  the app's mark for something the System is now holding
                  you to. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[2px]"
                style={{
                  background:
                    text.length > 0
                      ? 'linear-gradient(180deg, var(--accent-core), transparent)'
                      : 'var(--hair-faint)',
                  boxShadow: text.length > 0 ? 'var(--glow-sm)' : 'none',
                  transition: `background 220ms ${EASE}`,
                }}
              />

              <div className="pl-4">
                {text.length > 0 ? (
                  <p
                    key={text}
                    className="font-display text-title leading-[1.25] text-ink-100"
                    style={{ animation: `init-seal-in 420ms ${EASE} both` }}
                  >
                    {text}
                  </p>
                ) : (
                  <p
                    aria-hidden
                    className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-faint"
                  >
                    <span>Nothing sealed yet</span>
                    <span
                      className="inline-block h-[12px] w-[7px] shrink-0"
                      style={{
                        background: 'var(--faint)',
                        animation: 'init-caret 1.1s steps(1) infinite',
                      }}
                    />
                  </p>
                )}
              </div>
            </div>
          </Instrument>
        </Rise>

        <Rise delay={200}>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            <span
              aria-hidden
              className="block h-[3px] w-[3px] shrink-0 rotate-45"
              style={{ background: 'var(--faint)' }}
            />
            <span className="min-w-0 truncate">Quoted back at every checkpoint</span>
          </div>
        </Rise>
      </div>
    </StepConsole>
  );
}
