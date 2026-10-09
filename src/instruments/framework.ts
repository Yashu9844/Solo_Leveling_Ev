import type { InstrumentConfig, InstrumentParams, InstrumentType } from '../blueprint/schema';

/** A normalized record written by a generic instrument. Persisting is Phase 5;
 * this shape is deliberately free of storage concerns so instruments stay pure. */
export interface InstrumentRecord<TRecord extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  instrumentId: string;
  instrumentType: InstrumentType;
  domainId: string;
  localDate: string;
  eventId: string;
  blueprintVersion: number;
  record: TRecord;
}

/** A proposed award. The Blueprint engine applies channel and daily caps later. */
export interface GrantIntent {
  channel: string;
  amount: number;
  reason: string;
  kind: 'core' | 'bonus' | 'uncapped';
}

export interface InstrumentIssue {
  code: string;
  path: string;
  message: string;
}

export interface InstrumentEvaluationContext {
  localDate: string;
  /** The date range being read, inclusive. */
  from: string;
  to: string;
  /** The arc's first day, for instruments with day-cadence rules (checklist everyNDays). */
  arcStartDate?: string;
  /** Optional Blueprint-level selector, e.g. a pipeline stage. */
  filter?: Readonly<Record<string, string>>;
}

/**
 * The executable half of an instrument type. Configuration stays in a
 * Blueprint; this contract holds only code that is shared by every instance
 * of that type. Individual implementations arrive in loops 3.2–3.6.
 */
export interface InstrumentDefinition<
  TParams extends InstrumentParams = InstrumentParams,
  TRecord extends Record<string, unknown> = Record<string, unknown>,
> {
  type: InstrumentType;
  validateRecord(record: unknown, params: TParams): InstrumentIssue[];
  signals(records: readonly InstrumentRecord<TRecord>[], params: TParams, context: InstrumentEvaluationContext): Readonly<Record<string, number>>;
  grantIntents?(records: readonly InstrumentRecord<TRecord>[], params: TParams, context: InstrumentEvaluationContext): readonly GrantIntent[];
  guards?(records: readonly InstrumentRecord<TRecord>[], params: TParams, context: InstrumentEvaluationContext): readonly InstrumentIssue[];
}

/** Makes a definition's type parameters inferable without widening it. */
export function defineInstrument<
  TParams extends InstrumentParams,
  TRecord extends Record<string, unknown>,
>(definition: InstrumentDefinition<TParams, TRecord>): InstrumentDefinition<TParams, TRecord> {
  return definition;
}

export function recordFor(
  config: InstrumentConfig,
  identity: Omit<InstrumentRecord, 'instrumentId' | 'instrumentType' | 'domainId' | 'record'>,
  record: Record<string, unknown>
): InstrumentRecord {
  return {
    ...identity,
    instrumentId: config.id,
    instrumentType: config.type,
    domainId: config.domainId,
    record,
  };
}
