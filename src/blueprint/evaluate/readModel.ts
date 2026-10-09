// Assembles the SignalEnv every read-model evaluator shares for one question:
// "as of this date, under this Blueprint, given this log". One env per read,
// so attributes, gates, bosses and messages all see the same numbers
// (platform/04 §33.3: one SignalSnapshot per read).
import type { QuestInstanceRow } from '../../db/schema';
import type { SystemEvent } from '../../engine/types';
import { engineConfigFromBlueprint } from '../engineConfig';
import { buildProjectionsV2 } from '../engine/projections';
import type { SystemBlueprint } from '../schema';
import { recordsFromEvents } from './env';
import { buildFacts, type CheckpointFact, type FactsHooks } from './facts';
import type { SignalEnv } from './signals';

export interface ReadModelInput {
  blueprint: SystemBlueprint;
  events: readonly SystemEvent[];
  checkpoints: readonly CheckpointFact[];
  asOf: string;
  /** Quest instances, if the caller already has them; otherwise the V2 projections supply them. */
  instances?: readonly Pick<QuestInstanceRow, 'template_id' | 'local_date' | 'state' | 'recovered'>[];
  hooks?: Partial<FactsHooks>;
}

export function readModelEnv(input: ReadModelInput): SignalEnv {
  const { blueprint, events, checkpoints, asOf } = input;
  const config = engineConfigFromBlueprint(blueprint);
  const instances = input.instances ?? buildProjectionsV2([...events], { now: () => '', newId: () => '' }, [blueprint]).instances;
  const { facts, eligibleDates } = buildFacts(
    { blueprint, config, events, checkpoints, instances, asOf },
    { bossCleared: input.hooks?.bossCleared ?? (() => false) }
  );
  return {
    blueprint, asOf, arcStartDate: blueprint.arc.startDate, recordsByInstrument: recordsFromEvents(events), eligibleDates, facts,
  };
}
