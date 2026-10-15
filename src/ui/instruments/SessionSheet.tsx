import { useState } from 'react';
import type { ArtSlot } from '../../assets/art';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Stepper } from '../components/Stepper';
import { ArtLayer, PrimaryButton, Sheet } from '../kit';
import { LEGACY_SESSION_COPY } from './legacy/copy';
import { recordSession, recordThreshold } from './recorders/sessionAndThreshold';
import { humanize, type InstrumentSheetProps } from './types';

/** A reading's step: coarse for big targets (8,000 steps), fine for small ones. */
export function readingStep(target: number): number {
  return target >= 1000 ? 500 : target >= 100 ? 50 : target >= 20 ? 5 : 1;
}

/**
 * The session sheet (extracted from the TRAINING log sheet, platform/03 §27.2):
 * the kind of session, how long, how hard - and, when the domain keeps a
 * threshold beside it (steps), a toggle to log that reading from the same place.
 *
 * final/04 §1-3 - the quest completes on either; one entry point for both.
 */
export function SessionSheet({ instrument, domain, siblings, today, arcId, onClose }: InstrumentSheetProps) {
  const sessionTypes = instrument.params.sessionTypes as string[];
  const askRpe = typeof instrument.params.defaultRpe === 'number';
  const reading = siblings.find((sibling) => sibling.type === 'threshold');
  const copy = LEGACY_SESSION_COPY[instrument.id];
  const title = instrument.logVerb || `Log ${instrument.label}`;
  const sessionLabel = copy?.sessionLabel ?? instrument.label;
  const readingLabel = reading?.label ?? '';
  const readingTarget = (reading?.params.target as number | undefined) ?? 0;
  const artSlot = domain.presentation.artSlot as ArtSlot | undefined;

  const [mode, setMode] = useState<string>(sessionLabel);
  const [type, setType] = useState<string | null>(null);
  const [minutes, setMinutes] = useState((instrument.params.defaultMinutes as number | undefined) ?? 30);
  const [rpe, setRpe] = useState((instrument.params.defaultRpe as number | undefined) ?? 6);
  const [value, setValue] = useState(readingTarget);
  const [submitting, setSubmitting] = useState(false);

  const logsReading = reading !== undefined && mode === readingLabel;
  const canLog = logsReading ? value > 0 : type !== null;

  async function handleLog() {
    if (!canLog || submitting) return;
    setSubmitting(true);
    try {
      if (logsReading) {
        await recordThreshold(reading!, value, { today, arcId });
      } else {
        await recordSession(instrument, { sessionType: type!, minutes, rpe: askRpe ? rpe : undefined }, { today, arcId });
      }
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
        <PrimaryButton size="md" disabled={!canLog || submitting} onClick={() => void handleLog()}>
          {submitting ? 'Logging…' : logsReading ? `Log ${readingLabel.toLowerCase()}` : title}
        </PrimaryButton>
      }
    >
      {/* The one log sheet with a plate. TRAINING is the only domain
          whose evidence is physical, and the physique plate carries the
          body-part-to-attribute mapping the app already models. Kept as
          a short band at low opacity - this is a form, not a stage. */}
      {artSlot && (
        <div className="relative -mx-gutter mb-4 h-[110px] overflow-hidden">
          <ArtLayer slot={artSlot} scrim="band" focal="50% 32%" />
        </div>
      )}

      <div className="flex flex-col gap-4">

        {reading && <SingleChipSelect label="Mode" options={[sessionLabel, readingLabel]} labelFor={(m) => m} selected={mode} onSelect={setMode} />}

        {logsReading ? (
          <Stepper label={readingLabel} value={value} step={readingStep(readingTarget)} min={0} onChange={setValue} />
        ) : (
          <>
            <SingleChipSelect label="Type" options={sessionTypes} labelFor={humanize} selected={type} onSelect={setType} />
            <Stepper label="Minutes" value={minutes} step={5} min={5} onChange={setMinutes} />
            {askRpe && <Stepper label="RPE" value={rpe} step={1} min={1} onChange={(v) => setRpe(Math.min(10, v))} />}
          </>
        )}

      </div>
    </Sheet>
  );
}
