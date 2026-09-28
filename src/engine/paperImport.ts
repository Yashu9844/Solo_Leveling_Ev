// docs/13-day0-baseline.md's Part 2 — "the paper log imports cleanly,"
// final/07 §6: "a V1 requirement, not a nice-to-have." Two of the doc's
// tables are covered — the daily log (Part 2's main table: quest
// completions, sleep, screen time, the evening review) and the DSA
// problem log — because both map to this app's real events with no
// missing fields. The other two tables in that doc are deliberately not
// imported: the weekly summary is DERIVED data (completion%, xp-ish) the
// app computes itself, not a source of truth to import; the evidence
// log's 'applied' kind needs company/role/resume/why_line for a
// meaningful APPLICATION_LOGGED event and the CSV shape only has a
// free-text "detail" cell — real applications from that period need to
// go through the normal Log Application flow instead. Flagged as a
// resolved scope cut, same shape as every other deferred item this
// session.
import type { AttemptOutcome } from './srs';
import type { ReviewBlocker } from './types';
import { parseCsvWithHeader } from './csv';

export type QuestMark = 'complete' | 'floor' | 'none';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function parseMark(raw: string, rowNum: number, column: string, errors: string[]): QuestMark {
  const v = raw.trim().toLowerCase();
  if (v === '1') return 'complete';
  if (v === '0' || v === '') return 'none';
  if (v === 'm') return 'floor';
  errors.push(`row ${rowNum}: "${column}" must be 1, 0 or m — got "${raw}"`);
  return 'none';
}

const BLOCKER_MAP: Record<string, ReviewBlocker> = {
  time: 'time',
  tired: 'tired',
  wrongtime: 'wrong_time',
  didntwant: 'didnt_want_to',
  none: 'nothing',
};

export interface DailyLogEntry {
  date: string;
  dsa: QuestMark;
  bld: QuestMark;
  trn: QuestMark;
  slp: QuestMark;
  fue: QuestMark;
  att: QuestMark;
  wake?: string;
  sleep?: string;
  screenMinutes?: number;
  energy?: number;
  focus?: number;
  blocker?: ReviewBlocker;
  note?: string;
}

export interface ParseResult<T> {
  entries: T[];
  errors: string[];
}

/** Pure. Parses docs/13's daily-log CSV (header: date, dsa, bld, trn,
 * slp, fue, att, wake, sleep, scrn, energy, focus, blocker, note). Every
 * row is independent — one bad row is reported in `errors` and skipped,
 * never aborts the whole file. */
export function parseDailyLog(csv: string): ParseResult<DailyLogEntry> {
  const rows = parseCsvWithHeader(csv);
  const entries: DailyLogEntry[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // header is row 1
    const date = row.date ?? '';
    if (!DATE_RE.test(date)) {
      errors.push(`row ${rowNum}: "date" must be YYYY-MM-DD — got "${date}"`);
      return;
    }

    const entry: DailyLogEntry = {
      date,
      dsa: parseMark(row.dsa ?? '', rowNum, 'dsa', errors),
      bld: parseMark(row.bld ?? '', rowNum, 'bld', errors),
      trn: parseMark(row.trn ?? '', rowNum, 'trn', errors),
      slp: parseMark(row.slp ?? '', rowNum, 'slp', errors),
      fue: parseMark(row.fue ?? '', rowNum, 'fue', errors),
      att: parseMark(row.att ?? '', rowNum, 'att', errors),
    };

    if (row.wake && TIME_RE.test(row.wake)) entry.wake = row.wake;
    if (row.sleep && TIME_RE.test(row.sleep)) entry.sleep = row.sleep;
    if (row.scrn) {
      const n = Number(row.scrn);
      if (Number.isFinite(n)) entry.screenMinutes = n;
    }
    if (row.energy) {
      const n = Number(row.energy);
      if (Number.isFinite(n)) entry.energy = n;
    }
    if (row.focus) {
      const n = Number(row.focus);
      if (Number.isFinite(n)) entry.focus = n;
    }
    if (row.blocker) {
      const mapped = BLOCKER_MAP[row.blocker.trim().toLowerCase()];
      if (mapped) entry.blocker = mapped;
    }
    if (row.note) entry.note = row.note;

    entries.push(entry);
  });

  return { entries, errors };
}

export interface DsaLogEntry {
  date: string;
  problem: string;
  topic: string;
  difficulty: 'E' | 'M' | 'H';
  outcome: AttemptOutcome;
  minutes: number;
  insight?: string;
}

const OUTCOME_MAP: Record<string, AttemptOutcome> = {
  first: 'first_attempt',
  hint: 'hint',
  editorial: 'editorial',
  unsolved: 'unsolved',
};

/** Pure. Parses docs/13's DSA-log CSV (header: date, problem, topic,
 * diff, outcome, min, insight). */
export function parseDsaLog(csv: string): ParseResult<DsaLogEntry> {
  const rows = parseCsvWithHeader(csv);
  const entries: DsaLogEntry[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const date = row.date ?? '';
    if (!DATE_RE.test(date)) {
      errors.push(`row ${rowNum}: "date" must be YYYY-MM-DD — got "${date}"`);
      return;
    }
    const problem = (row.problem ?? '').trim();
    if (!problem) {
      errors.push(`row ${rowNum}: "problem" is required`);
      return;
    }
    const difficulty = (row.diff ?? '').trim().toUpperCase();
    if (difficulty !== 'E' && difficulty !== 'M' && difficulty !== 'H') {
      errors.push(`row ${rowNum}: "diff" must be E, M or H — got "${row.diff}"`);
      return;
    }
    const outcome = OUTCOME_MAP[(row.outcome ?? '').trim().toLowerCase()];
    if (!outcome) {
      errors.push(`row ${rowNum}: "outcome" must be first, hint, editorial or unsolved — got "${row.outcome}"`);
      return;
    }
    const minutes = Number(row.min);
    if (!Number.isFinite(minutes) || minutes < 0) {
      errors.push(`row ${rowNum}: "min" must be a number — got "${row.min}"`);
      return;
    }

    entries.push({
      date,
      problem,
      topic: (row.topic ?? '').trim() || 'Uncategorized',
      difficulty,
      outcome,
      minutes,
      insight: row.insight || undefined,
    });
  });

  return { entries, errors };
}

/** Pure. Same slug convention as ui/dsa/LogProblemSheet.tsx's manual
 * entry path, so a paper-imported problem and a later manually-logged
 * revisit of "the same" problem resolve to the same dsa_problem row. */
export function slugifyProblemTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, '-');
}
