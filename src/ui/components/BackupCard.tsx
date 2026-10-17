import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getEngineConfig } from '../../store/engineConfig';
import { realDeps } from '../../store/deps';
import { Panel, SecondaryButton, SectionLabel, TextInput } from '../kit';
import { getBackupStatus, ImportValidationError, type BackupStatus } from '../../store/checkpoint';
import { exportBackup, importBackup } from '../../store/backup';
import { isEncryptedExport, PassphraseRequiredError, WrongPassphraseError } from '../../store/exportCrypto';

const MIN_PASSPHRASE = 8;

// docs/07-data-model.md: "if no export exists in 14 days, the Profile
// screen says so in red." The one place --state-alert red is allowed
// outside an error state — everywhere else in this app red is reserved
// for genuine errors/destructive confirmations, never for "you haven't
// done X yet."
const RED_THRESHOLD_DAYS = 14;

function backupStatusLabel(status: BackupStatus): string {
  if (status.lastExportAt === null) {
    return status.daysSince === 0 ? 'Never backed up yet.' : `Never backed up — arc started ${status.daysSince} days ago.`;
  }
  if (status.daysSince === 0) return 'Last backup: today.';
  if (status.daysSince === 1) return 'Last backup: yesterday.';
  return `Last backup: ${status.daysSince} days ago.`;
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

/** final/07 §6 / final/06's Profile "data safety" row — a real,
 * anytime backup, separate from the checkpoint screen's export-before-
 * seal gate (that one also marks a specific checkpoint as exported;
 * this is just "back up right now"). Import is destructive — it
 * replaces the entire local database — so it's a two-step flow: pick a
 * file, read and see a confirmation naming what's about to happen,
 * confirm or cancel. Nothing is written before that second tap. */
interface BackupCardProps {
  /** Called after a successful export — lets the caller refresh the
   * "Last backup: N days ago" line elsewhere on the same screen. */
  onExported?: () => void;
}

export function BackupCard({ onExported }: BackupCardProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ fileName: string; json: string; eventCount: number; encrypted: boolean } | null>(null);
  // Optional protection of the file: a passphrase typed twice (a typo would make the backup unopenable), and the one asked for on import.
  const [passphrase, setPassphrase] = useState('');
  const [passphraseAgain, setPassphraseAgain] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [status, setStatus] = useState<BackupStatus | null>(null);

  async function refreshStatus() {
    setStatus(await getBackupStatus(realDeps));
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function handleExport() {
    setError(null);
    if (passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE) {
      setError(`Use at least ${MIN_PASSPHRASE} characters, or leave the passphrase empty.`);
      return;
    }
    if (passphrase !== passphraseAgain) {
      setError('The two passphrases are not the same.');
      return;
    }
    setExporting(true);
    try {
      const json = await exportBackup(realDeps, passphrase || undefined);
      triggerDownload(`system-backup-${new Date().toISOString().slice(0, 10)}${passphrase ? '.enc' : ''}.json`, json);
      setDone(passphrase ? 'Exported, encrypted.' : 'Exported.');
      setPassphrase('');
      setPassphraseAgain('');
      await refreshStatus();
      onExported?.();
      setTimeout(() => setDone(null), 3000);
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setError(null);
    const json = await file.text();
    try {
      if (isEncryptedExport(json)) {
        setImportPassphrase('');
        setPendingImport({ fileName: file.name, json, eventCount: 0, encrypted: true });
        return;
      }
      const parsed = JSON.parse(json) as { events?: unknown[] };
      const eventCount = Array.isArray(parsed.events) ? parsed.events.length : 0;
      setPendingImport({ fileName: file.name, json, eventCount, encrypted: false });
    } catch {
      setError('That file is not valid JSON.');
    }
  }

  async function handleConfirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    setError(null);
    try {
      await importBackup(pendingImport.json, importPassphrase || undefined, getEngineConfig(), realDeps);
      setPendingImport(null);
      setDone('Imported. Reloading…');
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setError(e instanceof ImportValidationError || e instanceof WrongPassphraseError || e instanceof PassphraseRequiredError ? e.message : 'Could not import — try again.');
    } finally {
      setImporting(false);
    }
  }

  return (
    // The testid lives on a wrapper rather than on Panel, which draws
    // its border as two nested elements and takes no passthrough props.
    <div className="mt-4" data-testid="backup-card">
      <Panel cut="md" bodyClassName="px-4 py-4">
        <SectionLabel className="mb-2">Data safety</SectionLabel>

        {status && (
          <p
            className={`text-xs ${status.daysSince >= RED_THRESHOLD_DAYS ? 'text-state-alert' : 'text-faint'}`}
            data-testid="backup-status"
          >
            {backupStatusLabel(status)}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <SecondaryButton disabled={exporting} onClick={() => void handleExport()}>
            {exporting ? 'Exporting…' : 'Export backup'}
          </SecondaryButton>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            data-testid="backup-import-input"
            onChange={(e) => void handleFileSelected(e)}
          />
          <SecondaryButton onClick={() => fileInputRef.current?.click()}>Import backup</SecondaryButton>
        </div>

        <details className="mt-4" data-testid="backup-protect">
          <summary className="min-h-tap cursor-pointer text-xs uppercase tracking-[0.14em] text-ink-700">Protect the next export with a passphrase</summary>
          <p className="mt-2 text-xs leading-[1.5] text-faint">Optional. The file is encrypted on this device before it is saved. If you lose the passphrase the backup cannot be opened: there is no recovery.</p>
          <div className="mt-3 flex flex-col gap-2">
            <TextInput type="password" autoComplete="new-password" placeholder="Passphrase" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} data-testid="backup-passphrase" />
            <TextInput type="password" autoComplete="new-password" placeholder="Passphrase again" value={passphraseAgain} onChange={(event) => setPassphraseAgain(event.target.value)} data-testid="backup-passphrase-again" />
          </div>
        </details>

        {done && <p className="mt-3 text-xs text-accent-mid">{done}</p>}
        {error && <p className="mt-3 text-xs text-state-alert">{error}</p>}

        {pendingImport && (
          // --state-alert is reserved for exactly this: an action that
          // destroys data. Import replaces the entire local database, so
          // the confirmation is allowed to look like a warning.
          <div
            className="cut-sm mt-4 p-4"
            data-testid="import-confirm"
            style={{ border: '1px solid var(--state-alert)', background: 'var(--surface-2)' }}
          >
            <p className="text-sm leading-[1.5] text-ink-100">
              Replace ALL current data with &ldquo;{pendingImport.fileName}&rdquo; (
              {pendingImport.encrypted ? 'encrypted' : `${pendingImport.eventCount} events`})?
            </p>
            {pendingImport.encrypted && (
              <div className="mt-3">
                <TextInput type="password" autoComplete="off" placeholder="Passphrase" value={importPassphrase} onChange={(event) => setImportPassphrase(event.target.value)} data-testid="import-passphrase" />
              </div>
            )}
            <p className="mt-2 text-xs text-ink-700">
              This cannot be undone unless you have another backup.
            </p>
            <div className="mt-4 flex gap-2">
              <SecondaryButton onClick={() => setPendingImport(null)} className="flex-1">
                Cancel
              </SecondaryButton>
              <button
                type="button"
                disabled={importing}
                onClick={() => void handleConfirmImport()}
                className="cut-md flex-1 px-4 text-xs font-medium uppercase tracking-button text-ink-100 disabled:opacity-40"
                style={{ minHeight: 46, background: 'var(--state-alert)' }}
              >
                {importing ? 'Importing…' : 'Replace and import'}
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
