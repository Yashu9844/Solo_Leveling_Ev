// From the interview's answers to the generator's input (platform/03 §23.4). Pure and total: a draft with nothing answered still yields a
// DraftState the generator can turn into a valid Blueprint, because every field the interview did not fill has the library's own default.
import type { SystemBlueprint } from '../blueprint/schema';
import { withGuardrails } from '../generator/presets';
import type { DomainAnswers, DomainChoice, DraftState } from '../generator/types';
import { ARCHETYPES } from '../library/archetypes';
import { isCustomArchetypeId } from '../library/archetypes/custom';
import { AREAS, DEFAULT_GUARDRAIL_ARCHETYPES } from '../library/presets';
import { activeAnswers, customNames, isCustomArea, rankedAreas, splitList, type Answers } from './engine';
import type { InterviewDraft, QuestionDef } from './types';
import { SKIP } from './types';

export interface MappingContext {
  lineageId: string;
  /** Today's local date. */
  today: string;
  timezone: string;
}

/** A "when, where, then" the person wrote for a domain; attached to the domain's quest by archetype once the System is generated. */
export interface Intention {
  archetypeId: string;
  time: string;
  place: string;
  action: string;
}

export interface InterviewResult {
  draft: DraftState;
  intentions: Intention[];
  /** Starting measurements the person gave (weight_kg, waist_cm, bodyfat_pct). Never scored. */
  baseline: Record<string, number>;
}

const DEFAULT_OBJECTIVE = 'Become the person this System describes.';
const MAX_TOPICS = 12;
const ARC_BOUNDS = { min: 60, max: 365 } as const;
const START_WINDOW = { daysBack: 14, daysAhead: 30 } as const;
const DAY = 86_400_000;

const isoDay = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / DAY;
const addDays = (iso: string, days: number): string => new Date((isoDay(iso) + days) * DAY).toISOString().slice(0, 10);
const asText = (value: unknown): string | undefined => (typeof value === 'string' && value !== SKIP && value.trim() !== '' ? value.trim() : undefined);
const asNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/** The archetype an area leads to: the person's resolution, or the area's own default. */
function archetypeOf(area: string, answers: Answers): string | undefined {
  const chosen = asText(answers[`area.${area}.resolution`]);
  if (chosen && (ARCHETYPES[chosen] || isCustomArchetypeId(chosen))) return chosen;
  return AREAS.find((candidate) => candidate.id === area)?.archetypeId;
}

function domainAnswers(area: string, archetypeId: string, answers: Answers): DomainAnswers {
  const out: DomainAnswers = {};
  if (isCustomArea(area)) {
    // A thing of their own: its name is the subject, and the rest is what the action calls for.
    out.topic = customNames(answers)[Number(area.slice('custom'.length)) - 1];
    const designation = asText(answers[`area.${area}.designation`]);
    if (designation) out.designation = designation;
    if (answers[`area.${area}.holds`] === 'hold') out.guardrail = true;
    const limit = asNumber(answers[`area.${area}.limit`]);
    if (limit !== undefined && limit > 0) out.limit = limit;
    const time = asText(answers[`area.${area}.time`]);
    if (time) out.time = time;
    const items = asText(answers[`area.${area}.items`]);
    if (items) out.items = splitList(items).slice(0, MAX_TOPICS);
  }
  const goodDay = asNumber(answers[`area.${area}.goodDay`]);
  const hardDay = asNumber(answers[`area.${area}.hardDay`]);
  const success = asNumber(answers[`area.${area}.success`]);
  if (goodDay !== undefined && goodDay >= 1) out.goodDay = goodDay;
  if (hardDay !== undefined && hardDay >= 1) out.hardDay = out.goodDay === undefined ? hardDay : Math.min(hardDay, out.goodDay);
  if (success !== undefined && success >= 1) out.success = success;
  const topics = asText(answers[`area.${area}.topics`]);
  if (topics && (archetypeId === 'exam-prep' || archetypeId === 'custom:practice_item')) {
    const list = [...new Set(topics.split(/[,;\n]/).map((topic) => topic.trim()).filter(Boolean))].slice(0, MAX_TOPICS);
    if (list.length > 0) out.topics = list;
  }
  return out;
}

/** The arc's length: the person's choice, or the days to the earliest exam when they asked for the arc to end on it. */
function arcLength(answers: Answers, startDate: string, examDates: string[]): number {
  const chosen = Number(answers['arc.lengthDays']);
  let length = Number.isFinite(chosen) && chosen > 0 ? chosen : 120;
  if (answers['arc.alignToExam'] === 'yes' && examDates.length > 0) {
    // The arc's last day is start + length - 1, so ending ON the exam date takes one day more than the days between.
    const toExam = Math.round(isoDay([...examDates].sort()[0]!) - isoDay(startDate));
    if (toExam > 0) length = toExam + 1;
  }
  return Math.min(ARC_BOUNDS.max, Math.max(ARC_BOUNDS.min, Math.round(length)));
}

