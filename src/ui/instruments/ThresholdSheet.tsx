import { useState } from 'react';
import { Stepper } from '../components/Stepper';
import { PrimaryButton, Sheet } from '../kit';
import { recordThreshold } from './recorders/sessionAndThreshold';
import { readingStep } from './SessionSheet';
import { humanize, type InstrumentSheetProps } from './types';

/**
 * The threshold sheet (extracted from the ATTENTION log sheet, platform/03 §27.2): one
 * number, straight from where it is measured. Never a yes/no, never an estimate -
 * whether it counts is the quest's business, not the sheet's.
 *
 * final/04 §5 - numeric entry only.
 */
export function ThresholdSheet({ instrument, today, arcId, onClose }: InstrumentSheetProps) {
  const params = instrument.params as { unit?: string; target?: number; entryLabel?: string; hint?: string; defaultValue?: number };
  const title = instrument.logVerb || `Log ${instrument.label}`;
  const [value, setValue] = useState(params.defaultValue ?? params.target ?? 0);
  const [submitting, setSubmitting] = useState(false);

  async function handleLog() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await recordThreshold(instrument, value, { today, arcId });
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

        {params.hint && <p className="text-sm text-ink-500">{params.hint}</p>}
        <Stepper label={params.entryLabel ?? humanize(params.unit ?? instrument.label)} value={value} step={readingStep(params.target ?? 0)} min={0} onChange={setValue} />
      </div>
    </Sheet>
  );
}
