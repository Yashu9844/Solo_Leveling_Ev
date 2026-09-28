import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { verifyIntegrity, type IntegrityReport } from '../../db/projections';
import { BackupCard } from '../components/BackupCard';
import { PaperImportCard } from '../components/PaperImportCard';
import { ScreenHeader, SettingsGroup, SettingsList, SettingsRow } from '../kit';

/**
 * Everything about the record itself — backing it up, bringing older
 * days in, and checking that the projections still match the log.
 *
 * These cards used to sit at the bottom of Profile, where they competed
 * with the arc. Profile answers "who am I in this system"; this screen
 * answers "is my data safe", and those are different questions asked at
 * different moments.
 */
export function DataScreen() {
  const navigate = useNavigate();

  return (
    <>
      <ScreenHeader title="DATA" onBack={() => navigate('/profile/settings')} />
      <div className="px-gutter pb-8" data-testid="data-screen">
        <BackupCard />
        <PaperImportCard />
        <StorageGroup />
        <IntegrityGroup />
      </div>
    </>
  );
}

/**
 * How much room the record takes.
 *
 * `navigator.storage.estimate()` is not available everywhere and its
 * numbers are approximate by specification, so the row simply does not
 * appear rather than printing a confident wrong figure.
 */
function StorageGroup() {
  const [used, setUsed] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.storage?.estimate) return;
    void navigator.storage
      .estimate()
      .then((e) => {
        if (cancelled || e.usage === undefined || e.quota === undefined) return;
        setUsed({ usage: e.usage, quota: e.quota });
      })
      .catch(() => {
        /* a browser that refuses to answer is not an error worth showing */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!used) return null;

  return (
    <SettingsGroup title="Storage">
      <SettingsRow
        label="Used on this device"
        description="Approximate — the browser reports a rounded figure on purpose."
        value={
          <span className="font-mono tabular-nums">
            {formatBytes(used.usage)} / {formatBytes(used.quota)}
          </span>
        }
      />
    </SettingsGroup>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * The integrity check, promoted out of the dev-only block it used to
 * live in on Profile.
 *
 * It belongs to the user, not to me: this app's entire claim is that
 * four months of evidence survive, and being able to ask "does the
 * rebuild still match what is stored" is part of that claim. It writes
 * nothing — it rebuilds in memory and diffs.
 */
function IntegrityGroup() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [running, setRunning] = useState(false);

  async function handleVerify() {
    setRunning(true);
    try {
      setReport(await verifyIntegrity(DEFAULT_CONFIG, realDeps));
    } finally {
      setRunning(false);
    }
  }

  return (
    <SettingsGroup
      title="Integrity"
      footnote="Rebuilds every projection from the event log in memory and compares it against what is stored. Nothing is written."
    >
      <SettingsList>
        <SettingsRow
          label={running ? 'Verifying…' : 'Verify integrity'}
          chevron={false}
          disabled={running}
          onClick={() => void handleVerify()}
          testId="verify-integrity-row"
        />
        {report ? (
          <div className="px-4 py-3" data-testid="integrity-report">
            {report.clean ? (
              <p className="text-xs text-accent-mid">
                Clean — the rebuild matches the live tables exactly.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-xs text-state-alert">
                {report.discrepancies.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </SettingsList>
    </SettingsGroup>
  );
}
