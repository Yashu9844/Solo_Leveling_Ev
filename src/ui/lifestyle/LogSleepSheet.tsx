import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { logSleep } from '../../store/lifestyle';
import { Field, PrimaryButton, Sheet, TextInput } from '../kit';

interface LogSleepSheetProps {
  today: string;
  arcId: string;
  onClose: () => void;
}

/** final/04 §4 — wake time is the whole criterion; no sleep-duration
 * scoring, no "did you sleep enough" judgment anywhere in this sheet. */
export function LogSleepSheet({ today, arcId, onClose }: LogSleepSheetProps) {
  const [wakeTime, setWakeTime] = useState(DEFAULT_CONFIG.wakeTargetTime);
  const [sleepTime, setSleepTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLog() {
    if (submitting || !wakeTime) return;
    setSubmitting(true);
    try {
      await logSleep(today, arcId, wakeTime, DEFAULT_CONFIG, realDeps, sleepTime || undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Log Synchronization"
      footer={
        <PrimaryButton size="md" disabled={submitting} onClick={() => void handleLog()}>
          {submitting ? 'Logging…' : 'Log Synchronization'}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">

        <Field label="Wake time">
          <TextInput type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
        </Field>

        <Field label="Sleep time (optional)">
          <TextInput type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
