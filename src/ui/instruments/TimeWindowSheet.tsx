import { useState } from 'react';
import { Field, PrimaryButton, Sheet, TextInput } from '../kit';
import { recordTimeWindow } from './recorders/lifestyle';
import type { InstrumentSheetProps } from './types';

/**
 * The time-window sheet (extracted from the SLEEP log sheet, platform/03 §27.2): the time
 * something happened, and optionally a second time beside it. The window and its
 * tolerance are the quest's business; the sheet only records the reading.
 *
 * final/04 §4 - the time is the whole criterion; no duration scoring, no
 * "did you sleep enough" judgment anywhere in this sheet.
 */
export function TimeWindowSheet({ instrument, today, arcId, onClose }: InstrumentSheetProps) {
  const params = instrument.params as { targetTime: string; secondaryLabel?: string };
  const title = instrument.logVerb || `Log ${instrument.label}`;
  const [time, setTime] = useState(params.targetTime);
  const [secondary, setSecondary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLog() {
    if (submitting || !time) return;
    setSubmitting(true);
    try {
      await recordTimeWindow(instrument, { time, secondary: secondary || undefined }, { today, arcId });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <PrimaryButton size="md" disabled={submitting} onClick={() => void handleLog()}>
          {submitting ? 'Logging…' : title}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">

        <Field label={instrument.label}>
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>

        {params.secondaryLabel && (
          <Field label={`${params.secondaryLabel} (optional)`}>
            <TextInput type="time" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
          </Field>
        )}
      </div>
    </Sheet>
  );
}
