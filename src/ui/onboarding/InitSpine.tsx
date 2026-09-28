import { EASE, STEPS, TOTAL_STEPS, pad2 } from './shared';

/**
 * The initialisation spine.
 *
 * Replaces six flat bars. The bars answered "how much is left" and
 * nothing else; a spine of nodes answers that *and* says the flow is a
 * sequence of locks being opened — which is the only thing this genre's
 * interfaces ever draw.
 *
 * The mechanics that matter:
 *
 * - The filled length is one element scaled on the X axis, not a width.
 *   A width animation lays out every frame; a transform does not, and
 *   this sits above a scrolling column on a phone.
 * - Nodes are absolutely positioned by percentage, so six of them fit a
 *   320px screen exactly as well as a 430px one with no media query.
 * - The whole thing is one `progressbar`, and the nodes are
 *   `aria-hidden`. Six separate announcements per step is noise; the
 *   step count is the fact.
 */
export function InitSpine({ step }: { step: number }) {
  // Nodes sit at the centre of equal columns rather than at 0% and
  // 100%: an end node pinned to the edge gets clipped by the gutter and
  // reads as a rendering fault at 320px.
  const at = (i: number) => ((i + 0.5) / TOTAL_STEPS) * 100;
  const fillTo = at(step - 1);
  // `step` is a caller's counter, and an index read is only as total as
  // the array. Clamping rather than asserting means an off-by-one
  // upstream degrades to the first node instead of throwing inside a
  // render — and STEPS is an `as const` tuple, so element 0 is a real
  // type rather than another possibly-undefined.
  const current = STEPS[Math.min(Math.max(step, 1), TOTAL_STEPS) - 1] ?? STEPS[0];

  return (
    <div className="px-gutter pt-4">
      <div
        className="relative h-[18px]"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={`Step ${step} of ${TOTAL_STEPS}`}
      >
        {/* The unwalked track. */}
        <span
          aria-hidden
          className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
          style={{ background: 'var(--hair-faint)' }}
        />

        {/* The walked length. `transition` on the transform rather than
            a keyframe: this element persists across steps, so it has to
            animate *between* two states, not replay an entrance. */}
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-px origin-left -translate-y-1/2"
          style={{
            width: '100%',
            transform: `scaleX(${fillTo / 100})`,
            transition: `transform 420ms ${EASE}`,
            background: 'linear-gradient(to right, var(--accent-deep), var(--accent))',
          }}
        />

        {STEPS.map((s, i) => {
          const index = i + 1;
          const done = index < step;
          const isCurrent = index === step;
          const size = isCurrent ? 11 : 7;

          return (
            <span
              key={s.code}
              aria-hidden
              className="absolute top-1/2"
              style={{ left: `${at(i)}%`, transform: 'translate(-50%, -50%)' }}
            >
              {/* The halo only ever exists on one node, which keeps the
                  §3 glow budget at one element for this whole band. */}
              {isCurrent && (
                <span
                  className="absolute left-1/2 top-1/2 block"
                  style={{
                    width: 18,
                    height: 18,
                    marginLeft: -9,
                    marginTop: -9,
                    border: '1px solid var(--accent)',
                    animation: 'init-node-halo 2.4s ease-in-out infinite',
                  }}
                />
              )}
              <span
                className="block"
                style={{
                  width: size,
                  height: size,
                  transform: 'rotate(45deg)',
                  background: done
                    ? 'var(--accent-deep)'
                    : isCurrent
                      ? 'var(--accent-core)'
                      : 'var(--surface-2)',
                  border: `1px solid ${done || isCurrent ? 'var(--accent)' : 'var(--hair)'}`,
                  boxShadow: isCurrent ? 'var(--glow-sm)' : 'none',
                  animation: isCurrent ? `init-node-lock 360ms ${EASE} both` : undefined,
                }}
              />
            </span>
          );
        })}
      </div>

      {/* The readout. The codename is what makes the spine legible —
          a node you cannot name is just a dot. */}
      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <span
          key={current.code}
          className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-accent-mid"
          style={{ animation: `init-rise 300ms ${EASE} both` }}
        >
          {current.code}
        </span>
        <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-ink-700">
          {pad2(step)} <span className="text-faint">/ {pad2(TOTAL_STEPS)}</span>
        </span>
      </div>
    </div>
  );
}
