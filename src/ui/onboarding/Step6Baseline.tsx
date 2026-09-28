import { SecondaryButton } from '../kit';
import { EASE, Instrument, Rise, SlotField, StepConsole, SubHead, type IntentionDraft } from './shared';

/** The line a phone alarm should carry. Shared with the clipboard copy
 * so the screen and the paste can never disagree. */
export function alarmLabel(intention: IntentionDraft, questTitle: string): string {
  const action = intention.first_action.trim() || '…';
  return `${intention.time} — ${questTitle}. ${action}.`;
}

function ManifestRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      {/* The label truncates, never the value — design/00 §8 rule 6.
          A half-printed main quest on the confirmation screen would be
          the worst possible place to lose a word. */}
      <span className="min-w-0 shrink truncate font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
        {label}
      </span>
      <span
        aria-hidden
        className="h-px min-w-[12px] flex-1"
        style={{ background: 'var(--hair-faint)' }}
      />
      <span className="max-w-[62%] text-right text-xs text-ink-300">{value}</span>
    </div>
  );
}

const CORNERS = [
  'left-0 top-0 border-l-2 border-t-2',
  'right-0 top-0 border-r-2 border-t-2',
  'left-0 bottom-0 border-b-2 border-l-2',
  'right-0 bottom-0 border-b-2 border-r-2',
] as const;

/**
 * Step 6 — baseline, then the manifest.
 *
 * Two jobs, in this order. The measurements come first because they are
 * work; the manifest comes last because it is the moment before
 * commitment, and the last thing anyone should see before pressing
 * "Initialise system" is what they actually agreed to — their name, the
 * length of the arc, and the one sentence the next four months are
 * judged against.
 *
 * The manifest is the only surface in the flow that is *raised* rather
 * than recessed: brighter than its console, double-bracketed, struck
 * rather than faded in. Everything else here is an instrument being
 * set; this is the document being signed, and it should not look like
 * another field.
 *
 * Art returns to this step — it bookends the flow with step 1. The user
 * is deciding to start, and a confirmation screen is the one form that
 * earns a backdrop.
 */
export function Step6Baseline({
  name,
  days,
  mainQuestText,
  heightCm,
  weightKg,
  problemsSolvedSoFar,
  onChangeHeight,
  onChangeWeight,
  onChangeProblems,
  career,
  dsa,
  onCopyTimes,
  copied,
}: {
  name: string;
  days: number | null;
  mainQuestText: string;
  heightCm: string;
  weightKg: string;
  problemsSolvedSoFar: string;
  onChangeHeight: (v: string) => void;
  onChangeWeight: (v: string) => void;
  onChangeProblems: (v: string) => void;
  career: IntentionDraft;
  dsa: IntentionDraft;
  onCopyTimes: () => void;
  copied: boolean;
}) {
  const quest = mainQuestText.trim();

  return (
    <StepConsole
      index={6}
      kicker="Baseline capture"
      title="Baseline"
      lead="The numbers today are the ones the checkpoint measures against."
    >
      <div className="space-y-6">
        {/* ── the measurements ── */}
        <Rise delay={60} className="space-y-4">
          <SubHead>Measurements</SubHead>

          <div className="grid grid-cols-2 gap-3">
            <SlotField label="Height (cm)">
              <input
                type="number"
                inputMode="numeric"
                value={heightCm}
                onChange={(e) => onChangeHeight(e.target.value)}
                className="tabular-nums"
              />
            </SlotField>
            <SlotField label="Weight (kg)">
              <input
                type="number"
                inputMode="numeric"
                value={weightKg}
                onChange={(e) => onChangeWeight(e.target.value)}
                className="tabular-nums"
              />
            </SlotField>
          </div>

          <p className="text-xs text-faint">
            Body fat — skip for now. Yours is unknown; it stays unknown and optional until you have
            a method you trust.
          </p>

          <SlotField label="Problems solved so far (optional)">
            <input
              type="number"
              inputMode="numeric"
              value={problemsSolvedSoFar}
              onChange={(e) => onChangeProblems(e.target.value)}
              className="tabular-nums"
            />
          </SlotField>
        </Rise>

        {/* ── the alarms ── */}
        <Rise delay={120} className="space-y-4">
          <SubHead>Take this off the screen</SubHead>

          <Instrument label="Three phone alarms">
            {/* Mono and tabular: these are times about to be typed into a
                Clock app, so they have to line up under one another. */}
            <ul className="space-y-2 font-mono text-xs tabular-nums text-ink-500">
              {[
                alarmLabel(career, 'CAREER'),
                alarmLabel(dsa, 'DSA'),
                '23:30 — Evening review. 25 seconds.',
              ].map((line) => (
                <li key={line} className="flex items-baseline gap-2">
                  <span
                    aria-hidden
                    className="mt-[1px] block h-[4px] w-[4px] shrink-0 rotate-45"
                    style={{ background: 'var(--accent-deep)' }}
                  />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>

            <SecondaryButton onClick={onCopyTimes} className="mt-4">
              {copied ? 'Copied' : 'Copy times'}
            </SecondaryButton>

            <p className="mt-3 text-xs text-faint">
              Add these in your phone&rsquo;s Clock app as repeating alarms.
            </p>
          </Instrument>
        </Rise>

        {/* ── the manifest ── */}
        <Rise delay={180}>
          <div
            className="relative overflow-hidden p-4"
            style={{
              border: '1px solid var(--accent)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--accent) 13%, transparent) 0%, transparent 62%), linear-gradient(180deg, var(--panel-top), var(--surface))',
              boxShadow:
                'inset 0 0 44px color-mix(in srgb, var(--accent) 14%, transparent), 0 0 24px color-mix(in srgb, var(--accent) 18%, transparent)',
              animation: `init-seal-in 520ms ${EASE} 120ms both`,
            }}
          >
            {/* Corner brackets, the app's mark for a ceremonial surface. */}
            {CORNERS.map((c) => (
              <span
                key={c}
                aria-hidden
                className={`pointer-events-none absolute ${c}`}
                style={{ width: 14, height: 14, borderColor: 'var(--accent)' }}
              />
            ))}

            <div className="mb-3.5 flex items-center gap-2.5">
              <span
                aria-hidden
                className="block h-[6px] w-[6px] shrink-0 rotate-45"
                style={{ background: 'var(--accent-core)', boxShadow: 'var(--glow-sm)' }}
              />
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-accent-mid">
                MANIFEST
              </span>
              <span
                aria-hidden
                className="h-px min-w-0 flex-1"
                style={{ background: 'var(--hair-faint)' }}
              />
            </div>

            <div className="space-y-2.5">
              <ManifestRow label="Designation" value={name.trim() || '—'} />
              <ManifestRow label="Arc" value={days === null ? '—' : `${days} days`} />
            </div>

            <div aria-hidden className="my-3.5 h-px" style={{ background: 'var(--hair-faint)' }} />

            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink-700">
              Main quest
            </div>
            <p className="mt-2 font-display text-title leading-[1.25] text-ink-100">
              {quest || '—'}
            </p>
          </div>
        </Rise>
      </div>
    </StepConsole>
  );
}
