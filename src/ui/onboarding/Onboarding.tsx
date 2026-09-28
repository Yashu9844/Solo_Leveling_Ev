import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_CONFIG } from '../../engine/config';
import type { ImplementationIntention } from '../../engine/types';
import { initialiseArc, type OnboardingInput } from '../../store/onboarding';
import { realDeps } from '../../store/deps';
import { useArcStatus } from '../../store/ArcStatusContext';
import { ArtLayer, PrimaryButton, SafeTop, ScreenShell, SecondaryButton } from '../kit';
import { InitSpine } from './InitSpine';
import { Step1Identity } from './Step1Identity';
import { Step2Arc } from './Step2Arc';
import { Step3Rhythm } from './Step3Rhythm';
import { Step4Directive } from './Step4Directive';
import { Step5Triggers } from './Step5Triggers';
import { Step6Baseline, alarmLabel } from './Step6Baseline';
import { EASE, TOTAL_STEPS, dayCount, type IntentionDraft } from './shared';

interface FormState {
  name: string;
  startDate: string;
  endDate: string;
  wakeTime: string;
  sleepTime: string;
  trainingDays: string[];
  stepsTarget: number;
  screenCapMinutes: number;
  attentionApps: string[];
  mainQuestText: string;
  career: IntentionDraft;
  dsa: IntentionDraft;
  training: IntentionDraft;
  heightCm: string;
  weightKg: string;
  problemsSolvedSoFar: string;
}

function initialForm(): FormState {
  return {
    name: '',
    startDate: DEFAULT_CONFIG.arc.startDate,
    endDate: DEFAULT_CONFIG.arc.endDate,
    wakeTime: '08:30',
    sleepTime: '02:00',
    trainingDays: [],
    stepsTarget: 8000,
    screenCapMinutes: 60,
    attentionApps: [],
    mainQuestText: '',
    career: { time: '08:35', place: '', first_action: '' },
    dsa: { time: '22:00', place: '', first_action: '' },
    training: { time: '20:15', place: '', first_action: '' },
    heightCm: '178',
    weightKg: '72',
    problemsSolvedSoFar: '',
  };
}

interface OnboardingProps {
  onComplete: () => void;
}

/**
 * The awakening sequence.
 *
 * Six steps, and the design problem is that the *middle* four are
 * unavoidably forms. The first version solved that by making all six
 * identical — one framed box, one noun, six flat progress bars — which
 * is why the first surface anyone ever saw read as a settings page in
 * the app's colours rather than as the System coming online.
 *
 * What carries it now:
 *
 * - **A spine, not a bar** (`InitSpine`). Named nodes, one lit. The
 *   flow reads as a sequence of locks being opened.
 * - **Each step is a console** (`StepConsole`). It owns its own frame,
 *   rail, ghosted index and a sweep that never stops, so a step that
 *   has finished arriving is still a live instrument rather than a
 *   printed card.
 * - **Each step has one hero.** A calibrated span on ARC, a 24-hour
 *   dial on RHYTHM, a struck seal on DIRECTIVE, three armed devices on
 *   TRIGGERS, a manifest on BASELINE. Peripheral vision registers
 *   "different screen" before a word is read.
 * - **The ground is alive.** Two counter-drifting washes and a rising
 *   horizon under the action bar, both far below conscious notice. The
 *   screen was previously inert the moment a step landed.
 * - **Nothing here is animated in JavaScript.** design/00 §5.1: every
 *   field on these screens has a final state that matters, and a
 *   starved rAF would leave one stranded at `opacity: 0` — visible to a
 *   test, invisible to a person. All of it is CSS with `both`, which
 *   the reduced-motion rules collapse to nothing.
 */
