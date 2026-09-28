import { useEffect, useState } from 'react';
import { Moment } from '../kit';
import { momentMotionReduced } from './motion';

interface BossClearedMomentProps {
  bossId: string;
  bossTitle: string;
  onDismiss: () => void;
}

type Phase = 'start' | 'rule' | 'label' | 'title';

/**
 * Full screen, 1100ms — final/05 §2.1 calls this "the heaviest" of the
 * six Moments: the rule sweeps (400ms), the boss number cross-fades
 * (400ms), the title fades in (300ms). Timings, haptics and the
 * reduced-motion path are unchanged.
 *
 * Boss red on the `boss-cleared` plate, which the slot map assigns the
 * Gold mood. That pairing is deliberate and it is the only place in the
 * app the two moods meet: the plate is what is on the other side of the
 * fight, and the red frame is the boss's own colour, showing up once
 * more on the way out. Everywhere else --boss stays confined to the
 * BossList, which is what lets it keep meaning "a live threat".
 */
export function BossClearedMoment({ bossId, bossTitle, onDismiss }: BossClearedMomentProps) {
  const reduced = momentMotionReduced();
  const [phase, setPhase] = useState<Phase>(reduced ? 'title' : 'start');

  useEffect(() => {
    if (reduced) return;
    if (navigator.vibrate) navigator.vibrate([16, 60, 16, 60, 32]);
    const t1 = setTimeout(() => setPhase('rule'), 0);
    const t2 = setTimeout(() => setPhase('label'), 400);
    const t3 = setTimeout(() => setPhase('title'), 400 + 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, by design
  }, []);

  const ruleVisible = reduced || phase !== 'start';
  const labelVisible = reduced || phase === 'label' || phase === 'title';
  const titleVisible = reduced || phase === 'title';

  return (
    <Moment
      label={`Boss ${bossId} cleared. Dismiss.`}
      onDismiss={onDismiss}
      tone="boss"
      slot="boss-cleared"
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-xxs uppercase tracking-wide text-ink-700">Boss cleared</p>

        <p
          className={[
            'glow-text mt-4 font-mono text-3xl tabular-nums text-ink-100 transition-all',
            reduced ? '' : 'duration-[400ms] ease-out',
            labelVisible ? 'translate-y-0 opacity-100' : 'translate-y-[8px] opacity-0',
          ].join(' ')}
        >
          BOSS {bossId}
        </p>

        <span
          className={['mt-5 h-px transition-all', reduced ? '' : 'duration-[400ms] ease-out'].join(
            ' '
          )}
          style={{
            width: ruleVisible ? '14rem' : '0',
            background: 'var(--boss)',
            boxShadow: '0 0 20px rgba(255, 77, 109, 0.35)',
          }}
          aria-hidden
        />

        <p
          className={[
            'mt-5 font-display text-lg leading-tight text-ink-100 transition-opacity',
            reduced ? '' : 'duration-[300ms]',
            titleVisible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          {bossTitle}
        </p>
      </div>
    </Moment>
  );
}
