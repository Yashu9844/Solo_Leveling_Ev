// "Because": every card of the Reveal says which answer it came from (platform/03 §28.3), so a person can see that the System is built from
// what they said and not from a template - and knows which line to change if it is wrong. Pure; one short line in the System register,
// using the person's own facts. It never praises and never predicts.
import type { DraftState } from '../generator/types';
import { ARCHETYPES } from '../library/archetypes';
import { measureBounds } from './content';
import { archetypeOf } from './mapping';
import { activeAnswers, chosenAreas, customNames, isCustomArea, rankedAreas } from './engine';
import { domainKey, type Pins } from './pins';
import type { InterviewDraft, QuestionDef } from './types';

export interface Provenance {
  /** By domain key (onboarding/pins.ts domainKey). */
  domain: Record<string, string>;
  /** Where a domain's good day came from. */
  goodDay: Record<string, string>;
  arc: string;
}

const ORDINALS = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH'];

export function provenanceFor(interview: InterviewDraft, questions: readonly QuestionDef[], draft: DraftState, pins: Pins): Provenance {
  const answers = activeAnswers(interview, questions);
  const areaOptions = questions.find((question) => question.writes === 'areas')?.options;
  const labelOfArea = (area: string): string => {
    if (isCustomArea(area)) return (customNames(answers)[Number(area.slice('custom'.length)) - 1] ?? area).toUpperCase();
    return (Array.isArray(areaOptions) ? areaOptions.find((option) => option.value === area)?.label : undefined)?.toUpperCase() ?? area.toUpperCase();
  };
  const ranked = rankedAreas(answers);
  const keyToArea = new Map<string, string>();
  for (const area of chosenAreas(answers)) {
    const archetypeId = archetypeOf(area, answers);
    if (archetypeId) keyToArea.set(domainKey(archetypeId, isCustomArea(area) ? labelOfArea(area) : undefined).toLowerCase(), area);
  }
  const guardrails = new Set(Array.isArray(answers.guardrails) ? (answers.guardrails as string[]) : []);

  const domain: Record<string, string> = {};
  const goodDay: Record<string, string> = {};
  for (const choice of draft.domains) {
    const key = domainKey(choice.archetypeId, choice.answers?.topic);
    const area = keyToArea.get(key.toLowerCase());
    const archetype = ARCHETYPES[choice.archetypeId];
    const held = choice.answers?.guardrail === true || archetype?.role === 'guardrail';
    if (area) {
      const rank = ranked.indexOf(area);
      const ordinal = ORDINALS[rank] ? `, AND RANKED IT ${ORDINALS[rank]}` : '';
      domain[key] = isCustomArea(area) ? `BECAUSE: YOU NAMED IT${ordinal}.` : `BECAUSE: YOU CHOSE ${labelOfArea(area)}${ordinal}.`;
    } else if (held) {
      domain[key] = guardrails.has(choice.archetypeId) ? 'BECAUSE: YOU CHOSE IT TO PROTECT YOUR CAPACITY.' : 'BECAUSE: THE SYSTEM PROTECTS YOUR CAPACITY WITH IT.';
    } else {
      domain[key] = 'BECAUSE: A SYSTEM NEEDS AT LEAST TWO THINGS TO PUSH.';
    }

    const noun = measureBounds(choice.archetypeId)?.noun;
    const pinned = pins.domains[key]?.goodDay !== undefined;
    const given = area ? answers[`area.${area}.goodDay`] : undefined;
    goodDay[key] = held ? 'HELD, NOT PUSHED.'
      : pinned ? 'YOU ADJUSTED IT.'
        : typeof given === 'number' && noun ? `BECAUSE: YOUR GOOD DAY IS ${given} ${noun}.`
          : 'BECAUSE: THE USUAL GOOD DAY FOR THIS WORK. ADJUST IT IF IT IS NOT YOURS.';
  }

  const hasExam = Object.keys(answers).some((path) => /^area\.[^.]+\.examDate$/.test(path));
  const arc = pins.arcLength !== undefined ? 'YOU ADJUSTED IT.'
    : answers['arc.alignToExam'] === 'yes' && hasExam ? 'BECAUSE: IT ENDS ON YOUR EXAM DATE.'
      : answers['arc.lengthDays'] !== undefined ? `BECAUSE: YOU CHOSE ${answers['arc.lengthDays']} DAYS.`
        : 'BECAUSE: THE USUAL LENGTH. ADJUST IT IF IT IS NOT YOURS.';
  return { domain, goodDay, arc };
}
