import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { logApplication, logSubstituteWork, createResumeVersion, getResumeVersions } from '../../store/career';
import type { ResumeVersionRow } from '../../db/schema';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Field, PrimaryButton, QuietButton, Sheet, TextArea, TextInput } from '../kit';

const ROLE_CATEGORIES = ['backend', 'ai', 'fullstack', 'platform', 'other'] as const;
const ROLE_CATEGORY_LABELS: Record<(typeof ROLE_CATEGORIES)[number], string> = {
  backend: 'Backend',
  ai: 'AI',
  fullstack: 'Fullstack',
  platform: 'Platform',
  other: 'Other',
};
const SOURCES = ['jobboard', 'referral', 'company_site', 'recruiter', 'network'] as const;
const SOURCE_LABELS: Record<(typeof SOURCES)[number], string> = {
  jobboard: 'Board',
  referral: 'Referral',
  company_site: 'Site',
  recruiter: 'Recruiter',
  network: 'Network',
};
const SUBSTITUTE_KINDS = ['resume_iteration', 'followups', 'networking', 'portfolio', 'writeup', 'mock'] as const;
const SUBSTITUTE_LABELS: Record<(typeof SUBSTITUTE_KINDS)[number], string> = {
  resume_iteration: 'Resume iteration',
  followups: 'Follow-ups',
  networking: 'Networking message',
  portfolio: 'Portfolio / README',
  writeup: 'Write-up drafting',
  mock: 'Mock interview',
};

interface LogApplicationSheetProps {
  today: string;
  arcId: string;
  onClose: () => void;
}

/** final/06 §5.4. Logging an application (or substitute work) is what
 * completes the CAREER quest — see store/career.ts's
 * maybeCompleteCareerQuest, run after every log. */
