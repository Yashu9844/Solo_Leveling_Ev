import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_CONFIG } from '../../../engine/config';
import { localDate } from '../../../engine/time';
import type { DraftState } from '../../../generator/types';
import { generateBlueprint } from '../../../generator/generate';
import { QUESTIONS } from '../../../onboarding/content';
import { clearDraft, loadDraft, loadPins, savePins, saveDraft } from '../../../onboarding/draftStorage';
import { clearAnswer, livePlan } from '../../../onboarding/engine';
import { interviewToDraft, questIntentions, type Intention } from '../../../onboarding/mapping';
import { NO_PINS, adjustables, applyPins, withArcLength, withPin, type Pins } from '../../../onboarding/pins';
import { provenanceFor } from '../../../onboarding/provenance';
import type { InterviewDraft, Tier } from '../../../onboarding/types';
import { activateNewSystem } from '../../../store/activation';
import { useArcStatus } from '../../../store/ArcStatusContext';
import { realDeps } from '../../../store/deps';
import { detectTimeZone } from '../timezone';
import { AdaptiveInterview } from './AdaptiveInterview';
import { Reveal } from './Reveal';
import { TierChoice } from './TierChoice';

type Phase =
  | { kind: 'tier' }
  | { kind: 'interview' }
  | { kind: 'reveal'; interview: InterviewDraft; input: DraftState; baseline: Record<string, number>; intentions: Intention[] };

/**
 * The new arc's way in (flag NEW_ONBOARDING): how much to say, the interview, the System it describes (the Reveal, whose fields can be
 * pinned), and the one tap that brings it into being. The interview, the pins and the System are three separate things: changing an
 * answer builds the System again, and the pins are laid over whatever comes out.
 */
export function NewOnboarding() {
  // A person who left part-way is returned to their question; a person arriving fresh chooses how much to say first.
  const [initial, setInitial] = useState<InterviewDraft>(() => loadDraft() ?? { tier: 'guided', answers: {} });
  const [phase, setPhase] = useState<Phase>(() => (Object.keys(initial.answers).length > 0 ? { kind: 'interview' } : { kind: 'tier' }));
  const [pins, setPins] = useState<Pins>(() => loadPins() ?? NO_PINS);
  const [round, setRound] = useState(0);
  const today = useMemo(() => localDate(realDeps.now(), detectTimeZone(DEFAULT_CONFIG.arc.timezone), DEFAULT_CONFIG.arc.dayBoundaryHour), []);

  function generate(interview: InterviewDraft) {
    const timezone = detectTimeZone(DEFAULT_CONFIG.arc.timezone);
    const { draft: input, baseline, intentions } = interviewToDraft(interview, QUESTIONS, { lineageId: realDeps.newId(), today, timezone });
    setPhase({ kind: 'reveal', interview, input, baseline, intentions });
  }

  // Changing the answers reopens the interview on its last question, with everything before it kept - and every pin.
  function reopen(interview: InterviewDraft) {
    const last = livePlan(interview, QUESTIONS).at(-1);
    const reopened = last ? clearAnswer(interview, last.writes) : interview;
    saveDraft(reopened);
    setInitial(reopened);
    setRound((value) => value + 1);
    setPhase({ kind: 'interview' });
  }

  function choose(tier: Tier) {
    setInitial({ tier, answers: {} });
    setPins(NO_PINS);
    savePins(NO_PINS);
    setRound((value) => value + 1);
    setPhase({ kind: 'interview' });
  }

  if (phase.kind === 'tier') return <TierChoice onChoose={choose} />;
  if (phase.kind === 'interview') return <AdaptiveInterview key={round} questions={QUESTIONS} initial={initial} today={today} onDraftChange={saveDraft} onComplete={generate} />;
  return <Awakened phase={phase} pins={pins} onPins={setPins} onChange={() => reopen(phase.interview)} />;
}

function Awakened({ phase, pins, onPins, onChange }: { phase: Extract<Phase, { kind: 'reveal' }>; pins: Pins; onPins: (pins: Pins) => void; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const navigate = useNavigate();
  const { markArcCreated } = useArcStatus();

  // The System is a pure function of the answers and the pins; adjusting a card builds it again.
  const pinned = useMemo(() => applyPins(phase.input, pins), [phase.input, pins]);
  const built = useMemo(() => generateBlueprint(pinned), [pinned]);
  const provenance = useMemo(() => provenanceFor(phase.interview, QUESTIONS, pinned, pins), [phase.interview, pinned, pins]);
  const errors = useMemo(() => built.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.plain), [built]);
  useEffect(() => { savePins(pins); }, [pins]);

  async function activate() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await activateNewSystem({ blueprint: built.blueprint, name: pinned.identity.displayName, baseline: phase.baseline, intentions: questIntentions(built.blueprint, phase.intentions) }, realDeps);
      // The answers have done their work: the Blueprint is the record, and the raw answers go.
      clearDraft();
      // Resolves once the new arc's config and versions are installed, so Today never renders against the defaults.
      await markArcCreated();
      navigate('/today', { replace: true });
    } catch {
      setFailure('Could not bring the System online. Nothing was saved — try again.');
      setBusy(false);
    }
  }

  return (
    <Reveal
      blueprint={built.blueprint} name={pinned.identity.displayName} provenance={provenance} pins={pins} adjustables={adjustables(pinned)} errors={errors} busy={busy} failure={failure}
      onPinDomain={(key, values) => {
        let next = pins;
        for (const [field, value] of Object.entries(values) as ['goodDay' | 'hardDay' | 'designation', number | string][]) next = withPin(next, key, field, value);
        onPins(next);
      }}
      onPinArc={(days) => onPins(withArcLength(pins, days))}
      onUnpin={() => onPins(NO_PINS)}
      onChange={onChange}
      onActivate={() => void activate()}
    />
  );
}
