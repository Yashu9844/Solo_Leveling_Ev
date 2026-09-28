import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CoreQuestKey, ImplementationIntention } from '../../engine/types';
import { DEFAULT_CONFIG } from '../../engine/config';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { INTENTION_KEYS, amendIntention, getArcClock, getIntentions } from '../../store/plan';
import { InstallCard } from '../components/InstallCard';
import {
  Field,
  PrimaryButton,
  ScreenHeader,
  SettingsGroup,
  SettingsList,
  SettingsRow,
  TextInput,
} from '../kit';

const QUEST_LABELS: Record<CoreQuestKey, string> = {
  career: 'Career',
  dsa: 'DSA',
  build: 'Build',
  training: 'Training',
  sleep: 'Sleep',
  attention: 'Attention',
};

type Intentions = Partial<Record<CoreQuestKey, ImplementationIntention>>;

/**
 * The application's own settings, as opposed to how it looks.
 *
 * What is here is what the engine actually has. design/03 §1 also
 * sketched an evening-review time, a weekly-review day and a week
 * start — none of those are concepts this build has: the evening review
 * is available all day until it is done, and the weekly review measures
 * a rolling seven days ending today rather than a calendar week. A
 * control that changes nothing is not configuration, so those are
 * absent rather than faked.
 */
export function SystemScreen() {
  const navigate = useNavigate();
  const [intentions, setIntentions] = useState<Intentions | null>(null);
  const [clock, setClock] = useState<Awaited<ReturnType<typeof getArcClock>>>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getIntentions(), getArcClock()]).then(([i, c]) => {
      if (cancelled) return;
      setIntentions(i);
      setClock(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <ScreenHeader title="SYSTEM" onBack={() => navigate('/profile/settings')} />
      <div className="px-gutter pb-8" data-testid="system-screen">
        <SettingsGroup
          title="Reminders"
          footnote="The if-then sentences from onboarding. Changing one is recorded as an amendment — the arc keeps both the old commitment and the day you changed it."
        >
          <SettingsList>
            {INTENTION_KEYS.map((key) => {
              const it = intentions?.[key];
              return (
                <SettingsRow
                  key={key}
                  label={QUEST_LABELS[key]}
                  description={it ? `at ${it.place}, ${it.first_action}` : undefined}
                  value={it ? <span className="font-mono tabular-nums">{it.time}</span> : '—'}
                  onClick={() => navigate(`/profile/settings/system/${key}`)}
                  testId={`reminder-${key}`}
                />
              );
            })}
          </SettingsList>
        </SettingsGroup>

        {clock && (
          <SettingsGroup
            title="The day"
            footnote="Fixed for the life of the arc. Every streak, rollup and checkpoint in the record was computed against these hours, so moving them would rewrite what past days meant."
          >
            <SettingsList>
              <SettingsRow
                label="Day begins"
                value={<Mono>{String(clock.dayBoundaryHour).padStart(2, '0')}:00</Mono>}
              />
              <SettingsRow
                label="Day closes"
                description="Logging is held during the close so a day cannot be edited while it is being sealed."
                value={<Mono>{String(clock.dayCloseHour).padStart(2, '0')}:00</Mono>}
              />
              <SettingsRow label="Time zone" value={<Mono>{clock.timezone}</Mono>} />
            </SettingsList>
          </SettingsGroup>
        )}

        <SettingsGroup title="This device">
          <SettingsRow
            label="Offline"
            description="Everything works with no network. There is no server and nothing to sign in to."
          />
        </SettingsGroup>

        {/* Outside the group, because it draws its own card and renders
            nothing at all unless the browser has offered an install —
            a group header with an empty card under it would be worse. */}
        <InstallCard />
      </div>
    </>
  );
}

/**
 * Editing one implementation intention.
 *
 * A pushed screen rather than an inline form: the sentence has three
 * parts and the whole point of it is reading as a sentence, which it
 * cannot do squeezed into a 56px row.
 */
export function ReminderScreen() {
  const navigate = useNavigate();
  const { questKey } = useParams<{ questKey: string }>();
  const key = (INTENTION_KEYS as string[]).includes(questKey ?? '')
    ? (questKey as CoreQuestKey)
    : null;

  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [action, setAction] = useState('');
  const [arcId, setArcId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const back = useCallback(() => navigate('/profile/settings/system'), [navigate]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void Promise.all([getIntentions(), getArcClock()]).then(([intentions, clock]) => {
      if (cancelled) return;
      const it = intentions[key];
      setTime(it?.time ?? '08:00');
      setPlace(it?.place ?? '');
      setAction(it?.first_action ?? '');
      setArcId(clock?.id ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) {
    return <ScreenHeader title="REMINDER" onBack={back} />;
  }

  const canSave = loaded && arcId !== null && place.trim().length > 0 && action.trim().length > 0;

  async function handleSave() {
    if (!key || !arcId || !canSave || saving) return;
    setSaving(true);
    try {
      const today = localDate(
        realDeps.now(),
        DEFAULT_CONFIG.arc.timezone,
        DEFAULT_CONFIG.arc.dayBoundaryHour
      );
      await amendIntention(
        key,
        { time, place: place.trim(), first_action: action.trim() },
        arcId,
        today,
        DEFAULT_CONFIG,
        realDeps
      );
      back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader title={QUEST_LABELS[key].toUpperCase()} onBack={back} />
      <div className="px-gutter pb-8" data-testid="reminder-screen">
        {/* The sentence, read back as one thing before it is edited in
            three fields — this is the form of the commitment, and seeing
            it whole is what makes editing it feel like a decision. */}
        <p className="mt-5 font-display text-[calc(16px*var(--type-scale))] leading-[1.5] text-ink-100">
          &ldquo;At {time || '—'} at {place || '—'} I will {action || '—'}.&rdquo;
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <Field label="Time">
            <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Place">
            <TextInput
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="my desk"
            />
          </Field>
          <Field label="First action">
            <TextInput
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="open the job board before anything"
            />
          </Field>
        </div>

        <div className="mt-6">
          <PrimaryButton size="md" disabled={!canSave || saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save amendment'}
          </PrimaryButton>
        </div>
      </div>
    </>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}
