import { useRef, useState, type ChangeEvent } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { db } from '../../db/db';
import { parseDailyLog, parseDsaLog, type DailyLogEntry, type DsaLogEntry } from '../../engine/paperImport';
import { importDailyLog, importDsaLog, type ImportSummary } from '../../store/paperImport';
import { Panel, PrimaryButton, SecondaryButton, SectionLabel } from '../kit';

type Pending =
  | { kind: 'daily'; fileName: string; entries: DailyLogEntry[]; errors: string[] }
  | { kind: 'dsa'; fileName: string; entries: DsaLogEntry[]; errors: string[] };

/** docs/13-day0-baseline.md's paper protocol, Part 2 — the bridge for
 * days tracked on paper before the app existed (final/07 §6: "a V1
 * requirement, not a nice-to-have"). Covers the two tables that map
 * cleanly to real events; the weekly summary and evidence-log tables
 * are deliberately not imported — see store/paperImport.ts's file
 * header for why. Parsing happens immediately on file selection (all
 * client-side); nothing is written until the explicit Import tap, and
 * every row-level error is shown before that tap so a malformed file
 * doesn't fail silently. */
export function PaperImportCard() {
  const dailyInputRef = useRef<HTMLInputElement>(null);
  const dsaInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleDailyFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSummary(null);
    const text = await file.text();
    const { entries, errors } = parseDailyLog(text);
    setPending({ kind: 'daily', fileName: file.name, entries, errors });
  }

  async function handleDsaFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSummary(null);
    const text = await file.text();
    const { entries, errors } = parseDsaLog(text);
    setPending({ kind: 'dsa', fileName: file.name, entries, errors });
  }

  async function handleImport() {
    if (!pending) return;
    const arc = await db.arc.toCollection().first();
    if (!arc) return;
    setImporting(true);
    try {
      if (pending.kind === 'daily') {
        const result: ImportSummary = await importDailyLog(pending.entries, arc.id, DEFAULT_CONFIG, realDeps);
        const parts = [`${result.daysImported} days imported`, `${result.questsCompleted} quests completed`];
        if (result.skippedDayClosed > 0) parts.push(`${result.skippedDayClosed} skipped (day closed right now — try again outside 03:00-04:00)`);
        setSummary(parts.join(', ') + '.');
      } else {
        const count = await importDsaLog(pending.entries, arc.id, DEFAULT_CONFIG, realDeps);
        setSummary(`${count} problems imported.`);
      }
      setPending(null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-4" data-testid="paper-import-card">
      <Panel cut="md" bodyClassName="px-4 py-4">
        <SectionLabel className="mb-2">Paper log import</SectionLabel>
        <p className="text-xs leading-[1.5] text-faint">
          For days tracked on paper before this app existed.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <input
            ref={dailyInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            data-testid="paper-import-daily-input"
            onChange={(e) => void handleDailyFile(e)}
          />
          <SecondaryButton onClick={() => dailyInputRef.current?.click()}>
            Import daily log CSV
          </SecondaryButton>

          <input
            ref={dsaInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            data-testid="paper-import-dsa-input"
            onChange={(e) => void handleDsaFile(e)}
          />
          <SecondaryButton onClick={() => dsaInputRef.current?.click()}>
            Import DSA log CSV
          </SecondaryButton>
        </div>

        {summary && <p className="mt-3 text-xs text-accent-mid">{summary}</p>}

        {pending && (
          <div
            className="cut-sm mt-4 p-4"
            data-testid="paper-import-preview"
            style={{ border: '1px solid var(--hair)', background: 'var(--surface-2)' }}
          >
            <p className="text-sm leading-[1.5] text-ink-100">
              &ldquo;{pending.fileName}&rdquo; — {pending.entries.length}{' '}
              {pending.kind === 'daily' ? 'days' : 'problems'} parsed
              {pending.errors.length > 0 ? `, ${pending.errors.length} rows skipped` : ''}.
            </p>
            {pending.errors.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-xs text-state-alert">
                {pending.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {pending.errors.length > 10 && <li>...and {pending.errors.length - 10} more</li>}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <SecondaryButton onClick={() => setPending(null)} className="flex-1">
                Cancel
              </SecondaryButton>
              <PrimaryButton
                size="md"
                disabled={importing || pending.entries.length === 0}
                onClick={() => void handleImport()}
                className="flex-1"
              >
                {importing ? 'Importing…' : `Import ${pending.entries.length}`}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
