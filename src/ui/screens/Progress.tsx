import { useEffect, useState } from 'react';
import { CaretRight, ChartBar, Flame, Shield } from '@phosphor-icons/react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { arcDay, localDate } from '../../engine/time';
import { levelFor } from '../../engine/level';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';
import { getTotalXp } from '../../store/playerState';
import { getStreakState, type LiveStreakState } from '../../store/streak';
import { getRealitySummary, type RealitySummary } from '../../store/reality';
import { AttributeBars } from '../components/AttributeBars';
import { StreakGrid } from '../components/StreakGrid';
import { WeeklyReview } from '../review/WeeklyReview';
import { getCurrentRank } from '../../store/checkpoint';
import { ArtLayer, DayMeta, MeterBar, ScreenTitle, SectionLabel } from '../kit';

const ARC_LENGTH_DAYS = 120;

type SubTab = 'SYSTEM' | 'REALITY';

const REALITY_DEFAULT_FROM_DAY = 30;

export function Progress() {
  const [day, setDay] = useState<number | null>(null);
  const [tab, setTab] = useState<SubTab | null>(null);

  useEffect(() => {
    void (async () => {
      const arc = await db.arc.toCollection().first();
      if (!arc) return;
      const d = arcDay(realDeps.now(), arc.start_date, arc.timezone, arc.day_boundary_hour);
      setDay(d);
      setTab(d >= REALITY_DEFAULT_FROM_DAY ? 'REALITY' : 'SYSTEM');
    })();
  }, []);

  if (tab === null) return null;

  return (
    <>
      {/* One heading per screen. This screen used to render an sr-only
          h1 from ScreenHeader *and* a visible one with the same words,
          so getByRole('heading', { name: ... }) matched two elements and
          eight specs failed on strict mode. The visible heading is the
          heading. */}
      <div className="px-gutter pb-6 pt-2">
        <ScreenTitle title="PROGRESS" meta={<DayMeta day={day} of={ARC_LENGTH_DAYS} />} className="mb-3" />

        {/* SubTab Switcher (SYSTEM / REALITY) */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setTab('SYSTEM')}
            aria-pressed={tab === 'SYSTEM'}
            className="cut-sm flex min-h-[44px] items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.18em] transition-all duration-200"
            style={{
              border: tab === 'SYSTEM' ? '1px solid rgba(77, 163, 255, 0.7)' : '1px solid rgba(77, 163, 255, 0.2)',
              background: tab === 'SYSTEM'
                ? 'linear-gradient(180deg, rgba(31, 95, 184, 0.65), rgba(12, 22, 38, 0.85))'
                : 'rgba(7, 13, 24, 0.6)',
              color: tab === 'SYSTEM' ? '#eaf3ff' : 'var(--ink-700)',
              boxShadow: tab === 'SYSTEM' ? '0 0 16px rgba(77, 163, 255, 0.4)' : 'none',
            }}
          >
            <span>◇</span>
            <span>SYSTEM</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('REALITY')}
            aria-pressed={tab === 'REALITY'}
            className="cut-sm flex min-h-[44px] items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.18em] transition-all duration-200"
            style={{
              border: tab === 'REALITY' ? '1px solid rgba(77, 163, 255, 0.7)' : '1px solid rgba(77, 163, 255, 0.2)',
              background: tab === 'REALITY'
                ? 'linear-gradient(180deg, rgba(31, 95, 184, 0.65), rgba(12, 22, 38, 0.85))'
                : 'rgba(7, 13, 24, 0.6)',
              color: tab === 'REALITY' ? '#eaf3ff' : 'var(--ink-700)',
              boxShadow: tab === 'REALITY' ? '0 0 16px rgba(77, 163, 255, 0.4)' : 'none',
            }}
          >
            <span>⬡</span>
            <span>REALITY</span>
          </button>
        </div>

        {tab === 'SYSTEM' ? <SystemTab /> : <RealityTab />}
      </div>
    </>
  );
}

