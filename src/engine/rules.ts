// final/01-quests-xp-level-rank.md §6.3 and final/03-learning-systems.md
// §4.1 — the rules engine proper. Deliberately narrow: two rules with a
// crisp, literal firing condition from the spec text. The mockup weekly
// review (final/05 §6) also shows a resume-nudge proposal and a
// correlational "your DSA rate drops after a missed sleep window"
// insight — both real now too, just not modelled here: they're pure
// functions of their own (engine/weeklyReview.ts's resumeNudgeFor and
// sleepDsaCorrelation), computed alongside these two rules by
// store/weeklyReview.ts's getWeeklyReview, not derived from evaluateRules.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { learnShipRuleFires, type BuildSessionFixture } from './build';
import type { QuestRecoveredPayload, SystemEvent } from './types';

export interface RuleProposal {
  rule: string;
  message: string;
  fires_on: string;
}

const WINDOW_DAYS = 14;
const WRONG_TIME_THRESHOLD = 3;

function withinTrailingWindow(localDate: string, asOf: string, windowDays: number): boolean {
  const diff = differenceInCalendarDays(parseISO(asOf), parseISO(localDate));
  return diff >= 0 && diff < windowDays;
}

/**
 * Pure. Evaluates the rules engine against the full event history as of
 * `asOf` (a local_date) and returns any proposals that fire. Each rule
 * fires exactly on its stated condition — no more, no less.
 */
export function evaluateRules(history: SystemEvent[], asOf: string): RuleProposal[] {
  const proposals: RuleProposal[] = [];

  const buildSessions: BuildSessionFixture[] = history
    .filter((e) => e.type === 'BUILD_SESSION_LOGGED' && withinTrailingWindow(e.local_date, asOf, WINDOW_DAYS))
    .map((e) => {
      const payload = e.payload as unknown as { mode: 'LEARN' | 'SHIP' };
      return { local_date: e.local_date, mode: payload.mode };
    });
  if (learnShipRuleFires(buildSessions)) {
    proposals.push({
      rule: 'LEARN_SHIP_RATIO',
      message: 'Learning without shipping produces no evidence. This week’s BUILD target: SHIP only.',
      fires_on: 'learn:ship ratio > 3:1 over 14 days',
    });
  }

  const wrongTimeCount = history.filter((e) => {
    if (e.type !== 'QUEST_RECOVERED') return false;
    if (!withinTrailingWindow(e.local_date, asOf, WINDOW_DAYS)) return false;
    const payload = e.payload as unknown as QuestRecoveredPayload;
    return payload.reason === 'wrong_time';
  }).length;
  if (wrongTimeCount >= WRONG_TIME_THRESHOLD) {
    proposals.push({
      rule: 'WRONG_TIME_PATTERN',
      message: `Wrong time, ${wrongTimeCount} of the last ${WINDOW_DAYS} days. Worth moving the slot.`,
      fires_on: `>= ${WRONG_TIME_THRESHOLD}x "wrong time" in ${WINDOW_DAYS} days`,
    });
  }

  return proposals;
}
