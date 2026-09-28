import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GearSix, Sparkle } from '@phosphor-icons/react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { levelFor } from '../../engine/level';
import { arcDay, localDate } from '../../engine/time';
import { applyEvents } from '../../engine/reduce';
import { resetArc } from '../../store/onboarding';
import { realDeps } from '../../store/deps';
import { useArcStatus } from '../../store/ArcStatusContext';
import { getCurrentRank } from '../../store/checkpoint';
import type { Checkpoint } from '../../engine/rank';
import { getTotalXp } from '../../store/playerState';
import { pauseArc, resumeArc } from '../../store/pause';
import { db } from '../../db/db';
import { getAllEvents } from '../../db/events';
import { AttributeBars } from '../components/AttributeBars';
import { CheckpointScreen } from '../checkpoint/CheckpointScreen';
import { BossList } from '../components/BossList';
import { AchievementsList } from '../components/AchievementsList';
import { BodyMetricsCard } from '../components/BodyMetricsCard';
import { CheckpointInstrumentsCard } from '../components/CheckpointInstrumentsCard';
import {
  ArtLayer,
  DayMeta,
  FramedPanel,
  MeterBar,
  ScreenTitle,
  SectionLabel,
  SecondaryButton,
} from '../kit';

const CHECKPOINT_DAYS: Checkpoint['day'][] = [14, 30, 60, 90, 120];
const ARC_LENGTH_DAYS = 120;

export function Profile() {
  const navigate = useNavigate();
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const arc = await db.arc.toCollection().first();
      if (!arc) return;
      setDay(arcDay(realDeps.now(), arc.start_date, arc.timezone, arc.day_boundary_hour));
    })();
  }, []);

  return (
    <>
      {/* One heading per screen. This screen used to render an sr-only
          h1 from ScreenHeader *and* a visible one with the same words,
          so getByRole('heading', { name: ... }) matched two elements and
          eight specs failed on strict mode. The visible heading is the
          heading. */}
      <div className="px-gutter pb-8 pt-2">
        {/* The settings gear is a control, not decoration, so it sits
            outside the title row and keeps its own 44px target. */}
        <div className="mb-4 flex items-center gap-3">
          <ScreenTitle
            title="PROFILE"
            meta={<DayMeta day={day} of={ARC_LENGTH_DAYS} />}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => navigate('/profile/settings')}
            aria-label="Settings"
            className="-mr-1 flex min-h-tap min-w-[44px] shrink-0 items-center justify-center text-ink-500 transition-colors hover:text-accent-mid"
          >
            <GearSix size={20} aria-hidden />
          </button>
        </div>

        <LevelSummary />
        <CheckpointRow />
        <BossList />
        <AchievementsList />
        <AttributeBars />
        <DayZeroBaselineRow />
        <BodyMetricsCard />
        <ArcPauseControl />
        {import.meta.env.DEV && <DevResetArc />}
      </div>
    </>
  );
}

/** Real level, real total XP, real rank (the rank as of the most
 * recently sealed checkpoint — final/01 §4: "Level measures effort.
 * Rank measures evidence. They are not convertible."). */
