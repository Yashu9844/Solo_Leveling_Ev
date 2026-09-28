import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG } from '../../engine/config';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { logBodyMetric } from '../../store/training';
import { db } from '../../db/db';
import { SingleChipSelect } from './SingleChipSelect';
import { Stepper } from './Stepper';
import { Panel, PrimaryButton, SectionLabel } from '../kit';

const KINDS = ['weight_kg', 'waist_cm', 'bodyfat_pct'] as const;
type Kind = (typeof KINDS)[number];
const KIND_LABELS: Record<Kind, string> = { weight_kg: 'Weight (kg)', waist_cm: 'Waist (cm)', bodyfat_pct: 'Body fat (%)' };
const KIND_UNITS: Record<Kind, string> = { weight_kg: 'kg', waist_cm: 'cm', bodyfat_pct: '%' };
const KIND_DEFAULTS: Record<Kind, number> = { weight_kg: 70, waist_cm: 80, bodyfat_pct: 20 };
const KIND_STEP: Record<Kind, number> = { weight_kg: 0.5, waist_cm: 0.5, bodyfat_pct: 0.5 };

/**
 * final/06 §5.8's checkpoint mockup shows weight/waist/1RM entry fields,
 * but final/03's evidence system has no core-quest home for body
 * metrics — they're a standalone log, any time (matching how
 * store/training.ts's logBodyMetric was already built: no quest tie,
 * no XP, per final/04 §1). This closes the gap the checkpoint screen's
 * own doc comment names: logBodyMetric existed with no UI caller
 * anywhere in the app.
 */
export function BodyMetricsCard() {
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<Kind>('weight_kg');
  const [value, setValue] = useState(KIND_DEFAULTS.weight_kg);
  const [arcId, setArcId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    void db.arc.toCollection().first().then((arc) => setArcId(arc?.id ?? null));
  }, []);

  function selectKind(next: Kind) {
    setKind(next);
    setValue(KIND_DEFAULTS[next]);
  }

  async function handleLog() {
    if (!arcId || submitting) return;
    setSubmitting(true);
    try {
      const today = localDate(realDeps.now(), DEFAULT_CONFIG.arc.timezone, DEFAULT_CONFIG.arc.dayBoundaryHour);
      await logBodyMetric(today, arcId, kind, value, KIND_UNITS[kind], DEFAULT_CONFIG, realDeps);
      setSavedAt(Date.now());
    } finally {
      setSubmitting(false);
    }
  }

  if (!arcId) return null;

  return (
    <Panel cut="md" className="mt-4" bodyClassName="px-4 py-4">
      {!expanded ? (
        // Collapsed by default: this is a real but occasional action, and
        // an always-open form would outweigh the readouts above it.
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-between text-left text-sm text-accent"
          style={{ minHeight: 44 }}
        >
          Log body metric
          <span aria-hidden className="text-ink-700">
            +
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Body metric</SectionLabel>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close"
              className="-mr-2 min-h-tap min-w-[44px] text-ink-700"
            >
              ✕
            </button>
          </div>
          <SingleChipSelect label="Metric" options={KINDS} labelFor={(k) => KIND_LABELS[k]} selected={kind} onSelect={selectKind} />
          <Stepper label={KIND_LABELS[kind]} value={value} step={KIND_STEP[kind]} min={0} onChange={setValue} />
          <PrimaryButton size="md" disabled={submitting} onClick={() => void handleLog()}>
            {submitting ? 'Logging…' : 'Log'}
          </PrimaryButton>
          {savedAt !== null && <p className="text-xs text-faint">Saved.</p>}
        </div>
      )}
    </Panel>
  );
}
