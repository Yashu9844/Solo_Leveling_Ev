// final/05-motivation-moments-notifications.md §6 — the weekly review's
// structured metrics: attribute movement (IMPROVED/DECLINED), the single
// BOTTLENECK, NEXT WEEK's proposals, the resume-content nudge, and the
// sleep/DSA correlational insight (resumeNudgeFor / sleepDsaCorrelation
// below). The rest of the review (the domain summary lines —
// applications, problems, sessions) is plain arithmetic the UI renders
// directly from store data, not modelled here.
import { addDays, format, parseISO } from 'date-fns';
import type { RuleProposal } from './rules';
import type { Attribute, AttributeResult } from './attributes';

export interface AttributeDelta {
  attribute: Attribute;
  before: number;
  after: number;
  delta: number;
}

/** Pure. Pairs two attribute snapshots (last week's close, this week's
 * close) by attribute name. Both arrays are expected to carry all six
 * attributes; a missing pairing is skipped rather than assumed 0, since
 * "no snapshot yet" (arc younger than two weeks) is a different thing
 * from "genuinely at 0". */
export function attributeDeltas(before: AttributeResult[], after: AttributeResult[]): AttributeDelta[] {
  const beforeByAttribute = new Map(before.map((r) => [r.attribute, r.value]));
  const deltas: AttributeDelta[] = [];
  for (const a of after) {
    const b = beforeByAttribute.get(a.attribute);
    if (b === undefined) continue;
    deltas.push({ attribute: a.attribute, before: b, after: a.value, delta: a.value - b });
  }
  return deltas;
}

/** Pure. The single most-declined attribute, or null if nothing declined
 * (every attribute held or rose — final/05 §6 shows exactly one
 * BOTTLENECK line, not a ranked list). */
export function bottleneckFrom(deltas: AttributeDelta[]): Attribute | null {
  const declined = deltas.filter((d) => d.delta < 0);
  if (declined.length === 0) return null;
  return declined.reduce((worst, d) => (d.delta < worst.delta ? d : worst)).attribute;
}

/** Pure. Up to `limit` attributes with the largest positive delta,
 * strongest first — final/05 §6's "IMPROVED Problem solving · Momentum". */
export function improvedFrom(deltas: AttributeDelta[], limit = 2): Attribute[] {
  return deltas
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit)
    .map((d) => d.attribute);
}

/** Pure. Up to `limit` attributes with the largest negative delta,
 * worst first. */
export function declinedFrom(deltas: AttributeDelta[], limit = 2): Attribute[] {
  return deltas
    .filter((d) => d.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit)
    .map((d) => d.attribute);
}

export interface WeeklyReviewResult {
  improved: Attribute[];
  declined: Attribute[];
  bottleneck: Attribute | null;
  proposals: RuleProposal[];
}

/** Pure assembly — the store layer computes `deltas` (from two
 * store/attributes.ts snapshots) and `proposals` (from
 * engine/rules.ts's evaluateRules over the week's events); this just
 * combines them into the review's structured shape. */
export function weeklyReviewFor(deltas: AttributeDelta[], proposals: RuleProposal[]): WeeklyReviewResult {
  return {
    improved: improvedFrom(deltas),
    declined: declinedFrom(deltas),
    bottleneck: bottleneckFrom(deltas),
    proposals,
  };
}

/** Pure. final/02 §5's resume-content nudge pattern ("You shipped an
 * eval suite and 2 features this week. Does your resume say so?") —
 * generalised to whatever count of artifacts actually shipped, any
 * kind, since the example itself mixes kinds. Null when nothing shipped
 * — no nudge to make. */
export function resumeNudgeFor(shippedArtifactCount: number): string | null {
  if (shippedArtifactCount === 0) return null;
  const noun = shippedArtifactCount === 1 ? 'artifact' : 'artifacts';
  return `You shipped ${shippedArtifactCount} ${noun} this week. Does your resume say so?`;
}

export interface WakeRecord {
  local_date: string;
  onTime: boolean;
}

export interface DsaDayRate {
  local_date: string;
  firstAttemptRate: number; // 0-1, that day's non-revisit attempts
}

export interface SleepDsaCorrelation {
  missedNights: number;
  afterMissRate: number; // 0-1, mean DSA first-attempt rate the day after a missed wake window
  afterOnTimeRate: number; // 0-1, mean rate the day after an on-time wake
  deltaPoints: number; // afterOnTimeRate - afterMissRate, in percentage points
}

/**
 * Pure. final/05 §6's correlational insight ("Late on 3 nights... your
 * DSA first-attempt rate after a missed window is 27 points lower") —
 * joins each wake record to the FOLLOWING day's DSA first-attempt rate
 * and compares the mean after a miss vs. after an on-time wake. Null
 * when there isn't at least one of each to compare — a correlation
 * computed from zero examples on either side isn't a real comparison,
 * it's a coincidence dressed as one.
 */
export function sleepDsaCorrelation(wakeRecords: WakeRecord[], dsaRates: DsaDayRate[]): SleepDsaCorrelation | null {
  const rateByDate = new Map(dsaRates.map((d) => [d.local_date, d.firstAttemptRate]));
  const afterMiss: number[] = [];
  const afterOnTime: number[] = [];

  for (const record of wakeRecords) {
    const nextDate = format(addDays(parseISO(record.local_date), 1), 'yyyy-MM-dd');
    const rate = rateByDate.get(nextDate);
    if (rate === undefined) continue;
    (record.onTime ? afterOnTime : afterMiss).push(rate);
  }

  if (afterMiss.length === 0 || afterOnTime.length === 0) return null;

  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const afterMissRate = mean(afterMiss);
  const afterOnTimeRate = mean(afterOnTime);

  return {
    missedNights: wakeRecords.filter((r) => !r.onTime).length,
    afterMissRate,
    afterOnTimeRate,
    deltaPoints: Math.round((afterOnTimeRate - afterMissRate) * 100),
  };
}
