import { useState } from 'react';
import { DeepWorkTimer } from '../components/DeepWorkTimer';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Stepper } from '../components/Stepper';
import { Field, PrimaryButton, Sheet, TextInput } from '../kit';
import { EvidenceAcceptedMoment } from '../moments/EvidenceAcceptedMoment';
import { LEGACY_DURATION_COPY } from './legacy/copy';
import { artifactSibling, recordDuration, type ShippedValues } from './recorders/duration';
import { humanize, type InstrumentSheetProps } from './types';

/**
 * The duration sheet (extracted from the BUILD log sheet, platform/03 §27.2): minutes
 * of focused work, optionally tagged with a mode and a project, and - when the
 * domain keeps an artifact beside it and the mode is the shipping one - the unit
 * shipped this session.
 *
 * final/03 §4.1 - every BUILD log requires a mode. The first mode feeds learning,
 * SHIP feeds an artifact row and its bonus.
 */
export function DurationSheet({ instrument, siblings, today, arcId, onClose }: InstrumentSheetProps) {
  const modes = ((instrument.params.modes as string[] | undefined) ?? []);
  const hasModes = modes.length > 0;
  const copy = LEGACY_DURATION_COPY[instrument.id];
  const title = instrument.logVerb || `Log ${instrument.label}`;

  const artifact = artifactSibling(siblings);
  const shipMode = (instrument.params.shipMode as string | undefined) ?? (modes.includes('SHIP') ? 'SHIP' : undefined);
  const shipBonus = (artifact?.params.bonusXp as number | undefined) ?? 0;
  const shipKinds = ((artifact?.params.shipKinds as string[] | undefined)
    ?? ((artifact?.params.kinds as string[] | undefined) ?? []).filter((kind) => kind !== 'resume' && kind !== 'portfolio'));
  const kindLabel = (kind: string) => copy?.artifactKindLabels[kind] ?? humanize(kind);

  const [mode, setMode] = useState<string | null>(null);
  const [minutes, setMinutes] = useState((instrument.params.defaultMinutes as number | undefined) ?? 25);
  const [projectKey, setProjectKey] = useState('');
  const [shippedTitle, setShippedTitle] = useState('');
  const [shippedKind, setShippedKind] = useState<string>(shipKinds[0] ?? 'feature');
  const [costPerTaskStated, setCostPerTaskStated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceMoment, setEvidenceMoment] = useState<{ kind: string; title: string } | null>(null);

  const canLog = !hasModes || (mode !== null && projectKey.trim().length > 0);
  const shipping = artifact !== undefined && shipMode !== undefined && mode === shipMode;

  async function handleLog() {
    if (!canLog || submitting) return;
    setSubmitting(true);
    try {
      const shipped: ShippedValues | undefined =
        shipping && shippedTitle.trim()
          ? { kind: shippedKind, title: shippedTitle.trim(), costPerTaskStated: shippedKind === 'project' ? costPerTaskStated : undefined }
          : undefined;
      await recordDuration(instrument, siblings, { minutes, mode: mode ?? undefined, projectKey: projectKey.trim() || undefined, shipped }, { today, arcId });
      // final/05 §2.1's EVIDENCE ACCEPTED Moment - fires only when a
      // public artefact was actually logged this session, not on every log.
      if (shipped) {
        setEvidenceMoment(shipped);
      } else {
        onClose();
      }
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
            {submitting ? (copy?.submittingLabel ?? 'Recording…') : title}
          </PrimaryButton>
        }
      >
        <div className="flex flex-col gap-4">

        {hasModes && <SingleChipSelect label="Mode — required" options={modes} labelFor={(m) => m} selected={mode} onSelect={setMode} />}

        {hasModes && (
          <Field label="Project">
            <TextInput type="text" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
          </Field>
        )}

        <Stepper label="Minutes" value={minutes} step={5} min={5} onChange={setMinutes} />
        <DeepWorkTimer onStop={setMinutes} />

        {shipping && (
          <Field label={`Shipped this session? (optional${shipBonus > 0 ? ` — +${shipBonus} XP` : ''})`}>
            <TextInput
              type="text"
              value={shippedTitle}
              onChange={(e) => setShippedTitle(e.target.value)}
              placeholder={copy?.shippedPlaceholder}
            />
          </Field>
        )}

        {shipping && shippedTitle.trim().length > 0 && (
          <>
            <SingleChipSelect label="Evidence kind" options={shipKinds} labelFor={kindLabel} selected={shippedKind} onSelect={setShippedKind} />
            {shippedKind === 'project' && (
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
          </>
        )}

        </div>
      </Sheet>

      {/* Outside the Sheet: a Moment is a full-screen ceremony and must
          not be trapped inside the sheet it was triggered from. */}
      {evidenceMoment && <EvidenceAcceptedMoment kind={evidenceMoment.kind} title={evidenceMoment.title} onDismiss={onClose} />}
    </>
  );
}
