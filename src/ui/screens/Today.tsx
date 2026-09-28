import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { arcDay, isDayClosed, localDate } from '../../engine/time';
import { levelFor, type LevelState } from '../../engine/level';
import type { CoreQuestKey, QuestInstance, QuestRecoveredPayload, QuestTemplate } from '../../engine/types';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';
import { loadTodayQuests, completeQuest, undoQuest } from '../../store/quests';
import { getDayXpByInstance, getTotalXp } from '../../store/playerState';
import { getStreakState, type LiveStreakState } from '../../store/streak';
import { getRecoverableDay, claimRecovery, type RecoverableDay } from '../../store/recovery';
import { hasReviewedToday } from '../../store/review';
import { QuestRow } from '../today/QuestRow';
import { QuestDetailSheet } from '../today/QuestDetailSheet';
import { priorityLine } from '../today/priorityLine';
import { LevelUpMoment } from '../moments/LevelUpMoment';
import { DayCompleteMoment } from '../moments/DayCompleteMoment';
import { unlockTextForRange } from '../moments/levelUnlocks';
import { EveningReview } from '../review/EveningReview';
import { LogApplicationSheet } from '../career/LogApplicationSheet';
import { LogProblemSheet } from '../dsa/LogProblemSheet';
import { getRevisitsDue, logRevisit, type RevisitDue } from '../../store/dsa';
import { getActiveWeeklyQuest, type ActiveWeeklyQuest } from '../../store/weeklyQuest';
import { getCurrentRank } from '../../store/checkpoint';
import { LogBuildSessionSheet } from '../build/LogBuildSessionSheet';
import { LogTrainingSheet } from '../training/LogTrainingSheet';
import { LogSleepSheet } from '../lifestyle/LogSleepSheet';
import { LogAttentionSheet } from '../lifestyle/LogAttentionSheet';
import { MaintenanceCard } from '../lifestyle/MaintenanceCard';
import { LearningBlockSheet } from '../foundations/LearningBlockSheet';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { ArtLayer, MeterBar, ScreenTitle, SectionLabel, SystemWindow } from '../kit';
import { useCountdown } from '../hooks/useCountdown';
import { getTodaySystemLine } from '../../store/messages';
import { resolveTransmission, type Transmission } from '../../store/systemMessage';
import { SystemTransmission } from '../today/SystemTransmission';
import { useSystemVoice } from '../speech/useSystemVoice';
import { recordReflectionShown } from '../../store/reflections';

const CONFIG = DEFAULT_CONFIG;

// final/01 §6.3 — "one optional diagnostic tap, no free text." 3x
// "wrong time" in 14 days feeds engine/rules.ts's WRONG_TIME_PATTERN.
const RECOVERY_REASONS: NonNullable<QuestRecoveredPayload['reason']>[] = [
  'ran_out_of_time',
  'too_tired',
  'wrong_time',
  'didnt_want_to',
];
const RECOVERY_REASON_LABELS: Record<NonNullable<QuestRecoveredPayload['reason']>, string> = {
  ran_out_of_time: 'Ran out of time',
  too_tired: 'Too tired',
  wrong_time: 'Wrong time',
  didnt_want_to: "Didn't want to",
};

