import { useState } from 'react';
import type { AttemptOutcome } from '../../engine/srs';
import type { PracticeItemParams } from '../../instruments/types/practiceItem';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Stepper } from '../components/Stepper';
import { DeepWorkTimer } from '../components/DeepWorkTimer';
import { Field, PrimaryButton, Sheet, TextInput } from '../kit';
import { MasteryMoment } from '../moments/MasteryMoment';
import { LEGACY_PRACTICE_COPY } from './legacy/copy';
import { recordPractice, type PracticeResult } from './recorders/practiceItem';
import { humanize, type InstrumentSheetProps } from './types';

const DIFFICULTIES = ['E', 'M', 'H'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const DEFAULT_OUTCOME_LABELS: Record<string, string> = {
  first_attempt: 'First attempt', hint: 'With a hint', editorial: 'From the solution', unsolved: 'Unsolved',
};

/**
 * The practice_item sheet (extracted from the DSA log sheet, platform/03 §27.2):
 * an item, a topic, a difficulty, an outcome, the minutes it took and an optional
 * insight. Topics and outcomes come from the instrument's params; the title from
 * its log verb; the owner's System-voice labels from ui/instruments/legacy/copy.
 *
 * final/03 §2.1 - a 7-second logging budget.
 */
export function PracticeItemSheet({ instrument, today, arcId, onClose }: InstrumentSheetProps) {
  const params = instrument.params as PracticeItemParams;
  const topics = params.topics as readonly string[];
  const outcomes = params.outcomes as readonly string[];
  const copy = LEGACY_PRACTICE_COPY[instrument.id];
  const title = instrument.logVerb || `Record ${instrument.label}`;
  const outcomeLabel = (outcome: string): string => copy?.outcomeLabels[outcome] ?? DEFAULT_OUTCOME_LABELS[outcome] ?? humanize(outcome);

  const [item, setItem] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [insight, setInsight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [masteryMoment, setMasteryMoment] = useState<PracticeResult['masteryAdvance'] | null>(null);

  const canLog = item.trim().length > 0 && topic !== null && difficulty !== null && outcome !== null;

  async function handleLog() {
    if (!canLog || submitting) return;
    setSubmitting(true);
    try {
      const result = await recordPractice(
        instrument,
        { title: item, topic: topic!, difficulty: difficulty!, outcome: outcome as AttemptOutcome, minutes, insight: insight.trim() || undefined },
        { today, arcId }
      );
      if (result.masteryAdvance) {
        setMasteryMoment(result.masteryAdvance);
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={title}
        footer={
          <PrimaryButton size="md" disabled={!canLog || submitting} onClick={() => void handleLog()}>
            {submitting ? (copy?.submittingLabel ?? 'Recording…') : title}
          </PrimaryButton>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={copy?.itemLabel ?? 'Item'}>
            <TextInput type="text" value={item} onChange={(e) => setItem(e.target.value)} />
          </Field>

        <SingleChipSelect label="Topic" options={topics} labelFor={(t) => t} selected={topic} onSelect={setTopic} />
        <SingleChipSelect label="Difficulty" options={DIFFICULTIES} labelFor={(d) => d} selected={difficulty} onSelect={setDifficulty} />
        <SingleChipSelect label="Outcome" options={outcomes} labelFor={outcomeLabel} selected={outcome} onSelect={setOutcome} />

        <Stepper label="Minutes" value={minutes} step={5} min={5} onChange={setMinutes} />
        <DeepWorkTimer onStop={setMinutes} />

          <Field label="Insight (optional)">
            <TextInput type="text" value={insight} onChange={(e) => setInsight(e.target.value)} />
          </Field>
        </div>
      </Sheet>

      {/* Outside the Sheet: a Moment is a full-screen ceremony and must
          not be trapped inside the sheet it was triggered from. */}
      {masteryMoment && <MasteryMoment topic={masteryMoment.topic} state={masteryMoment.state} onDismiss={onClose} />}
    </>
  );
}
