import { defineInstrument, type InstrumentEvaluationContext, type InstrumentIssue, type InstrumentRecord } from '../framework';

export type ArtifactKind = 'feature' | 'eval' | 'project' | 'deployment' | 'writeup' | 'resume' | 'portfolio';
export type ArtifactRecord = Record<string, unknown> & {
  kind: ArtifactKind;
  title: string;
  projectKey: string;
  url?: string;
  costPerTaskStated?: boolean;
};
export type ArtifactParams = Record<string, unknown> & { kinds: readonly ArtifactKind[]; bonusXp?: number };
export type ArtifactVerifiability = 'public_url' | 'recorded';

export function validateArtifactRecord(record: unknown, params: ArtifactParams): InstrumentIssue[] {
  if (!record || typeof record !== 'object') return [{ code: 'I-ART-01', path: 'record', message: 'An artifact record must be an object.' }];
  const candidate = record as Partial<ArtifactRecord>;
  const issues: InstrumentIssue[] = [];
  if (!candidate.kind || !params.kinds.includes(candidate.kind)) issues.push({ code: 'I-ART-02', path: 'record.kind', message: 'Choose a configured artifact kind.' });
  if (!candidate.title?.trim()) issues.push({ code: 'I-ART-03', path: 'record.title', message: 'An artifact title is required.' });
  if (!candidate.projectKey?.trim()) issues.push({ code: 'I-ART-04', path: 'record.projectKey', message: 'An artifact must belong to a project.' });
  if (candidate.costPerTaskStated && candidate.kind !== 'project') issues.push({ code: 'I-ART-05', path: 'record.costPerTaskStated', message: 'Cost-per-task evidence applies only to projects.' });
  return issues;
}

export function artifactVerifiability(record: ArtifactRecord): ArtifactVerifiability {
  return record.url?.trim() ? 'public_url' : 'recorded';
}

/** Legacy-equivalent artifact counts, scoped by the optional kind/project filters. */
export function artifactSignals(records: readonly InstrumentRecord<ArtifactRecord>[], context: InstrumentEvaluationContext): Readonly<Record<string, number>> {
  const kind = context.filter?.kind;
  const projectKey = context.filter?.projectKey;
  const matching = records.filter((record) => (kind === undefined || record.record.kind === kind) && (projectKey === undefined || record.record.projectKey === projectKey));
  const projects = new Set(matching.map((record) => record.record.projectKey));
  // Once a kind has appeared in the history, its first occurrence remains
  // a durable milestone; event-local "was this first?" is handled by the
  // write adapter in loop 3.7.
  const firstOfKind = kind === undefined || matching.length === 0 ? 0 : 1;
  return {
    count: matching.length,
    projects_with: projects.size,
    first_of_kind: firstOfKind,
  };
}

export const artifactInstrument = defineInstrument<ArtifactParams, ArtifactRecord>({
  type: 'artifact',
  validateRecord: validateArtifactRecord,
  signals: (records, _params, context) => artifactSignals(records, context),
});
