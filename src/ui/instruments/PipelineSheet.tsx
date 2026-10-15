import { useEffect, useMemo, useState } from 'react';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Field, PrimaryButton, QuietButton, Sheet, TextArea, TextInput } from '../kit';
import { LEGACY_PIPELINE_COPY, type PipelineCopy } from './legacy/copy';
import { pipelineGateway, type ResumeChoice } from './recorders/pipeline';
import { humanize, type InstrumentSheetProps } from './types';

const DEFAULT_SUBSTITUTE_KINDS = ['conversation', 'mock'];

/**
 * The pipeline sheet (extracted from the career log sheet, platform/03 §27.2):
 * log one entry in the pipeline - a company, a role, a category and source, the
 * resume it cites and why this one - or, when the domain has a duration beside
 * it, the work that stands in on a day the real thing could not happen.
 *
 * final/06 §5.4. Logging an entry (or substitute work) is what completes the
 * domain's core quest; the store does that after every write.
 */
export function PipelineSheet({ instrument, siblings, today, arcId, onClose }: InstrumentSheetProps) {
  const gateway = useMemo(() => pipelineGateway({ instrument, siblings, today, arcId }), [instrument, siblings, today, arcId]);
  const copy: PipelineCopy | undefined = LEGACY_PIPELINE_COPY[instrument.id];

  const categories = copy ? Object.keys(copy.categoryLabels) : ((instrument.params.roleCategories as string[] | undefined) ?? ['other']);
  const sources = copy ? Object.keys(copy.sourceLabels) : ((instrument.params.sources as string[] | undefined) ?? ['other']);
  const substituteKinds = copy ? Object.keys(copy.substituteKinds) : ((instrument.params.substituteKinds as string[] | undefined) ?? DEFAULT_SUBSTITUTE_KINDS);
  const categoryLabel = (id: string) => copy?.categoryLabels[id] ?? humanize(id);
  const sourceLabel = (id: string) => copy?.sourceLabels[id] ?? humanize(id);
  const substituteLabel = (id: string) => copy?.substituteKinds[id] ?? humanize(id);

  const applicationTitle = copy?.applicationTitle ?? (instrument.logVerb || `Log ${instrument.label}`);
  const applicationSubmit = copy?.applicationSubmit ?? applicationTitle;
  const applicationSubmitting = copy?.applicationSubmitting ?? 'Logging…';
  const substituteTitle = copy?.substituteTitle ?? 'Substitute work';
  const substituteSubmit = copy?.substituteSubmit ?? 'Log substitute work';
  const substituteSwitch = copy?.substituteSwitch ?? 'Substitute work instead';
  const applicationSwitch = copy?.applicationSwitch ?? `${applicationTitle} instead`;

  const [mode, setMode] = useState<'application' | 'substitute'>('application');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [resumeVersions, setResumeVersions] = useState<ResumeChoice[]>([]);
  const [resumeVersionId, setResumeVersionId] = useState('');
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [whyLine, setWhyLine] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'pass' | 'fail' | null>(null);

  const [substituteMinutes, setSubstituteMinutes] = useState(25);
  const [substituteKind, setSubstituteKind] = useState<string>(substituteKinds[0] ?? 'other');

  useEffect(() => {
    void gateway.resumes?.list().then((versions) => {
      setResumeVersions(versions);
      if (versions.length > 0) setResumeVersionId(versions[0]!.id);
    });
  }, [gateway]);

  async function handleCreateVersion() {
    if (!newVersionLabel.trim() || !gateway.resumes) return;
    const id = await gateway.resumes.create(newVersionLabel.trim());
    setResumeVersions(await gateway.resumes.list());
    setResumeVersionId(id);
    setNewVersionLabel('');
  }

  async function handleLogApplication() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const qualityPass = await gateway.logApplication({
        company: company.trim(), role: role.trim(), category: category ?? 'other', source: source ?? sources[0] ?? 'other', resumeVersionId, whyLine: whyLine.trim(),
      });
      setResult(qualityPass ? 'pass' : 'fail');
      if (qualityPass) {
        setTimeout(onClose, 900);
      }
    } finally {
      // Runs on both success and a thrown error - a write that throws
      // must never leave the button stuck on "Logging…" forever.
      setSubmitting(false);
    }
  }

  async function handleLogSubstitute() {
    if (submitting || !gateway.logSubstitute) return;
    setSubmitting(true);
    try {
      await gateway.logSubstitute(substituteMinutes, substituteKind);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const canLogApplication =
    company.trim().length > 0 && role.trim().length > 0 && (gateway.resumes === null || resumeVersionId !== '') && whyLine.trim().length >= 15;
  const canSubstitute = gateway.logSubstitute !== null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === 'application' ? applicationTitle : substituteTitle}
      footer={
        // The mode switch lives beside the primary action rather than
        // buried in the body: final/06 §5.4 puts "substitute career work
        // instead" directly under the log button, because the decision
        // being offered is "I could not do the real thing today", and it
        // has to be visible at the moment that becomes true.
        mode === 'application' ? (
          <div className="flex flex-col gap-2">
            <PrimaryButton size="md" disabled={!canLogApplication || submitting} onClick={() => void handleLogApplication()}>
              {submitting ? applicationSubmitting : applicationSubmit}
            </PrimaryButton>
            {canSubstitute && <QuietButton onClick={() => setMode('substitute')}>{substituteSwitch}</QuietButton>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <PrimaryButton size="md" disabled={submitting || substituteMinutes <= 0} onClick={() => void handleLogSubstitute()}>
              {submitting ? 'Logging…' : substituteSubmit}
            </PrimaryButton>
            <QuietButton onClick={() => setMode('application')}>{applicationSwitch}</QuietButton>
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

            <SingleChipSelect label="Category" options={categories} labelFor={categoryLabel} selected={category} onSelect={setCategory} />
            <SingleChipSelect label="Source" options={sources} labelFor={sourceLabel} selected={source} onSelect={setSource} />

            {gateway.resumes && (
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
            )}

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
            <SingleChipSelect label="What kind of work?" options={substituteKinds} labelFor={substituteLabel} selected={substituteKind} onSelect={setSubstituteKind} />
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
