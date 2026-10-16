import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAnswer, defaultFor, echoFor, livePlan, nextQuestion, optionsFor, stageStatuses, validateAnswer,
} from '../../../onboarding/engine';
import { SKIP, STAGES, type InterviewDraft, type QuestionDef, type QuestionInstance } from '../../../onboarding/types';
import { ArtLayer, PrimaryButton, SafeTop, ScreenShell, SecondaryButton } from '../../kit';
import { InitSpine } from '../InitSpine';
import { EASE, Echo } from '../shared';
import { QuestionView } from './QuestionView';
import { STAGE_COPY } from './stages';

export interface AdaptiveInterviewProps {
  questions: readonly QuestionDef[];
  initial: InterviewDraft;
  /** Today's local date: the engine has no clock. */
  today: string;
  /** Called with every new draft (loop 10.5 persists it). */
  onDraftChange?: (draft: InterviewDraft) => void;
  /** Called once, with the finished draft, when the last question is answered. */
  onComplete: (draft: InterviewDraft) => void;
  /** Disables the actions while the caller is generating or activating. */
  busy?: boolean;
  error?: string | null;
}

/**
 * The interview: one question at a time in the console the fixed flow used, driven entirely by the engine (src/onboarding).
 * It holds a draft and the value being edited; every other decision - what comes next, what is skipped, what the budget allows - is the engine's.
 */
export function AdaptiveInterview({ questions, initial, today, onDraftChange, onComplete, busy = false, error = null }: AdaptiveInterviewProps) {
  const [draft, setDraft] = useState(initial);
  const [revisit, setRevisit] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ key: string; value: unknown } | null>(null);
  const [echo, setEcho] = useState('');
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd');
  const scroller = useRef<HTMLDivElement>(null);

  const plan = useMemo(() => livePlan(draft, questions), [draft, questions]);
  const upcoming = useMemo(() => nextQuestion(draft, questions), [draft, questions]);
  const instance: QuestionInstance | null = (revisit && plan.find((candidate) => candidate.key === revisit)) || upcoming;

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [instance?.key]);

  // The interview can only be finished by answering; a draft that arrives already complete (a resumed one) is handed straight back.
  useEffect(() => {
    if (!instance && !busy) onComplete(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance === null]);

  if (!instance) return null;

  const stored = draft.answers[instance.writes];
  const value = edit?.key === instance.key ? edit.value : (stored ?? defaultFor(instance, draft.answers, { today }));
  const options = optionsFor(instance, draft.answers);
  const validation = validateAnswer(instance, draft.answers, value);
  const position = plan.findIndex((candidate) => candidate.key === instance.key);

  const statuses = stageStatuses(draft, questions);
  const nodes = STAGES.filter((stage) => statuses[stage] !== 'skipped').map((stage) => ({ stage, code: STAGE_COPY[stage].code }));
  const step = Math.max(1, nodes.findIndex((node) => node.stage === instance.def.stage) + 1);

  function submit(raw: unknown) {
    if (busy || !instance) return;
    const applied = applyAnswer(draft, instance, raw);
    if (applied.error) return;
    setDirection('fwd');
    setEdit(null);
    setRevisit(null);
    setEcho(echoFor(instance, applied.draft.answers, questions) ?? '');
    setDraft(applied.draft);
    onDraftChange?.(applied.draft);
    if (nextQuestion(applied.draft, questions) === null) onComplete(applied.draft);
  }

  function back() {
    const previous = plan[position - 1];
    if (!previous) return;
    setDirection('back');
    setEdit(null);
    setEcho('');
    setRevisit(previous.key);
  }

  const first = position <= 0;
  return (
    <ScreenShell>
      <div className="relative flex flex-1 flex-col overflow-hidden text-ink-100">
        <div aria-hidden className="init-field pointer-events-none absolute inset-0 overflow-hidden" />
        {first && <ArtLayer slot="onboarding" scrim="moment" priority />}
        <div aria-hidden className="init-lattice pointer-events-none absolute inset-0" />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <SafeTop />
          <div className="flex items-center gap-2.5 px-gutter pt-3">
            <span aria-hidden className="block h-[6px] w-[6px] shrink-0 rounded-pill" style={{ background: 'var(--accent-core)', animation: 'init-live-dot 2.2s ease-in-out infinite' }} />
            <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-accent-mid">⟨ SYSTEM INITIALISATION ⟩</span>
            <span aria-hidden className="h-px min-w-0 flex-1" style={{ background: 'linear-gradient(to right, var(--hair-strong), color-mix(in srgb, var(--accent) 10%, transparent) 60%, transparent)' }} />
          </div>

          <InitSpine step={step} nodes={nodes} />

          <div className="relative flex min-h-0 flex-1 flex-col">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6" style={{ background: 'linear-gradient(to bottom, var(--void), transparent)' }} />
            <div ref={scroller} className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-gutter pb-4 pt-5">
              <div key={instance.key} className="relative my-auto shrink-0" style={{ animation: `init-step-${direction} 260ms ${EASE} both` }}>
                <QuestionView instance={instance} options={options} answers={draft.answers} value={value} onChange={(next) => setEdit({ key: instance.key, value: next })} error={error} />
                {echo && (
                  <div className="mt-3" aria-live="polite">
                    <Echo prefix="▸" value={echo} caret={false} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative shrink-0">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 origin-bottom" style={{ background: 'radial-gradient(70% 100% at 50% 100%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 72%)', animation: 'init-horizon 11s ease-in-out infinite' }} />
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-8" style={{ background: 'linear-gradient(to top, var(--void), transparent)' }} />
            <div className="relative flex gap-3 px-gutter pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
              {!first && <SecondaryButton onClick={back} disabled={busy} className="flex-[0_0_31%]">Back</SecondaryButton>}
              {instance.def.skippable && <SecondaryButton onClick={() => submit(SKIP)} disabled={busy} className="flex-[0_0_31%]">Skip</SecondaryButton>}
              <PrimaryButton size="md" disabled={busy || !validation.ok} onClick={() => submit(value)} className="flex-1">
                {busy ? 'Working…' : first ? 'Begin' : 'Next'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
