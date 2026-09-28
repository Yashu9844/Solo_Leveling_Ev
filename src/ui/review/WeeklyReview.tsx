import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { getWeeklyReview, recordWeekReviewed, type WeeklyReviewReport } from '../../store/weeklyReview';
import { acceptWeeklyQuest } from '../../store/weeklyQuest';
import { exportSnapshotJson, getBackupStatus, type BackupStatus } from '../../store/checkpoint';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';
import type { Attribute } from '../../engine/types';
import { ArtLayer, Panel, Portal, PrimaryButton, SecondaryButton, SectionLabel } from '../kit';

function triggerDownload(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** docs/07-data-model.md: "prompts for an export every Sunday at the
 * weekly review." `today` is a plain YYYY-MM-DD; parsed as UTC midnight
 * so the day-of-week doesn't shift with the viewer's own timezone. */
function isSunday(today: string): boolean {
  return new Date(`${today}T00:00:00Z`).getUTCDay() === 0;
}

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  DISCIPLINE: 'Discipline',
  DEPTH: 'Depth',
  PROBLEM_SOLVING: 'Problem solving',
  ENGINEERING: 'Engineering',
  MOMENTUM: 'Momentum',
  VITALITY: 'Vitality',
};

interface WeeklyReviewProps {
  today: string;
  onClose: () => void;
}

/**
 * Week-over-week movement.
 *
 * The arrow carries the direction and the colour only reinforces it, so
 * the delta still reads with the colour removed (final/06 §7). Down is
 * amber, never red: a quieter week is information, not a failure, and
 * this app reserves red for data loss.
 */
function Delta({ current, previous, suffix = '' }: { current: number; previous: number; suffix?: string }) {
  const diff = current - previous;
  if (diff === 0) return null;
  const up = diff > 0;
  return (
    <span
      className="ml-2 text-xxs tabular-nums"
      style={{ color: up ? 'var(--dawn-bright)' : 'var(--ink-700)' }}
    >
      {up ? '▲' : '▼'} {Math.abs(Math.round(diff))}
      {suffix}
    </span>
  );
}

/** final/05 §6 — 3 minutes, ends in decisions. Every number here,
 * including the resume-content nudge and the sleep/DSA correlational
 * insight, is real and computed (store/weeklyReview.ts). */