function SystemTab() {
  const [totalXp, setTotalXp] = useState<number | null>(null);
  const [rank, setRank] = useState<string | null>(null);
  const [streak, setStreak] = useState<LiveStreakState | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);

  useEffect(() => {
    void (async () => {
      const [xp, streakState, currentRank] = await Promise.all([
        getTotalXp(),
        getStreakState(today, DEFAULT_CONFIG),
        getCurrentRank(),
      ]);
      setTotalXp(xp);
      setStreak(streakState);
      setRank(currentRank);
    })();
  }, [today]);

  if (totalXp === null || rank === null) return null;
  const level = levelFor(totalXp, DEFAULT_CONFIG);
  const pct = level.xpForNext > 0 ? Math.min(100, (level.xpIntoLevel / level.xpForNext) * 100) : 0;

  return (
    <div>
      {/* Sci-Fi Hero Level Card */}
      <div
        className="cut-md relative mb-3 overflow-hidden p-4 transition-all duration-200"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.4)',
          background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.85), rgba(5, 10, 20, 0.95))',
          boxShadow: '0 0 20px rgba(77, 163, 255, 0.15)',
        }}
      >
        {/* Sung Jinwoo Art Background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            mixBlendMode: 'lighten',
            opacity: 0.55,
            maskImage: 'radial-gradient(120% 100% at 50% 30%, #000 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(120% 100% at 50% 30%, #000 40%, transparent 80%)',
          }}
        >
          <ArtLayer slot="progress" scrim="none" focal="50% 28%" />
        </div>

        {/* Level and Rank Top Row */}
        <div className="relative flex items-center justify-between mb-4">
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-ink-700">CURRENT LEVEL</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-display text-xl text-ink-100">LV</span>
              <span className="font-mono text-3xl font-bold tabular-nums text-ink-100 glow-text">{level.level}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-ink-700">CURRENT RANK</div>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <Shield size={20} weight="fill" color="#5fb2ff" className="drop-shadow-[0_0_8px_rgba(77,163,255,0.6)]" />
              <span className="font-display text-2xl font-bold leading-none text-ink-100">{rank}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar & XP Stats */}
        <div className="relative mb-4">
          <MeterBar pct={pct} height={8} label="XP to next level" className="w-full" />
          <div className="flex items-baseline justify-between font-mono text-xs tabular-nums mt-2">
            <span className="font-semibold">
              <span className="text-accent-mid">{level.xpIntoLevel.toLocaleString()}</span> /{' '}
              <span className="text-ink-100">{level.xpForNext.toLocaleString()}</span>{' '}
              <span className="text-accent-mid">XP</span>
            </span>
            <span className="text-ink-700">{level.totalXp.toLocaleString()} total</span>
          </div>
        </div>

        {/* Bottom Metrics Bar: Weekly, Monthly, Streak, Quote */}
        <div className="relative grid grid-cols-4 items-center gap-2 pt-3 border-t border-hair-faint">
          <div>
            <div className="font-mono text-sm font-bold text-ink-100">{streak?.consistency_7 ?? 0}% <span className="text-[10px] text-ink-700 font-normal">(7d)</span></div>
            <div className="text-[8px] uppercase tracking-wider text-ink-700 font-semibold">WEEKLY</div>
          </div>

          <div>
            <div className="font-mono text-sm font-bold text-ink-100">{streak?.consistency_28 ?? 0}% <span className="text-[10px] text-ink-700 font-normal">(28d)</span></div>
            <div className="text-[8px] uppercase tracking-wider text-ink-700 font-semibold">MONTHLY</div>
          </div>

          <div className="flex items-center gap-1.5">
            <Flame size={18} weight="fill" color="#5fb2ff" className="drop-shadow-[0_0_6px_rgba(77,163,255,0.6)]" />
            <div>
              <div className="text-[8px] uppercase tracking-wider text-ink-700 font-semibold">STREAK</div>
              <div className="font-mono text-sm font-bold text-ink-100 leading-none">{streak?.arc_streak ?? 0}</div>
            </div>
          </div>

          <div className="text-right border-l border-hair-faint pl-1">
            <span className="block text-[8px] italic leading-tight text-ink-500">&ldquo;CONSISTENCY COMPOUNDS.&rdquo;</span>
          </div>
        </div>
      </div>

      <StreakGrid />

      {/* Weekly Review Action Banner */}
      <button
        type="button"
        onClick={() => setReviewOpen(true)}
        className="cut-sm relative mb-3 flex min-h-[50px] w-full items-center justify-between px-3.5 py-2.5 overflow-hidden text-left transition-all duration-200"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.35)',
          background: 'linear-gradient(180deg, rgba(12, 22, 38, 0.8), rgba(7, 13, 24, 0.9))',
        }}
      >
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-accent/40 bg-accent-deep/40 text-accent-mid shadow-[0_0_10px_rgba(77,163,255,0.3)]">
            <ChartBar size={18} weight="fill" color="#5fb2ff" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-ink-100">
              WEEKLY REVIEW
            </h3>
            <p className="text-[10px] uppercase tracking-[0.16em] text-ink-700 mt-0.5">
              LOOK BACK. GO FURTHER.
            </p>
          </div>
        </div>

        <CaretRight size={16} weight="bold" className="text-ink-700 relative z-10" />
      </button>

      <AttributeBars />

      {reviewOpen && <WeeklyReview today={today} onClose={() => setReviewOpen(false)} />}
    </div>
  );
}

