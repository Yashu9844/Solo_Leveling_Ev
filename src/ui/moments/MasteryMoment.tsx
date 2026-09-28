import { useEffect, useState } from 'react';
import { momentMotionReduced } from './motion';
import { ToastMoment } from './ToastMoment';

interface MasteryMomentProps {
  topic: string;
  state: 'introduced' | 'applied' | 'fluent' | 'retained';
  onDismiss: () => void;
}

const STATE_LABELS: Record<MasteryMomentProps['state'], string> = {
  introduced: 'Introduced',
  applied: 'Applied',
  fluent: 'Fluent',
  retained: 'Retained',
};

/**
 * Card overlay, 600ms — final/05 §2.1. Quieter than a full-screen
 * Moment by design: a mastery transition happens mid-session, often
 * right after logging a problem or a block, and shouldn't stop what you
 * were doing the way LEVEL UP or BOSS CLEARED do. Auto-dismisses after
 * its 600ms unless tapped sooner; never blocks input underneath.
 *
 * The accessible name is frozen — learning-block.spec finds this with
 * getByRole('button', { name: /Operating Systems advanced to Introduced/ }).
 */
export function MasteryMoment({ topic, state, onDismiss }: MasteryMomentProps) {
  const reduced = momentMotionReduced();
  const [visible, setVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(onDismiss, 2000); // still self-clears; just skips the fade
      return () => clearTimeout(t);
    }
    const showTimer = setTimeout(() => setVisible(true), 0);
    const hideTimer = setTimeout(() => setVisible(false), 600);
    const dismissTimer = setTimeout(onDismiss, 900);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, by design
  }, []);

  return (
    <ToastMoment
      label={`${topic} advanced to ${STATE_LABELS[state]}. Dismiss.`}
      onDismiss={onDismiss}
      visible={visible}
      still={reduced}
      kicker="Mastery"
    >
      {topic} <span className="text-accent-mid">→</span> {STATE_LABELS[state]}
    </ToastMoment>
  );
}