export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd');
  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { markArcCreated } = useArcStatus();
  const scrollRef = useRef<HTMLDivElement>(null);

  // A step is a new screen, so it starts at its top. Without this,
  // leaving RHYTHM scrolled to its last control drops the user into the
  // middle of DIRECTIVE, whose heading they never see.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateIntention(key: 'career' | 'dsa' | 'training', patch: Partial<IntentionDraft>) {
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  }

  function go(next: number) {
    setDirection(next > step ? 'fwd' : 'back');
    setStep(next);
  }

  const canProceed =
    step === 1
      ? form.name.trim().length > 0
      : step === 4
        ? form.mainQuestText.trim().length > 0
        : step === 5
          ? [form.career, form.dsa, form.training].every(
              (i) => i.place.trim().length > 0 && i.first_action.trim().length > 0,
            )
          : true;

  async function handleInitialise() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const toIntention = (i: IntentionDraft): ImplementationIntention => ({
      time: i.time,
      place: i.place.trim(),
      first_action: i.first_action.trim(),
    });

    const input: OnboardingInput = {
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      timezone: DEFAULT_CONFIG.arc.timezone,
      dayBoundaryHour: DEFAULT_CONFIG.arc.dayBoundaryHour,
      dayCloseHour: DEFAULT_CONFIG.arc.dayCloseHour,
      wakeTime: form.wakeTime,
      sleepTime: form.sleepTime,
      trainingDays: form.trainingDays,
      stepsTarget: form.stepsTarget,
      screenCapMinutes: form.screenCapMinutes,
      attentionApps: form.attentionApps,
      mainQuestText: form.mainQuestText.trim(),
      intentions: {
        career: toIntention(form.career),
        dsa: toIntention(form.dsa),
        training: toIntention(form.training),
      },
      baseline: {
        heightCm: form.heightCm.trim() ? Number(form.heightCm) : undefined,
        weightKg: form.weightKg.trim() ? Number(form.weightKg) : undefined,
        // bodyFatPct intentionally omitted — never collected, never estimated.
        problemsSolvedSoFar: form.problemsSolvedSoFar.trim()
          ? Number(form.problemsSolvedSoFar)
          : undefined,
      },
    };

    try {
      await initialiseArc(input, DEFAULT_CONFIG, realDeps);
      markArcCreated();
      onComplete();
      navigate('/today', { replace: true });
    } catch {
      setError('Could not save — try again.');
      setIsSubmitting(false);
    }
  }

  async function handleCopyTimes() {
    const text = [
      alarmLabel(form.career, 'CAREER'),
      alarmLabel(form.dsa, 'DSA'),
      '23:30 — Evening review. 25 seconds.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied — the times are on screen either way.
    }
  }

  // Art bookends the flow: step 1, where the user is deciding whether to
  // start, and step 6, where they are about to commit. The four steps
  // between are forms, and a form does not want a full backdrop.
  const showArt = step === 1 || step === TOTAL_STEPS;
  const isLast = step === TOTAL_STEPS;

  return (
    <ScreenShell>
      <div className="relative flex flex-1 flex-col overflow-hidden text-ink-100">
        {/* The mana field. Two counter-drifting washes, well under the
            threshold of notice, so the ground behind every step is a
            space with something moving in it rather than a flat colour.
            This is the layer that stopped the middle steps reading as a
            form on a black page. */}
        <div aria-hidden className="init-field pointer-events-none absolute inset-0 overflow-hidden" />

        {showArt && <ArtLayer slot="onboarding" scrim="moment" priority={step === 1} />}

        {/* Steps 2-5 get a masked bleed across the upper third instead.
            Bare was the other extreme, and it is why onboarding used to
            read as a different application. It stops short of the
            console so nothing sits behind a field. */}
        {!showArt && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[44%] overflow-hidden"
            style={{
              mixBlendMode: 'lighten',
              opacity: 0.34,
              maskImage: 'radial-gradient(130% 100% at 78% 0%, #000 8%, transparent 74%)',
              WebkitMaskImage: 'radial-gradient(130% 100% at 78% 0%, #000 8%, transparent 74%)',
            }}
          >
            <ArtLayer slot="onboarding" scrim="none" focal="62% 25%" />
          </div>
        )}

        {/* The lattice. It drifts upward at a speed nobody consciously
            notices, which is the point: the screen is alive before the
            user has done anything, so the System reads as running
            rather than waiting. */}
        <div aria-hidden className="init-lattice pointer-events-none absolute inset-0" />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <SafeTop />

          {/* The System naming what it is doing, with a pulse that says
              it is listening. */}
          <div className="flex items-center gap-2.5 px-gutter pt-3">
            <span
              aria-hidden
              className="block h-[6px] w-[6px] shrink-0 rounded-pill"
              style={{
                background: 'var(--accent-core)',
                animation: 'init-live-dot 2.2s ease-in-out infinite',
              }}
            />
            <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-accent-mid">
              ⟨ SYSTEM INITIALISATION ⟩
            </span>
            <span
              aria-hidden
              className="h-px min-w-0 flex-1"
              style={{
                background:
                  'linear-gradient(to right, var(--hair-strong), color-mix(in srgb, var(--accent) 10%, transparent) 60%, transparent)',
              }}
            />
          </div>

          <InitSpine step={step} />

          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* The column slides under the spine, so it has to dissolve
                into it rather than be sliced by it. Mirrors the fade
                above the action bar. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6"
              style={{ background: 'linear-gradient(to bottom, var(--void), transparent)' }}
            />

            <div
              ref={scrollRef}
              className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-gutter pb-4 pt-5"
            >
              {/* `my-auto`, not `mt-auto`. Auto margins on both sides
                  centre a short step in the free space and collapse to
                  nothing when it overflows, so tall steps still scroll
                  from their top. `mt-auto` alone pinned every step to
                  the bottom of the column, which left ARC and DIRECTIVE
                  sitting under ~400px of empty ground — the single
                  loudest way this flow read as unfinished.
                  `justify-center` on the scroller is not the same fix:
                  it clips an overflowing step's heading off the top. */}
              <div
                key={step}
                className="relative my-auto shrink-0"
                style={{
                  animation: `init-step-${direction === 'fwd' ? 'fwd' : 'back'} 260ms ${EASE} both`,
                }}
              >
                {step === 1 && (
                  <Step1Identity name={form.name} onChangeName={(v) => update('name', v)} />
                )}
                {step === 2 && (
                  <Step2Arc
                    startDate={form.startDate}
                    endDate={form.endDate}
                    onChangeStart={(v) => update('startDate', v)}
                    onChangeEnd={(v) => update('endDate', v)}
                  />
                )}
                {step === 3 && (
                  <Step3Rhythm
                    wakeTime={form.wakeTime}
                    sleepTime={form.sleepTime}
                    trainingDays={form.trainingDays}
                    stepsTarget={form.stepsTarget}
                    screenCapMinutes={form.screenCapMinutes}
                    attentionApps={form.attentionApps}
                    onChangeWake={(v) => update('wakeTime', v)}
                    onChangeSleep={(v) => update('sleepTime', v)}
                    onChangeTrainingDays={(v) => update('trainingDays', v)}
                    onChangeStepsTarget={(v) => update('stepsTarget', v)}
                    onChangeScreenCap={(v) => update('screenCapMinutes', v)}
                    onChangeAttentionApps={(v) => update('attentionApps', v)}
                  />
                )}
                {step === 4 && (
                  <Step4Directive
                    value={form.mainQuestText}
                    onChange={(v) => update('mainQuestText', v)}
                    endDate={DEFAULT_CONFIG.arc.endDate}
                  />
                )}
                {step === 5 && (
                  <Step5Triggers
                    career={form.career}
                    dsa={form.dsa}
                    training={form.training}
                    onChangeCareer={(patch) => updateIntention('career', patch)}
                    onChangeDsa={(patch) => updateIntention('dsa', patch)}
                    onChangeTraining={(patch) => updateIntention('training', patch)}
                  />
                )}
                {step === 6 && (
                  <Step6Baseline
                    name={form.name}
                    days={dayCount(form.startDate, form.endDate)}
                    mainQuestText={form.mainQuestText}
                    heightCm={form.heightCm}
                    weightKg={form.weightKg}
                    problemsSolvedSoFar={form.problemsSolvedSoFar}
                    onChangeHeight={(v) => update('heightCm', v)}
                    onChangeWeight={(v) => update('weightKg', v)}
                    onChangeProblems={(v) => update('problemsSolvedSoFar', v)}
                    career={form.career}
                    dsa={form.dsa}
                    onCopyTimes={handleCopyTimes}
                    copied={copied}
                  />
                )}
              </div>
            </div>
          </div>

          {error && (
            <p className="px-gutter pb-2 text-sm text-state-alert" role="alert">
              {error}
            </p>
          )}

          {/* Pinned, and sitting on its own ground: the action never
              scrolls out of reach on a small screen, which is where a
              six-step flow loses people. */}
          <div className="relative shrink-0">
            {/* The horizon. A slow rising glow behind the action bar —
                without it the bottom of the screen is a hard black band
                under a lit panel, which is where the composition used to
                fall off a cliff. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 origin-bottom"
              style={{
                background:
                  'radial-gradient(70% 100% at 50% 100%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 72%)',
                animation: 'init-horizon 11s ease-in-out infinite',
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-full h-8"
              style={{ background: 'linear-gradient(to top, var(--void), transparent)' }}
            />

            <div
              className="relative flex gap-3 px-gutter pt-2"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
            >
              {step > 1 && (
                <SecondaryButton onClick={() => go(step - 1)} className="flex-[0_0_31%]">
                  Back
                </SecondaryButton>
              )}
              {!isLast ? (
                <PrimaryButton
                  size="md"
                  disabled={!canProceed}
                  onClick={() => go(step + 1)}
                  className="flex-1"
                >
                  {step === 1 ? 'Begin' : 'Next'}
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  size="md"
                  disabled={isSubmitting}
                  onClick={handleInitialise}
                  className="flex-1"
                >
                  {isSubmitting ? 'Initialising…' : 'Initialise system'}
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
