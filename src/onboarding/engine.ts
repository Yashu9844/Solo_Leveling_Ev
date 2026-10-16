// The question engine (platform/03 §23.2): pure functions over serialisable data.
//
//   nextQuestion(draft, questions)  -> the first eligible, unanswered, in-budget question, or null
//   applyAnswer(draft, instance, v) -> a new draft (validated; the old one is never mutated)
//   activeAnswers(draft, questions) -> the answers that currently count; the rest are retained but inert
//
// Order: stage, then (within a stage) the questions that are asked once, in the order the content lists them, then the questions
// asked per area, one area at a time in the order the person ranked them. A person's answers are never discarded: switching an
// area off makes its answers inert, switching it back on makes them count again.
import {
  AREA_BUDGET, AREA_COUNT, SKIP, STAGES,
  type DefaultRule, type DraftPath, type InterviewDraft, type OptionDef, type Predicate, type QuestionDef, type QuestionInstance, type StageId, type Tier,
} from './types';

export type Answers = Record<DraftPath, unknown>;
export interface EngineContext {
  /** Today's local date: an input, because the engine has no clock. */
  today: string;
}

const present = (value: unknown): boolean =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '') && !(Array.isArray(value) && value.length === 0);

// ── Predicates ──────────────────────────────────────────────────────────────

export function evaluate(predicate: Predicate, answers: Answers): boolean {
  if ('always' in predicate) return true;
  if ('has' in predicate) {
    const value = answers[predicate.has];
    if (predicate.value === undefined) return present(value);
    return Array.isArray(value) ? value.includes(predicate.value) : value === predicate.value;
  }
  if ('eq' in predicate) return JSON.stringify(answers[predicate.eq[0]]) === JSON.stringify(predicate.eq[1]);
  if ('gte' in predicate) {
    const value = Number(answers[predicate.gte[0]]);
    return Number.isFinite(value) && value >= predicate.gte[1];
  }
  if ('and' in predicate) return predicate.and.every((child) => evaluate(child, answers));
  if ('or' in predicate) return predicate.or.some((child) => evaluate(child, answers));
  return !evaluate(predicate.not, answers);
}

const bindPath = (path: string, area: string | undefined): string => (area === undefined ? path : path.replace(/\{area\}/g, area));

/** The predicate with `{area}` replaced, in paths and in string values. */
export function bindPredicate(predicate: Predicate, area: string | undefined): Predicate {
  if (area === undefined) return predicate;
  const bindValue = <T>(value: T): T => (typeof value === 'string' ? (value.replace(/\{area\}/g, area) as unknown as T) : value);
  if ('always' in predicate) return predicate;
  if ('has' in predicate) return { has: bindPath(predicate.has, area), ...(predicate.value !== undefined ? { value: bindValue(predicate.value) } : {}) };
  if ('eq' in predicate) return { eq: [bindPath(predicate.eq[0], area), bindValue(predicate.eq[1])] };
  if ('gte' in predicate) return { gte: [bindPath(predicate.gte[0], area), predicate.gte[1]] };
  if ('and' in predicate) return { and: predicate.and.map((child) => bindPredicate(child, area)) };
  if ('or' in predicate) return { or: predicate.or.map((child) => bindPredicate(child, area)) };
  return { not: bindPredicate(predicate.not, area) };
}

// ── Areas ───────────────────────────────────────────────────────────────────

/** The chosen areas in the order the person ranked them; areas they have not ranked follow in the order they were chosen. */
export function rankedAreas(answers: Answers): string[] {
  const chosen = Array.isArray(answers.areas) ? (answers.areas as string[]).filter((area) => typeof area === 'string') : [];
  const ranked = Array.isArray(answers.priorities) ? (answers.priorities as string[]).filter((area) => chosen.includes(area)) : [];
  return [...new Set([...ranked, ...chosen])];
}

// ── Expansion ───────────────────────────────────────────────────────────────

