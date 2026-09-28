// platform/04-QUALITY-AND-OPERATIONS.md §32.4 — the owner's real event
// log as a private golden master. The export is personal data: it lives
// under platform-fixtures/private/ (gitignored), is loaded only when
// present, and nothing derived from it — not even the digest file — is
// ever committed. CI exercises this same harness against a synthetic
// export (see owner-golden.test.ts), so the code path is always tested
// even though the real data never leaves the owner's machine.
//
// What the harness proves: replaying an export through buildProjections
// and buildDomainTables yields exactly the derived state it did the last
// time the golden digest was recorded. Every platform phase that touches
// the engine (4, 6, 7, 17) must keep that digest unchanged.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildProjections } from '../../../src/db/projections';
import { buildDomainTables } from '../../../src/db/domainProjections';
import { DEFAULT_CONFIG } from '../../../src/engine/config';
import type { EngineConfig, EngineDeps, SystemEvent } from '../../../src/engine/types';

export const PRIVATE_DIR = resolve(__dirname, '../../../platform-fixtures/private');
export const OWNER_EXPORT_PATH = resolve(PRIVATE_DIR, 'owner-export.json');
export const OWNER_GOLDEN_PATH = resolve(PRIVATE_DIR, 'owner-golden.json');

/** The subset of store/checkpoint.ts's export shape this harness reads. */
export interface ExportSnapshot {
  schema_v: number;
  events: SystemEvent[];
  arc: unknown;
  profile: unknown;
  checkpoints: unknown[];
}

export interface GoldenRecord {
  digest: string;
  summary: Record<string, unknown>;
}

/** Deterministic deps: buildProjections derives every id from the log
 * itself, so the injected clock/id generator must not leak into output. */
export const harnessDeps: EngineDeps = { now: () => '2026-01-01T00:00:00Z', newId: () => 'harness-id' };

export function loadOwnerExport(): { json: string; snapshot: ExportSnapshot } | null {
  if (!existsSync(OWNER_EXPORT_PATH)) return null;
  const json = readFileSync(OWNER_EXPORT_PATH, 'utf-8');
  return { json, snapshot: JSON.parse(json) as ExportSnapshot };
}

export function loadOwnerGolden(): GoldenRecord | null {
  if (!existsSync(OWNER_GOLDEN_PATH)) return null;
  return JSON.parse(readFileSync(OWNER_GOLDEN_PATH, 'utf-8')) as GoldenRecord;
}

export function writeOwnerGolden(record: GoldenRecord): void {
  mkdirSync(dirname(OWNER_GOLDEN_PATH), { recursive: true });
  writeFileSync(OWNER_GOLDEN_PATH, JSON.stringify(record, null, 2));
}

/** JSON with object keys sorted at every depth — the digest must not
 * depend on property insertion order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    }
    return v;
  });
}

function byKey<T>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)));
}

/**
 * Every table the event log derives, rows sorted by primary key, plus a
 * small human-readable summary. The digest covers the full derived
 * state; the summary exists only to make a mismatch readable.
 */
export function deriveGolden(events: SystemEvent[], config: EngineConfig = DEFAULT_CONFIG): GoldenRecord {
  const built = buildProjections(events, config, harnessDeps);
  const domain = buildDomainTables(events, config);
  const id = (r: { id: string }) => r.id;
  const date = (r: { local_date: string }) => r.local_date;

  const derived = {
    templates: byKey(built.templates, id),
    instances: byKey(built.instances, id),
    ledger: byKey(built.ledger, id),
    dayRollups: byKey(built.dayRollups, date),
    playerState: built.playerState,
    applications: byKey(domain.applications, id),
    careerEvents: byKey(domain.careerEvents, id),
    resumeVersions: byKey(domain.resumeVersions, id),
    dsaProblems: byKey(domain.dsaProblems, id),
    dsaAttempts: byKey(domain.dsaAttempts, id),
    learningBlocks: byKey(domain.learningBlocks, id),
    systemDesigns: byKey(domain.systemDesigns, id),
    buildSessions: byKey(domain.buildSessions, id),
    artifacts: byKey(domain.artifacts, id),
    trainingSessions: byKey(domain.trainingSessions, id),
    metricSamples: byKey(domain.metricSamples, id),
    maintenanceLogs: byKey(domain.maintenanceLogs, date),
  };

  const digest = createHash('sha256').update(canonicalJson(derived)).digest('hex');
  const summary = {
    events: events.length,
    totalXp: built.playerState?.total_xp ?? 0,
    level: built.playerState?.level ?? 1,
    arcStreak: built.playerState?.arc_streak ?? 0,
    openedDays: built.dayRollups.length,
    completedInstances: built.instances.filter((i) => i.state === 'complete').length,
    ledgerRows: built.ledger.length,
    domainRows: Object.fromEntries(
      Object.entries(domain).map(([table, rows]) => [table, (rows as unknown[]).length])
    ),
  };
  return { digest, summary };
}
