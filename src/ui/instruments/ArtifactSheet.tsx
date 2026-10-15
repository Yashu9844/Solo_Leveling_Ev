import { useState } from 'react';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Field, PrimaryButton, Sheet, TextInput } from '../kit';
import { EvidenceAcceptedMoment } from '../moments/EvidenceAcceptedMoment';
import { recordArtifact } from './recorders/duration';
import { humanize, type InstrumentSheetProps } from './types';

/**
 * The artifact sheet (platform/03 §27.2): something finished and shown. The
 * shipped section of a session sheet (DurationSheet) records the same kind of
 * thing in passing; this is the way to log one on its own. A public link, when
 * there is one, is what makes it evidence rather than a claim.
 */
export function ArtifactSheet({ instrument, today, arcId, onClose }: InstrumentSheetProps) {
  const kinds = ((instrument.params.shipKinds as string[] | undefined) ?? (instrument.params.kinds as string[])).filter((kind) => kind !== 'resume' || (instrument.params.kinds as string[]).length === 1);
  const title = instrument.logVerb || `Record ${instrument.label}`;

  const [projectKey, setProjectKey] = useState('');
  const [shippedTitle, setShippedTitle] = useState('');
  const [kind, setKind] = useState<string>(kinds[0] ?? 'feature');
  const [url, setUrl] = useState('');
  const [costPerTaskStated, setCostPerTaskStated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moment, setMoment] = useState<{ kind: string; title: string } | null>(null);

  const canLog = shippedTitle.trim().length > 0 && projectKey.trim().length > 0;

  async function handleLog() {
    if (!canLog || submitting) return;
    setSubmitting(true);
    try {
      await recordArtifact(instrument, { kind, title: shippedTitle, projectKey, url, costPerTaskStated: kind === 'project' ? costPerTaskStated : undefined }, { today, arcId });
      setMoment({ kind, title: shippedTitle.trim() });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={title}
        footer={
          <PrimaryButton size="md" disabled={!canLog || submitting} onClick={() => void handleLog()}>
            {submitting ? 'Recording…' : title}
          </PrimaryButton>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="What did you finish?">
            <TextInput type="text" value={shippedTitle} onChange={(e) => setShippedTitle(e.target.value)} />
          </Field>
          <Field label="Project">
            <TextInput type="text" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
          </Field>
          <SingleChipSelect label="Kind" options={kinds} labelFor={humanize} selected={kind} onSelect={setKind} />
          <Field label="Link (optional — a public link makes it evidence)">
            <TextInput type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </Field>
          {kind === 'project' && (
            <label className="flex min-h-tap items-center gap-3 text-sm text-ink-300">
              <input
                type="checkbox"
                checked={costPerTaskStated}
                onChange={(e) => setCostPerTaskStated(e.target.checked)}
                className="h-5 w-5 accent-[var(--accent)]"
              />
              Cost per task measured and stated (README)
            </label>
          )}
        </div>
      </Sheet>

      {moment && <EvidenceAcceptedMoment kind={moment.kind} title={moment.title} onDismiss={onClose} />}
    </>
  );
}
