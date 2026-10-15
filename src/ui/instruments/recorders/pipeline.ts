// Writing to a pipeline instrument (platform/03 §27.2): applications, the resume
// versions they cite, and the substitute work a duration sibling stands in with.
// The sheet talks to a PipelineGateway; the gateway decides which store runs.
import type { InstrumentConfig } from '../../../blueprint/schema';
import { db } from '../../../db/db';
import { pipelineQualityPass, type PipelineRecord } from '../../../instruments/types/pipeline';
import { realDeps } from '../../../store/deps';
import { recordInstrument } from '../../../store/instruments';
import { legacyPipelineGateway } from '../legacy/pipeline';
import { isLegacyBound } from '../types';

export interface ApplicationValues {
  company: string;
  role: string;
  category: string;
  source: string;
  resumeVersionId: string;
  whyLine: string;
}

export interface ResumeChoice {
  id: string;
  label: string;
}

export interface PipelineGateway {
  /** Null when the System keeps no resume artifacts, in which case the sheet shows no resume field. */
  resumes: { list: () => Promise<ResumeChoice[]>; create: (label: string) => Promise<string> } | null;
  /** Resolves to whether the application passed the quality gate (a failed one still logs). */
  logApplication: (values: ApplicationValues) => Promise<boolean>;
  /** Null when the domain has no duration sibling to stand in with. */
  logSubstitute: ((minutes: number, kind: string) => Promise<void>) | null;
}

export interface GatewayContext {
  instrument: InstrumentConfig;
  siblings: readonly InstrumentConfig[];
  today: string;
  arcId: string;
}

/** The artifact sibling that holds resume versions, if any. */
function resumeInstrument(siblings: readonly InstrumentConfig[]): InstrumentConfig | undefined {
  return siblings.find((sibling) => sibling.type === 'artifact' && Array.isArray(sibling.params.kinds) && (sibling.params.kinds as string[]).includes('resume'));
}

function genericGateway({ instrument, siblings, today }: GatewayContext): PipelineGateway {
  const resumeSource = resumeInstrument(siblings);
  const durationSibling = siblings.find((sibling) => sibling.type === 'duration');
  return {
    resumes: resumeSource ? {
      list: async () => (await db.instrument_record.where('instrument_id').equals(resumeSource.id).toArray()).map((row) => ({ id: row.id, label: String(row.record.title ?? row.id) })),
      create: (label) => recordInstrument(resumeSource.id, { kind: 'resume', title: label, projectKey: label }, today, realDeps),
    } : null,
    logApplication: async (values) => {
      const rows = await db.instrument_record.where('[instrument_id+local_date]').equals([instrument.id, today]).toArray();
      const previous = [...rows].reverse().map((row) => row.record).find((record) => record.kind === 'application');
      const applicationId = realDeps.newId();
      const record = {
        kind: 'application' as const, applicationId, company: values.company, role: values.role, roleCategory: values.category,
        source: values.source, resumeVersionId: values.resumeVersionId || 'none', whyLine: values.whyLine, qualityPass: false, status: 'applied' as const,
      };
      const qualityPass = pipelineQualityPass(record as Extract<PipelineRecord, { kind: 'application' }>, previous?.whyLine as string | undefined);
      await recordInstrument(instrument.id, { ...record, qualityPass }, today, realDeps);
      return qualityPass;
    },
    logSubstitute: durationSibling ? (minutes, kind) => recordInstrument(durationSibling.id, { minutes, mode: kind }, today, realDeps).then(() => undefined) : null,
  };
}

export function pipelineGateway(context: GatewayContext): PipelineGateway {
  return isLegacyBound(context.instrument) ? legacyPipelineGateway(context) : genericGateway(context);
}
