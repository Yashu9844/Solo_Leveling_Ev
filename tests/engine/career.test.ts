import { describe, it, expect } from 'vitest';
import { passesQualityGate, funnelFrom, followThroughRate, substituteShare } from '../../src/engine/career';
import type { ApplicationFixture } from '../../src/engine/career';

function application(overrides: Partial<ApplicationFixture> = {}): ApplicationFixture {
  return {
    id: 'app-1',
    local_date: '2026-09-05',
    company: 'Acme',
    role: 'Backend Engineer',
    role_category: 'backend',
    resume_version_id: 'resume-1',
    why_line: 'Their agent infra work matches what I want to build next.',
    quality_pass: true,
    status: 'applied',
    ...overrides,
  };
}

describe('passesQualityGate', () => {
  it('passes a well-formed application with a fresh why_line', () => {
    expect(passesQualityGate(application(), undefined)).toBe(true);
  });

  it('rejects a missing company or role', () => {
    expect(passesQualityGate(application({ company: '' }), undefined)).toBe(false);
    expect(passesQualityGate(application({ role: '  ' }), undefined)).toBe(false);
  });

  it('rejects a missing resume version', () => {
    expect(passesQualityGate(application({ resume_version_id: '' }), undefined)).toBe(false);
  });

  it('rejects a why_line under 15 characters', () => {
    expect(passesQualityGate(application({ why_line: 'good fit' }), undefined)).toBe(false);
  });

  it('rejects a why_line duplicating the previous application', () => {
    const line = 'Their agent infra work matches what I want to build next.';
    expect(passesQualityGate(application({ why_line: line }), line)).toBe(false);
  });

  it('accepts a why_line that differs from the previous one', () => {
    expect(passesQualityGate(application(), 'A completely different reason for applying here.')).toBe(true);
  });
});

describe('funnelFrom', () => {
  it('computes conversion counts and rates against a fixture', () => {
    const applications: ApplicationFixture[] = [
      application({ id: 'a1', status: 'offer', quality_pass: true }),
      application({ id: 'a2', status: 'onsite', quality_pass: true }),
      application({ id: 'a3', status: 'interview', quality_pass: true }),
      application({ id: 'a4', status: 'call', quality_pass: true }),
      application({ id: 'a5', status: 'responded', quality_pass: false }),
      application({ id: 'a6', status: 'rejected', quality_pass: true }),
      application({ id: 'a7', status: 'applied', quality_pass: true }),
      application({ id: 'a8', status: 'ghosted', quality_pass: true }),
    ];
    const result = funnelFrom(applications, []);
    expect(result.applications).toBe(8);
    expect(result.responses).toBe(5); // a1-a5 all reached at least 'responded'
    expect(result.calls).toBe(4); // a1-a4 reached at least 'call'
    expect(result.loops).toBe(3); // a1-a3 reached at least 'interview'
    expect(result.onsites).toBe(2); // a1-a2 reached at least 'onsite'
    expect(result.offers).toBe(1); // a1 only
    expect(result.rejected).toBe(1); // a6
    expect(result.noResponse).toBe(2); // a7 (applied), a8 (ghosted)
  });

  it('every response-stage count is monotonically non-increasing down the funnel', () => {
    const applications: ApplicationFixture[] = [
      application({ id: 'a1', status: 'offer' }),
      application({ id: 'a2', status: 'onsite' }),
      application({ id: 'a3', status: 'call' }),
      application({ id: 'a4', status: 'applied' }),
    ];
    const result = funnelFrom(applications, []);
    expect(result.responses).toBeGreaterThanOrEqual(result.calls);
    expect(result.calls).toBeGreaterThanOrEqual(result.loops);
    expect(result.loops).toBeGreaterThanOrEqual(result.onsites);
    expect(result.onsites).toBeGreaterThanOrEqual(result.offers);
  });

  it('response_rate and qualityPassRate are 0 for an empty fixture, not NaN', () => {
    const result = funnelFrom([], []);
    expect(result.response_rate).toBe(0);
    expect(result.qualityPassRate).toBe(0);
  });
});

describe('followThroughRate', () => {
  it('computes the share of eligible (overdue) applications followed up or closed', () => {
    const applications: ApplicationFixture[] = [
      application({ id: 'a1', followup_due_at: '2026-09-01', followed_up_at: '2026-09-02' }), // eligible, done
      application({ id: 'a2', followup_due_at: '2026-09-01', status: 'rejected' }), // eligible, closed
      application({ id: 'a3', followup_due_at: '2026-09-01' }), // eligible, not done
      application({ id: 'a4', followup_due_at: '2026-09-20' }), // not yet eligible
    ];
    const rate = followThroughRate(applications, '2026-09-05');
    expect(rate).toBeCloseTo(2 / 3);
  });

  it('is 0, not NaN, when nothing is eligible yet', () => {
    const applications: ApplicationFixture[] = [application({ followup_due_at: '2026-09-20' })];
    expect(followThroughRate(applications, '2026-09-05')).toBe(0);
  });
});

describe('substituteShare', () => {
  it('flags avoidance when substitutes exceed half of recent completions', () => {
    const kinds: ('application' | 'substitute')[] = [
      'substitute',
      'substitute',
      'application',
      'substitute',
      'application',
    ];
    expect(substituteShare(kinds)).toBeGreaterThan(0.5);
  });

  it('is 0 for an all-application window', () => {
    expect(substituteShare(['application', 'application'])).toBe(0);
  });
});
