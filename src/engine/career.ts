// final/02-career-system.md — the Controlled/External split (§1) is the
// structural rule: nothing past `applied` ever earns XP or gates rank.
// That invariant is enforced in engine/xp.ts (CAREER_EVENT_LOGGED yields
// no grant for any kind) and asserted directly in career.test.ts.
import type { CareerEventKind } from './types';

export type ApplicationStatus =
  | 'applied'
  | 'responded'
  | 'call'
  | 'interview'
  | 'onsite'
  | 'offer'
  | 'rejected'
  | 'ghosted';

export interface ApplicationFixture {
  id: string;
  local_date: string;
  company: string;
  role: string;
  role_category: string;
  resume_version_id: string;
  why_line: string;
  quality_pass: boolean;
  status: ApplicationStatus;
  followed_up_at?: string;
  followup_due_at?: string;
}

export interface CareerEventFixture {
  kind: string;
  local_date: string;
}

export interface FunnelResult {
  applications: number;
  responses: number;
  calls: number;
  loops: number;
  onsites: number;
  offers: number;
  rejected: number;
  noResponse: number;
  response_rate: number;
  qualityPassRate: number;
}

const STATUS_RANK: Record<ApplicationStatus, number> = {
  applied: 0,
  responded: 1,
  call: 2,
  interview: 3,
  onsite: 4,
  offer: 5,
  rejected: -1,
  ghosted: -1,
};

function atLeast(status: ApplicationStatus, threshold: ApplicationStatus): boolean {
  return STATUS_RANK[status] >= STATUS_RANK[threshold];
}

/**
 * Pure. Applies the application quality gate (final/02 §2.1) — all three
 * must hold: company + role recorded, a resume version selected (never
 * "none"), and a why_line >= 15 chars that isn't a duplicate of the
 * previous application's line. Condition 3 is the real gate.
 */
export function passesQualityGate(
  application: ApplicationFixture,
  previousWhyLineToday: string | undefined
): boolean {
  if (!application.company.trim() || !application.role.trim()) return false;
  if (!application.resume_version_id) return false;
  const line = application.why_line.trim();
  if (line.length < 15) return false;
  if (previousWhyLineToday !== undefined && line === previousWhyLineToday.trim()) return false;
  return true;
}

/** Pure. Career Funnel conversion maths — external, never scored (final/02 §4). */
export function funnelFrom(applications: ApplicationFixture[], events: CareerEventFixture[]): FunnelResult {
  void events; // status on each application is the funnel's source of truth; see the file header
  const total = applications.length;
  const responses = applications.filter((a) => atLeast(a.status, 'responded')).length;
  const calls = applications.filter((a) => atLeast(a.status, 'call')).length;
  const loops = applications.filter((a) => atLeast(a.status, 'interview')).length;
  const onsites = applications.filter((a) => atLeast(a.status, 'onsite')).length;
  const offers = applications.filter((a) => a.status === 'offer').length;
  const rejected = applications.filter((a) => a.status === 'rejected').length;
  const noResponse = applications.filter((a) => a.status === 'applied' || a.status === 'ghosted').length;
  const qualityPasses = applications.filter((a) => a.quality_pass).length;

  return {
    applications: total,
    responses,
    calls,
    loops,
    onsites,
    offers,
    rejected,
    noResponse,
    response_rate: total > 0 ? responses / total : 0,
    qualityPassRate: total > 0 ? qualityPasses / total : 0,
  };
}

/** Pure. Share of eligible applications (>= 10 days old, final/02 §3's
 * followup_due_at = applied + 10 days) that were followed up or closed
 * (moved past 'applied'). final/02 §4's "94 of 124 eligible". */
export function followThroughRate(applications: ApplicationFixture[], asOf: string): number {
  const eligible = applications.filter((a) => a.followup_due_at !== undefined && a.followup_due_at <= asOf);
  if (eligible.length === 0) return 0;
  const closedOrFollowedUp = eligible.filter((a) => a.followed_up_at !== undefined || a.status !== 'applied');
  return closedOrFollowedUp.length / eligible.length;
}

/** Pure. final/02 §2.2's avoidance detector: substitute work as a share
 * of the trailing window's CAREER completions. `careerCompletionKinds`
 * is one entry per CAREER quest completion in the window, 'application'
 * or 'substitute'. */
export function substituteShare(careerCompletionKinds: ('application' | 'substitute')[]): number {
  if (careerCompletionKinds.length === 0) return 0;
  const substitutes = careerCompletionKinds.filter((k) => k === 'substitute').length;
  return substitutes / careerCompletionKinds.length;
}

/** Pure. Maps a CAREER_EVENT_LOGGED kind to the application status it
 * moves to, or undefined for kinds that don't represent a funnel-stage
 * outcome ('conversation', 'mock', 'followup' — the CONTROLLED
 * substitute-work kinds that share this event type's audit trail).
 * Used both by the live write path (store/career.ts) and
 * db/domainProjections.ts's rebuild fold — one mapping, so they can
 * never quietly diverge. */
export function careerEventKindToStatus(kind: CareerEventKind): ApplicationStatus | undefined {
  switch (kind) {
    case 'response':
      return 'responded';
    case 'call':
      return 'call';
    case 'interview':
      return 'interview';
    case 'onsite':
      return 'onsite';
    case 'offer':
      return 'offer';
    case 'rejection':
      return 'rejected';
    default:
      return undefined;
  }
}