const stageIndex = (stage: StageId): number => STAGES.indexOf(stage);

function areaLabel(area: string, questions: readonly QuestionDef[]): string {
  const intent = questions.find((question) => question.writes === 'areas');
  const option = Array.isArray(intent?.options) ? intent!.options.find((candidate) => candidate.value === area) : undefined;
  return (option?.label ?? area).toUpperCase();
}

/** Every question as it would be asked for this draft's areas, in asking order. Eligibility and budget are applied by the callers. */
export function expand(questions: readonly QuestionDef[], answers: Answers): QuestionInstance[] {
  const areas = rankedAreas(answers);
  const out: QuestionInstance[] = [];
  for (const stage of STAGES) {
    const inStage = questions.filter((question) => question.stage === stage);
    for (const question of inStage.filter((candidate) => candidate.each === undefined)) {
      out.push({ key: question.id, def: question, writes: question.writes, heading: question.heading });
    }
    for (const [rank, area] of areas.entries()) {
      for (const question of inStage.filter((candidate) => candidate.each === 'area' && (candidate.topN === undefined || rank < candidate.topN))) {
        out.push({ key: `${question.id}@${area}`, def: question, area, writes: bindPath(question.writes, area), heading: question.heading.replace(/\{area\}/g, areaLabel(area, questions)) });
      }
    }
  }
  return out;
}

const tierAllows = (questionTier: Tier, draftTier: Tier): boolean => draftTier === 'guided' || questionTier === 'quick';

/** The questions that are in play for this draft: right tier, eligible, and within each area's budget. */
export function livePlan(draft: InterviewDraft, questions: readonly QuestionDef[]): QuestionInstance[] {
  const used = new Map<string, number>();
  const plan: QuestionInstance[] = [];
  for (const instance of expand(questions, draft.answers)) {
    if (!tierAllows(instance.def.tier, draft.tier)) continue;
    if (!evaluate(bindPredicate(instance.def.eligibility, instance.area), draft.answers)) continue;
    if (instance.area !== undefined && instance.def.budgeted !== false) {
      const count = used.get(instance.area) ?? 0;
      if (count >= AREA_BUDGET[draft.tier]) continue;
      used.set(instance.area, count + 1);
    }
    plan.push(instance);
  }
  return plan;
}

export const isAnswered = (instance: QuestionInstance, answers: Answers): boolean => present(answers[instance.writes]);

/** The next question to ask, or null when the interview is complete. Pure. */
export function nextQuestion(draft: InterviewDraft, questions: readonly QuestionDef[]): QuestionInstance | null {
  return livePlan(draft, questions).find((instance) => !isAnswered(instance, draft.answers)) ?? null;
}

export const isComplete = (draft: InterviewDraft, questions: readonly QuestionDef[]): boolean => nextQuestion(draft, questions) === null;

/** The answers that count now. An answer to a question that has become ineligible (or out of budget) is kept in the draft but not returned. */
export function activeAnswers(draft: InterviewDraft, questions: readonly QuestionDef[]): Answers {
  const live = new Set(livePlan(draft, questions).map((instance) => instance.writes));
  return Object.fromEntries(Object.entries(draft.answers).filter(([path]) => live.has(path)));
}

// ── Options, defaults, validation ───────────────────────────────────────────

export function optionsFor(instance: QuestionInstance, answers: Answers): OptionDef[] {
  const { options } = instance.def;
  if (!options) return [];
  if (Array.isArray(options)) return options;
  // `from: '{area}'` keys the options by the area itself (each area offers its own resolutions).
  const key = options.from === '{area}' ? instance.area : answers[bindPath(options.from, instance.area)];
  return typeof key === 'string' ? (options.map[key] ?? []) : [];
}

