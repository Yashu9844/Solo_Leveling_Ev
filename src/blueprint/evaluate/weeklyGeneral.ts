// The weekly review of a generated System (platform/02 §17.2-17.3): the rules that notice a pattern, one weekly-quest proposal per
// instrument that can propose, the one correlation, and the evidence nudge. Everything is read from the Blueprint's own instruments and
// records, and says nothing but through their labels (I20). Pure. The owner's System keeps the legacy readers.
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { RuleProposal } from '../../engine/rules';
import type { QuestRecoveredPayload, SystemEvent } from '../../engine/types';
import type { InstrumentRecord } from '../../instruments/framework';
import type { InstrumentConfig, SystemBlueprint } from '../schema';
import { evidenceLines } from './evidenceMessages';

const shift = (date: string, days: number): string => format(addDays(parseISO(date), days), 'yyyy-MM-dd');
const within = (date: string, asOf: string, days: number): boolean => { const diff = differenceInCalendarDays(parseISO(asOf), parseISO(date)); return diff >= 0 && diff < days; };

/* ── rules ───────────────────────────────────────────────────────────── */

/** Needs more than the ratio's worth of input sessions before it speaks: one LEARN session and no SHIP is not a pattern. */
const RATIO_MIN_INPUT = 4;

export function generalizedRules(blueprint: SystemBlueprint, events: readonly SystemEvent[], recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>, today: string): RuleProposal[] {
  const out: RuleProposal[] = [];
  for (const rule of blueprint.rules.filter((candidate) => candidate.enabled)) {
    const params = (rule.params ?? {}) as Record<string, unknown>;
    if (rule.kind === 'MODE_RATIO') {
      const instrument = blueprint.instruments.find((candidate) => candidate.id === params.instrumentId);
      if (!instrument) continue;
      const inputMode = typeof params.inputMode === 'string' ? params.inputMode : 'LEARN';
      const outputMode = typeof params.outputMode === 'string' ? params.outputMode : 'SHIP';
      const windowDays = Number(params.windowDays ?? 14);
      const ratio = Number(params.ratio ?? 3);
      const sessions = (recordsByInstrument.get(instrument.id) ?? []).filter((record) => within(record.localDate, today, windowDays));
      const input = sessions.filter((record) => record.record.mode === inputMode).length;
      const output = sessions.filter((record) => record.record.mode === outputMode).length;
      if (input >= RATIO_MIN_INPUT && input > ratio * output) {
        out.push({
          rule: rule.id,
          message: `${instrument.label}: ${input} ${inputMode.toLowerCase()} to ${output} ${outputMode.toLowerCase()} in ${windowDays} days. This week’s target: ${outputMode.toLowerCase()} only.`,
          fires_on: `${inputMode.toLowerCase()}:${outputMode.toLowerCase()} ratio > ${ratio}:1 over ${windowDays} days`,
        });
      }
    } else if (rule.kind === 'WRONG_TIME') {
      const windowDays = Number(params.windowDays ?? 14);
      const threshold = Number(params.count ?? 3);
      const count = events.filter((event) => event.type === 'QUEST_RECOVERED' && within(event.local_date, today, windowDays) && (event.payload as unknown as QuestRecoveredPayload).reason === 'wrong_time').length;
      if (count >= threshold) out.push({ rule: rule.id, message: `Wrong time, ${count} of the last ${windowDays} days. Worth moving the slot.`, fires_on: `>= ${threshold}x "wrong time" in ${windowDays} days` });
    }
    // SUBSTITUTE_SHARE, LOW_CONVERSION and WEAKEST_TOPIC are generated switched off (s12Reviews) and have no reader yet.
  }
  return out;
}

/* ── weekly quest proposals ──────────────────────────────────────────── */

export type WeeklyMeasure = 'minutes' | 'records';

/** One proposal, from one instrument. The person accepts at most one. */
export interface WeeklyOffer {
  id: string;
  instrumentId: string;
  domainId: string;
  measure: WeeklyMeasure;
  description: string;
  target: number;
  topic?: string;
}

/** What a week of records adds up to under a measure: minutes, or records (revisits are not new work). */
export function weeklyMeasure(records: readonly InstrumentRecord[], measure: WeeklyMeasure, topic?: string): number {
  return records
    .filter((record) => !record.record.isRevisit && (topic === undefined || record.record.topic === topic))
    .reduce((sum, record) => sum + (measure === 'minutes' ? Number(record.record.minutes ?? 0) : 1), 0);
}

const weekOf = (records: readonly InstrumentRecord[], from: string, to: string): InstrumentRecord[] => records.filter((record) => record.localDate >= from && record.localDate <= to);
const roundUp = (value: number, step: number): number => Math.max(step, Math.ceil(value / step) * step);
const STRETCH = 1.25;

