import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { careerEventKindToStatus, followThroughRate, funnelFrom, passesQualityGate, substituteShare, type ApplicationFixture, type ApplicationStatus } from '../../src/engine/career';
import { pipelineFunnel, pipelineQualityPass, pipelineSignals, pipelineStageForEvent, validatePipelineRecord, type PipelineRecord } from '../../src/instruments/types/pipeline';
import type { InstrumentRecord } from '../../src/instruments/framework';

const statuses: ApplicationStatus[] = ['applied', 'responded', 'call', 'interview', 'onsite', 'offer', 'rejected', 'ghosted'];
const params = { stages: statuses, qualityGate: 'legacy' } as const;
const applicationArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }), local_date: fc.integer({ min: 1, max: 28 }).map((day) => `2026-09-${String(day).padStart(2, '0')}`),
  company: fc.string({ maxLength: 25 }), role: fc.string({ maxLength: 25 }), role_category: fc.string({ maxLength: 10 }),
  resume_version_id: fc.string({ maxLength: 8 }), why_line: fc.string({ maxLength: 40 }), quality_pass: fc.boolean(),
  status: fc.constantFrom(...statuses), followed_up_at: fc.option(fc.constant('2026-09-20'), { nil: undefined }), followup_due_at: fc.option(fc.constant('2026-09-10'), { nil: undefined }),
});

function record(application: ApplicationFixture): InstrumentRecord<PipelineRecord> {
  return {
    id: application.id, eventId: `event-${application.id}`, instrumentId: 'career.pipeline', instrumentType: 'pipeline', domainId: 'career', blueprintVersion: 1, localDate: application.local_date,
    record: { kind: 'application', applicationId: application.id, company: application.company, role: application.role, roleCategory: application.role_category, resumeVersionId: application.resume_version_id, whyLine: application.why_line, qualityPass: application.quality_pass, status: application.status, followedUpAt: application.followed_up_at, followupDueAt: application.followup_due_at },
  };
}

describe('pipeline instrument (loop 3.3)', () => {
  it('validates record contracts', () => {
    expect(validatePipelineRecord(record({ id: 'a', local_date: '2026-09-01', company: 'A', role: 'Engineer', role_category: 'dev', resume_version_id: 'r', why_line: 'A sufficiently specific reason.', quality_pass: true, status: 'applied' }).record, params)).toEqual([]);
    expect(validatePipelineRecord({ kind: 'substitute', minutes: -1 }, params)).toHaveLength(1);
  });

  it('matches legacy quality, funnel, follow-through, and stage mappings over 10,000 corpora', () => {
    fc.assert(fc.property(fc.array(applicationArb, { maxLength: 40 }), fc.array(fc.constantFrom<'application' | 'substitute'>('application', 'substitute'), { maxLength: 40 }), (applications, kinds) => {
      const records = applications.map(record);
      expect(pipelineFunnel(records)).toEqual(funnelFrom(applications, []));
      const signals = pipelineSignals(records, { localDate: '2026-09-28', from: '2026-09-01', to: '2026-09-28' });
      expect(signals.followthrough_rate).toBe(followThroughRate(applications, '2026-09-28'));
      expect(signals.quality_rate).toBe(funnelFrom(applications, []).qualityPassRate);
      const completionRecords: InstrumentRecord<PipelineRecord>[] = kinds.map((kind, index) => ({
        id: `completion-${index}`, eventId: `completion-event-${index}`, instrumentId: 'career.pipeline', instrumentType: 'pipeline', domainId: 'career', blueprintVersion: 1, localDate: '2026-09-01',
        record: kind === 'substitute'
          ? { kind: 'substitute', minutes: 25, substituteKind: 'mock' }
          : { kind: 'application', applicationId: `application-${index}`, company: 'Acme', role: 'Engineer', roleCategory: 'dev', resumeVersionId: 'resume', whyLine: 'A sufficiently specific reason for this application.', qualityPass: true, status: 'applied' },
      }));
      expect(pipelineSignals(completionRecords, { localDate: '2026-09-28', from: '2026-09-01', to: '2026-09-28' }).substitute_share).toBe(substituteShare(kinds));
      for (const application of applications) {
        expect(pipelineQualityPass(record(application).record as Extract<PipelineRecord, { kind: 'application' }>, undefined)).toBe(passesQualityGate(application, undefined));
      }
      for (const kind of ['response', 'call', 'interview', 'onsite', 'offer', 'rejection', 'conversation', 'mock', 'followup'] as const) expect(pipelineStageForEvent(kind)).toBe(careerEventKindToStatus(kind));
    }), { numRuns: 10_000 });
  });
});
