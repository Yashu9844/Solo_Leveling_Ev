// A Blueprint seen as the EngineConfig the surviving pure engine functions
// take (levelFor, streakFrom, the date helpers…). Everything the Blueprint
// specifies is read from it; the few legacy-only knobs it does not carry
// (SRS intervals, the sleep-window default) come from `base`. For
// LEGACY_BLUEPRINT_V1 the result equals engineConfigFor(arc) — asserted by
// tests/engine/blueprint-engine-config.test.ts.
import { DEFAULT_CONFIG } from '../engine/config';
import type { CoreQuestKey, EngineConfig, XpCategory } from '../engine/types';
import type { SystemBlueprint } from './schema';

function grantAmount(blueprint: SystemBlueprint, instrumentId: string, key: string): number | undefined {
  const grant = blueprint.instruments.find((instrument) => instrument.id === instrumentId)?.params[key] as { amount?: number } | undefined;
  return typeof grant?.amount === 'number' ? grant.amount : undefined;
}

export function engineConfigFromBlueprint(blueprint: SystemBlueprint, base: EngineConfig = DEFAULT_CONFIG): EngineConfig {
  const { arc, progression } = blueprint;
  const channelOf = (domainId: string) => blueprint.domains.find((domain) => domain.id === domainId)!.channel.id as XpCategory;
  const coreQuests = Object.fromEntries(
    blueprint.quests.filter((quest) => quest.type === 'core').map((quest) => [quest.id, { xp: quest.xp, category: channelOf(quest.domainId) }])
  ) as EngineConfig['coreQuests'] & Record<CoreQuestKey, unknown>;
  const categoryCaps = Object.fromEntries(blueprint.domains.map((domain) => [domain.channel.id, domain.channel.cap])) as EngineConfig['categoryCaps'];
  const wake = blueprint.instruments.find((instrument) => instrument.type === 'time_window')?.params.targetTime;
  const laundry = (blueprint.instruments.find((instrument) => instrument.type === 'checklist')?.params.items as { id: string; everyNDays?: number }[] | undefined)?.find((item) => item.everyNDays !== undefined);
  return {
    ...base,
    arc: { timezone: arc.timezone, dayBoundaryHour: arc.dayBoundaryHour, dayCloseHour: arc.dayCloseHour, startDate: arc.startDate, endDate: arc.endDate },
    coreQuests,
    categoryCaps,
    dailyCap: progression.dailyCap,
    mvdXp: progression.mvdXp,
    recoveryXp: progression.recoveryXp,
    bossXp: progression.bossXp,
    weeklyQuestXp: progression.weeklyQuestXp,
    revisitXp: grantAmount(blueprint, 'dsa.problems', 'revisitGrant') ?? base.revisitXp,
    shipBonusXp: grantAmount(blueprint, 'build.artifacts', 'grant') ?? base.shipBonusXp,
    learningBlockXp: grantAmount(blueprint, 'foundations.blocks', 'grant') ?? base.learningBlockXp,
    stepsBonusXp: grantAmount(blueprint, 'training.steps', 'grant') ?? base.stepsBonusXp,
    maintenanceXp: grantAmount(blueprint, 'maintenance.daily', 'grant') ?? base.maintenanceXp,
    stepsBonusThreshold: (blueprint.instruments.find((instrument) => instrument.id === 'training.steps')?.params.bonusAt as number | undefined) ?? base.stepsBonusThreshold,
    wakeTargetTime: typeof wake === 'string' ? wake : base.wakeTargetTime,
    maintenanceLaundryEveryDays: laundry?.everyNDays ?? base.maintenanceLaundryEveryDays,
    level: progression.level,
    streak: { graceDaysPer28: progression.grace.daysPer28, reducedModeTriggerMisses: progression.reducedMode.triggerMisses, reducedModeExitDays: progression.reducedMode.exitDays },
    attributes: { windowDays: progression.attributeWindowDays },
  };
}
