import { useEffect, useState } from 'react';
import { Moment } from '../kit';
import { momentMotionReduced } from './motion';

interface LevelUpMomentProps {
  fromLevel: number;
  toLevel: number;
  unlockText?: string;
  onDismiss: () => void;
}

type Phase = 'start' | 'rule' | 'number' | 'unlock';

/**
 * Full screen, 700ms total: the rule sweeps L→R (260ms), the number
 * cross-fades with a 6px rise (240ms), the unlock line fades in (200ms).
 * final/05 §2.2, §2.3. Dismissible on any tap, never blocks input, no
 * sound. Reduced motion drops the phases and the haptic and shows the
 * content immediately at its final state.
 *
 * Blue Arc, deliberately. A level is effort — XP crossing a threshold —
 * and final/01 §4 keeps effort and evidence in different colours the
 * whole way down. The Gold treatment belongs to RankAdvancedMoment.
 *
 * The phase timings, the haptic pattern and the reduced-motion path are
 * unchanged from the original: this is a re-skin onto the shared Moment
 * frame, not a re-tune. Only the surface it draws on is new.
 */
export function LevelUpMoment({ fromLevel, toLevel, unlockText, onDismiss }: LevelUpMomentProps) {
  const reduced = momentMotionReduced();
  const [phase, setPhase] = useState<Phase>(reduced ? 'unlock' : 'start');

  useEffect(() => {
    if (reduced) {
      return;
    }
    if (navigator.vibrate) {
      navigator.vibrate([12, 40, 24]);
    }
    const t1 = setTimeout(() => setPhase('rule'), 0);
    const t2 = setTimeout(() => setPhase('number'), 260);
    const t3 = setTimeout(() => setPhase('unlock'), 260 + 240);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, by design
  }, []);

  const ruleVisible = reduced || phase === 'rule' || phase === 'number' || phase === 'unlock';
  const numberVisible = reduced || phase === 'number' || phase === 'unlock';
  const unlockVisible = reduced || phase === 'unlock';

  return (
    // "Level up. Dismiss." is frozen: xp.spec selects this Moment with
    // getByRole('button', { name: /Level up/ }).
    <Moment label="Level up. Dismiss." onDismiss={onDismiss} tone="accent" slot="level-up">
      <div className="flex flex-col items-center text-center">
        <p className="text-xxs uppercase tracking-wide text-ink-700">Level</p>

        <p
          className={[
            'glow-text mt-4 font-mono text-3xl tabular-nums text-ink-100 transition-all',
            reduced ? '' : 'duration-[240ms] ease-out',
            numberVisible ? 'translate-y-0 opacity-100' : 'translate-y-[6px] opacity-0',
          ].join(' ')}
        >
          {String(fromLevel).padStart(2, '0')} → {String(toLevel).padStart(2, '0')}
        </p>

        <span
          className={['mt-5 h-px transition-all', reduced ? '' : 'duration-[260ms] ease-out'].join(
            ' '
          )}
          style={{
            width: ruleVisible ? '11rem' : '0',
            background: 'var(--accent)',
            boxShadow: 'var(--glow-sm)',
          }}
          aria-hidden
        />

        {unlockText && (
          <p
            className={[
              'mt-5 text-xs text-ink-500 transition-opacity',
              reduced ? '' : 'duration-[200ms]',
              unlockVisible ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            <span className="text-accent-mid">UNLOCKED</span> · {unlockText}
          </p>
        )}
      </div>
    </Moment>
  );
}
