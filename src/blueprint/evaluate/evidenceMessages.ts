// The evidence messages of a generated System (platform/02 §18.2): personal records, trends and correlations read from the Blueprint's own
// signals, said in templates that name no domain except through {label}/{with}, which are looked up here from the Blueprint at the moment the
// line is built. A message therefore cannot mention a domain the System does not have (I20), and the signals a template may read are the
// effort and performance ones the validator allows (V-MSG-01): never the body, never an outside outcome, never a forecast.
import { addDays, format, parseISO } from 'date-fns';
import type { EvidenceLine } from '../../engine/messages';
import type { SystemEvent } from '../../engine/types';
import type { InstrumentRecord } from '../../instruments/framework';
import type { EvidenceTemplateDef, SignalRef, SystemBlueprint } from '../schema';
import { recordsFromEvents, signalEnv } from './env';
import { resolveSignal } from './signals';

/** "Medium sample": a record or a trend needs this many active days behind it before it is said. */
export const MIN_ACTIVE_DAYS = 3;
/** A correlation needs this many days in each bucket. */
export const MIN_BUCKET_DAYS = 5;
/** The smallest day that can be called a record (one of anything is not). */
const MIN_RECORD_VALUE = 2;

const shift = (date: string, days: number): string => format(addDays(parseISO(date), days), 'yyyy-MM-dd');
const TIER_ORDER = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 } as const;

/** Fills the placeholders of a template; an unknown one is left visible rather than silently dropped (the validator refuses it long before). */
export function renderTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-z]+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

const instrumentOf = (signal: SignalRef | undefined): string | undefined => (signal?.source === 'instrument' ? signal.instrumentId : undefined);
const coreQuestOf = (blueprint: SystemBlueprint, domainId: string | undefined) => blueprint.quests.find((quest) => quest.domainId === domainId && quest.type === 'core');

interface Context {
  blueprint: SystemBlueprint;
  records: ReadonlyMap<string, readonly InstrumentRecord[]>;
  today: string;
  completed: ReadonlyMap<string, ReadonlySet<string>>;
  opened: ReadonlySet<string>;
}

function record(template: EvidenceTemplateDef, ctx: Context): EvidenceLine | null {
  const ref = template.signal;
  const id = instrumentOf(ref);
  if (!ref || ref.source !== 'instrument' || !id) return null;
  const dayRef: SignalRef = { ...ref, aggregate: 'day' };
  const value = resolveSignal(dayRef, signalEnv(ctx.blueprint, ctx.records, ctx.today));
  if (value < MIN_RECORD_VALUE) return null;
  // Only the days the instrument has records on can have a value, so only those are asked.
  const earlier = [...new Set((ctx.records.get(id) ?? []).map((row) => row.localDate))].filter((date) => date < ctx.today);
  const values = earlier.map((date) => resolveSignal(dayRef, signalEnv(ctx.blueprint, ctx.records, date)));
  const active = values.filter((v) => v > 0).length;
  if (active < MIN_ACTIVE_DAYS || value <= Math.max(0, ...values)) return null;
  return line(template, ctx, { value: Math.round(value) });
}

function trend(template: EvidenceTemplateDef, ctx: Context): EvidenceLine | null {
  const ref = template.signal;
  const id = instrumentOf(ref);
  if (!ref || ref.source !== 'instrument' || !id) return null;
  const window = (asOf: string) => resolveSignal({ ...ref, aggregate: 'window_14' }, signalEnv(ctx.blueprint, ctx.records, asOf));
  const current = window(ctx.today);
  const previous = window(shift(ctx.today, -14));
  const dates = [...new Set((ctx.records.get(id) ?? []).map((row) => row.localDate))];
  const inWindow = (from: number, to: number) => dates.filter((date) => date >= shift(ctx.today, from) && date <= shift(ctx.today, to)).length;
  if (inWindow(-13, 0) < MIN_ACTIVE_DAYS || inWindow(-27, -14) < MIN_ACTIVE_DAYS || !(current > previous)) return null;
  return line(template, ctx, { current: Math.round(current), previous: Math.round(previous) });
}

function correlation(template: EvidenceTemplateDef, ctx: Context): EvidenceLine | null {
  const engine = coreQuestOf(ctx.blueprint, template.domainId);
  const guard = coreQuestOf(ctx.blueprint, template.withDomainId);
  if (!engine || !guard) return null;
  const engineDays = ctx.completed.get(engine.id) ?? new Set<string>();
  const guardDays = ctx.completed.get(guard.id) ?? new Set<string>();
  const after = { hit: { days: 0, done: 0 }, miss: { days: 0, done: 0 } };
  for (let date = ctx.blueprint.arc.startDate; date < ctx.today; date = shift(date, 1)) {
    const next = shift(date, 1);
    if (next >= ctx.today || !ctx.opened.has(date) || !ctx.opened.has(next)) continue;
    const bucket = guardDays.has(date) ? after.hit : after.miss;
    bucket.days++;
    if (engineDays.has(next)) bucket.done++;
  }
  if (after.hit.days < MIN_BUCKET_DAYS || after.miss.days < MIN_BUCKET_DAYS) return null;
  const a = after.hit.done / after.hit.days;
  const b = after.miss.done / after.miss.days;
  if (!(a > b)) return null;
  return line(template, ctx, { a: Math.round(a * 100), b: Math.round(b * 100) });
}

function line(template: EvidenceTemplateDef, ctx: Context, values: Record<string, number>): EvidenceLine {
  const label = ctx.blueprint.domains.find((domain) => domain.id === template.domainId)?.name ?? '';
  const withName = ctx.blueprint.domains.find((domain) => domain.id === template.withDomainId)?.name ?? '';
  return { id: template.id, tier: template.tier as EvidenceLine['tier'], text: renderTemplate(template.template, { label, with: withName, unit: template.unit ?? '', ...values }) };
}

/** Every evidence message that applies today, most specific tier first. Pure. A Blueprint without templates (the owner's) yields none. */
export function evidenceLines(blueprint: SystemBlueprint, events: readonly SystemEvent[], today: string): EvidenceLine[] {
  const templates = blueprint.messaging.evidenceTemplates.filter((template) => template.kind !== undefined);
  if (templates.length === 0) return [];
  const completed = new Map<string, Set<string>>();
  const opened = new Set<string>();
  for (const event of events) {
    if (event.local_date > today) continue;
    if (event.type === 'QUEST_COMPLETED') {
      const id = String((event.payload as { questKey?: unknown }).questKey ?? '');
      if (id) completed.set(id, (completed.get(id) ?? new Set()).add(event.local_date));
    } else if (event.type === 'APP_OPENED') opened.add(event.local_date);
  }
  const ctx: Context = { blueprint, records: recordsFromEvents(events.filter((event) => event.local_date <= today)), today, completed, opened };
  const out: EvidenceLine[] = [];
  for (const template of templates) {
    // A template that cannot be read (a signal the instrument does not have) is skipped: a message never costs the screen it sits on.
    try {
      const made = template.kind === 'record' ? record(template, ctx) : template.kind === 'trend' ? trend(template, ctx) : template.kind === 'correlation' ? correlation(template, ctx) : null;
      if (made) out.push(made);
    } catch {
      continue;
    }
  }
  return out.sort((x, y) => TIER_ORDER[x.tier] - TIER_ORDER[y.tier]);
}
