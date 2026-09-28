import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { logTrainingSession, logSteps } from '../../store/training';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Stepper } from '../components/Stepper';
import { ArtLayer, PrimaryButton, Sheet } from '../kit';

const MODES = ['Session', 'Steps'] as const;
const TYPES = ['Push', 'Pull', 'Legs', 'Full', 'Conditioning'] as const;

interface LogTrainingSheetProps {
  today: string;
  arcId: string;
  onClose: () => void;
}

/** final/04 §1-3 — TRAINING completes on either a logged session or
 * >= 8,000 steps; this sheet is one entry point for both, picked via the
 * Session/Steps toggle (same "mode toggle" shape as BUILD's LEARN/SHIP). */
export function LogTrainingSheet({ today, arcId, onClose }: LogTrainingSheetProps) {
  const [mode, setMode] = useState<(typeof MODES)[number]>('Session');
  const [type, setType] = useState<(typeof TYPES)[number] | null>(null);
  const [minutes, setMinutes] = useState(45);
  const [rpe, setRpe] = useState(6);
  const [steps, setSteps] = useState(8000);
  const [submitting, setSubmitting] = useState(false);

  const canLog = mode === 'Steps' ? steps > 0 : type !== null;

  async function handleLog() {
    if (!canLog || submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'Session') {
        await logTrainingSession(today, arcId, { type: type!, minutes, rpe }, DEFAULT_CONFIG, realDeps);
      } else {
        await logSteps(today, arcId, steps, DEFAULT_CONFIG, realDeps);
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
      title="Record Vitality Trial"
      footer={
        <PrimaryButton size="md" disabled={!canLog || submitting} onClick={() => void handleLog()}>
          {submitting ? 'Logging…' : mode === 'Session' ? 'Record Vitality Trial' : 'Log steps'}
        </PrimaryButton>
      }
    >
      {/* The one log sheet with a plate. TRAINING is the only domain
          whose evidence is physical, and the physique plate carries the
          body-part-to-attribute mapping the app already models. Kept as
          a short band at low opacity — this is a form, not a stage. */}
      <div className="relative -mx-gutter mb-4 h-[110px] overflow-hidden">
        <ArtLayer slot="training" scrim="band" focal="50% 32%" />
      </div>

      <div className="flex flex-col gap-4">

        <SingleChipSelect label="Mode" options={MODES} labelFor={(m) => m} selected={mode} onSelect={setMode} />

        {mode === 'Session' ? (
          <>
            <SingleChipSelect label="Type" options={TYPES} labelFor={(t) => t} selected={type} onSelect={setType} />
            <Stepper label="Minutes" value={minutes} step={5} min={5} onChange={setMinutes} />
            <Stepper label="RPE" value={rpe} step={1} min={1} onChange={(v) => setRpe(Math.min(10, v))} />
          </>
        ) : (
          <Stepper label="Steps" value={steps} step={500} min={0} onChange={setSteps} />
        )}

      </div>
    </Sheet>
  );
}