export function interviewToDraft(interview: InterviewDraft, questions: readonly QuestionDef[], context: MappingContext): InterviewResult {
  const answers = activeAnswers(interview, questions);

  // Domains, in the order the person ranked their areas; two areas that lead to the same archetype make one domain.
  const seen = new Set<string>();
  const choices: DomainChoice[] = [];
  const examDates: string[] = [];
  const triggers: Intention[] = [];
  for (const area of rankedAreas(answers)) {
    const archetypeId = archetypeOf(area, answers);
    if (!archetypeId) continue;
    // Two areas that lead to the same archetype make one domain - except the person's own things, which are distinct by name.
    const key = isCustomArea(area) ? `${area}:${archetypeId}` : archetypeId;
    if (seen.has(key)) continue;
    seen.add(key);
    const given = domainAnswers(area, archetypeId, answers);
    choices.push({ archetypeId, ...(Object.keys(given).length > 0 ? { answers: given } : {}) });
    const examDate = asText(answers[`area.${area}.examDate`]);
    if (archetypeId === 'exam-prep' && examDate) examDates.push(examDate);
    const [time, place, action] = ['triggerTime', 'triggerPlace', 'triggerAction'].map((id) => asText(answers[`area.${area}.${id}`]));
    if (time && place && action && ARCHETYPES[archetypeId]?.intention) triggers.push({ archetypeId, time, place, action });
  }

  // The guardrails the person chose (Quick: the defaults), each with its limit where it has one.
  const chosenGuardrails = Array.isArray(answers.guardrails) ? (answers.guardrails as unknown[]).filter((id): id is string => typeof id === 'string' && !!ARCHETYPES[id]) : [];
  const domains = withGuardrails(choices, chosenGuardrails.length > 0 ? chosenGuardrails : DEFAULT_GUARDRAIL_ARCHETYPES);
  for (const choice of domains) {
    const limit = asNumber(answers[`guardrail.${choice.archetypeId}.limit`]);
    if (limit !== undefined && limit > 0) choice.answers = { ...choice.answers, limit };
  }

  const startRaw = asText(answers['arc.startDate']) ?? context.today;
  const offset = Math.round(isoDay(startRaw) - isoDay(context.today));
  const startDate = addDays(context.today, Number.isFinite(offset) ? Math.min(START_WINDOW.daysAhead, Math.max(-START_WINDOW.daysBack, offset)) : 0);

  const baseline: Record<string, number> = {};
  for (const metric of ['weight_kg', 'waist_cm', 'bodyfat_pct']) {
    const value = asNumber(answers[`baseline.${metric}`]);
    if (value !== undefined) baseline[metric] = value;
  }

  const wakeTime = asText(answers['rhythm.wakeTime']);
  const sleepTime = asText(answers['rhythm.sleepTime']);
  const draft: DraftState = {
    lineageId: context.lineageId,
    today: context.today,
    identity: { displayName: asText(answers['identity.displayName']) ?? 'Hunter', primaryObjective: asText(answers['identity.primaryObjective']) ?? DEFAULT_OBJECTIVE },
    domains,
    priorityMode: 'ranked',
    rhythm: { ...(wakeTime ? { wakeTime } : {}), ...(sleepTime ? { sleepTime } : {}) },
    arc: { startDate, lengthDays: arcLength(answers, startDate, examDates), timezone: context.timezone },
  };
  return { draft, intentions: triggers, baseline };
}

/** An if-then sentence bound to the quest that carries it. */
export interface QuestIntention {
  questId: string;
  time: string;
  place: string;
  first_action: string;
}

/** The person's triggers, resolved to the core quests of the generated System; a domain that does not allow one, or lost its quest, drops it. */
export function questIntentions(blueprint: SystemBlueprint, intentions: readonly Intention[]): QuestIntention[] {
  const out = new Map<string, QuestIntention>();
  for (const intention of intentions) {
    const domain = blueprint.domains.find((candidate) => candidate.archetypeId === intention.archetypeId && candidate.intention?.allowed);
    const quest = domain && blueprint.quests.find((candidate) => candidate.domainId === domain.id && candidate.type === 'core');
    if (quest && !out.has(quest.id)) out.set(quest.id, { questId: quest.id, time: intention.time, place: intention.place, first_action: intention.action });
  }
  return [...out.values()];
}
