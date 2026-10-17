import { useEffect, useState } from 'react';
import type { Checkpoint } from '../../engine/rank';
import { getCheckpoint, instrumentsComplete, saveCheckpointInstruments } from '../../store/checkpoint';
import { realDeps } from '../../store/deps';
import { InstrumentSliders } from './InstrumentSliders';
import { INSTRUMENT_SCALES } from '../../blueprint/evaluate/checkpointInstruments';
import { useSystem } from '../../store/SystemContext';
import { Panel, PrimaryButton } from '../kit';

interface CheckpointInstrumentsCardProps {
  day: Checkpoint['day'];
  label: string;
  header?: { title: string; subtitle: string };
  saveLabel?: string;
}

/**
 * docs/04 §5.2-5.3 — self-efficacy, automaticity and enjoyment,
 * administered at Day 0/30/60/90/120. Shared between Profile.tsx's
 * Day-0 catch-up row and CheckpointScreen.tsx's later-checkpoint
 * section: same three instruments, same scales, same save path
 * (store/checkpoint.ts's saveCheckpointInstruments) — only the
 * collapsed-button label and optional intro copy differ per caller.
 * Supplementary self-report, never a gate: visible independent of
 * whether the checkpoint itself is sealed.
 */
export function CheckpointInstrumentsCard({ day, label, header, saveLabel = 'Save' }: CheckpointInstrumentsCardProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  // The questions are the System's own (the owner's keep their original wording); the scales are fixed.
  const { blueprint } = useSystem();
  const questions = blueprint.checkpoints;
  const [selfEfficacy, setSelfEfficacy] = useState<number[]>(() => questions.selfEfficacy.map(() => INSTRUMENT_SCALES.selfEfficacy.start));
  const [automaticity, setAutomaticity] = useState<number[]>(() => questions.automaticity.map(() => INSTRUMENT_SCALES.automaticity.start));
  const [enjoyment, setEnjoyment] = useState<number[]>(() => questions.enjoyment.map(() => INSTRUMENT_SCALES.enjoyment.start));

  // A different System (or a new version of it) asks different questions: start the answers over rather than misalign them.
  useEffect(() => {
    setSelfEfficacy(questions.selfEfficacy.map(() => INSTRUMENT_SCALES.selfEfficacy.start));
    setAutomaticity(questions.automaticity.map(() => INSTRUMENT_SCALES.automaticity.start));
    setEnjoyment(questions.enjoyment.map(() => INSTRUMENT_SCALES.enjoyment.start));
  }, [questions]);

  useEffect(() => {
    let cancelled = false;
    getCheckpoint(day).then((checkpoint) => {
      if (!cancelled) setVisible(!instrumentsComplete(checkpoint));
    });
    return () => {
      cancelled = true;
    };
  }, [day]);

  if (!visible) return null;

  async function handleSave() {
    setSaving(true);
    await saveCheckpointInstruments(
      day,
      {
        selfEfficacy,
        automaticity,
        ...(enjoyment.length > 0 ? { enjoyment } : {}),
      },
      realDeps,
      blueprint
    );
    setSaving(false);
    setVisible(false);
  }

  return (
    <Panel cut="md" className="mt-4" bodyClassName="px-4 py-4">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-between text-left text-sm text-accent"
          style={{ minHeight: 44 }}
        >
          {label}
          <span aria-hidden className="text-ink-700">
            +
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-7">
          {header && (
            <div>
              <p className="font-display text-lg leading-tight text-ink-100">{header.title}</p>
              <p className="mt-2 text-sm leading-[1.5] text-ink-500">{header.subtitle}</p>
            </div>
          )}

          <InstrumentSliders
            title="How confident are you, right now, that you could:"
            questions={questions.selfEfficacy.map((item) => item.prompt)}
            values={selfEfficacy}
            onChange={setSelfEfficacy}
            min={INSTRUMENT_SCALES.selfEfficacy.min}
            max={INSTRUMENT_SCALES.selfEfficacy.max}
            step={INSTRUMENT_SCALES.selfEfficacy.step}
          />
          <InstrumentSliders
            title={'"I do this without having to consciously remember or decide."'}
            questions={questions.automaticity.map((item) => item.prompt)}
            values={automaticity}
            onChange={setAutomaticity}
            min={INSTRUMENT_SCALES.automaticity.min}
            max={INSTRUMENT_SCALES.automaticity.max}
            step={INSTRUMENT_SCALES.automaticity.step}
          />
          {questions.enjoyment.length > 0 && (
            <InstrumentSliders
              title="How much do you enjoy this, independent of its usefulness?"
              questions={questions.enjoyment.map((item) => item.prompt)}
              values={enjoyment}
              onChange={setEnjoyment}
              min={INSTRUMENT_SCALES.enjoyment.min}
              max={INSTRUMENT_SCALES.enjoyment.max}
              step={INSTRUMENT_SCALES.enjoyment.step}
            />
          )}

          <PrimaryButton size="md" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : saveLabel}
          </PrimaryButton>
        </div>
      )}
    </Panel>
  );
}
