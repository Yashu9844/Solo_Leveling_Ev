import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { arcDay } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { resetArc } from '../../store/onboarding';
import { useArcStatus } from '../../store/ArcStatusContext';
import { db } from '../../db/db';
import { ScreenHeader, SettingsGroup, SettingsList, SettingsRow } from '../kit';

interface ArcFacts {
  startDate: string;
  endDate: string;
  day: number;
  timezone: string;
}

/**
 * Version, the arc's own dates, and the one genuinely destructive
 * action in the app.
 *
 * Reset is isolated in its own group at the bottom in --state-alert and
 * double-confirms (design/03 §4). It is not hidden — someone who wants
 * to start over should be able to — but it is the last thing on the
 * last screen, and it says exactly what it destroys before it does it.
 */
export function AboutScreen() {
  const navigate = useNavigate();
  const { markArcReset } = useArcStatus();
  const [facts, setFacts] = useState<ArcFacts | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void db.arc
      .toCollection()
      .first()
      .then((arc) => {
        if (cancelled || !arc) return;
        setFacts({
          startDate: arc.start_date,
          endDate: arc.end_date,
          day: arcDay(realDeps.now(), arc.start_date, arc.timezone, arc.day_boundary_hour),
          timezone: arc.timezone,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleReset() {
    setResetting(true);
    await resetArc();
    markArcReset();
    navigate('/onboarding', { replace: true });
  }

  return (
    <>
      <ScreenHeader title="ABOUT" onBack={() => navigate('/profile/settings')} />
      <div className="px-gutter pb-8" data-testid="about-screen">
        <SettingsGroup title="This build">
          <SettingsList>
            <SettingsRow label="Version" value={<Mono>{__APP_VERSION__}</Mono>} />
            <SettingsRow label="Storage" value={<Mono>on this device only</Mono>} />
          </SettingsList>
        </SettingsGroup>

        {facts && (
          <SettingsGroup title="This arc">
            <SettingsList>
              <SettingsRow label="Started" value={<Mono>{facts.startDate}</Mono>} />
              <SettingsRow label="Ends" value={<Mono>{facts.endDate}</Mono>} />
              <SettingsRow label="Day" value={<Mono>{facts.day} / 120</Mono>} />
              <SettingsRow label="Time zone" value={<Mono>{facts.timezone}</Mono>} />
            </SettingsList>
          </SettingsGroup>
        )}

        <SettingsGroup
          title="Danger"
          tone="alert"
          footnote="Export a backup first if there is any chance you want this arc back. Nothing else in the app can undo it."
        >
          {!confirming ? (
            <SettingsRow
              label="Reset arc"
              description="Deletes every event, every projection, and the arc itself."
              tone="alert"
              onClick={() => setConfirming(true)}
              testId="reset-arc-row"
            />
          ) : (
            <div className="px-4 py-4">
              <p className="text-sm leading-[1.5] text-ink-100">
                Delete this arc and everything logged in it?
              </p>
              <p className="mt-2 text-xs leading-[1.5] text-faint">
                {facts
                  ? `${facts.day} days of record, starting ${facts.startDate}.`
                  : 'Every event and projection.'}{' '}
                This cannot be undone.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="cut-sm flex-1 px-4 text-xs font-medium uppercase tracking-button text-ink-500"
                  style={{ minHeight: 46, border: '1px solid var(--hair)' }}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={resetting}
                  onClick={() => void handleReset()}
                  className="cut-sm flex-1 px-4 text-xs font-medium uppercase tracking-button text-ink-100 disabled:opacity-40"
                  style={{ minHeight: 46, background: 'var(--state-alert)' }}
                  data-testid="reset-arc-confirm"
                >
                  {resetting ? 'Resetting…' : 'Delete arc'}
                </button>
              </div>
            </div>
          )}
        </SettingsGroup>
      </div>
    </>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}
