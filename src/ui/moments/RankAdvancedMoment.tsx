import { useEffect, useState } from 'react';
import { Moment } from '../kit';
import { momentMotionReduced } from './motion';

interface RankAdvancedMomentProps {
  fromRank: string;
  toRank: string;
  onDismiss: () => void;
}

type Phase = 'start' | 'rule' | 'rank';

/**
 * Full screen, 1100ms — final/05 §2.1, the longest Moment in the app.
 *
 * Gold Horizon, and that is the entire reason this exists separately
 * from LEVEL UP. final/01 §4: "Level measures effort. Rank measures
 * evidence. They are not convertible." A rank letter changing means
 * externally-verifiable evidence cleared a gate, so it gets the dawn
 * palette, the `rank` plate, and nearly twice the airtime of a level.
 *
 * Phase timings, haptics and the reduced-motion path are unchanged from
 * the original — this is a re-skin onto the shared Moment frame.
 */
export function RankAdvancedMoment({ fromRank, toRank, onDismiss }: RankAdvancedMomentProps) {
  const reduced = momentMotionReduced();
  const [phase, setPhase] = useState<Phase>(reduced ? 'rank' : 'start');

  useEffect(() => {
    if (reduced) return;
    if (navigator.vibrate) navigator.vibrate([16, 60, 16, 60, 32]);
    const t1 = setTimeout(() => setPhase('rule'), 0);
    const t2 = setTimeout(() => setPhase('rank'), 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, by design
  }, []);

  const ruleVisible = reduced || phase !== 'start';
  const rankVisible = reduced || phase === 'rank';

  return (
    <Moment
      label={`Rank advanced to ${toRank}. Dismiss.`}
      onDismiss={onDismiss}
      tone="dawn"
      slot="rank"
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-xxs uppercase tracking-wide text-ink-700">Rank advanced</p>

        {/* The letters in the display serif rather than the mono the
            other Moments use. A rank is not a count — it is a grade, and
            it should not look like one more number going up. */}
        <p
          className={[
            'glow-text mt-4 font-display text-display leading-none text-dawn-core transition-all',
            reduced ? '' : 'duration-[450ms] ease-out',
            rankVisible ? 'translate-y-0 opacity-100' : 'translate-y-[8px] opacity-0',
          ].join(' ')}
        >
          {fromRank} → {toRank}
        </p>

        <span
          className={['mt-6 h-px transition-all', reduced ? '' : 'duration-[450ms] ease-out'].join(
            ' '
          )}
          style={{
            width: ruleVisible ? '14rem' : '0',
            background: 'var(--dawn)',
            boxShadow: '0 0 20px rgba(232, 161, 60, 0.35)',
          }}
          aria-hidden
        />

        <p className="mt-5 text-xs leading-[1.5] text-ink-500">
          Evidence cleared a gate. This one is not XP.
        </p>
      </div>
    </Moment>
  );
}
