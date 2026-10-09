// Assembles the SignalEnv every read-model evaluator shares for one question:
// "as of this date, under this Blueprint, given this log". One env per read,
// so attributes, gates, bosses and messages all see the same numbers
// (platform/04 §33.3: one SignalSnapshot per read).
import type { BuiltProjections } from '../../db/projections';
import type { QuestInstanceRow } from '../../db/schema';
import type { SystemEvent } from '../../engine/types';
import { engineConfigFromBlueprint } from '../engineConfig';
import { buildProjectionsV2 } from '../engine/projections';
import type { SystemBlueprint } from '../schema';
import { evaluateBoss } from './boss';
import { recordsFromEvents } from './env';
import { buildFacts, type CheckpointFact } from './facts';
import type { SignalEnv } from './signals';

export interface ReadModelInput {
  blueprint: SystemBlueprint;
  events: readonly SystemEvent[];
  checkpoints: readonly CheckpointFact[];
  asOf: string;
  /** Quest instances, if the caller already has them; otherwise the V2 projections supply them. */
  instances?: readonly Pick<QuestInstanceRow, 'template_id' | 'local_date' | 'state' | 'recovered'>[];
  /** The V2 projections, if the caller already built them (they are the expensive part of a read). */
  projections?: BuiltProjections;
}

export function readModelEnv(input: ReadModelInput): SignalEnv {
  const { blueprint, events, checkpoints, asOf } = input;
  const config = engineConfigFromBlueprint(blueprint);
  const projections = input.projections ?? (input.instances ? undefined : buildProjectionsV2([...events], { now: () => '', newId: () => '' }, [blueprint]));
  const instances = input.instances ?? projections!.instances;
  // The facts need a boss's live status for gate conditions, and a boss's
  // status needs the facts: they share one env, resolved lazily.
  const env: SignalEnv = { blueprint, asOf, arcStartDate: blueprint.arc.startDate, recordsByInstrument: recordsFromEvents(events) };
  const { facts, eligibleDates } = buildFacts(
    { blueprint, config, events, checkpoints, instances, ledger: projections?.ledger, asOf },
    { bossCleared: (id) => { const def = blueprint.bosses.find((boss) => boss.id === id); return def ? evaluateBoss(def, env, events).cleared : false; } }
  );
  env.facts = facts;
  env.eligibleDates = eligibleDates;
  return env;
}