function currentLocalDate(): string {
  return localDate(realDeps.now(), CONFIG.arc.timezone, CONFIG.arc.dayBoundaryHour);
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

interface Arc {
  id: string;
  start_date: string;
  end_date: string;
}

interface LevelUpEvent {
  fromLevel: number;
  toLevel: number;
}

/**
 * Which level-ups earn the full screen.
 *
 * final/05 §2.3 asks that LEVEL UP stop being full-screen once it stops
 * being rare, and the original rule — the first three, full stop — read
 * that as a count. On this level curve that is a mistake: at a full 500
 * XP/day the player reaches L2 on day 0.6, L3 on day 1.3 and L4 on day
 * 2.2, so the entire allowance is spent inside 48 hours and every
 * level-up for the remaining 118 days is a six-second text banner.
 *
 * Rarity is the property §2.3 actually cares about, so this encodes
 * rarity: the early levels, which are genuinely new, and then every
 * fifth. L5, L10, L15 … stay events for the length of the arc, and the
 * levels between them pass quietly, which is what makes the milestones
 * read as milestones.
 */
function levelUpDeservesFullScreen(level: number): boolean {
  return level <= 3 || level % 5 === 0;
}

export function Today() {
  const [arc, setArc] = useState<Arc | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [today, setToday] = useState<string>(currentLocalDate);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);
  const [instances, setInstances] = useState<QuestInstance[]>([]);
  const [dayXp, setDayXp] = useState<Record<string, { amount: number; cappedFrom?: number }>>({});
  const [levelState, setLevelState] = useState<LevelState>(() => levelFor(0, CONFIG));
  const [openInstanceId, setOpenInstanceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moment, setMoment] = useState<LevelUpEvent | null>(null);
  const [dayComplete, setDayComplete] = useState<{ xp: number; streak: number; total: number } | null>(
    null
  );
  const [banner, setBanner] = useState<LevelUpEvent | null>(null);
  const [streak, setStreak] = useState<LiveStreakState | null>(null);
  const [recoverable, setRecoverable] = useState<RecoverableDay | null>(null);
  const [claimingRecovery, setClaimingRecovery] = useState(false);
  const [recoveryReason, setRecoveryReason] = useState<NonNullable<QuestRecoveredPayload['reason']> | null>(null);
  const [reviewed, setReviewed] = useState(true); // true until refresh() proves otherwise — hides the entry on first paint
  const [reviewOpen, setReviewOpen] = useState(false);
  const [careerLogOpen, setCareerLogOpen] = useState(false);
  const [dsaLogOpen, setDsaLogOpen] = useState(false);
  const [buildLogOpen, setBuildLogOpen] = useState(false);
  const [trainingLogOpen, setTrainingLogOpen] = useState(false);
  const [sleepLogOpen, setSleepLogOpen] = useState(false);
  const [attentionLogOpen, setAttentionLogOpen] = useState(false);
  const [learningBlockOpen, setLearningBlockOpen] = useState(false);
  const [revisitsDue, setRevisitsDue] = useState<RevisitDue[]>([]);
  const [weeklyQuest, setWeeklyQuest] = useState<ActiveWeeklyQuest | null>(null);
  const [rank, setRank] = useState('E');
  const [systemLine, setSystemLine] = useState<string | null>(null);
  // design/04 §12 — the System's reading of the current state. Resolved
  // from the same derived tables the rest of this screen reads, and
  // cached by state fingerprint, so a re-render or a return to this tab
  // never re-rolls it.
  const [transmission, setTransmission] = useState<Transmission | null>(null);
  const [revisitingId, setRevisitingId] = useState<string | null>(null);
  // The System says its line out loud once per app open, when the Player
  // has the voice turned on. Keyed on the transmission's fingerprint, so
  // it speaks when there is something new to say and stays quiet through
  // re-renders, tab round trips and quest toggles inside the same state.
  useSystemVoice({
    messageId: transmission?.message.id ?? null,
    text: transmission?.message.text ?? null,
    fingerprint: transmission?.fingerprint ?? null,
  });

  const dayClosed = isDayClosed(realDeps.now(), CONFIG);

  // The pressure gradient the screen never had. The app has always known
  // when the day closes — it gates logging on it and prints a banner
  // afterwards — but it only ever said so once it was too late to act,
  // which is why 9am and 9pm looked identical.
  const countdown = useCountdown(CONFIG.arc.dayCloseHour, CONFIG.arc.timezone);

  const refreshXp = useCallback(async (date: string) => {
    const [totalXp, xpByInstance] = await Promise.all([getTotalXp(), getDayXpByInstance(date)]);
    setLevelState(levelFor(totalXp, CONFIG));
    setDayXp(xpByInstance);
  }, []);

  /**
   * Re-reads the System's verdict on the current state.
   *
   * Cheap and idempotent: resolveTransmission compares a fingerprint of
   * the state against the one it cached for this local date and only
   * selects (and writes) when something the System would actually have a
   * different opinion about has moved. Calling it after a quest toggle is
   * therefore free inside a band and meaningful when a tap crosses one.
   */
  const refreshTransmission = useCallback(async (date: string) => {
    const arcRow = await db.arc.toCollection().first();
    if (!arcRow) return;
    const dayNumber = arcDay(realDeps.now(), arcRow.start_date, arcRow.timezone, arcRow.day_boundary_hour);
    setTransmission(await resolveTransmission(date, dayNumber, CONFIG, realDeps));
  }, []);

  const refresh = useCallback(async () => {
    const arcRow = await db.arc.toCollection().first();
    if (!arcRow) return;
    setArc({ id: arcRow.id, start_date: arcRow.start_date, end_date: arcRow.end_date });
    setDay(arcDay(realDeps.now(), arcRow.start_date, arcRow.timezone, arcRow.day_boundary_hour));

    const date = currentLocalDate();
    setToday(date);
    const { templates: t, instances: i } = await loadTodayQuests(date, CONFIG, realDeps);
    setTemplates(t);
    setInstances(i);
    await refreshXp(date);

    const [streakState, recoverableDay, alreadyReviewed, dueRevisits, currentRank, activeWeeklyQuest] = await Promise.all([
      getStreakState(date, CONFIG),
      getRecoverableDay(date, CONFIG),
      hasReviewedToday(date),
      getRevisitsDue(date, CONFIG),
      getCurrentRank(),
      getActiveWeeklyQuest(date, arcRow.id, CONFIG, realDeps),
    ]);
    setStreak(streakState);
    setRecoverable(recoverableDay);
    setReviewed(alreadyReviewed);
    setRevisitsDue(dueRevisits);
    setRank(currentRank);
    setWeeklyQuest(activeWeeklyQuest);
    if (activeWeeklyQuest?.justCompleted) await refreshXp(date);

    // final/06 §5.2's "reflection" line, right below the priority line.
    // A missed day surfacing a recovery card IS the post-lapse moment
    // final/05 §1.2 means — the reflection pool narrows to setbacks/
    // calm/reflective for exactly as long as that card is showing.
    const line = await getTodaySystemLine(date, arcDay(realDeps.now(), arcRow.start_date, arcRow.timezone, arcRow.day_boundary_hour), recoverableDay !== null, recoverableDay !== null ? 'POST_LAPSE' : 'MORNING', CONFIG);
    setSystemLine(line.text);
    if (line.source === 'reflection' && line.reflectionId) {
      await recordReflectionShown(line.reflectionId, date);
    }

    await refreshTransmission(date);
  }, [refreshXp, refreshTransmission]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // You leave this app open overnight — a stale date after the 04:00
  // rollover is a real bug, not a hypothetical (final/11 Step 3).
  useEffect(() => {
    function onVisibleOrFocus() {
      const date = currentLocalDate();
      if (date !== today) {
        void refresh();
      }
    }
    document.addEventListener('visibilitychange', onVisibleOrFocus);
    window.addEventListener('focus', onVisibleOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibleOrFocus);
      window.removeEventListener('focus', onVisibleOrFocus);
    };
  }, [today, refresh]);

  async function handleToggle(instance: QuestInstance, template: QuestTemplate) {
    if (dayClosed || !arc) return;

    const wasComplete = instance.state === 'complete';
    const optimistic: QuestInstance = {
      ...instance,
      state: wasComplete ? 'available' : 'complete',
      completed_at: wasComplete ? undefined : realDeps.now(),
    };
    setInstances((prev) => prev.map((i) => (i.id === instance.id ? optimistic : i)));
    // Optimistic XP feedback — the visible number before the write
    // confirms, so a tap reads as instant. Corrected to the real (maybe
    // capped) amount once refreshXp resolves. final/12 Step 4: under
    // 300ms, offline.
    if (!wasComplete) {
      setDayXp((prev) => ({ ...prev, [instance.id]: { amount: template.xp } }));
    } else {
      setDayXp((prev) => omitKey(prev, instance.id));
    }

    const beforeLevel = levelState.level;

    try {
      if (wasComplete) {
        await undoQuest(instance, arc.id, CONFIG, realDeps);
      } else {
        await completeQuest(instance, template.key, arc.id, CONFIG, realDeps);
      }
      await refreshXp(today);
      await refreshTransmission(today);

      if (!wasComplete) {
        // The day just became complete on this tap. Checked against the
        // optimistic list, which already holds the toggle — the confirmed
        // write lands later and the ceremony must not wait for it.
        const nowComplete = instances.every((i) =>
          i.id === instance.id ? true : i.state === 'complete'
        );
        if (nowComplete && instances.length > 0) {
          const xpByInstance = await getDayXpByInstance(today);
          const xpToday = Object.values(xpByInstance).reduce((sum, x) => sum + x.amount, 0);
          const streakState = await getStreakState(today, CONFIG);
          setDayComplete({
            xp: xpToday,
            streak: streakState.arc_streak,
            total: instances.length,
          });
        }

        const afterXp = await getTotalXp();
        const afterLevel = levelFor(afterXp, CONFIG).level;
        if (afterLevel > beforeLevel) {
          const event: LevelUpEvent = { fromLevel: beforeLevel, toLevel: afterLevel };
          if (levelUpDeservesFullScreen(afterLevel)) {
            setMoment(event);
          } else {
            setBanner(event);
            setTimeout(() => setBanner(null), 6000);
          }
        }
      }
    } catch {
      setInstances((prev) => prev.map((i) => (i.id === instance.id ? instance : i)));
      setDayXp((prev) => omitKey(prev, instance.id));
      setNotice('Could not save — try again.');
      setTimeout(() => setNotice(null), 3000);
    }
  }

  async function handleClaimRecovery() {
    if (!arc || !recoverable || claimingRecovery) return;
    setClaimingRecovery(true);
    try {
      await claimRecovery(recoverable.localDate, today, arc.id, CONFIG, realDeps, recoveryReason ?? undefined);
      setRecoverable(null);
      setRecoveryReason(null);
      await refreshXp(today);
      await refreshTransmission(today);
    } catch {
      setNotice('Could not save — try again.');
      setTimeout(() => setNotice(null), 3000);
    } finally {
      setClaimingRecovery(false);
    }
  }

  async function handleLogRevisit(problemId: string, outcome: 'first_attempt' | 'hint' | 'editorial' | 'unsolved') {
    if (!arc || revisitingId) return;
    setRevisitingId(problemId);
    try {
      await logRevisit(today, arc.id, problemId, outcome, 10, CONFIG, realDeps);
      setRevisitsDue((prev) => prev.filter((r) => r.problemId !== problemId));
      await refreshXp(today);
    } catch {
      setNotice('Could not save — try again.');
      setTimeout(() => setNotice(null), 3000);
    } finally {
      setRevisitingId(null);
    }
  }

  function domainLogFor(key: CoreQuestKey, closeSheet: () => void): { label: string; onOpen: () => void } | undefined {
    function open(setter: (v: boolean) => void) {
      closeSheet();
      setter(true);
    }
    switch (key) {
      case 'career':
        return { label: 'Despatch Ascension', onOpen: () => open(setCareerLogOpen) };
      case 'dsa':
        return { label: 'Record Logic Trial', onOpen: () => open(setDsaLogOpen) };
      case 'build':
        return { label: 'Forge Construct', onOpen: () => open(setBuildLogOpen) };
      case 'training':
        return { label: 'Record Vitality Trial', onOpen: () => open(setTrainingLogOpen) };
      case 'sleep':
        return { label: 'Log Synchronization', onOpen: () => open(setSleepLogOpen) };
      case 'attention':
        return { label: 'Log Friction Control', onOpen: () => open(setAttentionLogOpen) };
    }
  }

  const openTemplate = templates.find(
    (t) => t.id === instances.find((i) => i.id === openInstanceId)?.template_id
  );
  const openInstance = instances.find((i) => i.id === openInstanceId);
  const barPct =
    levelState.xpForNext > 0 ? Math.min(100, (levelState.xpIntoLevel / levelState.xpForNext) * 100) : 0;

  // What the System is actually tracking: how many of the day's
  // requirements are still outstanding. Drives the window's label and
  // the requirement counter beside the heading.
  const completedCount = instances.filter((i) => i.state === 'complete').length;
  const remaining = instances.length - completedCount;

  return (
    <>
      {/* One heading per screen. This screen used to render an sr-only
          h1 from ScreenHeader *and* a visible one with the same words,
          so getByRole('heading', { name: ... }) matched two elements and
          eight specs failed on strict mode. The visible heading is the
          heading. */}
      <div className="px-gutter pb-4 pt-2">
      {/*
        The identity block. Top taglines, Sung Jinwoo background artwork,
        DAY number, Rank Crest Badge, and Level XP progress bar.
      */}
      <div className="relative -mx-gutter mb-1 px-gutter">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-[190px] w-[220px] overflow-hidden"
          style={{
            mixBlendMode: 'lighten',
            opacity: 0.6,
            maskImage: 'radial-gradient(125% 105% at 100% 0%, #000 35%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(125% 105% at 100% 0%, #000 35%, transparent 75%)',
          }}
        >
          <ArtLayer slot="today" scrim="none" focal="62% 22%" />
        </div>

        <div className="relative">
          {/* The screen's heading lives here rather than in a strip of
              its own. Today is measured to zero overflow at 412x915 —
              final/06 §5.2, the constraint that caps the core set at six
              — and a separate title block cost 51px of that budget while
              repeating chrome this row was already carrying. */}
          {/* The slogan that used to ride along here ("DISCIPLINE
              CREATES FREEDOM") is gone. It never changed, so after day
              one it was read as texture rather than as words, and it was
              competing with the one thing on this row that does change. */}
          <ScreenTitle
            title="TODAY"
            compact
            className="mb-2"
            meta={
              instances.length > 0 ? (
                <span
                  className={[
                    'font-mono text-[10px] font-bold uppercase leading-none tracking-[0.14em]',
                    remaining > 0 ? 'text-accent-mid' : 'glow-text text-state-complete',
                  ].join(' ')}
                >
                  {remaining > 0 ? `${remaining} REMAIN` : 'ALL CLEAR'}
                </span>
              ) : null
            }
          />

          {/* DAY 07 & RANK Crest */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[26px] leading-none tracking-[0.14em] text-ink-100">
                DAY
              </span>
              <span className="font-mono text-[30px] font-bold leading-none tabular-nums text-accent-mid">
                {day != null ? String(day).padStart(2, '0') : '07'}
              </span>
            </div>

            {/* Rank Crest Diamond Badge */}
            <div className="flex items-center gap-2.5">
              <div className="text-right">
                {/* ⟨ TIME REMAINING ⟩ replaces the XP figure that used to
                    sit here. The meter on the row below is already the XP
                    story; the day running out was told nowhere at all,
                    which is why this screen looked the same at 9am and
                    9pm. Amber inside three hours — the point where the
                    day stops being theoretical. Hidden once the day has
                    closed, because the banner below is then the true
                    thing to say and a running clock would contradict it. */}
                <span className="block text-[9px] uppercase tracking-[0.18em] text-ink-700">
                  {dayClosed ? 'RANK' : '⟨ TIME REMAINING ⟩'}
                </span>
                {!dayClosed && (
                  <span
                    className={[
                      'font-mono text-[13px] font-bold leading-none tabular-nums',
                      countdown.urgent ? 'glow-text text-state-recover' : 'text-accent-mid',
                    ].join(' ')}
                  >
                    {countdown.formatted}
                  </span>
                )}
              </div>
              {/* The visible "RANK" label gives way to the countdown, so
                  the crest carries the name itself — otherwise the rank
                  is announced as a bare letter, or not at all. */}
              <div
                role="img"
                aria-label={`Rank ${rank}`}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center"
              >
                <svg aria-hidden viewBox="0 0 48 48" className="absolute inset-0 h-full w-full drop-shadow-[0_0_10px_rgba(77,163,255,0.65)]">
                  <polygon points="24,3 45,24 24,45 3,24" fill="rgba(10,20,36,0.85)" stroke="#4da3ff" strokeWidth="1.5" />
                  <polygon points="24,7 41,24 24,41 7,24" fill="none" stroke="rgba(124,196,255,0.4)" strokeWidth="1" />
                  <line x1="24" y1="3" x2="24" y2="8" stroke="#7cc4ff" strokeWidth="2" />
                  <line x1="24" y1="40" x2="24" y2="45" stroke="#7cc4ff" strokeWidth="2" />
                </svg>
                <span aria-hidden className="z-10 font-display text-lg font-bold text-ink-100">{rank}</span>
              </div>
            </div>
          </div>

          {/* Level and XP Meter */}
          <div className="mt-2 flex items-center gap-3">
            <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider text-ink-700">
              LV <span className="font-mono text-xs tabular-nums text-ink-100">{levelState.level}</span>
            </span>
            <MeterBar pct={barPct} testId="xp-bar-fill" label="XP to next level" className="min-w-0 flex-1" />
          </div>

          {streak &&
            (streak.consistency_7 > 0 || streak.consistency_28 > 0 || streak.arc_streak > 0) && (
              <p className="mt-1.5 font-mono text-[11px] tabular-nums text-faint">
                {streak.consistency_7}% (7d) · {streak.consistency_28}% (28d) · streak{' '}
                {streak.arc_streak}
              </p>
            )}
        </div>
      </div>

      {banner && (
        <p
          className="mb-3 pl-3 font-mono text-sm tabular-nums text-ink-300"
          style={{ borderLeft: '2px solid var(--accent)' }}
        >
          LEVEL {String(banner.fromLevel).padStart(2, '0')} → {String(banner.toLevel).padStart(2, '0')}
        </p>
      )}

      {recoverable && (
        <div
          className="cut-sm mb-3 p-3.5"
          data-testid="recovery-card"
          style={{
            borderLeft: '2px solid var(--state-recover)',
            background: 'var(--surface)',
          }}
        >
          <p className="text-sm text-ink-300">
            Yesterday: {recoverable.coreCompleted} of {recoverable.coreTotal}.{' '}
            {recoverable.missedTitles.join(' and ')} incomplete.
          </p>
          <p className="mt-1.5 text-xs text-faint">
            Worth less than what you&rsquo;d have earned — recovering is never better than not
            missing.
          </p>
          <div className="mt-2">
            <SingleChipSelect
              label="What got in the way? (optional)"
              options={RECOVERY_REASONS}
              labelFor={(r) => RECOVERY_REASON_LABELS[r]}
              selected={recoveryReason}
              onSelect={setRecoveryReason}
            />
          </div>
          <button
            type="button"
            disabled={claimingRecovery}
            onClick={() => void handleClaimRecovery()}
            className="cut-sm mt-3 min-h-tap w-full text-sm disabled:opacity-40"
            style={{ border: '1px solid var(--state-recover)', color: 'var(--state-recover)' }}
          >
            Recovery quest · +{CONFIG.recoveryXp} XP
          </button>
        </div>
      )}

      {dayClosed && (
        <p
          className="mb-3 pl-3 text-sm text-ink-500"
          style={{ borderLeft: '2px solid var(--state-recover)' }}
        >
          Day closed. Next day begins at 04:00.
        </p>
      )}

      {/*
        The System's reading of where the Player actually is — design/04.
        Above the quest window on purpose: the System states the condition
        first, then lists the requirements. Reversed, the line becomes a
        footnote on a checklist.
      */}
      {transmission ? (
        <SystemTransmission
          message={transmission.message}
          context={transmission.context}
          fingerprint={transmission.fingerprint}
          systemLine={systemLine}
        />
      ) : (
        <SystemWindow
          key={today}
          arrive
          label={remaining > 0 ? 'DAILY QUEST' : 'DAILY QUEST COMPLETE'}
          className="cut-sm mb-2 p-2"
        >
          {streak?.reduced_mode && (
            <p className="mb-1 pl-2 text-xs leading-relaxed text-state-recover">
              Reduced to the floor for two days. The arc continues.
            </p>
          )}

          <p className="pl-2 text-xs leading-relaxed text-ink-300">
            {priorityLine(templates, instances, today, arc)}
          </p>

          {systemLine && (
            <p
              className="mt-1 line-clamp-2 pl-2 text-xs italic leading-relaxed text-ink-500"
              data-testid="system-line"
            >
              {systemLine}
            </p>
          )}
        </SystemWindow>
      )}

      {transmission && streak?.reduced_mode && (
        <div className="cut-sm mb-2 px-3 py-2 border border-state-recover/40 bg-state-recover/10 text-xs font-semibold text-state-recover">
          Reduced to the floor for two days. The arc continues.
        </div>
      )}

      <div>
        {templates.map((template) => {
          const instance = instances.find((i) => i.template_id === template.id);
          if (!instance) return null;
          return (
            <QuestRow
              key={template.id}
              template={template}
              instance={instance}
              dayClosed={dayClosed}
              xp={dayXp[instance.id]}
              onToggle={() => void handleToggle(instance, template)}
              onOpen={() => setOpenInstanceId(instance.id)}
            />
          );
        })}
      </div>

      {arc && (
        <MaintenanceCard today={today} arcId={arc.id} arcStartDate={arc.start_date} onChanged={() => void refreshXp(today)} />
      )}

      {/* Learning Block Action Card */}
      <button
        type="button"
        onClick={() => setLearningBlockOpen(true)}
        className="cut-sm mt-2 flex min-h-tap w-full items-center justify-between px-3 py-1.5 text-left transition-all duration-150"
        style={{
          border: '1px solid rgba(77, 163, 255, 0.3)',
          background: 'linear-gradient(180deg, rgba(12, 22, 38, 0.75), rgba(7, 13, 24, 0.85))',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-accent/40 bg-accent-deep/40 text-accent-mid shadow-[0_0_8px_rgba(77,163,255,0.3)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-100">
            Foundational Trial
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-accent-mid">
            +{CONFIG.learningBlockXp} XP
          </span>
          <span className="text-ink-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>
      </button>

      {weeklyQuest && (
        <div
          className="cut-sm mt-3 relative overflow-hidden p-3.5"
          data-testid="weekly-quest-progress"
          style={{
            border: '1px solid rgba(77, 163, 255, 0.3)',
            background: 'linear-gradient(180deg, rgba(10, 20, 36, 0.85), rgba(5, 10, 20, 0.95))',
          }}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-16">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] uppercase font-bold tracking-[0.18em] text-ink-700">THIS WEEK</span>
                <span className="font-mono text-xs text-accent-mid">
                  {weeklyQuest.progress}/{weeklyQuest.row.target}
                </span>
              </div>
              <p className="text-xs font-bold text-ink-100 leading-snug">{weeklyQuest.row.description}</p>
              {/* Restored. The HUD pass dropped this line, so a weekly
                  quest could complete and pay out 200 XP with nothing on
                  screen saying it had. A payout the user cannot see is a
                  payout that did not land. */}
              {weeklyQuest.justCompleted && (
                <p className="glow-text mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent-mid">
                  ⟨ COMPLETE ⟩ +{weeklyQuest.row.xp} XP
                </p>
              )}
              <div className="mt-2.5">
                <MeterBar pct={weeklyQuest.row.target > 0 ? (weeklyQuest.progress / weeklyQuest.row.target) * 100 : 0} label="Weekly quest progress" />
              </div>
            </div>
            {/* Side quote overlay text */}
            <div className="absolute right-3 top-3 bottom-3 flex flex-col justify-center text-right border-l border-hair-faint pl-2">
              <span className="text-[8px] uppercase tracking-[0.16em] leading-tight text-ink-700 font-semibold max-w-[50px]">
                SMALL STEPS BIG RESULTS
              </span>
            </div>
          </div>
        </div>
      )}

      {revisitsDue.length > 0 && (
        <div className="mt-3" data-testid="revisits-due">
          <SectionLabel rule className="mb-1">
            Revisit · +{CONFIG.revisitXp} XP each
          </SectionLabel>
          {revisitsDue.map((r) => (
            <div
              key={r.problemId}
              className="flex items-center justify-between gap-3 py-2"
              style={{ borderBottom: '1px solid var(--hair-faint)' }}
            >
              <span className="min-w-0 flex-1 truncate text-sm text-ink-300">{r.title}</span>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={revisitingId === r.problemId}
                  onClick={() => void handleLogRevisit(r.problemId, 'first_attempt')}
                  className="cut-sm min-h-tap px-3 text-xs text-accent disabled:opacity-40"
                  style={{ border: '1px solid var(--accent)' }}
                >
                  Solved
                </button>
                <button
                  type="button"
                  disabled={revisitingId === r.problemId}
                  onClick={() => void handleLogRevisit(r.problemId, 'unsolved')}
                  className="cut-sm min-h-tap px-3 text-xs text-ink-700 disabled:opacity-40"
                  style={{ border: '1px solid var(--hair)' }}
                >
                  Unsolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!reviewed && (
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="cut-sm mt-2 flex min-h-tap w-full items-center justify-between px-4 py-2 transition-all duration-200"
          style={{
            border: '1px solid rgba(192, 132, 252, 0.5)',
            background: 'linear-gradient(180deg, rgba(55, 20, 85, 0.85), rgba(25, 10, 42, 0.95))',
            boxShadow: '0 0 16px rgba(168, 85, 247, 0.25)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-pill bg-[rgba(168,85,247,0.3)] text-purple-200">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-100">
              Evening review · 25 seconds
            </span>
          </div>
          <span className="text-purple-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
      )}

      {notice && (
        <p
          className="cut-sm mt-3 p-3 text-sm text-ink-300"
          role="status"
          style={{ borderLeft: '2px solid var(--state-alert)', background: 'var(--surface)' }}
        >
          {notice}
        </p>
      )}

      {openTemplate && openInstance && (
        <QuestDetailSheet
          template={openTemplate}
          instance={openInstance}
          dayClosed={dayClosed}
          onClose={() => setOpenInstanceId(null)}
          onToggle={() => void handleToggle(openInstance, openTemplate)}
          domainLog={domainLogFor(openTemplate.key, () => setOpenInstanceId(null))}
        />
      )}

      {careerLogOpen && arc && (
        <LogApplicationSheet
          today={today}
          arcId={arc.id}
          onClose={() => {
            setCareerLogOpen(false);
            void refresh();
          }}
        />
      )}

      {dsaLogOpen && arc && (
        <LogProblemSheet
          today={today}
          arcId={arc.id}
          onClose={() => {
            setDsaLogOpen(false);
            void refresh();
          }}
        />
      )}

      {buildLogOpen && arc && (
        <LogBuildSessionSheet
          today={today}
          arcId={arc.id}
          onClose={() => {
            setBuildLogOpen(false);
            void refresh();
          }}
        />
      )}

      {trainingLogOpen && arc && (
        <LogTrainingSheet
          today={today}
          arcId={arc.id}
          onClose={() => {
            setTrainingLogOpen(false);
            void refresh();
          }}
        />
      )}

      {sleepLogOpen && arc && (
        <LogSleepSheet
          today={today}
          arcId={arc.id}
          onClose={() => {
            setSleepLogOpen(false);
            void refresh();
          }}
        />
      )}

      {attentionLogOpen && arc && (
        <LogAttentionSheet
          today={today}
          arcId={arc.id}
          onClose={() => {
            setAttentionLogOpen(false);
            void refresh();
          }}
        />
      )}

      {learningBlockOpen && arc && (
        <LearningBlockSheet
          today={today}
          arcId={arc.id}
          onClose={() => {
            setLearningBlockOpen(false);
            void refresh();
          }}
        />
      )}

      {moment && (
        <LevelUpMoment
          fromLevel={moment.fromLevel}
          toLevel={moment.toLevel}
          unlockText={unlockTextForRange(moment.fromLevel, moment.toLevel)}
          onDismiss={() => setMoment(null)}
        />
      )}

      {/* Queued behind LEVEL UP: when one tap earns both, the level
          plays first and this follows on its dismiss, rather than two
          full-screen overlays stacking. */}
      {dayComplete && !moment && (
        <DayCompleteMoment
          day={day}
          xpToday={dayComplete.xp}
          streakDays={dayComplete.streak}
          coreTotal={dayComplete.total}
          onDismiss={() => setDayComplete(null)}
        />
      )}

      {reviewOpen && arc && (
        <EveningReview
          today={today}
          day={day}
          arcId={arc.id}
          onClose={() => {
            setReviewOpen(false);
            setReviewed(true);
          }}
        />
      )}
      </div>
    </>
  );
}
