import { useEffect, useState } from 'react';
import type { Checkpoint } from '../../engine/rank';
import { getCheckpoint, instrumentsComplete, saveCheckpointInstruments } from '../../store/checkpoint';
import { realDeps } from '../../store/deps';
import {
  InstrumentSliders,
  SELF_EFFICACY_QUESTIONS,
  AUTOMATICITY_QUESTIONS,
  ENJOYMENT_QUESTIONS,
  type SelfEfficacyItems,
  type AutomaticityItems,
  type EnjoymentItems,
} from './InstrumentSliders';
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
  const [selfEfficacy, setSelfEfficacy] = useState<number[]>([50, 50, 50, 50, 50, 50]);
  const [automaticity, setAutomaticity] = useState<number[]>([4, 4, 4, 4]);
  const [enjoyment, setEnjoyment] = useState<number[]>([5, 5, 5]);

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
        selfEfficacy: selfEfficacy as SelfEfficacyItems,
        automaticity: automaticity as AutomaticityItems,
        enjoyment: enjoyment as EnjoymentItems,
      },
      realDeps
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
            questions={SELF_EFFICACY_QUESTIONS}
            values={selfEfficacy}
            onChange={setSelfEfficacy}
            min={0}
            max={100}
            step={10}
          />
          <InstrumentSliders
            title={'"I do this without having to consciously remember or decide."'}
            questions={AUTOMATICITY_QUESTIONS}
            values={automaticity}
            onChange={setAutomaticity}
            min={1}
            max={7}
            step={1}
          />
          <InstrumentSliders
            title="How much do you enjoy this, independent of its usefulness?"
            questions={ENJOYMENT_QUESTIONS}
            values={enjoyment}
            onChange={setEnjoyment}
            min={0}
            max={10}
            step={1}
          />

          <PrimaryButton size="md" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : saveLabel}
          </PrimaryButton>
        </div>
      )}
    </Panel>
  );
}
