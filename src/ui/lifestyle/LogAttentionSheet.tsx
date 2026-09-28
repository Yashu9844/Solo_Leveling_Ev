import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { logScreentime } from '../../store/lifestyle';
import { Stepper } from '../components/Stepper';
import { PrimaryButton, Sheet } from '../kit';

interface LogAttentionSheetProps {
  today: string;
  arcId: string;
  onClose: () => void;
}

/** final/04 §5 — numeric entry only, straight from Digital Wellbeing.
 * Never a yes/no, never an estimate. */
export function LogAttentionSheet({ today, arcId, onClose }: LogAttentionSheetProps) {
  const [minutes, setMinutes] = useState(45);
  const [submitting, setSubmitting] = useState(false);

  async function handleLog() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await logScreentime(today, arcId, minutes, DEFAULT_CONFIG, realDeps);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Log Friction Control"
      footer={
        <PrimaryButton size="md" disabled={submitting} onClick={() => void handleLog()}>
          {submitting ? 'Logging…' : 'Log Friction Control'}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">

        <p className="text-sm text-ink-500">Minutes from Digital Wellbeing, named apps.</p>
        <Stepper label="Minutes" value={minutes} step={5} min={0} onChange={setMinutes} />
      </div>
    </Sheet>
  );
}
