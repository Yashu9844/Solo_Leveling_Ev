// Writing a duration record, and the artifact a session may ship (platform/03 §27.2).
import type { InstrumentConfig } from '../../../blueprint/schema';
import { realDeps } from '../../../store/deps';
import { recordInstrument } from '../../../store/instruments';
import { legacyRecordDuration } from '../legacy/duration';
import { isLegacyBound } from '../types';

export interface ShippedValues {
  kind: string;
  title: string;
  costPerTaskStated?: boolean;
}

export interface DurationValues {
  minutes: number;
  mode?: string;
  projectKey?: string;
  /** Set when the session shipped something; recorded through the artifact sibling. */
  shipped?: ShippedValues;
}

export interface RecorderContext {
  today: string;
  arcId: string;
}

export function artifactSibling(siblings: readonly InstrumentConfig[]): InstrumentConfig | undefined {
  return siblings.find((sibling) => sibling.type === 'artifact' && !((sibling.params.kinds as string[] | undefined) ?? []).every((kind) => kind === 'resume' || kind === 'portfolio'));
}

export async function recordDuration(instrument: InstrumentConfig, siblings: readonly InstrumentConfig[], values: DurationValues, ctx: RecorderContext): Promise<void> {
  if (isLegacyBound(instrument)) return legacyRecordDuration(instrument.id, values, ctx);
  await recordInstrument(instrument.id, {
    minutes: values.minutes, ...(values.mode ? { mode: values.mode } : {}), ...(values.projectKey ? { projectKey: values.projectKey } : {}),
  }, ctx.today, realDeps);
  const artifact = artifactSibling(siblings);
  if (values.shipped && artifact) {
    await recordArtifact(artifact, { ...values.shipped, projectKey: values.projectKey ?? values.shipped.title }, ctx);
  }
}

export interface ArtifactValues extends ShippedValues {
  projectKey: string;
  url?: string;
}

export async function recordArtifact(instrument: InstrumentConfig, values: ArtifactValues, ctx: RecorderContext): Promise<void> {
  if (isLegacyBound(instrument)) throw new Error(`"${instrument.id}" is a legacy artifact; the owner's artifacts are shipped through their build session.`);
  await recordInstrument(instrument.id, {
    kind: values.kind, title: values.title.trim(), projectKey: values.projectKey.trim(),
    ...(values.url?.trim() ? { url: values.url.trim() } : {}),
    ...(values.kind === 'project' && values.costPerTaskStated !== undefined ? { costPerTaskStated: values.costPerTaskStated } : {}),
  }, ctx.today, realDeps);
}