export function WeeklyReview({ today, onClose }: WeeklyReviewProps) {
  const [report, setReport] = useState<WeeklyReviewReport | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [arcId, setArcId] = useState<string | null>(null);
  const [weeklyQuestAccepted, setWeeklyQuestAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getWeeklyReview(today, DEFAULT_CONFIG, realDeps).then((r) => {
      if (!cancelled) setReport(r);
    });
    void getBackupStatus(realDeps).then((s) => {
      if (!cancelled) setBackupStatus(s);
    });
    void db.arc.toCollection().first().then((arc) => {
      if (!cancelled) setArcId(arc?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [today]);

  async function handleExport() {
    setExporting(true);
    try {
      const json = await exportSnapshotJson(realDeps);
      triggerDownload(`solo-leveling-backup-${today}.json`, json);
      setBackupStatus(await getBackupStatus(realDeps));
      setExported(true);
    } finally {
      setExporting(false);
    }
  }

  async function handleAcceptWeeklyQuest() {
    if (!report?.weeklyQuestProposal) return;
    const accepted = await acceptWeeklyQuest(today, report.weeklyQuestProposal, realDeps);
    if (accepted) setWeeklyQuestAccepted(true);
  }

  async function handleAccept() {
    if (arcId) {
      const proposal = weeklyQuestAccepted ? report?.weeklyQuestProposal : undefined;
      await recordWeekReviewed(
        today,
        arcId,
        proposal ? { kind: proposal.kind, description: proposal.description, target: proposal.target, topic: proposal.topic } : undefined,
        realDeps
      );
    }
    onClose();
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[55] flex flex-col overflow-y-auto"
        style={{ background: 'var(--void)' }}
        data-testid="weekly-review"
      >
        <div
          className="flex items-center justify-between px-gutter pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <h1 className="text-h1 text-accent-mid">SYSTEM EVALUATION</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 min-h-tap min-w-[44px] text-ink-500"
          >
            ✕
          </button>
        </div>

        {!report ? (
          <p className="px-gutter text-sm text-ink-500">Loading…</p>
        ) : (
          <div className="pb-10">
            {/* Distance travelled — the only Gold block on a Blue screen.
                Everything else here is this week's effort; these two
                numbers are the comparison against last week, which is
                the closest a weekly review comes to evidence. */}
            <div className="relative mt-1 h-[150px] overflow-hidden">
              <ArtLayer slot="review-weekly" scrim="band" focal="50% 38%" />
              <div className="absolute inset-x-0 bottom-0 flex items-end gap-8 px-gutter pb-4">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-lg leading-none tabular-nums text-ink-100">
                    <span className="glow-text">{report.thisWeek.xpEarned.toLocaleString()}</span>
                    <Delta current={report.thisWeek.xpEarned} previous={report.lastWeek.xpEarned} />
                  </span>
                  <span className="text-xxs uppercase text-ink-700">XP this week</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-lg leading-none tabular-nums text-ink-100">
                    <span className="glow-text">
                      {Math.round(report.thisWeek.deepWorkMinutes / 60)}h{' '}
                      {report.thisWeek.deepWorkMinutes % 60}m
                    </span>
                    <Delta
                      current={report.thisWeek.deepWorkMinutes}
                      previous={report.lastWeek.deepWorkMinutes}
                      suffix="m"
                    />
                  </span>
                  <span className="text-xxs uppercase text-ink-700">Deep work</span>
                </div>
              </div>
            </div>

            <div className="px-gutter">
              <SectionLabel rule className="mb-1 mt-6">
                The week
              </SectionLabel>
              <Row label="Career">
                {report.thisWeek.applications} applications ({report.thisWeek.qualityApplications} quality)
              </Row>
              <Row label="DSA">{report.thisWeek.problems} problems</Row>
              <Row label="Build">{report.thisWeek.buildSessions} sessions</Row>
              <Row label="Learn">{report.thisWeek.learnBlocks} blocks</Row>
              <Row label="Training">
                {report.thisWeek.trainingSessions} sessions · steps {Math.round(report.thisWeek.meanSteps).toLocaleString()}/day
              </Row>

              {(report.review.improved.length > 0 ||
                report.review.declined.length > 0 ||
                report.review.bottleneck) && (
                <div className="mt-6 flex flex-col gap-2 text-xs leading-[1.5]">
                  {report.review.improved.length > 0 && (
                    <p className="text-ink-500">
                      <span className="text-ink-700">IMPROVED </span>
                      {report.review.improved.map((a) => ATTRIBUTE_LABELS[a]).join(' · ')}
                    </p>
                  )}
                  {report.review.declined.length > 0 && (
                    <p className="text-ink-500">
                      <span className="text-ink-700">DECLINED </span>
                      {report.review.declined.map((a) => ATTRIBUTE_LABELS[a]).join(' · ')}
                    </p>
                  )}
                  {report.review.bottleneck && (
                    <p className="text-accent-mid">
                      BOTTLENECK {ATTRIBUTE_LABELS[report.review.bottleneck]}
                    </p>
                  )}
                </div>
              )}

              {report.sleepDsaCorrelation && report.sleepDsaCorrelation.deltaPoints > 0 && (
                <Panel cut="sm" className="mt-6" bodyClassName="px-4 py-4">
                  <p className="text-xs leading-[1.55] text-ink-500" data-testid="sleep-dsa-insight">
                    {report.sleepDsaCorrelation.missedNights} missed wake window
                    {report.sleepDsaCorrelation.missedNights === 1 ? '' : 's'} this week. Your DSA
                    first-attempt rate the day after a missed window is{' '}
                    {report.sleepDsaCorrelation.deltaPoints} points lower than after an on-time one.
                  </p>
                </Panel>
              )}

              {(report.review.proposals.length > 0 || report.resumeNudge) && (
                <>
                  <SectionLabel rule className="mb-2 mt-6">
                    Next week — proposed
                  </SectionLabel>
                  <div className="flex flex-col gap-2">
                    {report.review.proposals.map((p) => (
                      <p key={p.rule} className="text-xs leading-[1.5] text-ink-500">
                        <span className="text-accent-mid">→ </span>
                        {p.message}
                      </p>
                    ))}
                    {report.resumeNudge && (
                      <p className="text-xs leading-[1.5] text-ink-500" data-testid="resume-nudge">
                        <span className="text-accent-mid">→ </span>
                        {report.resumeNudge}
                      </p>
                    )}
                  </div>
                </>
              )}

              {report.activeWeeklyQuest && (
                <div data-testid="weekly-quest-active">
                  <SectionLabel rule className="mb-2 mt-6">
                    Weekly quest
                  </SectionLabel>
                  <Panel cut="md" bodyClassName="px-4 py-4">
                    <p className="text-sm leading-[1.5] text-ink-300">
                      {report.activeWeeklyQuest.row.description}
                    </p>
                    <p className="mt-2 font-mono text-xs tabular-nums text-ink-700">
                      {report.activeWeeklyQuest.progress}/{report.activeWeeklyQuest.row.target}
                      {report.activeWeeklyQuest.justCompleted ? ` — complete! +${report.activeWeeklyQuest.row.xp} XP` : ''}
                    </p>
                  </Panel>
                </div>
              )}

              {!report.activeWeeklyQuest && report.weeklyQuestProposal && (
                <div data-testid="weekly-quest-proposal">
                  <SectionLabel rule className="mb-2 mt-6">
                    Weekly quest — proposed
                  </SectionLabel>
                  <Panel cut="md" bodyClassName="px-4 py-4">
                    <p className="text-sm leading-[1.5] text-ink-300">
                      {report.weeklyQuestProposal.description}
                    </p>
                    {weeklyQuestAccepted ? (
                      <p className="glow-text mt-3 text-xs text-accent-mid">Accepted.</p>
                    ) : (
                      <div className="mt-4">
                        <SecondaryButton onClick={() => void handleAcceptWeeklyQuest()}>
                          Accept weekly quest · +{DEFAULT_CONFIG.weeklyQuestXp} XP
                        </SecondaryButton>
                      </div>
                    )}
                  </Panel>
                </div>
              )}

              {backupStatus && (
                <div data-testid="weekly-review-backup">
                  <SectionLabel rule className="mb-2 mt-6">
                    Data safety
                  </SectionLabel>
                  <p className="text-xs text-faint">
                    {isSunday(today) ? 'Sunday backup — ' : ''}
                    {backupStatus.lastExportAt === null
                      ? `never backed up (arc started ${backupStatus.daysSince}d ago)`
                      : backupStatus.daysSince === 0
                        ? 'backed up today'
                        : `last backup ${backupStatus.daysSince}d ago`}
                  </p>
                  <div className="mt-3">
                    <SecondaryButton disabled={exporting} onClick={() => void handleExport()}>
                      {exporting ? 'Exporting…' : exported ? 'Exported ✓ — export again' : 'Export backup'}
                    </SecondaryButton>
                  </div>
                </div>
              )}

              <div className="mt-8">
                <PrimaryButton onClick={() => void handleAccept()}>Accept</PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </Portal>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="flex items-baseline gap-4 py-2.5"
      style={{ borderBottom: '1px solid var(--hair-faint)' }}
    >
      <span className="shrink-0 text-sm text-ink-700">{label}</span>
      <span className="min-w-0 flex-1 text-right font-mono text-xs tabular-nums text-ink-300">
        {children}
      </span>
    </div>
  );
}
