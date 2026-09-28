import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Brain,
  Clock,
  Lightning,
  Moon,
  Quotes,
} from '@phosphor-icons/react';
import type { CoreQuestKey, ReviewBlocker } from '../../engine/types';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';
import { completeEveningReview, getDailyReport, type DailyReport } from '../../store/review';
import { DotPicker } from '../components/DotPicker';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { ArtLayer, Panel, Portal, QuoteCard, Sheet, TextInput } from '../kit';

const BLOCKER_LABELS: Record<ReviewBlocker, string> = {
  time: 'Time',
  tired: 'Tired',
  wrong_time: 'Wrong time',
  didnt_want_to: "Didn't want to",
  nothing: 'Nothing',
};

const PRIORITY_LABELS: Record<CoreQuestKey, string> = {
  career: 'Career',
  dsa: 'DSA',
  build: 'Build',
  training: 'Train',
  sleep: 'Sleep',
  attention: 'Attention',
};
const PRIORITY_OPTIONS: CoreQuestKey[] = ['career', 'dsa', 'build', 'training'];

interface EveningReviewProps {
  today: string;
  day: number | null;
  arcId: string;
  onClose: () => void;
}

/** final/05 §5 — 25 seconds, 5 taps, no typing. Matching exact sci-fi HUD design from Image 1 */
export function EveningReview({ today, day, arcId, onClose }: EveningReviewProps) {
  const [energy, setEnergy] = useState(3);
  const [focus, setFocus] = useState(3);
  const [blocker, setBlocker] = useState<ReviewBlocker | null>(null);
  const [priority, setPriority] = useState<CoreQuestKey | null>(null);
  const [sleptAt, setSleptAt] = useState('02:00');
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void db.profile
      .toCollection()
      .first()
      .then((p) => {
        if (!cancelled) setName(p?.name?.trim() || null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleComplete() {
    if (!blocker || submitting) return;
    setSubmitting(true);
    await completeEveningReview(
      today,
      arcId,
      { energy, focus, blocker, tomorrowPriority: priority ?? undefined, sleptAt },
      DEFAULT_CONFIG,
      realDeps
    );
    const result = await getDailyReport(today, DEFAULT_CONFIG);
    setReport(result);
    setSubmitting(false);
  }

  if (report) {
    return <DailyReportView report={report} day={day} name={name} onDismiss={onClose} />;
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={day != null ? `Day ${day} · Evening` : 'Evening'}
      hideHeader
      footer={
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={!blocker || submitting}
            onClick={() => void handleComplete()}
            className="cut-sm flex min-h-[50px] w-full items-center justify-between px-5 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-200 disabled:opacity-40"
            style={{
              border: '1px solid rgba(192, 132, 252, 0.8)',
              background: 'linear-gradient(180deg, rgba(88, 28, 135, 0.9), rgba(45, 10, 80, 0.98))',
              color: '#ffffff',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.45)',
            }}
          >
            <span className="flex-1 text-center pl-4">
              {submitting ? 'SAVING…' : 'COMPLETE DAY'}
            </span>
            <ArrowRight size={18} weight="bold" color="#ffffff" />
          </button>
          
          <div className="text-center text-[9px] uppercase tracking-[0.24em] text-ink-700">
            — SMALL REFLECTIONS. BIG RESULTS. —
          </div>
        </div>
      }
    >
      <div className="relative -mx-gutter -mt-4 mb-4 px-gutter pt-4 pb-2 overflow-hidden">
        {/* Background Artwork */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-[190px] w-[220px] overflow-hidden"
          style={{
            mixBlendMode: 'lighten',
            opacity: 0.65,
            maskImage: 'radial-gradient(125% 105% at 100% 0%, #000 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(125% 105% at 100% 0%, #000 40%, transparent 80%)',
          }}
        >
          <ArtLayer slot="review" scrim="none" focal="50% 35%" />
        </div>

        <div className="relative">
          {/* Header Bar: SYSTEM & Close */}
          <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-ink-700 mb-2">
            <div>
              <span>SYSTEM</span>
              <div className="h-[1px] w-6 bg-accent-mid/60 mt-0.5" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[8px] tracking-[0.16em] leading-tight text-ink-700 text-right uppercase">
                REFLECT · ADJUST · IMPROVE · CONTINUE
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-700 hover:text-accent-bright transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* DAY 07 EVENING REVIEW */}
          <div>
            <h1 className="font-display text-3xl leading-none tracking-[0.14em] text-ink-100">
              DAY {day != null ? String(day).padStart(2, '0') : '07'}
            </h1>
            <div className="font-bold text-xs uppercase tracking-[0.22em] text-accent-mid mt-1">
              EVENING REVIEW
            </div>
            <p className="text-[11px] italic text-ink-500 mt-1">
              A quiet mind builds a stronger tomorrow.
            </p>
          </div>
        </div>
      </div>

      {/* Quote Banner Box */}
      <div
        className="cut-sm relative mb-4 p-3 flex items-center justify-between gap-3 overflow-hidden"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.35)',
          background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.85), rgba(5, 10, 20, 0.9))',
          boxShadow: '0 0 14px rgba(77, 163, 255, 0.12)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent-deep/40 text-accent-mid border border-accent/40 shadow-[0_0_10px_rgba(77,163,255,0.4)]">
            <Quotes size={18} weight="fill" color="#5fb2ff" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-100 leading-snug">
            HONEST ANSWERS CREATE REAL PROGRESS.
          </p>
        </div>
        <div className="border-l border-hair-faint pl-2 text-right shrink-0">
          <span className="block text-[8px] uppercase tracking-[0.16em] text-ink-700 font-medium max-w-[70px] leading-tight">
            SAME EFFORT A STRONGER YOU
          </span>
        </div>
      </div>

      {/* Content Form */}
      <div className="flex flex-col gap-4">
        <DotPicker
          label="ENERGY"
          description="How was your physical energy today?"
          icon={Lightning}
          value={energy}
          onChange={setEnergy}
        />

        <DotPicker
          label="FOCUS"
          description="How was your mental focus today?"
          icon={Brain}
          value={focus}
          onChange={setFocus}
        />

        <div className="relative">
          <SingleChipSelect
            label="WHAT GOT IN THE WAY?"
            options={Object.keys(BLOCKER_LABELS) as ReviewBlocker[]}
            labelFor={(k) => BLOCKER_LABELS[k]}
            selected={blocker}
            onSelect={setBlocker}
          />
        </div>

        <SingleChipSelect
          label="TOMORROW'S ONE PRIORITY"
          options={PRIORITY_OPTIONS}
          labelFor={(k) => PRIORITY_LABELS[k]}
          selected={priority}
          onSelect={setPriority}
        />

        {/* Slept At Time Picker Box */}
        <div>
          <div className="mb-2 text-[10px] uppercase font-bold tracking-[0.18em] text-ink-700">
            SLEPT AT
          </div>
          <div
            className="cut-sm flex min-h-[46px] items-center justify-between px-3.5"
            style={{
              border: '1px solid rgba(77, 163, 255, 0.35)',
              background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.85), rgba(5, 10, 20, 0.95))',
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-accent-deep/30 text-accent-mid border border-accent/30">
                <Moon size={15} weight="fill" color="#5fb2ff" />
              </div>
              <TextInput
                type="time"
                value={sleptAt}
                onChange={(e) => setSleptAt(e.target.value)}
                className="bg-transparent font-mono text-sm font-bold text-ink-100 outline-none border-none p-0 focus:outline-none"
              />
            </div>
            <Clock size={16} weight="regular" className="text-ink-700" />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function DailyReportView({
  report,
  day,
  name,
  onDismiss,
}: {
  report: DailyReport;
  day: number | null;
  name: string | null;
  onDismiss: () => void;
}) {
  return (
    // The day's closing surface. It is a full-screen report rather than
    // a toast because the day is over — final/05 §5 ends the loop with
    // something to read, not something to acknowledge.
    <Portal>
      <div
        className="fixed inset-0 z-[55] flex flex-col justify-center overflow-y-auto px-gutter py-10"
        style={{ background: 'var(--void)' }}
        onClick={onDismiss}
        role="button"
        tabIndex={0}
        aria-label="Daily report. Dismiss."
      >
        <ArtLayer slot="review" scrim="quiet" focal="50% 35%" />

        <div className="relative">
          <p className="text-center text-xxs uppercase tracking-wide text-ink-700">
            DAILY REPORT · DAY {day ?? report.day}
          </p>
          {/* The closing line of the day is the natural place for the
              System to say whose day it was. The name is collected on
              onboarding step 1 and was displayed nowhere in the app. */}
          {name && (
            <p className="glow-text mt-1 text-center font-mono text-xxs uppercase tracking-[0.22em] text-accent-mid">
              ⟨ PLAYER · {name.toUpperCase()} ⟩
            </p>
          )}

          <Panel cut="md" className="mx-auto mt-5 w-full max-w-[380px]" bodyClassName="px-4 py-4">
            <Row label="XP" value={`${report.xp}`} />
            <Row label="Core quests" value={`${report.coreCompleted} / ${report.coreTotal}`} />
            <Row label="Arc streak" value={`${report.arcStreak} ${report.arcStreak === 1 ? 'day' : 'days'}`} />
            {report.strongest && (
              <Row
                stacked
                label="Strongest"
                value={`${report.strongest.title} — ${report.strongest.streakDays}${report.strongest.streakDays === 1 ? 'st' : 'th'} consecutive day`}
              />
            )}
            {report.weakest && (
              <Row
                stacked
                label="Weakest"
                value={`${report.weakest.title} — ${report.weakest.missesInWindow} misses in ${report.weakest.windowDays}`}
              />
            )}
          </Panel>

          {/* The one sanctioned quote surface. design/00 §7 bans these at
              the point of action and on any failure screen; the evening
              report is neither — the day is already done, and this is
              the app's closing line rather than encouragement to act. */}
          <QuoteCard attributed className="mx-auto mt-5 w-full max-w-[380px]">
            {report.message}
          </QuoteCard>

          <p className="mt-8 text-center text-xxs uppercase tracking-wide text-faint">tap anywhere</p>
        </div>
      </div>
    </Portal>
  );
}

/**
 * A labelled figure in the report.
 *
 * The label holds a fixed column and the value takes the rest, wrapping
 * rather than truncating: "Strongest" carries a whole sentence, and the
 * numbers ("1 / 6") are read verbatim by review.spec, so neither side
 * may be cut.
 */
function Row({ label, value, stacked = false }: { label: string; value: string; stacked?: boolean }) {
  // Numbers sit on one line opposite their label. Sentences ("CAREER —
  // 1st consecutive day") get their own line underneath and are set in
  // sans: right-aligned wrapped mono broke them into ragged fragments
  // with two words orphaned on the last line.
  if (stacked) {
    return (
      <div className="py-2.5" style={{ borderBottom: '1px solid var(--hair-faint)' }}>
        <span className="text-xs text-ink-700">{label}</span>
        <p className="mt-1 text-sm leading-[1.45] text-ink-100">{value}</p>
      </div>
    );
  }

  return (
    <div
      className="flex items-baseline gap-4 py-2.5"
      style={{ borderBottom: '1px solid var(--hair-faint)' }}
    >
      <span className="w-[86px] shrink-0 text-xs text-ink-700">{label}</span>
      <span className="min-w-0 flex-1 text-right font-mono text-sm tabular-nums text-ink-100">
        {value}
      </span>
    </div>
  );
}