export function LogApplicationSheet({ today, arcId, onClose }: LogApplicationSheetProps) {
  const [mode, setMode] = useState<'application' | 'substitute'>('application');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [category, setCategory] = useState<(typeof ROLE_CATEGORIES)[number] | null>(null);
  const [source, setSource] = useState<(typeof SOURCES)[number] | null>(null);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersionRow[]>([]);
  const [resumeVersionId, setResumeVersionId] = useState('');
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [whyLine, setWhyLine] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'pass' | 'fail' | null>(null);

  const [substituteMinutes, setSubstituteMinutes] = useState(25);
  const [substituteKind, setSubstituteKind] = useState<(typeof SUBSTITUTE_KINDS)[number]>('resume_iteration');

  useEffect(() => {
    getResumeVersions().then((versions) => {
      setResumeVersions(versions);
      if (versions.length > 0) setResumeVersionId(versions[0]!.id);
    });
  }, []);

  async function handleCreateVersion() {
    if (!newVersionLabel.trim()) return;
    const id = await createResumeVersion(today, newVersionLabel.trim(), 'Created from the application log', arcId, realDeps);
    const versions = await getResumeVersions();
    setResumeVersions(versions);
    setResumeVersionId(id);
    setNewVersionLabel('');
  }

  async function handleLogApplication() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const qualityPass = await logApplication(
        today,
        arcId,
        {
          company: company.trim(),
          role: role.trim(),
          roleCategory: category ?? 'other',
          source: source ?? 'jobboard',
          resumeVersionId,
          whyLine: whyLine.trim(),
        },
        DEFAULT_CONFIG,
        realDeps
      );
      setResult(qualityPass ? 'pass' : 'fail');
      if (qualityPass) {
        setTimeout(onClose, 900);
      }
    } finally {
      // Runs on both success and a thrown error — a write that throws
      // must never leave the button stuck on "Logging…" forever.
      setSubmitting(false);
    }
  }

  async function handleLogSubstitute() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await logSubstituteWork(today, arcId, substituteMinutes, substituteKind, DEFAULT_CONFIG, realDeps);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const canLogApplication =
    company.trim().length > 0 && role.trim().length > 0 && resumeVersionId !== '' && whyLine.trim().length >= 15;

  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === 'application' ? 'Despatch Ascension' : 'Substitute Ascension Work'}
      footer={
        // The mode switch lives beside the primary action rather than
        // buried in the body: final/06 §5.4 puts "substitute career work
        // instead" directly under the log button, because the decision
        // being offered is "I could not do the real thing today", and it
        // has to be visible at the moment that becomes true.
        mode === 'application' ? (
          <div className="flex flex-col gap-2">
            <PrimaryButton
              size="md"
              disabled={!canLogApplication || submitting}
              onClick={() => void handleLogApplication()}
            >
              {submitting ? 'Despatching…' : 'Despatch Ascension'}
            </PrimaryButton>
            <QuietButton onClick={() => setMode('substitute')}>
              Substitute ascension work instead
            </QuietButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <PrimaryButton
              size="md"
              disabled={submitting || substituteMinutes <= 0}
              onClick={() => void handleLogSubstitute()}
            >
              {submitting ? 'Logging…' : 'Log substitute work'}
            </PrimaryButton>
            <QuietButton onClick={() => setMode('application')}>
              Despatch an ascension instead
            </QuietButton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4">

        {mode === 'application' ? (
          <>
            <Field label="Company">
              <TextInput type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
            </Field>
            <Field label="Role">
              <TextInput type="text" value={role} onChange={(e) => setRole(e.target.value)} />
            </Field>

            <SingleChipSelect
              label="Category"
              options={ROLE_CATEGORIES}
              labelFor={(k) => ROLE_CATEGORY_LABELS[k]}
              selected={category}
              onSelect={setCategory}
            />
            <SingleChipSelect
              label="Source"
              options={SOURCES}
              labelFor={(k) => SOURCE_LABELS[k]}
              selected={source}
              onSelect={setSource}
            />

            <div>
              <span className="mb-2 block text-xxs uppercase text-ink-700">Resume — required</span>
              {resumeVersions.length > 0 && (
                <select
                  value={resumeVersionId}
                  onChange={(e) => setResumeVersionId(e.target.value)}
                  className="w-full rounded-sm px-3 text-md text-ink-100 outline-none focus:border-accent"
                  style={{
                    minHeight: 48,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                  }}
                >
                  {resumeVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="mt-2 flex gap-2">
                <TextInput
                  type="text"
                  value={newVersionLabel}
                  onChange={(e) => setNewVersionLabel(e.target.value)}
                  placeholder="New version label, e.g. v2 — AI-weighted"
                  className="!w-auto min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateVersion()}
                  className="cut-sm shrink-0 px-3 text-sm text-ink-500"
                  style={{ minHeight: 48, border: '1px solid var(--hair)' }}
                >
                  + New
                </button>
              </div>
            </div>

            <Field label="Why this role? — required, ≥15 chars">
              <TextArea value={whyLine} onChange={(e) => setWhyLine(e.target.value)} rows={2} />
            </Field>

            {result === 'fail' && (
              <p
                className="cut-sm p-3 text-xs text-ink-300"
                style={{ borderLeft: '2px solid var(--state-recover)', background: 'var(--surface)' }}
              >
                {/* Straight apostrophe, not a typographic one: career.spec
                    asserts getByText(/didn't pass/) and a curly quote
                    silently breaks the match. Copy that a test reads is
                    part of the contract (design system §10). */}
                Logged, but the quality gate didn't pass — this one earns 0 XP. Flagged for the
                weekly review.
              </p>
            )}
            {result === 'pass' && <p className="text-xs text-accent-mid">Logged.</p>}
          </>
        ) : (
          <>
            <SingleChipSelect
              label="What kind of work?"
              options={SUBSTITUTE_KINDS}
              labelFor={(k) => SUBSTITUTE_LABELS[k]}
              selected={substituteKind}
              onSelect={setSubstituteKind}
            />
            <Field label="Minutes">
              <TextInput
                type="number"
                inputMode="numeric"
                value={substituteMinutes}
                onChange={(e) => setSubstituteMinutes(Number(e.target.value))}
              />
            </Field>
          </>
        )}
      </div>
    </Sheet>
  );
}
