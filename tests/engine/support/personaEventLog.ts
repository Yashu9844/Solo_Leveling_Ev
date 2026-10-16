// Loop 9.1 (platform/04 §32.3): a Blueprint-driven activity generator.
//
// Where randomEventLog.ts toggles raw QUEST_COMPLETED events, this drives each *instrument* of a Blueprint with
// plausible records (the way the sheets would write them), then completes the quests whose criterion those records
// meet - so every read model (XP, attributes, skills, gates, bosses, reality) moves for a generated System exactly as
// it would in use. Deterministic: the same (blueprint, seed, profile) always yields the same log (mulberry32).
//
// Profiles:
//   steady      ~85% of days each quest is done, with a margin; ~35% of days extra records on every instrument
//   lapsing     two empty days in every ten, then floor-sized days until Reduced Mode lets go
//   burst       grinds the first domain hard every day, the others a quarter of the time (caps, headroom)
//   adversarial the least that counts: exactly the target, duplicate rationales, failed quality, cap probing
import { addDays, addMinutes, format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { evaluateCriterion } from '../../../src/blueprint/evaluate/criterion';
import { signalEnv, recordsFromEvents } from '../../../src/blueprint/evaluate/env';
import { activationEvent } from '../../../src/blueprint/activation';
import { instrumentIdemKey, questCompletedPayloadV2 } from '../../../src/blueprint/events';
import type { Criterion, InstrumentConfig, QuestTemplateDef, SystemBlueprint } from '../../../src/blueprint/schema';
import type { SystemEvent } from '../../../src/engine/types';
import type { InstrumentRecord } from '../../../src/instruments/framework';
import { mulberry32 } from './randomEventLog';

export type PersonaProfileKind = 'steady' | 'lapsing' | 'burst' | 'adversarial';
export interface PersonaProfile {
  kind: PersonaProfileKind;
  /** Days to simulate, 1..arc length (default: the whole arc). */
  days?: number;
}

type Leaf = Extract<Criterion, { kind: 'signal' }>;
type Rng = () => number;

const pick = <T>(items: readonly T[], index: number): T => items[index % items.length]!;

/** The time of day as minutes after midnight. */
const minutesOfTime = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function leavesOf(criterion: Criterion, rng: Rng): Leaf[] {
  if (criterion.kind === 'signal') return [criterion];
  if (criterion.kind === 'any') return leavesOf(criterion.of[Math.floor(rng() * criterion.of.length)]!, rng);
  return criterion.of.flatMap((child) => leavesOf(child, rng));
}

/** Applies a signal's filter to a record, so the record is one the filter selects ("isRevisit=false", "mode=mock", "hasUrl=true"). */
function applyFilter(record: Record<string, unknown>, filter: Record<string, string> | undefined): Record<string, unknown> {
  for (const [key, value] of Object.entries(filter ?? {})) {
    if (key === 'hasUrl') record.url = value === 'true' ? 'https://example.com/persona' : undefined;
    else if (key === 'kinds' || key === 'tree' || key === 'topics' || key === 'stage') continue; // computed selectors, not record fields
    else record[key] = value === 'true' ? true : value === 'false' ? false : value;
  }
  return record;
}

interface MakeContext {
  rng: Rng;
  seq: { n: number };
  localDate: string;
  /** adversarial: the same rationale every time, and quality that sometimes fails */
  adversarial: boolean;
}

/** One record a sheet of this instrument's type would write, carrying `amount` of whatever the signal counts. */
function makeRecords(instrument: InstrumentConfig, signal: string, amount: number, filter: Record<string, string> | undefined, ctx: MakeContext): Record<string, unknown>[] {
  const p = instrument.params as Record<string, unknown>;
  const list = (key: string, fallback: string[]): string[] => (Array.isArray(p[key]) && (p[key] as unknown[]).length > 0 ? (p[key] as string[]) : fallback);
  const n = ++ctx.seq.n;
  const count = Math.max(1, Math.ceil(amount));
  const out: Record<string, unknown>[] = [];

  switch (instrument.type) {
    case 'practice_item': {
      const records = signal === 'count' || signal === 'weighted_volume' ? count : 1;
      for (let i = 0; i < records; i++) {
        out.push({
          problemId: `p-${n}-${i}`, title: `Item ${n}-${i}`, topic: pick(list('topics', ['General']), n + i),
          difficulty: pick(['E', 'M', 'H', 'M'] as const, n + i), outcome: ctx.rng() < 0.7 ? 'first_attempt' : pick(list('outcomes', ['hint']).slice(1), i),
          minutes: signal === 'minutes' ? Math.max(1, Math.ceil(amount)) : 20, isRevisit: false,
        });
      }
      break;
    }
    case 'pipeline': {
      const wanted = signal === 'submitted' || signal === 'quality_count' || signal === 'stage_counts' ? count : 1;
      for (let i = 0; i < wanted; i++) {
        const passes = ctx.adversarial ? ctx.rng() < 0.5 : true;
        out.push({
          kind: 'application', applicationId: `a-${n}-${i}`, company: `Company ${n}-${i}`, role: 'Role', roleCategory: 'other', source: 'other',
          resumeVersionId: 'v1', whyLine: ctx.adversarial ? 'same reason every single time' : `Reason ${n}-${i}: this team ships the thing I want to learn to build.`,
          qualityPass: passes, status: 'applied',
        });
      }
      break;
    }
    case 'duration': {
      const modes = list('modes', []);
      const minBlock = typeof p.minBlockMinutes === 'number' ? p.minBlockMinutes : 1;
      const records = signal === 'mode_counts' || signal === 'records' ? count : 1;
      for (let i = 0; i < records; i++) {
        out.push({ minutes: Math.max(minBlock, signal === 'minutes' ? Math.ceil(amount) : 25), ...(modes.length > 0 ? { mode: pick(modes, n + i) } : {}), projectKey: `project-${(n + i) % 3}` });
      }
      break;
    }
    case 'session': {
      const records = signal === 'count' ? count : 1;
      const minMinutes = typeof p.minMinutes === 'number' ? p.minMinutes : 1;
      for (let i = 0; i < records; i++) out.push({ sessionType: pick(list('sessionTypes', ['Session']), n + i), minutes: Math.max(minMinutes, signal === 'minutes' ? Math.ceil(amount) : 40), rpe: 6 });
      break;
    }
    case 'threshold': {
      const target = typeof p.target === 'number' ? p.target : 1;
      const under = p.comparator === '<=';
      const good = under ? Math.max(0, Math.floor(target * (ctx.adversarial ? 1 : 0.8))) : Math.ceil(Math.max(target, amount) * (ctx.adversarial ? 1 : 1.15));
      out.push({ value: signal === 'total_value' && !under ? Math.max(good, Math.ceil(amount)) : good });
      break;
    }
    case 'time_window': {
      const at = minutesOfTime(typeof p.targetTime === 'string' ? p.targetTime : '07:00');
      const tolerance = typeof p.toleranceMinutes === 'number' ? p.toleranceMinutes : 30;
      const offset = ctx.adversarial ? tolerance : Math.round((ctx.rng() - 0.5) * tolerance);
      out.push({ minutes: Math.min(1439, Math.max(0, at + offset)) });
      break;
    }
    case 'artifact': {
      const kinds = list('kinds', ['feature']).filter((kind) => kind !== 'resume' || list('kinds', []).length === 1);
      const records = signal === 'count' ? count : 1;
      for (let i = 0; i < records; i++) out.push({ kind: pick(kinds, n + i), title: `Artifact ${n}-${i}`, projectKey: `project-${(n + i) % 3}`, ...((n + i) % 4 === 0 ? { url: 'https://example.com/persona' } : {}) });
      break;
    }
    case 'study_block': {
      const topics = list('topics', []);
      if (topics.length === 0) return [];
      const records = signal === 'blocks' || signal === 'mode_counts' ? count : 1;
      for (let i = 0; i < records; i++) out.push({ topic: pick(topics, n + i), minutes: Math.max(10, signal === 'minutes' ? Math.ceil(amount) : 25), ...(list('modes', []).length > 0 ? { mode: pick(list('modes', []), n + i) } : {}) });
      break;
    }
    case 'checklist': {
      const items = (p.items as { id: string }[] | undefined) ?? [];
      out.push({ done: items.map((item) => item.id) });
      break;
    }
  }
  return out.map((record) => applyFilter(record, filter));
}

/** The default thing an instrument counts, for an "extra" record that no quest asked for. */
function defaultSignal(instrument: InstrumentConfig): string {
  return { practice_item: 'count', pipeline: 'submitted', duration: 'records', session: 'count', threshold: 'hit', time_window: 'hit', artifact: 'count', study_block: 'blocks', checklist: 'all_done_days' }[instrument.type];
}

export function personaEventLog(blueprint: SystemBlueprint, seed: number, profile: PersonaProfile = { kind: 'steady' }): SystemEvent[] {
  const rng = mulberry32(seed);
  const arc = blueprint.arc;
  const days = Math.max(1, Math.min(profile.days ?? arc.lengthDays, arc.lengthDays));
  const events: SystemEvent[] = [];
  const records = new Map<string, InstrumentRecord[]>();
  const seq = { n: 0 };
  let counter = 0;
  let cursor = 0;

  const instruments = blueprint.instruments.filter((instrument) => instrument.eventBinding.kind === 'generic');
  const instrumentById = new Map(instruments.map((instrument) => [instrument.id, instrument]));
  const coreQuests = blueprint.quests.filter((quest) => quest.type === 'core');

  const stamp = (localDate: string): string => {
    const naive = addMinutes(parseISO(`${localDate}T00:00:00`), arc.dayBoundaryHour * 60 + 90 + cursor);
    cursor = (cursor + 2) % 600;
    return fromZonedTime(format(naive, "yyyy-MM-dd'T'HH:mm:ss"), arc.timezone).toISOString();
  };
  const push = (type: SystemEvent['type'], localDate: string, payload: object, idemKey: string, source: SystemEvent['source'] = 'user', schemaV = 1): string => {
    const id = `pl-${seed}-${String(counter++).padStart(7, '0')}`;
    const event: SystemEvent = { id, type, occurred_at: stamp(localDate), local_date: localDate, arc_id: blueprint.arcId, payload: payload as Record<string, unknown>, source, idem_key: idemKey, schema_v: schemaV };
    events.push(event);
    if (type === 'INSTRUMENT_RECORDED') for (const [instrumentId, list] of recordsFromEvents([event])) records.set(instrumentId, [...(records.get(instrumentId) ?? []), ...list]);
    return id;
  };

  const record = (instrument: InstrumentConfig, localDate: string, body: Record<string, unknown>): void => {
    const id = `pl-${seed}-${String(counter).padStart(7, '0')}`;
    push('INSTRUMENT_RECORDED', localDate, { instrumentId: instrument.id, instrumentType: instrument.type, domainId: instrument.domainId, blueprintVersion: blueprint.version, record: body }, instrumentIdemKey(id));
  };

  // ── Genesis ────────────────────────────────────────────────────────────
  push('ARC_STARTED', arc.startDate, {
    arcId: blueprint.arcId, startDate: arc.startDate, endDate: arc.endDate, timezone: arc.timezone, dayBoundaryHour: arc.dayBoundaryHour, dayCloseHour: arc.dayCloseHour,
    mainQuestText: blueprint.identity.primaryObjective || 'The arc.',
  }, `arc-started:${blueprint.arcId}`);
  const activation = activationEvent(blueprint, { id: `pl-${seed}-${String(counter++).padStart(7, '0')}`, occurred_at: stamp(arc.startDate), local_date: arc.startDate });
  events.push(activation);

  // ── Reduced Mode, tracked the way the streak does (without grace) ───────
  let consecutiveMisses = 0;
  let hitsInReduced = 0;
  let reduced = false;
  const reducedRule = blueprint.progression.reducedMode;

  const adversarial = profile.kind === 'adversarial';
  const byPriority = blueprint.domains.slice().sort((a, b) => a.priority - b.priority);
  // The burst grinds the first domain whose instruments pay a grant - the only XP beyond the quest, and so the only thing a cap can trim.
  const leadDomain = (profile.kind === 'burst' ? byPriority.find((domain) => domain.instrumentIds.some((id) => (instrumentById.get(id)?.params as { grant?: unknown } | undefined)?.grant !== undefined)) : undefined) ?? byPriority[0];

  for (let d = 0; d < days; d++) {
    const localDate = format(addDays(parseISO(arc.startDate), d), 'yyyy-MM-dd');
    push('APP_OPENED', localDate, { seconds: 0 }, `app-opened:${localDate}`, 'system');
    const ctx: MakeContext = { rng, seq, localDate, adversarial };

    const emptyDay = profile.kind === 'lapsing' && d % 10 >= 7 && d % 10 <= 8;
    const completed: QuestTemplateDef[] = [];

    if (!emptyDay) {
      for (const quest of coreQuests) {
        const isLead = quest.domainId === leadDomain?.id;
        const attempt = profile.kind === 'steady' ? 0.85 : profile.kind === 'lapsing' ? 0.9 : profile.kind === 'burst' ? (isLead ? 1 : 0.25) : 1;
        if (rng() >= attempt) continue;
        // In Reduced Mode (where the System collapses) the person does the floor; otherwise the whole criterion.
        const useFloor = reduced && reducedRule.collapsesQuests;
        const margin = adversarial || useFloor ? 1 : 1.2;
        const repeat = profile.kind === 'burst' && isLead ? 5 : 1;
        for (let r = 0; r < repeat; r++) {
          for (const leaf of leavesOf(useFloor ? quest.floor : quest.criterion, rng)) {
            const instrument = instrumentById.get(leaf.instrumentId);
            if (!instrument) continue;
            for (const body of makeRecords(instrument, leaf.signal, leaf.target * margin, leaf.filter, ctx)) record(instrument, localDate, body);
          }
        }
      }
      if (profile.kind === 'burst') {
        for (const instrument of instruments.filter((candidate) => candidate.domainId === leadDomain?.id && (candidate.params as { grant?: unknown }).grant !== undefined)) {
          for (let i = 0; i < 6; i++) for (const body of makeRecords(instrument, defaultSignal(instrument), 1, undefined, ctx)) record(instrument, localDate, body);
        }
      }
      // Extras: records no quest asked for, so every instrument (a ladder, a skill, an artifact) moves.
      const extrasChance = profile.kind === 'steady' ? 0.35 : profile.kind === 'burst' ? 0.5 : profile.kind === 'lapsing' ? 0.15 : 0;
      for (const instrument of instruments) {
        if (rng() >= extrasChance) continue;
        for (const body of makeRecords(instrument, defaultSignal(instrument), 1, undefined, ctx)) record(instrument, localDate, body);
      }
      // Cap probing: a pile of tiny records on the first duration, to find where XP stops.
      if (adversarial && d % 5 === 0) {
        const probe = instruments.find((instrument) => instrument.type === 'duration');
        if (probe) for (let i = 0; i < 25; i++) record(probe, localDate, { minutes: Math.max(1, typeof probe.params.minBlockMinutes === 'number' ? probe.params.minBlockMinutes : 1), ...(Array.isArray(probe.params.modes) && probe.params.modes.length > 0 ? { mode: probe.params.modes[0] } : {}), projectKey: 'probe' });
      }
      // Body and other manual measurements: weekly, never scored.
      if (d % 7 === 0) {
        for (const metric of blueprint.metrics.filter((candidate) => 'manual' in candidate.source)) {
          push('METRIC_RECORDED', localDate, { kind: metric.id, value: metric.unit === 'pass' ? (rng() < 0.3 ? 1 : 0) : Math.round((60 + rng() * 20) * 10) / 10, unit: metric.unit }, `metric:${metric.id}:${localDate}`);
        }
      }

      // Complete the quests whose criterion the day's records meet.
      const env = signalEnv(blueprint, records, localDate);
      for (const quest of coreQuests) {
        const useFloor = reduced && reducedRule.collapsesQuests;
        if (!evaluateCriterion(useFloor ? quest.floor : quest.criterion, env).met) continue;
        const templateId = `${blueprint.arcId}::${quest.id}`;
        const instanceId = `${templateId}::${localDate}`;
        push('QUEST_COMPLETED', localDate, questCompletedPayloadV2({ instanceId, templateId, localDate }, { id: quest.id, domainId: quest.domainId }, blueprint.version), `quest-complete:${instanceId}:0`, 'user', 2);
        completed.push(quest);
      }
    }

    if (completed.length > 0) {
      consecutiveMisses = 0;
      if (reduced && ++hitsInReduced >= reducedRule.exitDays) { reduced = false; hitsInReduced = 0; }
    } else {
      hitsInReduced = 0;
      if (++consecutiveMisses >= reducedRule.triggerMisses) reduced = true;
    }
  }
  return events;
}