/** How an instrument proposes, or undefined if it does not. */
function proposalFor(instrument: InstrumentConfig, last: readonly InstrumentRecord[]): Pick<WeeklyOffer, 'measure' | 'description' | 'target' | 'topic'> | undefined {
  const label = instrument.label.toLowerCase();
  switch (instrument.type) {
    case 'duration': {
      const prior = weeklyMeasure(last, 'minutes');
      const base = Number(instrument.params.defaultMinutes ?? 30) * 3;
      const target = roundUp(prior > 0 ? prior * STRETCH : base, 15);
      return { measure: 'minutes', target, description: `${target} minutes of ${label} this week` };
    }
    case 'practice_item': {
      const attempts = last.filter((record) => !record.record.isRevisit);
      const byTopic = new Map<string, { n: number; first: number }>();
      for (const record of attempts) {
        const topic = String(record.record.topic ?? '');
        if (!topic) continue;
        const bucket = byTopic.get(topic) ?? { n: 0, first: 0 };
        bucket.n += 1;
        if (record.record.outcome === 'first_attempt') bucket.first += 1;
        byTopic.set(topic, bucket);
      }
      const weakest = [...byTopic].sort(([aTopic, a], [bTopic, b]) => a.first / a.n - b.first / b.n || aTopic.localeCompare(bTopic))[0];
      if (!weakest) return { measure: 'records', target: 5, description: `5 ${label} this week` };
      const [topic, { n, first }] = weakest;
      const target = Math.max(10, Math.round(n * 1.5));
      return { measure: 'records', target, topic, description: `${target} ${label}, ${topic} focus (${Math.round((first / n) * 100)}% first-attempt, weakest)` };
    }
    case 'session': case 'study_block': {
      const prior = weeklyMeasure(last, 'records');
      const target = prior > 0 ? Math.ceil(prior * STRETCH) : 3;
      return { measure: 'records', target, description: `${target} ${label} this week` };
    }
    case 'artifact':
      // A resume version is not shipped work; a one-kind 'resume' instrument proposes nothing.
      return (instrument.params.kinds as string[] | undefined)?.every((kind) => kind === 'resume') ? undefined : { measure: 'records', target: 1, description: `Ship one: ${label}` };
    default:
      return undefined;
  }
}

export function weeklyOffers(blueprint: SystemBlueprint, recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>, today: string): WeeklyOffer[] {
  const thisWeek = { from: shift(today, -6), to: today };
  const rank = new Map(blueprint.domains.map((domain) => [domain.id, domain.priority]));
  return [...blueprint.instruments]
    .filter((instrument) => rank.has(instrument.domainId))
    .sort((a, b) => rank.get(a.domainId)! - rank.get(b.domainId)! || a.id.localeCompare(b.id))
    .flatMap((instrument) => {
      const proposal = proposalFor(instrument, weekOf(recordsByInstrument.get(instrument.id) ?? [], thisWeek.from, thisWeek.to));
      return proposal ? [{ id: `offer.${instrument.id}`, instrumentId: instrument.id, domainId: instrument.domainId, ...proposal }] : [];
    });
}

/* ── the correlation and the evidence nudge ──────────────────────────── */

/** The one insight a generated System can say about its own days: the kept guardrail's effect on the lead engine (12.1's P3 line). */
export function correlationInsight(blueprint: SystemBlueprint, events: readonly SystemEvent[], today: string): string | null {
  return evidenceLines(blueprint, events, today).find((line) => line.tier === 'P3' && /done the day after/.test(line.text))?.text ?? null;
}

/** "You shipped 3 artifacts this week. Does your portfolio say so?" - only for a domain that declares an evidence surface. */
export function evidenceNudge(blueprint: SystemBlueprint, recordsByInstrument: ReadonlyMap<string, readonly InstrumentRecord[]>, today: string): string | null {
  let best: { surface: string; count: number } | undefined;
  for (const domain of blueprint.domains.filter((candidate) => candidate.evidenceSurface)) {
    const count = blueprint.instruments
      .filter((instrument) => instrument.domainId === domain.id && instrument.type === 'artifact' && proposalFor(instrument, []) !== undefined)
      .reduce((sum, instrument) => sum + weekOf(recordsByInstrument.get(instrument.id) ?? [], shift(today, -6), today).length, 0);
    if (count > 0 && (!best || count > best.count)) best = { surface: domain.evidenceSurface!, count };
  }
  return best ? `You shipped ${best.count} ${best.count === 1 ? 'artifact' : 'artifacts'} this week. Does your ${best.surface} say so?` : null;
}
