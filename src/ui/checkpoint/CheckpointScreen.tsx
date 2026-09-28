import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { verdictTextFor, type Checkpoint, type ComparisonRow, type GateCondition } from '../../engine/rank';
import {
  getCheckpointReport,
  getCheckpointComparison,
  exportSnapshotJson,
  markExported,
  sealCheckpoint,
  getCurrentRank,
  type CheckpointReport,
} from '../../store/checkpoint';
import { realDeps } from '../../store/deps';
import { RankAdvancedMoment } from '../moments/RankAdvancedMoment';
import { CheckpointMoment } from '../moments/CheckpointMoment';
import { CheckpointInstrumentsCard } from '../components/CheckpointInstrumentsCard';
import { ArtLayer, FramedPanel, Portal, PrimaryButton, SecondaryButton, SectionLabel } from '../kit';

interface CheckpointScreenProps {
  day: Checkpoint['day'];
  today: string;
  onClose: () => void;
}

function triggerDownload(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** final/06 §5's checkpoint screen and final/01 §4.3's "most important
 * sentence" — the ✓/✗ gate checklist, real evidence, the export gate,
 * sealing, and the verdict text. Body metrics have their own standalone
 * entry point (ui/components/BodyMetricsCard.tsx, on Profile — not tied
 * to a specific checkpoint day, since a weight/waist/1RM reading isn't
 * inherently a checkpoint-day event). Self-efficacy/automaticity/
 * enjoyment ARE tied to specific checkpoint days (docs/04 §5.2-5.3) and
 * render below via CheckpointInstrumentsCard. */
export function CheckpointScreen({ day, today, onClose }: CheckpointScreenProps) {
  const [report, setReport] = useState<CheckpointReport | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  interface PendingCheckpointMoment {
    rows: ComparisonRow[];
    conditions: GateCondition[];
    verdictText: string;
  }
  const [rankAdvance, setRankAdvance] = useState<{ from: string; to: string; next: PendingCheckpointMoment | null } | null>(null);
  const [checkpointMoment, setCheckpointMoment] = useState<
    (PendingCheckpointMoment & { rankBefore: string; rankAfter: string }) | null
  >(null);

  async function refresh() {
    setReport(await getCheckpointReport(day, today, DEFAULT_CONFIG));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, today]);

  async function handleExport() {
    setExporting(true);
    try {
      const json = await exportSnapshotJson(realDeps);
      triggerDownload(`solo-leveling-export-day-${day}.json`, json);
      await markExported(day, realDeps);
      await refresh();
    } finally {
      setExporting(false);
    }
  }

  async function handleSeal() {
    setSealing(true);
    setError(null);
    try {
      const rankBefore = await getCurrentRank();
      const result = await sealCheckpoint(day, today, DEFAULT_CONFIG, realDeps);
      const rankAdvanced = result.rank === result.targetRank && result.rank !== rankBefore;
      const comparison = await getCheckpointComparison(day, today, DEFAULT_CONFIG);
      const pending: PendingCheckpointMoment | null = comparison.improved
        ? { rows: comparison.rows, conditions: result.conditions, verdictText: verdictTextFor(result) }
        : null;

      // Both are real, distinct Moments (final/05 §2.1's own weights:
      // RANK ADVANCED full-screen 1100ms, CHECKPOINT a self-paced
      // sequence) — when a seal earns both, RANK ADVANCED plays first and
      // CHECKPOINT follows on its dismiss, rather than stacking overlays.
      if (rankAdvanced) {
        setRankAdvance({ from: rankBefore, to: result.rank, next: pending });
      } else if (pending) {
        setCheckpointMoment({ rankBefore, rankAfter: result.rank, ...pending });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not seal.');
    } finally {
      setSealing(false);
    }
  }

  if (!report) return null;
  const sealed = report.checkpoint?.sealed_at !== undefined;
  const exported = report.checkpoint?.export_verified === true;

  return (
    // Portalled for the same reason every other full-screen surface is:
    // route content sits under a CSS animation, which makes a stacking
    // context that position:fixed cannot escape.
    <Portal>
      <div
        className="fixed inset-0 z-[55] flex flex-col overflow-y-auto"
        style={{ background: 'var(--void)' }}
        data-testid="checkpoint-screen"
      >
        {/* Gold Horizon. This is the screen that says something in the
            real world changed — design/00 §2.2 reserves the dawn palette
            for exactly that, and the checkpoint plate is its home. */}
        <div className="relative h-[220px] shrink-0 overflow-hidden">
          <ArtLayer slot="checkpoint" scrim="hero" focal="50% 30%" priority />
          <div
            className="absolute inset-x-0 top-0 flex justify-end p-2"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="min-h-tap min-w-[44px] text-ink-500"
            >
              ✕
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-gutter pb-5">
            <SectionLabel className="mb-2">Checkpoint</SectionLabel>
            <h1 className="glow-text font-display text-h1 leading-none text-dawn-core">
              DAY {day}
            </h1>
          </div>
        </div>

        <div className="px-gutter pb-10">
          {/* The verdict is the sentence the whole screen exists to
              deliver, so it gets the frame — in dawn, because a rank is
              evidence rather than effort (final/01 §4). */}
          <FramedPanel tone="dawn" className="mt-5 px-4 py-4">
            <p
              className="font-display text-[calc(17px*var(--type-scale))] leading-[1.45] text-ink-100"
              data-testid="checkpoint-verdict"
            >
              {report.verdictText}
            </p>
          </FramedPanel>

          <SectionLabel rule className="mb-2 mt-6">
            The gate
          </SectionLabel>
          <ul className="flex flex-col">
            {report.result.conditions.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-3 py-2.5"
                style={{ borderBottom: '1px solid var(--hair-faint)' }}
              >
                {/* Shape first, colour second (final/06 §7): a met
                    condition is a filled square with a tick, an unmet one
                    is a hollow square with a cross. Either reading works
                    on its own. */}
                <span
                  aria-hidden
                  className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[11px] leading-none"
                  style={{
                    background: c.met ? 'var(--dawn)' : 'transparent',
                    border: `1px solid ${c.met ? 'var(--dawn)' : 'var(--hair)'}`,
                    color: c.met ? 'var(--void)' : 'var(--ink-500)',
                  }}
                >
                  {c.met ? '✓' : '✗'}
                </span>
                <span
                  className={`text-sm leading-[1.45] ${c.met ? 'text-ink-300' : 'text-ink-700'}`}
                >
                  {c.label}
                </span>
              </li>
            ))}
          </ul>

          {error && <p className="mt-4 text-xs text-state-alert">{error}</p>}

          {/* docs/04 §5.2-5.3 — self-efficacy/automaticity/enjoyment are
              administered at Day 0/30/60/90/120, not Day 14.
              Supplementary self-report, not part of the gate — shown
              regardless of sealed state. */}
          {day !== 14 && (
            <CheckpointInstrumentsCard day={day} label={`Record Day ${day} instruments`} />
          )}

          {sealed ? (
            <p className="glow-text mt-6 text-sm text-dawn-bright">
              Sealed. Rank {report.checkpoint?.rank_after}.
            </p>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              {!exported && (
                <p className="mb-1 text-xs text-ink-700">
                  Export required to seal — a rank you cannot prove later is not evidence.
                </p>
              )}
              <SecondaryButton disabled={exporting} onClick={() => void handleExport()}>
                {exporting ? 'Exporting…' : exported ? 'Export again' : 'Export'}
              </SecondaryButton>
              <PrimaryButton
                tone="dawn"
                disabled={!exported || sealing}
                onClick={() => void handleSeal()}
              >
                {sealing ? 'Sealing…' : 'Seal checkpoint'}
              </PrimaryButton>
            </div>
          )}
        </div>

        {rankAdvance && (
          <RankAdvancedMoment
            fromRank={rankAdvance.from}
            toRank={rankAdvance.to}
            onDismiss={() => {
              const next = rankAdvance.next;
              setRankAdvance(null);
              if (next) setCheckpointMoment({ rankBefore: rankAdvance.from, rankAfter: rankAdvance.to, ...next });
            }}
          />
        )}

        {checkpointMoment && (
          <CheckpointMoment
            day={day}
            rankBefore={checkpointMoment.rankBefore}
            rankAfter={checkpointMoment.rankAfter}
            rows={checkpointMoment.rows}
            conditions={checkpointMoment.conditions}
            verdictText={checkpointMoment.verdictText}
            onDismiss={() => setCheckpointMoment(null)}
          />
        )}
      </div>
    </Portal>
  );
}
