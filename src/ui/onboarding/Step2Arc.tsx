import { EASE, HeroFigure, Instrument, Rise, SlotField, StepConsole, dayCount } from './shared';

/** Day + short month, for the two ends of the span. Deliberately not a
 * long `toLocaleDateString` format — the bar has ~80px an end at 320px,
 * and a wrapped date reads as a broken layout. */
function endLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

/**
 * Month boundaries as a fraction along the span.
 *
 * The gradations are what turn a bar into an instrument: without them
 * the span is a decorative line, and with them it is a scale you can
 * read your own four months off. Capped at 11 so a mis-typed decade
 * degrades to a dense-but-finite ruler rather than rendering thousands
 * of nodes inside a phone's layout pass.
 */
function monthTicks(startDate: string, endDate: string): number[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const span = end.getTime() - start.getTime();
  if (!Number.isFinite(span) || span <= 0) return [];

  const ticks: number[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 0, 0, 0)
  );
  while (cursor.getTime() < end.getTime() && ticks.length < 11) {
    ticks.push((cursor.getTime() - start.getTime()) / span);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ticks;
}

/**
 * The span, drawn as a calibrated rail.
 *
 * A start date and an end date are two facts; the distance between them
 * is the commitment, and the commitment is what the user is actually
 * agreeing to on this screen. The travelling pulse is the part that
 * makes it read as a channel with something running through it rather
 * than as a progress bar that is inexplicably already full.
 */
function SpanRail({ startDate, endDate }: { startDate: string; endDate: string }) {
  const ticks = monthTicks(startDate, endDate);

  return (
    <div>
      <div className="relative flex items-center gap-2">
        <span
          aria-hidden
          className="block h-[10px] w-[10px] shrink-0 rotate-45"
          style={{ border: '1px solid var(--accent)', background: 'var(--accent-deep)' }}
        />

        <span className="relative h-[16px] min-w-0 flex-1">
          {/* The channel the charge runs down. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-pill"
            style={{
              background: 'color-mix(in srgb, var(--void) 70%, var(--surface-2))',
              boxShadow: 'inset 0 1px 3px #000',
            }}
          />
          {/* The charge itself. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-[4px] origin-left -translate-y-1/2 rounded-pill"
            style={{
              background:
                'linear-gradient(to right, var(--accent-deep), var(--accent) 55%, var(--accent-core))',
              boxShadow: 'var(--glow-sm)',
              animation: `init-spine-grow 620ms ${EASE} 60ms both`,
            }}
          />
          {/* Month gradations, sitting on top of the lit rail. */}
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute top-1/2 h-[10px] w-px -translate-y-1/2"
              style={{
                left: `${t * 100}%`,
                background: 'color-mix(in srgb, var(--void) 70%, transparent)',
              }}
            />
          ))}
          {/* The pulse. One element, animating `left`, which is cheap
              here because it is absolutely positioned and therefore out
              of flow — nothing reflows behind it. */}
          <span
            aria-hidden
            className="absolute top-1/2 block h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-pill"
            style={{
              background: 'var(--accent-core)',
              boxShadow: '0 0 14px var(--accent-core)',
              animation: 'init-travel 5.5s ease-in-out 900ms infinite',
            }}
          />
        </span>

        <span
          aria-hidden
          className="block h-[10px] w-[10px] shrink-0 rotate-45"
          style={{ border: '1px solid var(--accent-core)', background: 'var(--accent)' }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] tabular-nums text-ink-500">
        <span>{endLabel(startDate)}</span>
        <span className="text-faint">{ticks.length ? `${ticks.length + 1} MO` : ''}</span>
        <span>{endLabel(endDate)}</span>
      </div>
    </div>
  );
}

export function Step2Arc({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
}: {
  startDate: string;
  endDate: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
}) {
  const days = dayCount(startDate, endDate);
  const weeks = days === null ? null : Math.floor(days / 7);

  return (
    <StepConsole
      index={2}
      kicker="Define the window"
      title="Arc"
      lead="The window the System measures inside. Nothing before it counts, and nothing after it is promised."
    >
      <div className="space-y-5">
        {/* One column until 360px. A native date control is the widest
            input in the app — ten digits plus a picker glyph it draws
            itself — and half of a 320px gutter-and-console column
            leaves it ~85px, which cuts the year off both fields. The
            year is the one group a reader cannot infer from the rest,
            so the fields stack rather than shrink. */}
        <Rise delay={60} className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <SlotField label="Start">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onChangeStart(e.target.value)}
              className="tabular-nums"
            />
          </SlotField>
          <SlotField label="End">
            <input
              type="date"
              value={endDate}
              onChange={(e) => onChangeEnd(e.target.value)}
              className="tabular-nums"
            />
          </SlotField>
        </Rise>

        <Rise delay={120}>
          <Instrument
            label="Span"
            live
            right={
              <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-accent-mid">
                {days === null ? 'INVALID' : 'LOCKED'}
              </span>
            }
          >
            <div className="space-y-4">
              <SpanRail startDate={startDate} endDate={endDate} />

              {/* The length, given the same mono-tabular treatment every
                  real figure in this app gets. It is the number the user
                  will quote back to themselves for four months. */}
              <div className="flex items-end justify-between gap-3">
                <HeroFigure value={days ?? '—'} unit="days" />
                <div className="pb-1 text-right">
                  <div className="font-mono text-md font-bold tabular-nums text-ink-300">
                    {weeks ?? '—'}
                  </div>
                  <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
                    weeks
                  </div>
                </div>
              </div>

              {days === null && (
                <p className="text-xs text-state-recover">
                  The end date has to fall after the start.
                </p>
              )}
            </div>
          </Instrument>
        </Rise>

        <Rise delay={180}>
          {/* Wraps rather than truncates. Tracked uppercase mono is a
              wide face, and at 320px this line overran its row — which
              cost the reader "04:00", the only part of it that is
              actually a fact about their day. */}
          <div className="flex items-start gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            <span
              aria-hidden
              className="mt-[5px] block h-[3px] w-[3px] shrink-0 rotate-45"
              style={{ background: 'var(--faint)' }}
            />
            <span className="min-w-0 leading-[1.5]">Asia/Kolkata · day rolls at 04:00</span>
          </div>
        </Rise>
      </div>
    </StepConsole>
  );
}
