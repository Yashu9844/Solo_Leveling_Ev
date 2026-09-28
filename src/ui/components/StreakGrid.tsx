import { useEffect, useState, useCallback } from 'react';
import { Flame, CheckCircle, Warning, CalendarCheck, Sparkle } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseISO, format, addDays } from 'date-fns';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';
import { localDate } from '../../engine/time';
import { getAllEvents } from '../../db/events';
import { applyEvents } from '../../engine/reduce';
import { buildDayOutcomes } from '../../db/projections';
import { streakFrom } from '../../engine/streak';

export interface DayCell {
  date: string;
  dayNumber: number;
  dayOfWeek: number; // 0 = Mon, 1 = Tue, 2 = Wed, 3 = Thu, 4 = Fri, 5 = Sat, 6 = Sun
  dayName: string;
  completed: number;
  total: number;
  isToday: boolean;
  isFuture: boolean;
  status: 'full' | 'partial' | 'empty' | 'future';
}

interface StreakGridProps {
  compact?: boolean;
}

const CORE_QUEST_KEYS = new Set(['career', 'dsa', 'build', 'training', 'sleep', 'attention']);
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const ROW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function StreakGrid({ compact = false }: StreakGridProps) {
  const [gridWeeks, setGridWeeks] = useState<(DayCell | null)[][]>([]);
  const [selectedCell, setSelectedCell] = useState<DayCell | null>(null);
  const [stats, setStats] = useState({ streak: 0, fullDays: 0, partialDays: 0, totalOpened: 0 });
  const [loading, setLoading] = useState(true);

  const todayStr = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);

  const loadData = useCallback(async () => {
    try {
      const arc = await db.arc.toCollection().first();
      if (!arc) {
        setLoading(false);
        return;
      }

      const events = await getAllEvents();
      const state = applyEvents(events, DEFAULT_CONFIG);

      // Count core quest completions per date from state.quests
      const coreCompletionsByDate = new Map<string, Set<string>>();

      for (const record of Object.values(state.quests)) {
        if (CORE_QUEST_KEYS.has(record.quest_key)) {
          const set = coreCompletionsByDate.get(record.local_date) ?? new Set();
          set.add(record.quest_key);
          coreCompletionsByDate.set(record.local_date, set);
        }
      }

      // Build live streak outcomes
      const pausedDates = state.arc?.paused_dates ?? [];
      const dayOutcomes = buildDayOutcomes(events, state.quests, arc.start_date, pausedDates, todayStr);
      const streakResult = streakFrom(dayOutcomes, DEFAULT_CONFIG.streak);

      let fullCount = 0;
      let partialCount = 0;
      let openedCount = 0;

      const totalArcDays = 120;
      const arcStartDateObj = parseISO(arc.start_date);

      // Build 2D week grid: 7 rows (0=Mon, ..., 6=Sun) x W columns
      const weeks: (DayCell | null)[][] = [];
      let currentWeek: (DayCell | null)[] = new Array(7).fill(null);

      for (let i = 0; i < totalArcDays; i++) {
        const d = addDays(arcStartDateObj, i);
        const dateStr = format(d, 'yyyy-MM-dd');

        // Calculate 0-indexed Day of Week (0 = Mon, 1 = Tue, ..., 6 = Sun)
        const jsDay = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
        const dayOfWeek = (jsDay + 6) % 7; // 0 = Mon, ..., 6 = Sun

        const isFuture = dateStr > todayStr;
        const isToday = dateStr === todayStr;

        const completedSet = coreCompletionsByDate.get(dateStr);
        const completed = completedSet ? completedSet.size : 0;
        const total = 6;

        let status: 'full' | 'partial' | 'empty' | 'future' = 'empty';
        if (isFuture) {
          status = 'future';
        } else if (completed >= 6) {
          status = 'full';
          fullCount++;
          openedCount++;
        } else if (completed > 0) {
          status = 'partial';
          partialCount++;
          openedCount++;
        } else {
          status = 'empty';
        }

        const cell: DayCell = {
          date: dateStr,
          dayNumber: i + 1,
          dayOfWeek,
          dayName: DAY_NAMES[dayOfWeek] ?? '',
          completed,
          total,
          isToday,
          isFuture,
          status,
        };

        // Place cell in current week at its exact dayOfWeek row
        currentWeek[dayOfWeek] = cell;

        // If it's Sunday (row 6) or the last day of the Arc, push week and start new week
        if (dayOfWeek === 6 || i === totalArcDays - 1) {
          weeks.push(currentWeek);
          currentWeek = new Array(7).fill(null);
        }
      }

      setGridWeeks(weeks);
      setStats({
        streak: streakResult.arc_streak,
        fullDays: fullCount,
        partialDays: partialCount,
        totalOpened: openedCount,
      });

      // Find today's cell or default to selected cell
      let foundToday: DayCell | null = null;
      for (const week of weeks) {
        for (const cell of week) {
          if (cell?.isToday) {
            foundToday = cell;
            break;
          }
        }
      }
      setSelectedCell(foundToday || (weeks[0]?.[0] ?? null));
      setLoading(false);
    } catch (err) {
      console.error('Failed to load streak grid data:', err);
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    void loadData();

    // Subscribe to Dexie event mutations for live real-time update on quest toggle
    const hookFunc = () => {
      setTimeout(() => void loadData(), 50);
    };

    db.event.hook('creating', hookFunc);
    db.event.hook('deleting', hookFunc);

    window.addEventListener('focus', loadData);

    return () => {
      db.event.hook('creating').unsubscribe(hookFunc);
      db.event.hook('deleting').unsubscribe(hookFunc);
      window.removeEventListener('focus', loadData);
    };
  }, [loadData]);

  if (loading) {
    return (
      <div className="cut-sm p-4 text-center font-mono text-xs text-ink-700 animate-pulse border border-accent/20 bg-surface/50">
        LOADING SYSTEM MATRIX STREAK...
      </div>
    );
  }

  return (
    <div
      className="cut-md relative mb-4 overflow-hidden p-4 transition-all duration-200"
      style={{
        border: '1px solid rgba(77, 163, 255, 0.35)',
        background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.9), rgba(5, 10, 20, 0.96))',
        boxShadow: '0 0 20px rgba(77, 163, 255, 0.12)',
      }}
      data-testid="github-streak-grid"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3 border-b border-hair-faint pb-2.5">
        <div className="flex items-center gap-2">
          <Flame size={18} weight="fill" color="#5fb2ff" className="drop-shadow-[0_0_8px_#5fb2ff]" />
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-ink-100 glow-text">
              SYSTEM ACTIVITY MATRIX
            </h3>
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-ink-700">
              REAL-TIME STREAK & TRIAL COMPLETIONS
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded cut-sm bg-accent-deep/40 border border-accent/40 text-xs font-mono font-bold text-accent-mid shadow-[0_0_8px_rgba(77,163,255,0.3)]">
            <CalendarCheck size={14} weight="fill" color="#5fb2ff" />
            <span>STREAK: {stats.streak}D</span>
          </div>
        </div>
      </div>

      {/* Stats Summary Badges */}
      {!compact && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2 rounded cut-sm border border-emerald-500/30 bg-emerald-950/30 flex items-center justify-between">
            <div>
              <div className="text-[8px] font-mono uppercase tracking-wider text-emerald-400 font-bold">100% COMPLETE</div>
              <div className="font-mono text-sm font-bold text-emerald-300 glow-text">{stats.fullDays} DAYS</div>
            </div>
            <CheckCircle size={16} weight="fill" className="text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          </div>

          <div className="p-2 rounded cut-sm border border-orange-500/30 bg-orange-950/30 flex items-center justify-between">
            <div>
              <div className="text-[8px] font-mono uppercase tracking-wider text-orange-400 font-bold">PARTIAL TRIALS</div>
              <div className="font-mono text-sm font-bold text-orange-300 glow-text">{stats.partialDays} DAYS</div>
            </div>
            <Warning size={16} weight="fill" className="text-orange-400 drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
          </div>

          <div className="p-2 rounded cut-sm border border-accent/30 bg-accent-deep/30 flex items-center justify-between">
            <div>
              <div className="text-[8px] font-mono uppercase tracking-wider text-accent-mid font-bold">ACTIVE ARC</div>
              <div className="font-mono text-sm font-bold text-ink-100">{stats.totalOpened} / 120D</div>
            </div>
            <Sparkle size={16} weight="fill" className="text-accent-mid drop-shadow-[0_0_6px_#5fb2ff]" />
          </div>
        </div>
      )}

      {/* GitHub Style Grid Container */}
      <div className="relative w-full overflow-x-auto no-scrollbar py-1">
        <div className="flex w-full items-center justify-between gap-1 sm:gap-1.5 min-w-full">
          {/* Day of Week Labels (Mon to Sun) */}
          <div className="flex flex-col gap-1 pr-1 border-r border-hair-faint shrink-0">
            {ROW_LABELS.map((lbl, idx) => (
              <span
                key={idx}
                className="h-3.5 w-3.5 text-[8px] font-mono font-bold text-ink-700 flex items-center justify-center"
              >
                {lbl}
              </span>
            ))}
          </div>

          {/* Week Columns */}
          <div className="flex-1 flex justify-between gap-0.5 sm:gap-1">
            {gridWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((cell, rIdx) => {
                  if (!cell) {
                    // Empty cell placeholder for days before Arc start or after Arc end in week
                    return <div key={`empty-${wIdx}-${rIdx}`} className="h-3.5 w-3.5 opacity-0" />;
                  }

                  const isSelected = selectedCell?.date === cell.date;

                  // Green for full completion (all 6 tasks), Orange for partial completion, Dark for empty
                  let bgStyle = 'rgba(255, 255, 255, 0.05)';
                  let borderStyle = '1px solid rgba(255, 255, 255, 0.1)';
                  let shadowStyle = 'none';

                  if (cell.status === 'full') {
                    bgStyle = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    borderStyle = '1px solid #34d399';
                    shadowStyle = '0 0 8px rgba(16, 185, 129, 0.6)';
                  } else if (cell.status === 'partial') {
                    bgStyle = 'linear-gradient(135deg, #f97316 0%, #d97706 100%)';
                    borderStyle = '1px solid #fb923c';
                    shadowStyle = '0 0 8px rgba(249, 115, 22, 0.6)';
                  } else if (cell.isToday) {
                    borderStyle = '1px solid rgba(77, 163, 255, 0.9)';
                    shadowStyle = '0 0 10px rgba(77, 163, 255, 0.8)';
                  } else if (cell.isFuture) {
                    bgStyle = 'rgba(255, 255, 255, 0.02)';
                    borderStyle = '1px solid rgba(255, 255, 255, 0.04)';
                  }

                  return (
                    <motion.button
                      key={cell.date}
                      type="button"
                      whileHover={{ scale: 1.2, zIndex: 20 }}
                      onClick={() => setSelectedCell(cell)}
                      title={`Day ${cell.dayNumber} - ${cell.dayName} (${cell.date}): ${cell.completed}/${cell.total} completed`}
                      aria-label={`Day ${cell.dayNumber} ${cell.dayName} activity`}
                      className={[
                        'h-3.5 w-3.5 rounded-[3px] transition-all duration-150 relative cursor-pointer',
                        isSelected ? 'ring-2 ring-accent-bright scale-110 z-10' : '',
                      ].join(' ')}
                      style={{
                        background: bgStyle,
                        border: borderStyle,
                        boxShadow: shadowStyle,
                      }}
                    >
                      {cell.isToday && (
                        <span className="absolute inset-0 rounded-[3px] animate-ping border border-accent-bright opacity-75" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Legend Bar */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-hair-faint text-[9px] font-mono text-ink-700">
        <span className="uppercase tracking-widest font-semibold">MATRIX LEGEND:</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-white/5 border border-white/10" />
            <span>0% Empty</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-gradient-to-r from-orange-500 to-amber-600 border border-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.5)]" />
            <span className="text-orange-400 font-bold">Partial (Orange)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-gradient-to-r from-emerald-500 to-green-600 border border-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="text-emerald-400 font-bold">100% Full (Green)</span>
          </div>
        </div>
      </div>

      {/* Active Day Detail Card */}
      <AnimatePresence mode="wait">
        {selectedCell && (
          <motion.div
            key={selectedCell.date}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 p-2.5 rounded cut-sm border border-accent/30 bg-surface-2/90 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xs font-bold text-ink-100 uppercase tracking-wider">
                  DAY {selectedCell.dayNumber} · {selectedCell.dayName.toUpperCase()} ({selectedCell.date})
                </span>
                {selectedCell.isToday && (
                  <span className="px-1.5 py-0.2 rounded cut-sm text-[8px] font-mono font-bold uppercase text-accent-bright bg-accent-deep/50 border border-accent/40">
                    TODAY
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                {selectedCell.isFuture
                  ? 'Future evaluation gate — unopened.'
                  : `${selectedCell.completed} of ${selectedCell.total} core trials completed (${Math.round(
                      (selectedCell.completed / selectedCell.total) * 100
                    )}%)`}
              </div>
            </div>

            <div className="text-right">
              <span
                className={[
                  'px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider',
                  selectedCell.status === 'full'
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    : selectedCell.status === 'partial'
                      ? 'bg-orange-950/70 text-orange-300 border border-orange-500/50 shadow-[0_0_8px_rgba(249,115,22,0.4)]'
                      : selectedCell.status === 'future'
                        ? 'bg-ink-900/40 text-ink-700 border border-ink-700/30'
                        : 'bg-red-950/40 text-red-400 border border-red-500/30',
                ].join(' ')}
              >
                {selectedCell.status === 'full'
                  ? '✓ FULL ASCENSION'
                  : selectedCell.status === 'partial'
                    ? '⚡ PARTIAL TRIAL'
                    : selectedCell.status === 'future'
                      ? 'LOCKED GATE'
                      : '0% MISSED'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