function Row({ label, day0, now }: { label: string; day0: string; now: string }) {
  const moved = now !== day0;
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--hair-faint)' }}>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-300">{label}</span>
      <span className="w-[44px] shrink-0 text-right font-mono text-xs tabular-nums text-faint">
        {day0}
      </span>
      <span
        className={[
          'w-[58px] shrink-0 text-right font-mono text-xs font-bold tabular-nums',
          moved ? 'text-accent-mid' : 'text-ink-700',
        ].join(' ')}
      >
        {now}
      </span>
    </div>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function RealityTab() {
  const [summary, setSummary] = useState<RealitySummary | null>(null);

  useEffect(() => {
    void (async () => {
      const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);
      setSummary(await getRealitySummary(today));
    })();
  }, []);

  if (!summary) return null;

  const rows: { label: string; day0: string; now: string }[] = [
    { label: 'Problems', day0: '0', now: String(summary.problems) },
    {
      label: 'First-attempt M',
      day0: '—',
      now: summary.firstAttemptRateM > 0 ? pct(summary.firstAttemptRateM) : '—',
    },
    { label: 'Public projects', day0: '0', now: String(summary.publicProjects) },
    { label: 'Evals', day0: '0', now: String(summary.evals) },
    { label: 'Applications', day0: '0', now: String(summary.applications) },
    {
      label: 'Quality rate',
      day0: '—',
      now: summary.applications > 0 ? pct(summary.qualityRate) : '—',
    },
    {
      label: 'Follow-through',
      day0: '—',
      now: summary.followThroughRate > 0 ? pct(summary.followThroughRate) : '—',
    },
    { label: 'Foundations Fluent+', day0: '0 / 9', now: `${summary.foundationsFluentOrBetter} / 9` },
  ];

  return (
    <div className="cut-sm mt-3 p-4" data-testid="reality-tab" style={{ border: '1px solid rgba(77, 163, 255, 0.25)', background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.8), rgba(5, 10, 20, 0.9))' }}>
      <SectionLabel rule>Controlled Evidence</SectionLabel>
      <p className="mt-1.5 text-xs leading-relaxed text-faint">
        Cumulative and all-time. Everything here started at zero.
      </p>

      <div className="mt-3 flex items-center gap-3 pb-1.5 border-b border-hair-faint">
        <span className="min-w-0 flex-1 text-xxs uppercase font-bold text-ink-700">Metric</span>
        <span className="w-[44px] shrink-0 text-right text-xxs uppercase font-bold text-faint">Day 0</span>
        <span className="w-[58px] shrink-0 text-right text-xxs uppercase font-bold text-accent-mid">Now</span>
      </div>

      {rows.map((r) => (
        <Row key={r.label} label={r.label} day0={r.day0} now={r.now} />
      ))}
    </div>
  );
}

