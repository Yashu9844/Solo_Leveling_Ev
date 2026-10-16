import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SystemBlueprint } from '../../../blueprint/schema';
import { generateBlueprint } from '../../../generator/generate';
import { QUESTIONS } from '../../../onboarding/content';
import { interviewToDraft } from '../../../onboarding/mapping';
import type { InterviewDraft } from '../../../onboarding/types';
import { DEFAULT_CONFIG } from '../../../engine/config';
import { clearDraft, loadDraft, saveDraft } from '../../../onboarding/draftStorage';
import { clearAnswer, livePlan } from '../../../onboarding/engine';
import { realDeps } from '../../../store/deps';
import { activateNewSystem } from '../../../store/activation';
import { useArcStatus } from '../../../store/ArcStatusContext';
import { localDate } from '../../../engine/time';
import { PrimaryButton, SafeTop, ScreenShell, SecondaryButton } from '../../kit';
import { Instrument, Rise, StepConsole } from '../shared';
import { detectTimeZone } from '../timezone';
import { AdaptiveInterview } from './AdaptiveInterview';

type Phase = { kind: 'interview' } | { kind: 'reveal'; draft: InterviewDraft; blueprint: SystemBlueprint; name: string; baseline: Record<string, number>; errors: string[] };

/**
 * The new arc's way in (flag NEW_ONBOARDING): the Quick interview, the System it describes, and the one tap that brings it into being.
 * The Reveal here is the minimum - what was built, in the person's own terms - and 11.3 makes it a moment.
 */
export function NewOnboarding() {
  const [phase, setPhase] = useState<Phase>({ kind: 'interview' });
  const [initial, setInitial] = useState<InterviewDraft>(() => loadDraft() ?? { tier: 'quick', answers: {} });
  const [round, setRound] = useState(0);
  const today = useMemo(() => localDate(realDeps.now(), detectTimeZone(DEFAULT_CONFIG.arc.timezone), DEFAULT_CONFIG.arc.dayBoundaryHour), []);

  function generate(draft: InterviewDraft) {
    const timezone = detectTimeZone(DEFAULT_CONFIG.arc.timezone);
    const { draft: input, baseline } = interviewToDraft(draft, QUESTIONS, { lineageId: realDeps.newId(), today, timezone });
    const { blueprint, issues } = generateBlueprint(input);
    setPhase({ kind: 'reveal', draft, blueprint, name: input.identity.displayName, baseline, errors: issues.filter((issue) => issue.severity === 'error').map((issue) => issue.plain) });
  }

  // Changing the answers reopens the interview on its last question, with everything before it kept.
  function reopen(draft: InterviewDraft) {
    const last = livePlan(draft, QUESTIONS).at(-1);
    const reopened = last ? clearAnswer(draft, last.writes) : draft;
    saveDraft(reopened);
    setInitial(reopened);
    setRound((value) => value + 1);
    setPhase({ kind: 'interview' });
  }

  if (phase.kind === 'interview') return <AdaptiveInterview key={round} questions={QUESTIONS} initial={initial} today={today} onDraftChange={saveDraft} onComplete={generate} />;
  return <Reveal blueprint={phase.blueprint} name={phase.name} baseline={phase.baseline} errors={phase.errors} onRedo={() => reopen(phase.draft)} />;
}

function Reveal({ blueprint, name, baseline, errors, onRedo }: { blueprint: SystemBlueprint; name: string; baseline: Record<string, number>; errors: string[]; onRedo: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const navigate = useNavigate();
  const { markArcCreated } = useArcStatus();
  const core = blueprint.quests.filter((quest) => quest.type === 'core');
  const domainOf = (id: string) => blueprint.domains.find((domain) => domain.id === id);

  async function activate() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await activateNewSystem({ blueprint, name, baseline }, realDeps);
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
    <ScreenShell>
      <div className="relative flex flex-1 flex-col overflow-hidden text-ink-100">
        <div aria-hidden className="init-field pointer-events-none absolute inset-0 overflow-hidden" />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <SafeTop />
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-gutter pb-4 pt-6" data-testid="reveal">
            <StepConsole index={blueprint.domains.length} kicker="SYSTEM CONSTRUCTED" title={`${name.toUpperCase()}, THIS IS YOUR SYSTEM`} lead={`${blueprint.arc.lengthDays} days, from ${blueprint.arc.startDate} to ${blueprint.arc.endDate}. Every day these are the quests.`}>
              <div className="space-y-3">
                {core.map((quest, index) => {
                  const domain = domainOf(quest.domainId);
                  return (
                    <Rise key={quest.id} delay={index * 40}>
                      <div data-testid="reveal-card" data-designation={quest.designation}>
                      <Instrument label={domain?.designation ?? quest.designation} right={<span className="font-mono text-[10px] tabular-nums text-accent-mid">{quest.xp} XP</span>}>
                        <p className="text-sm leading-snug text-ink-100" data-testid="reveal-quest">{quest.objective}</p>
                      </Instrument>
                      </div>
                    </Rise>
                  );
                })}
              </div>
              {errors.length > 0 && (
                <ul className="mt-4 space-y-1" role="alert">
                  {errors.map((error) => <li key={error} className="font-mono text-[11px] uppercase tracking-[0.12em] text-state-alert">{error}</li>)}
                </ul>
              )}
            </StepConsole>
          </div>
          {failure && <p className="px-gutter pb-2 text-sm text-state-alert" role="alert">{failure}</p>}
          <div className="relative flex gap-3 px-gutter pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <SecondaryButton onClick={onRedo} disabled={busy} className="flex-[0_0_31%]">Change</SecondaryButton>
            <PrimaryButton size="md" disabled={busy || errors.length > 0} onClick={activate} className="flex-1">{busy ? 'Initialising…' : 'Initialise system'}</PrimaryButton>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
