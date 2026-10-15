import { useEffect, useState } from 'react';
import { localDate } from '../../engine/time';
import { realDeps } from '../../store/deps';
import { getEngineConfig } from '../../store/engineConfig';
import { getCareerTreeOverview, getMilestonePanel, type CareerTreeOverview } from '../../store/skills';

function TreeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-2 rounded-sm transition-all duration-150 hover:bg-accent-deep/15 border-b border-hair-faint">
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-300">{label}</span>
      <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-accent-mid glow-text">{value}</span>
    </div>
  );
}

/**
 * The owner's Career Tree: foundations and AI tiers touched, the artifacts they shipped, resume
 * versions, applications and what came of them. Built for the owner's System and shown only for it
 * (a generic System has its milestone panel instead).
 */
export function LegacyCareerPanel({ foundationsTouched, aiTouched }: { foundationsTouched: number; aiTouched: number }) {
  const [overview, setOverview] = useState<CareerTreeOverview | null>(null);
  useEffect(() => {
    void getCareerTreeOverview().then(setOverview);
  }, []);
  if (!overview) return null;
  return (
    <>
      <TreeRow label="Software engineering → foundations" value={`${foundationsTouched}/9`} />
      <TreeRow label="AI / Agentic → tiers unlocked" value={`${aiTouched}/21 Tiers Active`} />
      <TreeRow
        label="Projects → artifacts"
        value={
          Object.entries(overview.artifactsByKind)
            .filter(([, n]) => (n ?? 0) > 0)
            .map(([kind, n]) => `${n} ${kind}`)
            .join(' · ') || '0'
        }
      />
      <TreeRow label="Resume → versions" value={String(overview.resumeVersions)} />
      <TreeRow label="Applications Logged" value={`${overview.applications} (${overview.qualityApplications} quality)`} />
      <TreeRow label="Interviews Conducted" value={String(overview.interviews)} />
      <TreeRow label="Offer Secured" value={String(overview.offers)} />
    </>
  );
}

/** A generic System's milestones, each with how far along it is. */
export function MilestonePanel() {
  const [rows, setRows] = useState<{ id: string; label: string; progress: string; met: boolean }[] | null>(null);
  useEffect(() => {
    const today = localDate(realDeps.now(), getEngineConfig().arc.timezone, getEngineConfig().arc.dayBoundaryHour);
    void getMilestonePanel(today).then(setRows);
  }, []);
  if (!rows) return null;
  if (rows.length === 0) return <p className="py-3 text-center font-mono text-xs text-ink-700">No milestones yet.</p>;
  return (
    <>
      {rows.map((row) => (
        <TreeRow key={row.id} label={row.label} value={row.met ? '✓ MET' : row.progress} />
      ))}
    </>
  );
}
