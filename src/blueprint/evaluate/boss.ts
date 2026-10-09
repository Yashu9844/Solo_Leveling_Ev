// Bosses (platform/02 §15): a checklist anchored to a real milestone. Rules
// carried from the legacy evaluateBoss: a boss cannot be failed — its window
// opens at its start day and never closes — and a boss that was formally
// cleared stays cleared. "Cleared" for a rank gate is the LIVE status: formally
// cleared, or window open and every condition currently met.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { BossClearedPayload, SystemEvent } from '../../engine/types';
import type { BossDef } from '../schema';
import { evaluateCondition } from './condition';
import type { SignalEnv } from './signals';

export interface BossStatus {
  boss: Pick<BossDef, 'id' | 'title' | 'windowStartDay' | 'windowEndDay'>;
  windowOpen: boolean;
  conditions: { label: string; met: boolean }[];
  cleared: boolean;
}

export function bossFormallyCleared(events: readonly SystemEvent[], bossId: string): boolean {
  return events.some((event) => event.type === 'BOSS_CLEARED' && (event.payload as unknown as BossClearedPayload).bossId === bossId);
}

/** 1-based arc day of `asOf`; 0 before the arc has started. */
export function arcDayOn(asOf: string, arcStartDate: string): number {
  return differenceInCalendarDays(parseISO(asOf), parseISO(arcStartDate)) + 1;
}

export function evaluateBoss(def: BossDef, env: SignalEnv, events: readonly SystemEvent[]): BossStatus {
  const windowOpen = arcDayOn(env.asOf, env.arcStartDate) >= def.windowStartDay;
  const conditions = def.conditions.map((condition) => {
    const { label, met } = evaluateCondition(condition, env);
    return { label, met };
  });
  const cleared = bossFormallyCleared(events, def.id) || (windowOpen && conditions.every((condition) => condition.met));
  return { boss: { id: def.id, title: def.title, windowStartDay: def.windowStartDay, windowEndDay: def.windowEndDay }, windowOpen, conditions, cleared };
}

export function evaluateBosses(bosses: readonly BossDef[], env: SignalEnv, events: readonly SystemEvent[]): BossStatus[] {
  return bosses.map((def) => evaluateBoss(def, env, events));
}
