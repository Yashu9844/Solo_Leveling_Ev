// Quest auto-completion under the Blueprint engine (platform/02 §9.2, ENGINE_V2).
//
// One function replaces maybeCompleteCareerQuest, …DsaQuest, …BuildQuest,
// …TrainingQuest and the sleep and attention checks: after an instrument
// record is written, evaluate the quest's criterion against the day's
// instrument signals and, if it holds and the quest is not yet complete,
// complete it through the same completeQuest the manual tap uses.
//
// Legacy semantics preserved exactly (E-level parity is proven on logs by
// evaluateCriterion's suite; this keeps the LIVE write path identical too):
//   - career, DSA, build and training are judged on the day's totals;
//   - sleep and attention fire only when the record JUST written satisfies the
//     criterion (so undoing a completion and then logging a worse reading does
//     not re-complete the quest) - `trigger` restricts that instrument's
//     records to the newest one.
import { evaluateCriterion } from '../blueprint/evaluate/criterion';
import { recordsFromEvents, signalEnv } from '../blueprint/evaluate/env';
import { resolveBlueprints, versionFor } from '../blueprint/resolve';
import { db } from '../db/db';
import { getAllEvents } from '../db/events';
import type { EngineConfig, EngineDeps } from '../engine/types';
import { completeQuest } from './quests';

export interface CompletionTrigger {
  /** The instrument whose newest record today is the only one considered. */
  instrumentId: string;
}

export async function autoCompleteQuest(
  questKey: string,
  today: string,
  arcId: string,
  config: EngineConfig,
  deps: EngineDeps,
  trigger?: CompletionTrigger
): Promise<void> {
  const events = await getAllEvents();
  const blueprint = versionFor(resolveBlueprints(events).versions, today);
  const quest = blueprint?.quests.find((candidate) => candidate.id === questKey && candidate.type === 'core');
  if (!blueprint || !quest) return;

  const template = (await db.quest_template.toArray()).find((candidate) => candidate.key === questKey && candidate.type === 'core');
  if (!template) return;
  const instance = (await db.quest_instance.where('local_date').equals(today).toArray()).find((candidate) => candidate.template_id === template.id);
  if (!instance || instance.state === 'complete') return;

  const records = recordsFromEvents(events);
  if (trigger) {
    const newest = (records.get(trigger.instrumentId) ?? []).filter((record) => record.localDate === today).at(-1);
    records.set(trigger.instrumentId, newest ? [newest] : []);
  }
  if (evaluateCriterion(quest.criterion, signalEnv(blueprint, records, today)).met) {
    await completeQuest(instance, questKey, arcId, config, deps);
  }
}
