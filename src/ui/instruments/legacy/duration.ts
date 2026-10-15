// The owner's build sessions keep writing BUILD_SESSION_LOGGED (and ARTIFACT_SHIPPED for what they ship)
// through store/build.ts.
import { realDeps } from '../../../store/deps';
import { getEngineConfig } from '../../../store/engineConfig';
import { logBuildSession, type LogBuildSessionInput } from '../../../store/build';
import type { DurationValues, RecorderContext } from '../recorders/duration';

export async function legacyRecordDuration(instrumentId: string, values: DurationValues, ctx: RecorderContext): Promise<void> {
  if (instrumentId !== 'build.sessions') throw new Error(`"${instrumentId}" has no legacy duration writer.`);
  await logBuildSession(
    ctx.today,
    ctx.arcId,
    {
      mode: values.mode as LogBuildSessionInput['mode'],
      minutes: values.minutes,
      projectKey: (values.projectKey ?? '').trim(),
      shippedArtifact: values.shipped
        ? {
            kind: values.shipped.kind as NonNullable<LogBuildSessionInput['shippedArtifact']>['kind'],
            title: values.shipped.title.trim(),
            costPerTaskStated: values.shipped.kind === 'project' ? values.shipped.costPerTaskStated : undefined,
          }
        : undefined,
    },
    getEngineConfig(),
    realDeps
  );
}
