import { useEffect, useState } from 'react';
import type { MetricDefinition } from '../../blueprint/schema';
import { db } from '../../db/db';
import { realDeps } from '../../store/deps';
import { getEngineConfig } from '../../store/engineConfig';
import { logBodyMetric } from '../../store/training';
import { SingleChipSelect } from '../components/SingleChipSelect';
import { Stepper } from '../components/Stepper';
import { PrimaryButton, Sheet } from '../kit';

interface MetricSheetProps {
  /** The manual metrics on offer (a body panel passes the body ones; a benchmark card, its own). */
  metrics: readonly MetricDefinition[];
  title?: string;
  today: string;
  arcId: string;
  onClose: () => void;
}

/** Units that move in half steps (kilograms, centimetres, percent); everything else in whole ones. */
const stepFor = (unit: string): number => (['kg', 'cm', '%'].includes(unit) ? 0.5 : 1);

/**
 * The metric sheet (new, platform/05 loop 7.4): a number the person measures themselves -
 * weight, waist, a benchmark score - logged against a Blueprint metric. It starts at the
 * last value logged, so the thumb moves a little rather than a lot. Metrics never earn XP
 * and no quest depends on them (V-MET-01); this is a record, not an instrument.
 */
export function MetricSheet({ metrics, title = 'Log metric', today, arcId, onClose }: MetricSheetProps) {
  const [metricId, setMetricId] = useState<string | null>(metrics[0]?.id ?? null);
  const metric = metrics.find((candidate) => candidate.id === metricId);
  const [value, setValue] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!metricId) return;
    let cancelled = false;
    void db.metric_sample.where('kind').equals(metricId).toArray().then((samples) => {
      if (cancelled) return;
      const latest = [...samples].sort((a, b) => a.local_date.localeCompare(b.local_date)).pop();
      setValue(latest?.value ?? 0);
    });
    return () => { cancelled = true; };
  }, [metricId]);

  async function handleLog() {
    if (!metric || submitting) return;
    setSubmitting(true);
    try {
      // The event's `kind` is the metric id; the typed union is the legacy three, the log accepts any.
      await logBodyMetric(today, arcId, metric.id as 'weight_kg', value, metric.unit, getEngineConfig(), realDeps);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const labelOf = (id: string): string => {
    const found = metrics.find((candidate) => candidate.id === id);
    return found ? `${found.label} (${found.unit})` : id;
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <PrimaryButton size="md" disabled={!metric || submitting} onClick={() => void handleLog()}>
          {submitting ? 'Logging…' : 'Log'}
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        {metrics.length > 1 && <SingleChipSelect label="Metric" options={metrics.map((candidate) => candidate.id)} labelFor={labelOf} selected={metricId} onSelect={setMetricId} />}
        {metric && <Stepper label={labelOf(metric.id)} value={value} step={stepFor(metric.unit)} min={0} onChange={setValue} />}
      </div>
    </Sheet>
  );
}
