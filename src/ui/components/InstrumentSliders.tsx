import type { Automaticity, Enjoyment, SelfEfficacy } from '../../store/checkpoint';

export type SelfEfficacyItems = SelfEfficacy['items'];
export type AutomaticityItems = Automaticity['items'];
export type EnjoymentItems = Enjoyment['items'];

// docs/13-day0-baseline.md — exact item wording, shared by the Day-0
// baseline row (Profile.tsx) and every later checkpoint's instrument
// section (CheckpointScreen.tsx), since both administer the same three
// instruments (docs/04 §5.2-5.3: "administered at Day 0/30/60/90/120").
export const SELF_EFFICACY_QUESTIONS = [
  'Solve an unseen medium DSA problem in 25 minutes, in front of an interviewer?',
  "Explain your last project's architecture to a senior engineer for 10 minutes?",
  'Design an evaluation suite for an agent from a blank file?',
  "Complete your planned training session on a day you don't feel like it?",
  'Hold your wake time within 30 minutes for the next 14 days?',
  'Apply to 5 roles above your current level this week?',
] as const;

export const AUTOMATICITY_QUESTIONS = ['Waking at my target time', 'Training', 'Daily study', 'Sleeping at my target time'] as const;

export const ENJOYMENT_QUESTIONS = ['DSA', 'Building/AI', 'Training'] as const;

interface InstrumentSlidersProps {
  title: string;
  questions: readonly string[];
  values: number[];
  onChange: (values: number[]) => void;
  min: number;
  max: number;
  step: number;
}

/** A titled group of slider questions, all sharing one scale — the
 * shared rendering for all three instruments (self-efficacy 0-100,
 * automaticity 1-7, enjoyment 0-10), which differ only in scale and
 * question text. */
export function InstrumentSliders({ title, questions, values, onChange, min, max, step }: InstrumentSlidersProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Not a SectionLabel: these titles are whole sentences, and
          SectionLabel sizes its text shrink-0 next to a flexible rule,
          so a long one ran straight off the right edge. An instruction
          also should not be set in tracked uppercase — it is a question
          being asked, not a heading. */}
      <div>
        <p className="text-xs leading-[1.5] text-ink-500">{title}</p>
        <div className="hairline mt-3" aria-hidden />
      </div>
      {questions.map((question, idx) => (
        <label key={question} className="block">
          <span className="flex gap-2 text-sm leading-[1.45] text-ink-300">
            {/* The number is in its own column so a two-line question
                stays hanging-indented under itself rather than wrapping
                back under its own index. */}
            <span className="w-4 shrink-0 font-mono tabular-nums text-ink-700">{idx + 1}</span>
            {question}
          </span>
          <div className="mt-3 flex items-center gap-4">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[idx]}
              onChange={(e) => onChange(values.map((v, i) => (i === idx ? Number(e.target.value) : v)))}
              className="min-w-0 flex-1"
            />
            <span className="w-9 shrink-0 text-right font-mono text-sm tabular-nums text-accent-mid">
              {values[idx]}
            </span>
          </div>
        </label>
      ))}
    </div>
  );
}
