import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { realDeps } from '../../store/deps';
import { logBuildSession } from '../../store/build';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Stepper } from '../components/Stepper';
import { Field, PrimaryButton, Sheet, TextInput } from '../kit';
import { EvidenceAcceptedMoment } from '../moments/EvidenceAcceptedMoment';
import { DeepWorkTimer } from '../components/DeepWorkTimer';

const MODES = ['LEARN', 'SHIP'] as const;
// final/03 §4.3's evidence ladder — 'resume'/'portfolio' aren't
// something a BUILD session ships, so they're excluded here.
const ARTIFACT_KINDS = ['feature', 'eval', 'project', 'deployment', 'writeup'] as const;
type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  feature: 'Feature',
  eval: 'Eval',
  project: 'Project',
  deployment: 'Deployment',
  writeup: 'Write-up',
};

interface LogBuildSessionSheetProps {
  today: string;
  arcId: string;
  onClose: () => void;
}

/** final/03 §4.1 — every BUILD log requires a mode. LEARN feeds
 * FOUNDATIONS/tier mastery; SHIP feeds an artifact row + 50 XP bonus. */
export function LogBuildSessionSheet({ today, arcId, onClose }: LogBuildSessionSheetProps) {
  const [mode, setMode] = useState<(typeof MODES)[number] | null>(null);
  const [minutes, setMinutes] = useState(45);
  const [projectKey, setProjectKey] = useState('');
  const [shippedTitle, setShippedTitle] = useState('');
  const [shippedKind, setShippedKind] = useState<ArtifactKind>('feature');
  const [costPerTaskStated, setCostPerTaskStated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceMoment, setEvidenceMoment] = useState<{ kind: string; title: string } | null>(null);

  const canLog = mode !== null && projectKey.trim().length > 0;

  async function handleLog() {
    if (!canLog || submitting) return;
    setSubmitting(true);
    try {
      const shippedArtifact =
        mode === 'SHIP' && shippedTitle.trim()
          ? {
              kind: shippedKind,
              title: shippedTitle.trim(),
              costPerTaskStated: shippedKind === 'project' ? costPerTaskStated : undefined,
            }
          : undefined;
      await logBuildSession(today, arcId, { mode: mode!, minutes, projectKey: projectKey.trim(), shippedArtifact }, DEFAULT_CONFIG, realDeps);
      // final/05 §2.1's EVIDENCE ACCEPTED Moment — fires only when a
      // public artefact was actually logged this session, not on every
      // BUILD log.
      if (shippedArtifact) {
        setEvidenceMoment(shippedArtifact);
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
        title="Forge Construct"
        footer={
          <PrimaryButton
            size="md"
            disabled={!canLog || submitting}
            onClick={() => void handleLog()}
          >
            {submitting ? 'Forging…' : 'Forge Construct'}
          </PrimaryButton>
        }
      >
        <div className="flex flex-col gap-4">

        <SingleChipSelect label="Mode — required" options={MODES} labelFor={(m) => m} selected={mode} onSelect={setMode} />

        <Field label="Project">
          <TextInput type="text" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
        </Field>

        <Stepper label="Minutes" value={minutes} step={5} min={5} onChange={setMinutes} />
        <DeepWorkTimer onStop={setMinutes} />

        {mode === 'SHIP' && (
          <Field label={`Shipped this session? (optional — +${DEFAULT_CONFIG.shipBonusXp} XP)`}>
            <TextInput
              type="text"
              value={shippedTitle}
              onChange={(e) => setShippedTitle(e.target.value)}
              placeholder="e.g. Tool-calling retry logic"
            />
          </Field>
        )}

        {mode === 'SHIP' && shippedTitle.trim().length > 0 && (
          <>
            <SingleChipSelect
              label="Evidence kind"
              options={ARTIFACT_KINDS}
              labelFor={(k) => ARTIFACT_KIND_LABELS[k]}
              selected={shippedKind}
              onSelect={setShippedKind}
            />
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
      {evidenceMoment && (
        <EvidenceAcceptedMoment kind={evidenceMoment.kind} title={evidenceMoment.title} onDismiss={onClose} />
      )}
    </>
  );
}
