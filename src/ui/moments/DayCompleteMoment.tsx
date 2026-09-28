import { useEffect, useState } from 'react';
import { Moment } from '../kit';
import { momentMotionReduced } from './motion';

interface DayCompleteMomentProps {
  day: number | null;
  /** XP earned today, from the ledger — not a guess. */
  xpToday: number;
  /** Arc streak *including* today. */
  streakDays: number;
  coreTotal: number;
  onDismiss: () => void;
}

type Phase = 'start' | 'rule' | 'count' | 'streak';

/**
 * The day is done.
 *
 * This is the ceremony the app was missing entirely. Completing all six
 * core quests is the achievement a user earns more than any other — 60+
 * times across a 120-day arc — and until now the entire response was a
 * line of text changing to "Six of six. Day closed." A meter moved and
 * nothing else happened.
 *
 * It also fills a real gap in the ceremony schedule. All three
 * full-screen LEVEL UPs are spent by day 2 at a full 500 XP/day, and the
 * next full-screen Moment of any kind is the Day-14 checkpoint — an
 * eleven-day silence starting on day 3, which is exactly the window
 * where the habit either forms or dies. This lands on every complete
 * day, including day 3.
 *
 * Gold Horizon: a complete day is evidence about the world, not an XP
 * threshold (final/01 §4, design/00 §2.2).
 *
 * 900ms in three beats, and the same CSS-only, motion-setting-aware
 * treatment as every other Moment.
 */
export function DayCompleteMoment({
  day,
  xpToday,
  streakDays,
  coreTotal,
  onDismiss,
}: DayCompleteMomentProps) {
  const reduced = momentMotionReduced();
  const [phase, setPhase] = useState<Phase>(reduced ? 'streak' : 'start');

  useEffect(() => {
    if (reduced) return;
    if (navigator.vibrate) navigator.vibrate([14, 50, 28]);
    const t1 = setTimeout(() => setPhase('rule'), 0);
    const t2 = setTimeout(() => setPhase('count'), 300);
    const t3 = setTimeout(() => setPhase('streak'), 300 + 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, by design
  }, []);

  const ruleVisible = reduced || phase !== 'start';
  const countVisible = reduced || phase === 'count' || phase === 'streak';
  const streakVisible = reduced || phase === 'streak';

  return (
    <Moment
      label="Day complete. Dismiss."
      onDismiss={onDismiss}
      tone="dawn"
      slot="review-weekly"
      testId="day-complete-moment"
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-xxs uppercase tracking-wide text-ink-700">
          {day != null ? `Day ${String(day).padStart(2, '0')}` : 'Today'} · complete
        </p>

        <p
          className={[
            'glow-text mt-4 font-mono text-3xl tabular-nums text-dawn-core transition-all',
            reduced ? '' : 'duration-[300ms] ease-out',
            countVisible ? 'translate-y-0 opacity-100' : 'translate-y-[6px] opacity-0',
          ].join(' ')}
        >
          {coreTotal} / {coreTotal}
        </p>

        <span
          className={['mt-5 h-px transition-all', reduced ? '' : 'duration-[300ms] ease-out'].join(
            ' '
          )}
          style={{
            width: ruleVisible ? '12rem' : '0',
            background: 'var(--dawn)',
            boxShadow: '0 0 20px rgba(232, 161, 60, 0.35)',
          }}
          aria-hidden
        />

        <div
          className={[
            'mt-5 flex items-baseline justify-center gap-5 font-mono text-xs tabular-nums transition-opacity',
            reduced ? '' : 'duration-[300ms]',
            streakVisible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <span className="text-ink-500">
            <span className="text-dawn-bright">+{xpToday.toLocaleString()}</span> XP
          </span>
          {/* Shown only when it is a real number. The streak projection
              counts a day at rollover, so mid-day it still reads the run
              *before* today — and "streak 0" on the evening you finished
              all six is both wrong-feeling and the exact opposite of
              what this Moment is for. */}
          {streakDays > 0 && (
            <span className="text-ink-500">
              streak <span className="text-dawn-bright">{streakDays}</span>
            </span>
          )}
        </div>
      </div>
    </Moment>
  );
}