function LevelSummary() {
  const [totalXp, setTotalXp] = useState<number | null>(null);
  const [rank, setRank] = useState<string | null>(null);
  const [mainQuest, setMainQuest] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getTotalXp(),
      getCurrentRank(),
      db.arc.toCollection().first(),
      db.profile.toCollection().first(),
    ]).then(([xp, r, arc, profile]) => {
      if (!cancelled) {
        setTotalXp(xp);
        setRank(r);
        setMainQuest(arc?.main_quest_text ?? null);
        setName(profile?.name?.trim() || null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (totalXp === null || rank === null) return null;
  const level = levelFor(totalXp, DEFAULT_CONFIG);
  const pct = level.xpForNext > 0 ? (level.xpIntoLevel / level.xpForNext) * 100 : 0;

  return (
    <div
      className="cut-md relative mb-4 overflow-hidden p-5 transition-all duration-200"
      style={{
        border: '1px solid rgba(77, 163, 255, 0.45)',
        background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.9), rgba(5, 10, 20, 0.96))',
        boxShadow: '0 0 24px rgba(77, 163, 255, 0.2)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          mixBlendMode: 'lighten',
          opacity: 0.55,
          maskImage: 'radial-gradient(120% 100% at 50% 30%, #000 45%, transparent 88%)',
          WebkitMaskImage: 'radial-gradient(120% 100% at 50% 30%, #000 45%, transparent 88%)',
        }}
      >
        <ArtLayer slot="rank" scrim="none" focal="50% 35%" priority />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          {/* The name has been collected on onboarding step 1 and stored
              since Slice 1, and nothing in the app has ever displayed it.
              A System that never says who it is talking to is a
              dashboard; this is the one line that makes it an address. */}
          <span className="cut-sm border border-accent/40 bg-accent-deep/40 px-2 py-0.5 font-mono text-[8px] font-bold tracking-widest text-accent-mid shadow-[0_0_8px_rgba(77,163,255,0.3)]">
            {name ? `PLAYER · ${name.toUpperCase()}` : 'PLAYER IDENTITY RECORD'}
          </span>
          <Sparkle size={16} weight="fill" color="#5fb2ff" className="drop-shadow-[0_0_8px_rgba(77,163,255,0.8)] animate-pulse" />
        </div>

        {/* Main Quest Banner */}
        {mainQuest && (
          <div className="mb-4 pb-4 border-b border-hair-faint">
            <div className="text-[9px] uppercase font-mono tracking-widest text-accent-mid font-bold mb-1">
              MAIN QUEST MANDATE
            </div>
            <p className="font-display text-[calc(17px*var(--type-scale))] leading-[1.45] text-ink-100 font-medium">
              &ldquo;{mainQuest}&rdquo;
            </p>
          </div>
        )}

        {/* Level & Rank Metrics */}
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-ink-700">LV</span>
            <span className="glow-text font-mono text-2xl font-bold tabular-nums text-accent-mid">
              {level.level}
            </span>
          </div>

          {/* checkpoint.spec asserts getByText(/RANK E/), so the word and
              the letter have to share one element's text content. Nesting
              the letter keeps that true while letting it be set larger. */}
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-ink-700">
              RANK{' '}
              <span className="font-display text-2xl font-bold leading-none text-ink-100 glow-text">
                {rank}
              </span>
            </span>
          </div>
        </div>

        <MeterBar pct={pct} height={8} label="XP to next level" className="mt-1" />

        <div className="mt-3 flex items-baseline justify-between font-mono text-xs tabular-nums text-ink-700">
          <span>
            <span className="text-accent-mid font-bold glow-text">{level.xpIntoLevel.toLocaleString()}</span> /{' '}
            {level.xpForNext.toLocaleString()} to L{level.level + 1}
          </span>
          <span className="font-semibold text-ink-300">{level.totalXp.toLocaleString()} total XP</span>
        </div>
      </div>
    </div>
  );
}

/** final/01 §4.1 — "The Profile screen always shows the next gate as a
 * ✓/✗ checklist. This is the app's most important sentence." */
function CheckpointRow() {
  const [day, setDay] = useState<number | null>(null);
  const [nextCheckpointDay, setNextCheckpointDay] = useState<Checkpoint['day'] | null>(null);
  const [open, setOpen] = useState(false);
  const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);

  const refresh = useCallback(async () => {
    const arc = await db.arc.toCollection().first();
    if (!arc) return;
    setDay(arcDay(realDeps.now(), arc.start_date, arc.timezone, arc.day_boundary_hour));

    const sealedDays = new Set(
      (await db.checkpoint.toArray()).filter((c) => c.sealed_at !== undefined).map((c) => c.day)
    );
    const next = CHECKPOINT_DAYS.find((d) => !sealedDays.has(d)) ?? null;
    setNextCheckpointDay(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (nextCheckpointDay === null) return null;
  const daysUntil = day !== null ? nextCheckpointDay - day : null;
  const due = daysUntil !== null && daysUntil <= 0;

  return (
    <FramedPanel tone={due ? 'dawn' : 'accent'} className="mt-4 shadow-[0_0_16px_rgba(77,163,255,0.15)]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-4 py-4 text-left group transition-all duration-150"
        style={{ minHeight: 56 }}
      >
        {/* The eyebrow here said "THE NEXT GATE // SYSTEM ASSESSMENT"
            directly above "Next checkpoint: Day N" — the same fact in
            costume, plus a dot that pulsed whether or not anything was
            due. The line below is the information. */}
        <span className="block font-display text-lg leading-tight text-ink-100 group-hover:text-accent-mid transition-colors">
          Next checkpoint: Day {nextCheckpointDay}
        </span>
        <span
          className={[
            'mt-1.5 block font-mono text-xs tabular-nums font-semibold',
            due ? 'text-dawn-bright glow-text' : 'text-accent-mid glow-text',
          ].join(' ')}
        >
          {daysUntil === null
            ? 'Open the checklist'
            : due
              ? 'Due now — open it'
              : `${daysUntil} ${daysUntil === 1 ? 'day' : 'days'} away — open the checklist`}
        </span>
      </button>
      {open && (
        <CheckpointScreen
          day={nextCheckpointDay}
          today={today}
          onClose={() => {
            setOpen(false);
            void refresh();
          }}
        />
      )}
    </FramedPanel>
  );
}

/** Day-0 Baseline Row */
function DayZeroBaselineRow() {
  return (
    <CheckpointInstrumentsCard
      day={0}
      label="Complete Day-0 baseline"
      header={{
        title: 'Baseline.',
        subtitle: 'There is no good or bad answer — this is the number we compare against in December.',
      }}
      saveLabel="Save baseline"
    />
  );
}

/** One tap, up to 7 days. No quests generate, streak preserved, end date
 * shifts. Zero penalty. final/01 §6.5. */
function ArcPauseControl() {
  const [arcId, setArcId] = useState<string | null>(null);
  const [pausedToday, setPausedToday] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);

  const refresh = useCallback(async () => {
    const arc = await db.arc.toCollection().first();
    if (!arc) return;
    setArcId(arc.id);
    const events = await getAllEvents();
    const state = applyEvents(events, DEFAULT_CONFIG);
    setPausedToday(state.arc?.paused_dates.includes(today) ?? false);
  }, [today]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handlePause(days: number) {
    if (!arcId || busy) return;
    setBusy(true);
    await pauseArc(today, days, arcId, DEFAULT_CONFIG, realDeps);
    await refresh();
    setBusy(false);
  }

  async function handleResume() {
    if (!arcId || busy) return;
    setBusy(true);
    await resumeArc(today, arcId, DEFAULT_CONFIG, realDeps);
    await refresh();
    setBusy(false);
  }

  if (arcId === null) return null;

  return (
    <div
      className="cut-md mb-4 mt-5 p-4 transition-all duration-200"
      style={{
        border: pausedToday ? '1px solid var(--state-recover)' : '1px solid rgba(77, 163, 255, 0.32)',
        background: pausedToday ? 'var(--state-recover)' : 'linear-gradient(180deg, rgba(10, 20, 36, 0.85), rgba(5, 10, 20, 0.95))',
        boxShadow: '0 0 16px rgba(77, 163, 255, 0.12)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <SectionLabel className="mb-0 text-accent-mid font-mono tracking-widest text-[9px]">ARC PAUSE PROTOCOL</SectionLabel>
        <span className="text-[9px] font-mono uppercase text-ink-700">SYSTEM RECOVERY</span>
      </div>

      {pausedToday ? (
        <>
          <p className="text-sm leading-[1.5] text-ink-100 font-medium">
            Paused. No quests generate. Zero penalty.
          </p>
          <div className="mt-4">
            <SecondaryButton disabled={busy} onClick={() => void handleResume()}>
              Resume now
            </SecondaryButton>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs leading-[1.5] text-ink-300">
            Illness, travel, a work crisis. One tap, up to 7 days.
          </p>
          <div className="mt-4 flex gap-2">
            {[1, 3, 7].map((days) => (
              <SecondaryButton
                key={days}
                disabled={busy}
                onClick={() => void handlePause(days)}
                className="flex-1"
              >
                {days}d
              </SecondaryButton>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** DEV-only Reset Arc */
function DevResetArc() {
  const navigate = useNavigate();
  const { markArcReset } = useArcStatus();

  async function handleReset() {
    await resetArc();
    markArcReset();
    navigate('/onboarding', { replace: true });
  }

  return (
    <DevBlock className="mt-8">
      <button
        type="button"
        onClick={handleReset}
        className="cut-sm mt-3 w-full px-4 text-xs font-medium uppercase tracking-button text-state-alert"
        style={{ minHeight: 46, border: '1px solid var(--state-alert)' }}
      >
        Reset arc
      </button>
      <p className="mt-3 text-xs leading-[1.5] text-faint">
        Deletes all events and projections, clears the arc, returns to onboarding.
      </p>
    </DevBlock>
  );
}

function DevBlock({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={['cut-sm p-4', className].join(' ')}
      style={{ border: '1px dashed var(--state-alert)' }}
    >
      <div className="text-xxs uppercase tracking-wide text-state-alert">Dev only</div>
      {children}
    </div>
  );
}
