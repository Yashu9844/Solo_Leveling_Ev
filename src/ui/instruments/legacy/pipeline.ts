// The owner's career pipeline keeps writing APPLICATION_LOGGED, RESUME_VERSION_CREATED and
// CAREER_SUBSTITUTE_LOGGED through store/career.ts (platform/02 §8.2).
import type { CareerSubstituteLoggedPayload } from '../../../engine/types';
import { createResumeVersion, getResumeVersions, logApplication, logSubstituteWork } from '../../../store/career';
import { realDeps } from '../../../store/deps';
import { getEngineConfig } from '../../../store/engineConfig';
import type { GatewayContext, PipelineGateway } from '../recorders/pipeline';

export function legacyPipelineGateway({ instrument, today, arcId }: GatewayContext): PipelineGateway {
  if (instrument.id !== 'career.applications') throw new Error(`"${instrument.id}" has no legacy pipeline writer.`);
  return {
    resumes: {
      list: async () => (await getResumeVersions()).map((version) => ({ id: version.id, label: version.label })),
      create: (label) => createResumeVersion(today, label, 'Created from the application log', arcId, realDeps),
    },
    logApplication: (values) =>
      logApplication(
        today,
        arcId,
        {
          company: values.company.trim(),
          role: values.role.trim(),
          roleCategory: values.category || 'other',
          source: values.source || 'jobboard',
          resumeVersionId: values.resumeVersionId,
          whyLine: values.whyLine.trim(),
        } as Parameters<typeof logApplication>[2],
        getEngineConfig(),
        realDeps
      ),
    logSubstitute: (minutes, kind) => logSubstituteWork(today, arcId, minutes, kind as CareerSubstituteLoggedPayload['kind'], getEngineConfig(), realDeps),
  };
}
