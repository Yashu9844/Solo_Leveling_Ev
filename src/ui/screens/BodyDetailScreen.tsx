import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Barbell,
  CheckCircle,
  Plus,
  ArrowLeft,
  Gear,
  Sparkle,
} from '@phosphor-icons/react';
import { ArtLayer, ScreenTitle } from '../kit';
import {
  DEFAULT_WEEKLY_SPLIT,
  getStoredWeeklySplit,
  saveStoredWeeklySplit,
  getStoredWorkoutLogs,
  saveWorkoutLogEntry,
  type DaySplit,
  type ExerciseLog,
  type WorkoutLogEntry,
} from '../../store/workoutStore';
import { localDate } from '../../engine/time';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function BodyDetailScreen() {
  const navigate = useNavigate();
  const todayStr = localDate(
    realDeps.now(),
    DEFAULT_CONFIG.arc.timezone,
    DEFAULT_CONFIG.arc.dayBoundaryHour
  );
  const currentDayIndex = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const todayDayName = DAYS_OF_WEEK[currentDayIndex] || 'Sunday';

  const [splits, setSplits] = useState<DaySplit[]>(getStoredWeeklySplit);
  const [selectedDay, setSelectedDay] = useState<string>(todayDayName);
  const [logs, setLogs] = useState<WorkoutLogEntry[]>(getStoredWorkoutLogs);

  // Active workout editing state for selected day
  const activeSplit = splits.find((s) => s.dayName === selectedDay) || splits[0] || DEFAULT_WEEKLY_SPLIT[0];
  const [activeExercises, setActiveExercises] = useState<ExerciseLog[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Initialize exercise logs for selected day
  useEffect(() => {
    const existingLog = logs.find((l) => l.date === todayStr && l.dayName === selectedDay);
    if (existingLog) {
      setActiveExercises(existingLog.exercises);
    } else if (activeSplit && !activeSplit.isRestDay) {
      const initial: ExerciseLog[] = activeSplit.defaultExercises.map((def, idx) => ({
        id: `ex-${idx}-${def.name}`,
        name: def.name,
        muscleGroup: def.muscleGroup,
        sets: Array.from({ length: def.targetSets }, (_, sIdx) => ({
          setNumber: sIdx + 1,
          weightKg: 40 + idx * 10,
          reps: def.defaultReps,
          completed: false,
        })),
      }));
      setActiveExercises(initial);
    } else {
      setActiveExercises([]);
    }
  }, [selectedDay, splits, logs, todayStr, activeSplit]);

  const handleToggleSet = (exIdx: number, setIdx: number) => {
    setActiveExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const newSets = ex.sets.map((s, sj) =>
          sj === setIdx ? { ...s, completed: !s.completed } : s
        );
        return { ...ex, sets: newSets };
      })
    );
  };

  const handleUpdateSet = (
    exIdx: number,
    setIdx: number,
    field: 'weightKg' | 'reps',
    val: number
  ) => {
    setActiveExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const newSets = ex.sets.map((s, sj) =>
          sj === setIdx ? { ...s, [field]: Math.max(0, val) } : s
        );
        return { ...ex, sets: newSets };
      })
    );
  };

  const handleAddSet = (exIdx: number) => {
    setActiveExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSetNumber = ex.sets.length + 1;
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              setNumber: newSetNumber,
              weightKg: lastSet ? lastSet.weightKg : 40,
              reps: lastSet ? lastSet.reps : 10,
              completed: false,
            },
          ],
        };
      })
    );
  };

  const handleAddExercise = () => {
    const name = prompt('Enter Exercise Name (e.g. Incline Dumbbell Press):');
    if (!name) return;
    setActiveExercises((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        muscleGroup: 'Custom Target',
        sets: [
          { setNumber: 1, weightKg: 20, reps: 10, completed: false },
          { setNumber: 2, weightKg: 20, reps: 10, completed: false },
          { setNumber: 3, weightKg: 20, reps: 10, completed: false },
        ],
      },
    ]);
  };

  const handleSaveWorkout = () => {
    let totalVol = 0;
    activeExercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (s.completed) {
          totalVol += s.weightKg * s.reps;
        }
      });
    });

    const entry: WorkoutLogEntry = {
      id: `workout-${todayStr}-${selectedDay}`,
      date: todayStr,
      dayName: selectedDay,
      focus: activeSplit?.focus || 'Workout',
      exercises: activeExercises,
      totalVolumeKg: totalVol,
      completedAt: new Date().toISOString(),
    };

    saveWorkoutLogEntry(entry);
    setLogs(getStoredWorkoutLogs());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Stats summary calculations
  const totalWorkoutsLogged = logs.length;
  const totalVolumeAllTime = logs.reduce((acc, l) => acc + l.totalVolumeKg, 0);

  return (
    <div className="px-gutter pb-12 pt-2">
      {/* Top Header / Back Button */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => navigate('/progress')}
          className="flex items-center gap-2 text-xs font-mono font-bold text-accent-mid hover:text-accent-bright transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          <span>BACK TO PROGRESS</span>
        </button>

        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded cut-sm border border-accent/40 bg-accent-deep/30 text-xs font-mono text-ink-100 hover:border-accent transition-all"
        >
          <Gear size={14} weight="fill" color="#5fb2ff" />
          <span>SETUP SPLIT</span>
        </button>
      </div>

      <ScreenTitle title="PHYSICAL TRIALS" compact className="mb-3" />

      {/* Hero Card */}
      <div
        className="cut-md relative mb-4 overflow-hidden p-4 transition-all duration-200"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.45)',
          background: 'linear-gradient(180deg, rgba(12, 24, 44, 0.9), rgba(5, 10, 20, 0.96))',
          boxShadow: '0 0 24px rgba(77, 163, 255, 0.2)',
        }}
      >
        {/* Training Art Layer */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-[200px] overflow-hidden"
          style={{
            mixBlendMode: 'lighten',
            opacity: 0.55,
            maskImage: 'radial-gradient(120% 100% at 100% 30%, #000 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(120% 100% at 100% 30%, #000 40%, transparent 80%)',
          }}
        >
          <ArtLayer slot="training" scrim="none" focal="60% 30%" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Barbell size={22} weight="fill" color="#5fb2ff" className="drop-shadow-[0_0_8px_#5fb2ff]" />
            <h2 className="font-display text-xl font-bold uppercase tracking-[0.14em] text-ink-100 glow-text">
              BODY · VITALITY ASCENSION
            </h2>
          </div>
          <p className="text-xs font-mono uppercase tracking-[0.14em] text-ink-500 mb-4">
            WEEKLY SPLIT & WEIGHT PROGRESSION LOG
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-hair-faint">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-ink-700 block">
                SESSIONS
              </span>
              <span className="font-mono text-lg font-bold text-ink-100">{totalWorkoutsLogged}</span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-ink-700 block">
                TOTAL VOLUME
              </span>
              <span className="font-mono text-lg font-bold text-amber-400">
                {totalVolumeAllTime.toLocaleString()} <span className="text-xs">kg</span>
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-ink-700 block">
                TARGET SPLIT
              </span>
              <span className="font-mono text-xs font-bold text-accent-bright truncate block">
                {activeSplit?.focus || 'Workout'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Split Day Selector Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
            WEEKLY SCHEDULE (SELECT DAY)
          </span>
          <span className="text-[10px] font-mono text-accent-mid font-bold">
            TODAY: {todayDayName ? todayDayName.toUpperCase() : ''}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {splits.map((s) => {
            const isSelected = s.dayName === selectedDay;
            const isToday = s.dayName === todayDayName;
            return (
              <button
                key={s.dayName}
                type="button"
                onClick={() => setSelectedDay(s.dayName)}
                className={[
                  'cut-sm py-2 px-1 flex flex-col items-center justify-center transition-all duration-150 relative',
                  isSelected
                    ? 'border-accent text-accent-bright bg-accent-deep/50 shadow-[0_0_12px_rgba(77,163,255,0.35)]'
                    : 'border-hair-faint text-ink-700 hover:text-ink-300 bg-surface/60',
                ].join(' ')}
                style={{
                  border: isSelected ? '1px solid #4da3ff' : '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider">
                  {s.dayName.substring(0, 3)}
                </span>
                <span
                  className={[
                    'text-[8px] font-mono truncate max-w-full mt-0.5',
                    s.isRestDay ? 'text-amber-500 font-bold' : 'text-ink-500',
                  ].join(' ')}
                >
                  {s.isRestDay ? 'REST' : s.focus.split(' ')[0]}
                </span>

                {isToday && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent-bright animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Workout Log Sheet */}
      <div
        className="cut-md p-4 mb-4 relative"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.35)',
          background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.9), rgba(5, 10, 20, 0.96))',
        }}
      >
        <div className="flex items-center justify-between mb-3 border-b border-hair-faint pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded cut-sm text-[9px] font-mono font-bold uppercase text-accent-bright bg-accent-deep/40 border border-accent/40">
                {selectedDay.toUpperCase()}
              </span>
              <h3 className="font-display text-base font-bold text-ink-100 uppercase tracking-wider">
                {activeSplit?.focus || 'Workout'}
              </h3>
            </div>
            <p className="text-[10px] font-mono text-ink-500 mt-0.5">
              {activeSplit?.isRestDay
                ? 'Active recovery day — stretch, hydrate, and rest your muscle groups.'
                : 'Log your sets, reps, and weights below to track your progress.'}
            </p>
          </div>

          {!activeSplit?.isRestDay && (
            <button
              type="button"
              onClick={handleAddExercise}
              className="flex items-center gap-1 px-2.5 py-1 rounded cut-sm border border-accent/40 text-xs font-mono text-accent-mid hover:text-accent-bright transition-colors"
            >
              <Plus size={14} weight="bold" />
              <span>ADD EXERCISE</span>
            </button>
          )}
        </div>

        {activeSplit?.isRestDay ? (
          <div className="py-8 text-center cut-sm border border-dashed border-amber-500/30 bg-amber-950/10">
            <Sparkle size={32} weight="fill" color="#f59e0b" className="mx-auto mb-2" />
            <h4 className="font-display text-lg font-bold text-amber-400">REST & RECOVERY DAY</h4>
            <p className="text-xs font-mono text-ink-500 max-w-xs mx-auto mt-1">
              Consistency includes rest. Your muscles repair and level up during recovery.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeExercises.map((ex, exIdx) => (
              <div
                key={ex.id || exIdx}
                className="cut-sm p-3 border border-accent/20 bg-surface-2/80"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-mono text-sm font-bold text-ink-100">{ex.name}</h4>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-accent-mid">
                      {ex.muscleGroup}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSet(exIdx)}
                    className="text-xs font-mono text-ink-700 hover:text-accent-mid"
                  >
                    + ADD SET
                  </button>
                </div>

                {/* Sets List Table */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-2 text-[9px] font-mono text-ink-700 font-bold uppercase px-1">
                    <span className="col-span-2">SET</span>
                    <span className="col-span-4">WEIGHT (KG)</span>
                    <span className="col-span-4">REPS</span>
                    <span className="col-span-2 text-right">DONE</span>
                  </div>

                  {ex.sets.map((set, setIdx) => (
                    <div
                      key={setIdx}
                      className={[
                        'grid grid-cols-12 gap-2 items-center p-1.5 rounded cut-sm border transition-all',
                        set.completed
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : 'border-hair-faint bg-surface/50',
                      ].join(' ')}
                    >
                      <span className="col-span-2 font-mono text-xs font-bold text-ink-500">
                        #{set.setNumber}
                      </span>

                      <div className="col-span-4 flex items-center gap-1">
                        <input
                          type="number"
                          value={set.weightKg}
                          onChange={(e) =>
                            handleUpdateSet(exIdx, setIdx, 'weightKg', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-surface-2 border border-hair-faint px-2 py-0.5 rounded cut-sm text-xs font-mono text-ink-100 focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div className="col-span-4 flex items-center gap-1">
                        <input
                          type="number"
                          value={set.reps}
                          onChange={(e) =>
                            handleUpdateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)
                          }
                          className="w-full bg-surface-2 border border-hair-faint px-2 py-0.5 rounded cut-sm text-xs font-mono text-ink-100 focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSet(exIdx, setIdx)}
                          className={[
                            'h-7 w-7 flex items-center justify-center rounded cut-sm border transition-all',
                            set.completed
                              ? 'bg-emerald-500 text-black border-emerald-400'
                              : 'bg-surface border-hair-faint text-ink-700 hover:text-ink-100',
                          ].join(' ')}
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleSaveWorkout}
              className="cut-sm w-full py-2.5 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-black bg-accent-bright hover:bg-white shadow-[0_0_16px_rgba(77,163,255,0.4)] transition-all"
            >
              <CheckCircle size={16} weight="bold" />
              <span>SAVE WORKOUT SESSION</span>
            </button>

            {savedSuccess && (
              <div className="p-2 cut-sm border border-emerald-500/50 bg-emerald-950/40 text-center font-mono text-xs text-emerald-300">
                ✓ WORKOUT SESSION SAVED SUCCESSFULLY!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Setup Split Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="cut-md max-w-md w-full bg-surface-2 border border-accent p-4 max-h-[85vh] overflow-y-auto">
            <h3 className="font-display text-lg font-bold text-ink-100 uppercase tracking-wider mb-2">
              CONFIGURE WEEKLY SPLIT
            </h3>
            <p className="text-xs font-mono text-ink-500 mb-4">
              Customize the muscle group focus for each day of the week.
            </p>

            <div className="space-y-3 mb-4">
              {splits.map((s, idx) => (
                <div key={s.dayName} className="p-2 border border-hair-faint bg-surface rounded cut-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-accent-mid">{s.dayName}</span>
                    <label className="flex items-center gap-1 text-[10px] font-mono text-ink-500">
                      <input
                        type="checkbox"
                        checked={s.isRestDay}
                        onChange={(e) => {
                          const updated = [...splits];
                          updated[idx] = { ...s, isRestDay: e.target.checked };
                          setSplits(updated);
                        }}
                      />
                      Rest Day
                    </label>
                  </div>
                  <input
                    type="text"
                    value={s.focus}
                    disabled={s.isRestDay}
                    onChange={(e) => {
                      const updated = [...splits];
                      updated[idx] = { ...s, focus: e.target.value };
                      setSplits(updated);
                    }}
                    className="w-full bg-surface-2 border border-hair-faint px-2 py-1 rounded text-xs font-mono text-ink-100"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  saveStoredWeeklySplit(splits);
                  setShowConfigModal(false);
                }}
                className="flex-1 py-2 cut-sm bg-accent text-black font-mono text-xs font-bold uppercase"
              >
                SAVE SPLIT CONFIG
              </button>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 cut-sm border border-hair text-ink-500 font-mono text-xs"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
