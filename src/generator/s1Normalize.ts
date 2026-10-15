// S1 normalize: trim, clamp, derive, default (platform/03 §29). Nothing the person typed is lost to
// a default; nothing out of range is passed on. Every correction is reported as an issue.
import { addDays, format, parseISO } from 'date-fns';
import { isValidTimeZone } from '../engine/time';
import { MAX_ARC_LENGTH, MIN_ARC_LENGTH } from '../library/calibration';
import { generatorIssue, type DraftState, type NormalizedDraft } from './types';
import { minutesOf, timeOf } from './util';
import type { Issue } from '../blueprint/validate';

const DEFAULT_WAKE = '07:00';
const DEFAULT_SLEEP = '23:00';
const MAX_NAME = 24;
const MAX_OBJECTIVE = 160;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** V-ARC-03: an arc may begin up to 14 days ago (the paper-log precedent) or 30 days ahead. */
const START_WINDOW_BEFORE = 14;
const START_WINDOW_AFTER = 30;

const isoDate = (date: Date): string => format(date, 'yyyy-MM-dd');

export function normalize(draft: DraftState): { draft: NormalizedDraft; issues: Issue[] } {
  const issues: Issue[] = [];

  const displayName = draft.identity.displayName.trim().slice(0, MAX_NAME) || 'SYSTEM';
  const primaryObjective = draft.identity.primaryObjective.trim().slice(0, MAX_OBJECTIVE);
  const stake = draft.identity.stake?.trim();

  // The arc: a length in range, a start in the allowed window, a real time zone.
  const requestedLength = Number.isFinite(draft.arc.lengthDays) ? Math.round(draft.arc.lengthDays) : 120;
  const lengthDays = Math.min(MAX_ARC_LENGTH, Math.max(MIN_ARC_LENGTH, requestedLength));
  if (lengthDays !== requestedLength) {
    issues.push(generatorIssue('G-ARC-01', 'warning', 'arc.lengthDays', 'THE ARC LENGTH WAS ADJUSTED.', `An arc lasts ${MIN_ARC_LENGTH}–${MAX_ARC_LENGTH} days; yours is now ${lengthDays}.`));
  }
  const today = ISO_DATE.test(draft.today) ? draft.today : '1970-01-01';
  const earliest = isoDate(addDays(parseISO(today), -START_WINDOW_BEFORE));
  const latest = isoDate(addDays(parseISO(today), START_WINDOW_AFTER));
  let startDate = ISO_DATE.test(draft.arc.startDate) ? draft.arc.startDate : today;
  if (startDate < earliest || startDate > latest) {
    const moved = startDate < earliest ? earliest : latest;
    issues.push(generatorIssue('G-ARC-02', 'warning', 'arc.startDate', 'THE START DATE WAS ADJUSTED.', `An arc may begin from ${START_WINDOW_BEFORE} days ago to ${START_WINDOW_AFTER} days ahead; yours now begins ${moved}.`));
    startDate = moved;
  }
  const endDate = isoDate(addDays(parseISO(startDate), lengthDays - 1));
  const timezone = isValidTimeZone(draft.arc.timezone) ? draft.arc.timezone : 'UTC';
  if (timezone !== draft.arc.timezone) {
    issues.push(generatorIssue('G-ARC-03', 'warning', 'arc.timezone', 'THE TIME ZONE WAS NOT RECOGNISED.', 'Your time zone was replaced with UTC; set it in the arc.'));
  }

  // The rhythm: wake and sleep times, and the day boundary derived from when the person sleeps (V-ARC-04).
  const wakeMinutes = minutesOf(draft.rhythm?.wakeTime ?? '') ?? minutesOf(DEFAULT_WAKE)!;
  const sleepMinutes = minutesOf(draft.rhythm?.sleepTime ?? '') ?? minutesOf(DEFAULT_SLEEP)!;
  // The day turns over two hours after the typical sleep time, at any hour, so a night shift works (02:00 -> 04:00).
  const dayBoundaryHour = Math.floor(((sleepMinutes + 120) % 1440) / 60);
  const dayCloseHour = (dayBoundaryHour + 23) % 24;

  const domains = draft.domains.map((choice) => ({ archetypeId: choice.archetypeId.trim(), answers: { ...choice.answers } }));

  return {
    draft: {
      lineageId: draft.lineageId.trim() || 'arc',
      today,
      identity: { displayName, primaryObjective, ...(stake ? { stake } : {}) },
      domains,
      priorityMode: draft.priorityMode ?? 'ranked',
      rhythm: { wakeTime: timeOf(wakeMinutes), sleepTime: timeOf(sleepMinutes) },
      arc: { lengthDays, startDate, endDate, timezone, dayBoundaryHour, dayCloseHour, wakeTime: timeOf(wakeMinutes), sleepTime: timeOf(sleepMinutes) },
      pinned: [...(draft.pinned ?? [])],
    },
    issues,
  };
}
