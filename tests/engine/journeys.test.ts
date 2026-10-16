// Loop 11.5: P1-P7 as a person answers for them. The answers go through the interview, the System they produce goes through the whole persona
// suite (the assertions every generated System owes), and the journey is held to what the persona's own draft asks for.
import { describe, expect, it } from 'vitest';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { generateBlueprint } from '../../src/generator';
import { checkpointDaysFor } from '../../src/library/calibration';
import { QUESTIONS } from '../../src/onboarding/content';
import { interviewToDraft } from '../../src/onboarding/mapping';
import { JOURNEYS } from '../fixtures/personas/journeys';
import { p1 } from '../fixtures/personas/p1';
import { p2 } from '../fixtures/personas/p2';
import { p3 } from '../fixtures/personas/p3';
import { p4 } from '../fixtures/personas/p4';
import { p5 } from '../fixtures/personas/p5';
import { p6 } from '../fixtures/personas/p6';
import { p7 } from '../fixtures/personas/p7';
import type { Persona } from '../fixtures/personas/types';
import { walkJourney } from './support/journeyWalk';
import { personaEventLog } from './support/personaEventLog';
import { describePersona } from './support/personaSuite';

const TODAY = '2026-09-01';
const PERSONAS: Record<string, Persona> = { P1: p1, P2: p2, P3: p3, P4: p4, P5: p5, P6: p6, P7: p7 };
const deps = { now: () => '2027-12-31T00:00:00.000Z', newId: () => 'persona-id' };

/** The persona a journey produces: its draft is what the interview made of the answers; the reviewed numbers are read from the System it generated. */
function personaOf(journeyId: string): Persona {
  const journey = JOURNEYS.find((candidate) => candidate.id === journeyId)!;
  const { draft: interview } = walkJourney(journey.answers(TODAY), TODAY);
  const { draft } = interviewToDraft(interview, QUESTIONS, { lineageId: `journey-${journey.id}`, today: TODAY, timezone: 'Asia/Kolkata' });
  const blueprint = generateBlueprint(draft).blueprint;
  const week = buildProjectionsV2(personaEventLog(blueprint, journey.seed, { kind: 'steady', days: 7 }), deps);
  return {
    id: journey.id, label: journey.label, draft, profile: { kind: 'steady', days: 60 }, seed: journey.seed,
    expect: {
      arcLength: blueprint.arc.lengthDays,
      domains: blueprint.domains.map((domain) => `${domain.role}:${domain.designation}`),
      coreXp: blueprint.quests.filter((quest) => quest.type === 'core').map((quest) => quest.xp),
      caps: blueprint.domains.map((domain) => domain.channel.cap),
      checkpointDays: checkpointDaysFor(blueprint.arc.lengthDays),
      bossTitles: blueprint.bosses.map((boss) => boss.title),
      skillTreeSizes: blueprint.skills.map((tree) => tree.nodes.length),
      attributes: blueprint.attributes.defs.map((definition) => definition.id),
      unscoredMetrics: blueprint.metrics.filter((metric) => metric.kind === 'external' || metric.kind === 'body').map((metric) => metric.id),
      firstWeekXp: week.ledger.reduce((sum, row) => sum + row.amount, 0),
    },
  };
}

for (const journey of JOURNEYS) describePersona(personaOf(journey.id));

describe('the journeys', () => {
  it('every answer a journey gives is one the interview asks for, and accepts', () => {
    for (const journey of JOURNEYS) {
      const { unused } = walkJourney(journey.answers(TODAY), TODAY);
      expect(unused, journey.id).toEqual([]);
    }
  });

  it('each says what the persona says: the same engines, the arc length and the rhythm, apart from the differences it states', () => {
    for (const journey of JOURNEYS) {
      const persona = PERSONAS[journey.persona]!;
      const made = personaOf(journey.id).draft;
      const engines = (draft: Persona['draft']) => draft.domains.map((choice) => choice.archetypeId).filter((id) => !['sleep-regularity', 'attention-control'].includes(id));
      if (journey.differences.length === 0) {
        expect(engines(made).slice().sort(), journey.id).toEqual(engines(persona.draft).slice().sort());
        expect(made.arc.lengthDays, journey.id).toBe(persona.draft.arc.lengthDays);
      }
      expect(made.rhythm, journey.id).toEqual(persona.draft.rhythm);
      expect(made.identity.primaryObjective, journey.id).toBe(persona.draft.identity.primaryObjective);
    }
  });

  it('P2’s arc ends on the exam date, and P3 keeps its body measurement beside the System, never in it', () => {
    const j2 = personaOf('J2');
    expect(j2.draft.arc.lengthDays).toBe(150);
    const j3 = walkJourney(JOURNEYS.find((journey) => journey.id === 'J3')!.answers(TODAY), TODAY);
    const { baseline } = interviewToDraft(j3.draft, QUESTIONS, { lineageId: 'x', today: TODAY, timezone: 'Asia/Kolkata' });
    expect(baseline).toEqual({ weight_kg: 71.5 });
  });
});
