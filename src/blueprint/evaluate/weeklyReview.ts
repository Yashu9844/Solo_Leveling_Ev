// The weekly review (platform/02 §17.2), driven by a Blueprint: this week's
// and last week's headline numbers, how each attribute moved, the rules that
// fired, the resume nudge and the sleep/DSA correlation. The pure engine
// helpers (attributeDeltas, weeklyReviewFor, resumeNudgeFor,
// sleepDsaCorrelation, evaluateRules) are the same ones the legacy store uses;
// what changes is where their INPUTS come from — instrument records and
// Blueprint signals instead of the legacy tables. The weekly-quest proposal
// stays with store/weeklyQuest.ts (it is stateful, not a read model).
import { addDays, format, parseISO } from 'date-fns';
import { evaluateRules } from '../../engine/rules';
import { withinWakeWindowMinutes } from '../../engine/sleep';
import { attributeDeltas, resumeNudgeFor, sleepDsaCorrelation, weeklyReviewFor, type DsaDayRate, type SleepDsaCorrelation, type WakeRecord, type WeeklyReviewResult } from '../../engine/weeklyReview';
import type { AttributeResult } from '../../engine/attributes';
import type { SystemEvent } from '../../engine/types';
import { buildProjectionsV2 } from '../engine/projections';
import type { SystemBlueprint } from '../schema';
import { evaluateAttributes } from './attribute';
import { readModelEnv, type ReadModelInput } from './readModel';
import { recordsFor, resolveSignal } from './signals';
import { correlationInsight, evidenceNudge, generalizedRules, weeklyOffers, type WeeklyOffer } from './weeklyGeneral';

export interface WeeklyReviewV2 {
  thisWeek: Record<string, number>;
  lastWeek: Record<string, number>;
  review: WeeklyReviewResult;
  resumeNudge: string | null;
  sleepDsaCorrelation: SleepDsaCorrelation | null;
  /** Present only for a generated System: its own rows, its one correlation, and a weekly-quest offer per proposing instrument. */
  generated?: {
    rows: { key: string; label: string; thisWeek: number; lastWeek: number }[];
    insight: string | null;
    offers: WeeklyOffer[];
    attributeLabels: Record<string, string>;
  };
}

/** Which engine rule each Blueprint rule kind switches on. */
const RULE_FOR_KIND: Record<string, string> = { MODE_RATIO: 'LEARN_SHIP_RATIO', WRONG_TIME: 'WRONG_TIME_PATTERN' };

function shift(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

export function evaluateWeeklyReview(blueprint: SystemBlueprint, input: Omit<ReadModelInput, 'blueprint' | 'asOf'>, today: string): WeeklyReviewV2 {
  // The projections are the expensive part of a read and do not depend on the date asked about.
  const projections = input.projections ?? buildProjectionsV2([...input.events], { now: () => '', newId: () => '' }, [blueprint]);
  const here = readModelEnv({ ...input, projections, blueprint, asOf: today });
  // Last week's attributes are read as the legacy store reads them: with the mastery of ALL blocks (see SignalEnv.unboundedTotals).
  const before = { ...readModelEnv({ ...input, projections, blueprint, asOf: shift(today, -7) }), unboundedTotals: true };
  const metrics = (env: typeof here) => Object.fromEntries((blueprint.reviews.weeklyMetrics ?? []).map((row) => [row.key, resolveSignal(row.signal, env)]));

  const afterAttributes = evaluateAttributes(blueprint, here) as unknown as AttributeResult[];
  const beforeAttributes = evaluateAttributes(blueprint, before) as unknown as AttributeResult[];
  const generated = blueprint.origin !== 'legacy';
  const enabled = new Set(blueprint.rules.filter((rule) => rule.enabled).map((rule) => RULE_FOR_KIND[rule.kind]).filter(Boolean));
  const proposals = generated
    ? generalizedRules(blueprint, input.events, here.recordsByInstrument, today)
    : evaluateRules([...input.events] as SystemEvent[], today).filter((proposal) => enabled.has(proposal.rule));
  const review = weeklyReviewFor(attributeDeltas(beforeAttributes, afterAttributes), proposals);

  const artifactInstrument = blueprint.instruments.find((instrument) => instrument.type === 'artifact' && instrument.domainId === 'build') ?? blueprint.instruments.find((instrument) => instrument.type === 'artifact');
  const shipped = artifactInstrument ? recordsFor(here.recordsByInstrument.get(artifactInstrument.id) ?? [], 'window_7', undefined, here).length : 0;

  const thisWeek = metrics(here);
  const lastWeek = metrics(before);
  if (generated) {
    return {
      thisWeek, lastWeek, review, resumeNudge: evidenceNudge(blueprint, here.recordsByInstrument, today), sleepDsaCorrelation: null,
      generated: {
        rows: (blueprint.reviews.weeklyMetrics ?? []).map((row) => ({ key: row.key, label: row.label, thisWeek: thisWeek[row.key] ?? 0, lastWeek: lastWeek[row.key] ?? 0 })),
        insight: correlationInsight(blueprint, input.events, today),
        offers: weeklyOffers(blueprint, here.recordsByInstrument, today),
        attributeLabels: Object.fromEntries(blueprint.attributes.defs.map((def) => [def.id, def.name])),
      },
    };
  }
  return { thisWeek, lastWeek, review, resumeNudge: resumeNudgeFor(shipped), sleepDsaCorrelation: correlation(blueprint, here) };
}

function correlation(blueprint: SystemBlueprint, env: ReturnType<typeof readModelEnv>): SleepDsaCorrelation | null {
  const wake = blueprint.instruments.find((instrument) => instrument.type === 'time_window');
  const practice = blueprint.instruments.find((instrument) => instrument.type === 'practice_item');
  if (!wake || !practice) return null;
  const target = wake.params.targetTime as string;
  const tolerance = wake.params.toleranceMinutes as number;
  const wakeRecords: WakeRecord[] = recordsFor(env.recordsByInstrument.get(wake.id) ?? [], 'window_7', undefined, env)
    .map((record) => ({ local_date: record.localDate, onTime: withinWakeWindowMinutes(record.record.minutes as number, target, tolerance) }));
  // The rate per day across the whole log, not just this week: a wake record
  // at the week's edge needs the NEXT day's rate, which may fall outside it.
  const byDate = new Map<string, { firstAttempt: number; total: number }>();
  for (const record of env.recordsByInstrument.get(practice.id) ?? []) {
    if (record.record.isRevisit) continue;
    const bucket = byDate.get(record.localDate) ?? { firstAttempt: 0, total: 0 };
    bucket.total += 1;
    if (record.record.outcome === 'first_attempt') bucket.firstAttempt += 1;
    byDate.set(record.localDate, bucket);
  }
  const rates: DsaDayRate[] = [...byDate].map(([local_date, bucket]) => ({ local_date, firstAttemptRate: bucket.firstAttempt / bucket.total }));
  return sleepDsaCorrelation(wakeRecords, rates);
}