export function defaultFor(instance: QuestionInstance, answers: Answers, context: EngineContext): unknown {
  const rule: DefaultRule | undefined = instance.def.default;
  if (!rule) return undefined;
  if ('const' in rule) return structuredClone(rule.const);
  if ('copy' in rule) return present(answers[bindPath(rule.copy, instance.area)]) ? structuredClone(answers[bindPath(rule.copy, instance.area)]) : rule.otherwise;
  if ('scale' in rule) {
    const base = Number(answers[bindPath(rule.scale.from, instance.area)]);
    if (!Number.isFinite(base)) return rule.scale.otherwise;
    return Math.max(rule.scale.min ?? 0, Math.round(base * rule.scale.factor));
  }
  if ('firstOption' in rule) {
    const options = optionsFor(instance, answers);
    if (instance.def.kind === 'multi_card') return options.slice(0, rule.count ?? 1).map((option) => option.value);
    return options[0]?.value;
  }
  const date = new Date(`${context.today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (rule.days ?? 0));
  return date.toISOString().slice(0, 10);
}

export type Validation = { ok: true; value: unknown } | { ok: false; error: string };
const fail = (error: string): Validation => ({ ok: false, error });
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Checks an answer against its question and returns the value to store (numbers clamped and snapped, text trimmed). */
export function validateAnswer(instance: QuestionInstance, answers: Answers, raw: unknown): Validation {
  const { def } = instance;
  if (raw === SKIP) return def.skippable ? { ok: true, value: SKIP } : fail('This one cannot be skipped.');
  const options = optionsFor(instance, answers);
  const values = new Set(options.map((option) => option.value));
  switch (def.kind) {
    case 'single_card':
    case 'action_card':
      return typeof raw === 'string' && values.has(raw) ? { ok: true, value: raw } : fail('Choose one of the cards.');
    case 'multi_card': {
      if (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string' || !values.has(item))) return fail('Choose from the cards.');
      const unique = [...new Set(raw as string[])];
      if (def.count?.min !== undefined && unique.length < def.count.min) return fail(`Choose at least ${def.count.min}.`);
      if (def.count?.max !== undefined && unique.length > def.count.max) return fail(`Choose at most ${def.count.max}.`);
      return { ok: true, value: unique };
    }
    case 'rank': {
      const source = answers[def.rankFrom ?? 'areas'];
      const expected = Array.isArray(source) ? (source as string[]) : [];
      if (!Array.isArray(raw) || raw.length !== expected.length || new Set(raw).size !== raw.length || raw.some((item) => !expected.includes(item as string))) return fail('Put every item in order.');
      return { ok: true, value: [...(raw as string[])] };
    }
    case 'number': {
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN;
      if (!Number.isFinite(value)) return fail('Enter a number.');
      const { min = -Infinity, max = Infinity, step } = def.bounds ?? {};
      let clamped = Math.min(max, Math.max(min, value));
      if (step && Number.isFinite(min)) clamped = min + Math.round((clamped - min) / step) * step;
      else if (step) clamped = Math.round(clamped / step) * step;
      return { ok: true, value: Math.round(clamped * 1000) / 1000 };
    }
    case 'time':
    case 'dial':
      return typeof raw === 'string' && TIME.test(raw) ? { ok: true, value: raw } : fail('Enter a time as HH:MM.');
    case 'date':
      return typeof raw === 'string' && isIsoDate(raw) ? { ok: true, value: raw } : fail('Enter a date.');
    case 'text_short': {
      if (typeof raw !== 'string') return fail('Enter some text.');
      // eslint-disable-next-line no-control-regex
      const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
      const max = def.bounds?.maxLength ?? 80;
      if (text.length === 0) return fail('Enter some text.');
      return { ok: true, value: text.slice(0, max) };
    }
  }
}

// ── Reducing the draft ──────────────────────────────────────────────────────

export function newDraft(tier: Tier = 'guided'): InterviewDraft {
  return { tier, answers: {} };
}

/** Records an answer. Returns the new draft, or the reason the answer was refused (the draft is unchanged). */
export function applyAnswer(draft: InterviewDraft, instance: QuestionInstance, raw: unknown): { draft: InterviewDraft; error?: string } {
  const result = validateAnswer(instance, draft.answers, raw);
  if (!result.ok) return { draft, error: result.error };
  return { draft: { ...draft, answers: { ...draft.answers, [instance.writes]: result.value } } };
}

/** Forgets an answer (to be asked again). Answers that depend on it stay in the draft and become inert if it made them eligible. */
export function clearAnswer(draft: InterviewDraft, path: DraftPath): InterviewDraft {
  const { [path]: _removed, ...rest } = draft.answers;
  void _removed;
  return { ...draft, answers: rest };
}

export const setTier = (draft: InterviewDraft, tier: Tier): InterviewDraft => ({ ...draft, tier });

/** Answers every question still open with its default (Quick Awakening, and "use the defaults" in Guided). Questions with no default stay open. */
export function withDefaults(draft: InterviewDraft, questions: readonly QuestionDef[], context: EngineContext): InterviewDraft {
  let current = draft;
  // Each pass can make new questions eligible (an answer to `areas` opens the per-area ones), so repeat until nothing moves.
  for (let guard = 0; guard < 1000; guard++) {
    const instance = nextQuestion(current, questions);
    if (!instance) break;
    const value = defaultFor(instance, current.answers, context);
    if (value === undefined) break;
    const applied = applyAnswer(current, instance, value);
    if (applied.error) break;
    current = applied.draft;
  }
  return current;
}

// ── The System's reply ──────────────────────────────────────────────────────

/** An answer in words: card labels, a number, a time. */
export function answerInWords(instance: QuestionInstance, answers: Answers): string {
  const value = answers[instance.writes];
  if (Array.isArray(value)) {
    const options = optionsFor(instance, answers);
    return value.map((item) => options.find((option) => option.value === item)?.label ?? String(item)).join(', ');
  }
  if (typeof value === 'string' && (instance.def.kind === 'single_card' || instance.def.kind === 'action_card')) {
    return optionsFor(instance, answers).find((option) => option.value === value)?.label ?? value;
  }
  return value === undefined ? '' : String(value);
}

/** One line reflecting the answer back, in the System register, using the person's own facts. Never praises, never predicts. */
export function echoFor(instance: QuestionInstance, answers: Answers, questions: readonly QuestionDef[]): string | null {
  const template = instance.def.echo;
  if (!template || !isAnswered(instance, answers)) return null;
  return template
    .replace(/\{answer\}/g, answerInWords(instance, answers).toUpperCase())
    .replace(/\{area\}/g, instance.area ? areaLabel(instance.area, questions) : '')
    .replace(/\{n\}/g, String(answers[instance.writes] ?? ''));
}

// ── The spine ───────────────────────────────────────────────────────────────

export type StageStatus = 'done' | 'current' | 'pending' | 'skipped';

/** Where each node of the spine stands, for the progress display. A stage with nothing to ask this tier is skipped. */
export function stageStatuses(draft: InterviewDraft, questions: readonly QuestionDef[]): Record<StageId, StageStatus> {
  const plan = livePlan(draft, questions);
  const next = nextQuestion(draft, questions);
  const currentStage = next?.def.stage;
  const statuses = {} as Record<StageId, StageStatus>;
  for (const stage of STAGES) {
    const inStage = plan.filter((instance) => instance.def.stage === stage);
    const possible = questions.some((question) => question.stage === stage && tierAllows(question.tier, draft.tier));
    if (inStage.length === 0) statuses[stage] = possible && currentStage !== undefined && stageIndex(stage) > stageIndex(currentStage) ? 'pending' : possible && currentStage === undefined ? 'done' : 'skipped';
    else if (inStage.every((instance) => isAnswered(instance, draft.answers))) statuses[stage] = 'done';
    else statuses[stage] = stage === currentStage ? 'current' : 'pending';
  }
  return statuses;
}

export { AREA_COUNT };
