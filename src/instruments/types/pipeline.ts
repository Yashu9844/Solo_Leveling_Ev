import {
  careerEventKindToStatus,
  followThroughRate,
  funnelFrom,
  passesQualityGate,
  substituteShare,
  type ApplicationFixture,
  type ApplicationStatus,
  type CareerEventFixture,
  type FunnelResult,
} from '../../engine/career';
import type { CareerEventKind } from '../../engine/types';
import { defineInstrument, type InstrumentEvaluationContext, type InstrumentIssue, type InstrumentRecord } from '../framework';

export type PipelineRecord = Record<string, unknown> & (
  | { kind: 'application'; applicationId: string; company: string; role: string; roleCategory: string; resumeVersionId: string; whyLine: string; qualityPass: boolean; status: ApplicationStatus; source?: string; statusHistory?: { status: ApplicationStatus; date: string }[]; followedUpAt?: string; followupDueAt?: string }
  | { kind: 'substitute'; minutes: number; substituteKind: 'conversation' | 'mock' }
  | { kind: 'event'; eventKind: CareerEventKind; applicationId?: string; stuckOn?: string }
  | { kind: 'followup'; applicationId: string }
);

export type PipelineParams = Record<string, unknown> & { stages: readonly string[]; qualityGate: string };

function applications(records: readonly InstrumentRecord<PipelineRecord>[]): ApplicationFixture[] {
  return records.flatMap((item) => {
    const record = item.record;
    if (record.kind !== 'application') return [];
    return [{
      id: record.applicationId, local_date: item.localDate, company: record.company, role: record.role,
      role_category: record.roleCategory, resume_version_id: record.resumeVersionId, why_line: record.whyLine,
      quality_pass: record.qualityPass, status: record.status, followed_up_at: record.followedUpAt,
      followup_due_at: record.followupDueAt,
    }];
  });
}

export function validatePipelineRecord(record: unknown, params: PipelineParams): InstrumentIssue[] {
  if (!record || typeof record !== 'object') return [{ code: 'I-PIPE-01', path: 'record', message: 'A pipeline record must be an object.' }];
  const item = record as Partial<PipelineRecord>;
  if (!item.kind || !['application', 'substitute', 'event', 'followup'].includes(item.kind)) return [{ code: 'I-PIPE-02', path: 'record.kind', message: 'Choose a supported pipeline record kind.' }];
  if (item.kind === 'application') {
    const application = item as Extract<PipelineRecord, { kind: 'application' }>;
    const missing = !application.applicationId || !application.company || !application.role || !application.roleCategory || !application.resumeVersionId || typeof application.whyLine !== 'string' || typeof application.qualityPass !== 'boolean' || !application.status;
    return missing ? [{ code: 'I-PIPE-03', path: 'record', message: 'An application requires its identity, quality evidence, and stage.' }] : [];
  }
  if (item.kind === 'substitute') return Number.isFinite((item as Extract<PipelineRecord, { kind: 'substitute' }>).minutes) && ((item as Extract<PipelineRecord, { kind: 'substitute' }>).minutes >= 0) ? [] : [{ code: 'I-PIPE-04', path: 'record.minutes', message: 'Substitute minutes must be non-negative.' }];
  if (!item.applicationId && item.kind === 'followup') return [{ code: 'I-PIPE-05', path: 'record.applicationId', message: 'A follow-up needs an application.' }];
  if (item.kind === 'event' && !(item as Extract<PipelineRecord, { kind: 'event' }>).eventKind) return [{ code: 'I-PIPE-06', path: 'record.eventKind', message: 'An event needs a stage kind.' }];
  void params;
  return [];
}

/** Legacy-equivalent quality decision for a new application. */
export function pipelineQualityPass(record: Extract<PipelineRecord, { kind: 'application' }>, previousWhyLine: string | undefined): boolean {
  return passesQualityGate({
    id: record.applicationId, local_date: '', company: record.company, role: record.role, role_category: record.roleCategory,
    resume_version_id: record.resumeVersionId, why_line: record.whyLine, quality_pass: false, status: record.status,
  }, previousWhyLine);
}

export function pipelineFunnel(records: readonly InstrumentRecord<PipelineRecord>[]): FunnelResult {
  return funnelFrom(applications(records), []);
}

export function pipelineStageCount(records: readonly InstrumentRecord<PipelineRecord>[], stage: keyof Pick<FunnelResult, 'applications' | 'responses' | 'calls' | 'loops' | 'onsites' | 'offers' | 'rejected' | 'noResponse'>): number {
  return pipelineFunnel(records)[stage];
}

export function pipelineSignals(records: readonly InstrumentRecord<PipelineRecord>[], context: InstrumentEvaluationContext): Readonly<Record<string, number>> {
  const appRows = applications(records);
  const funnel = funnelFrom(appRows, []);
  const stage = context.filter?.stage as keyof FunnelResult | undefined;
  const completionKinds = records.flatMap((item) => item.record.kind === 'substitute' ? ['substitute' as const] : item.record.kind === 'application' && item.record.qualityPass ? ['application' as const] : []);
  return {
    submitted: funnel.applications,
    quality_count: appRows.filter((application) => application.quality_pass).length,
    quality_rate: funnel.qualityPassRate,
    followthrough_rate: followThroughRate(appRows, context.to),
    stage_counts: stage && stage in funnel && typeof funnel[stage] === 'number' ? funnel[stage] as number : funnel.applications,
    substitute_share: substituteShare(completionKinds),
  };
}

/** Canonical stage mapping shared with the legacy career write adapter. */
export function pipelineStageForEvent(kind: CareerEventKind): ApplicationStatus | undefined {
  return careerEventKindToStatus(kind);
}

export const pipelineInstrument = defineInstrument<PipelineParams, PipelineRecord>({
  type: 'pipeline',
  validateRecord: validatePipelineRecord,
  signals: (records, _params, context) => pipelineSignals(records, context),
});

export type { CareerEventFixture };
