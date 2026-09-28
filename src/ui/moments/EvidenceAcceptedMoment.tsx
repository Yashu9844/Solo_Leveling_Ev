import { useEffect, useState } from 'react';
import { momentMotionReduced } from './motion';
import { ToastMoment } from './ToastMoment';

interface EvidenceAcceptedMomentProps {
  kind: string;
  title: string;
  onDismiss: () => void;
}

/**
 * Card overlay, 600ms — final/05 §2.1. Fires when a public artefact
 * (repo, deploy, write-up) is logged (engine/xp.ts's ARTIFACT_SHIPPED —
 * the same event that grants the SHIP bonus). Same quiet, non-blocking
 * treatment as MasteryMoment: this happens inline with logging a BUILD
 * session, not as a standalone celebration.
 *
 * Gold, unlike MASTERY. This one is evidence — something now exists in
 * the world that did not before — and design/00 §2.2 keeps that
 * distinction in colour everywhere it appears.
 *
 * "EVIDENCE ACCEPTED" is frozen: weekly-review.spec finds and clicks
 * that exact text to dismiss this.
 */
export function EvidenceAcceptedMoment({ kind, title, onDismiss }: EvidenceAcceptedMomentProps) {
  const reduced = momentMotionReduced();
  const [visible, setVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(onDismiss, 2000);
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
      label={`Evidence accepted: ${title}. Dismiss.`}
      onDismiss={onDismiss}
      visible={visible}
      still={reduced}
      kicker="EVIDENCE ACCEPTED"
      tone="dawn"
    >
      {kind} · {title}
    </ToastMoment>
  );
}
