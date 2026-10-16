// Walks the interview with a journey's answers (tests/fixtures/personas/journeys.ts): every question the engine asks, in order, answered with
// the journey's value where it has one and the System's default where it does not. The same steps are what the browser journey replays.
import { QUESTIONS } from '../../../src/onboarding/content';
import { applyAnswer, defaultFor, nextQuestion, optionsFor } from '../../../src/onboarding/engine';
import type { InterviewDraft, QuestionKind, Tier } from '../../../src/onboarding/types';

export interface JourneyStep {
  key: string;
  kind: QuestionKind;
  writes: string;
  value: unknown;
  /** Whether the journey gave this answer (otherwise it is the System's own default). */
  given: boolean;
  options: string[];
}

export function walkJourney(answers: Record<string, unknown>, today: string, tier: Tier = 'guided'): { draft: InterviewDraft; steps: JourneyStep[]; unused: string[] } {
  let draft: InterviewDraft = { tier, answers: {} };
  const steps: JourneyStep[] = [];
  for (let guard = 0; guard < 400; guard++) {
    const instance = nextQuestion(draft, QUESTIONS);
    if (!instance) break;
    const given = Object.prototype.hasOwnProperty.call(answers, instance.writes);
    const value = given ? answers[instance.writes] : defaultFor(instance, draft.answers, { today });
    const applied = applyAnswer(draft, instance, value);
    if (applied.error) throw new Error(`${instance.key} (${instance.writes}) refused ${JSON.stringify(value)}: ${applied.error}`);
    steps.push({ key: instance.key, kind: instance.def.kind, writes: instance.writes, value: applied.draft.answers[instance.writes], given, options: optionsFor(instance, draft.answers).map((option) => option.value) });
    draft = applied.draft;
  }
  const asked = new Set(steps.map((step) => step.writes));
  return { draft, steps, unused: Object.keys(answers).filter((path) => !asked.has(path)) };
}
