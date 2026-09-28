import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { logProblem } from '../../store/dsa';
import { getDsaTopicMastery } from '../../store/mastery';
import { DSA_TOPICS } from '../../engine/dsa';
import type { AttemptOutcome } from '../../engine/srs';
import type { MasteryState } from '../../engine/types';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Stepper } from '../components/Stepper';
import { Field, PrimaryButton, Sheet, TextInput } from '../kit';
import { MasteryMoment } from '../moments/MasteryMoment';
import { DeepWorkTimer } from '../components/DeepWorkTimer';

const TOPICS = DSA_TOPICS;
const DIFFICULTIES = ['E', 'M', 'H'] as const;
const OUTCOMES: AttemptOutcome[] = ['first_attempt', 'hint', 'editorial', 'unsolved'];
const OUTCOME_LABELS: Record<AttemptOutcome, string> = {
  first_attempt: 'First impact',
  hint: 'Clue',
  editorial: 'Decree',
  unsolved: 'Unresolved',
};

interface LogProblemSheetProps {
  today: string;
  arcId: string;
  onClose: () => void;
}

/** final/03 §2.1 — a 7-second logging budget. */
export function LogProblemSheet({ today, arcId, onClose }: LogProblemSheetProps) {
  const [problem, setProblem] = useState('');
  const [topic, setTopic] = useState<(typeof TOPICS)[number] | null>(null);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number] | null>(null);
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [insight, setInsight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [masteryMoment, setMasteryMoment] = useState<{ topic: string; state: 'introduced' | 'applied' | 'fluent' | 'retained' } | null>(
    null
  );

  const canLog = problem.trim().length > 0 && topic !== null && difficulty !== null && outcome !== null;

  const MASTERY_ORDER: MasteryState[] = ['unseen', 'introduced', 'applied', 'fluent', 'retained'];

  async function handleLog() {
    if (!canLog || submitting) return;
    setSubmitting(true);
    try {
      const before = await getDsaTopicMastery(topic!);
      await logProblem(
        today,
        arcId,
        {
          slug: problem.trim().toLowerCase().replace(/\s+/g, '-'),
          title: problem.trim(),
          topic: topic!,
          difficulty: difficulty!,
          outcome: outcome!,
          minutes,
          insight: insight.trim() || undefined,
        },
        DEFAULT_CONFIG,
        realDeps
      );
      const after = await getDsaTopicMastery(topic!);
      // final/05 §2.1's MASTERY Moment — fires only on a genuine
      // state advance, not on every log (a log can also hold steady
      // or, for fluent→retained, depend on a lapse-free window).
      if (MASTERY_ORDER.indexOf(after) > MASTERY_ORDER.indexOf(before) && after !== 'unseen') {
        setMasteryMoment({ topic: topic!, state: after });
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
        title="Record Logic Trial"
        footer={
          <PrimaryButton
            size="md"
            disabled={!canLog || submitting}
            onClick={() => void handleLog()}
          >
            {submitting ? 'Recording…' : 'Record Logic Trial'}
          </PrimaryButton>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Problem">
            <TextInput type="text" value={problem} onChange={(e) => setProblem(e.target.value)} />
          </Field>

        <SingleChipSelect label="Topic" options={TOPICS} labelFor={(t) => t} selected={topic} onSelect={setTopic} />
        <SingleChipSelect
          label="Difficulty"
          options={DIFFICULTIES}
          labelFor={(d) => d}
          selected={difficulty}
          onSelect={setDifficulty}
        />
        <SingleChipSelect
          label="Outcome"
          options={OUTCOMES}
          labelFor={(o) => OUTCOME_LABELS[o]}
          selected={outcome}
          onSelect={setOutcome}
        />

        <Stepper label="Minutes" value={minutes} step={5} min={5} onChange={setMinutes} />
        <DeepWorkTimer onStop={setMinutes} />

          <Field label="Insight (optional)">
            <TextInput type="text" value={insight} onChange={(e) => setInsight(e.target.value)} />
          </Field>
        </div>
      </Sheet>

      {/* Outside the Sheet: a Moment is a full-screen ceremony and must
          not be trapped inside the sheet it was triggered from. */}
      {masteryMoment && (
        <MasteryMoment topic={masteryMoment.topic} state={masteryMoment.state} onDismiss={onClose} />
      )}
    </>
  );
}
