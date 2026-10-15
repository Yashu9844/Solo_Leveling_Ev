// The owner's DSA instrument keeps writing PROBLEM_LOGGED through store/dsa.ts
// (platform/02 §8.2: legacy instruments never come through recordInstrument).
import { getEngineConfig } from '../../../store/engineConfig';
import { realDeps } from '../../../store/deps';
import { logProblem } from '../../../store/dsa';
import { getDsaTopicMastery } from '../../../store/mastery';
import { masteryAdvanced, slugOf, type PracticeResult, type PracticeValues } from '../recorders/practiceShared';

export async function legacyRecordPractice(instrumentId: string, values: PracticeValues, ctx: { today: string; arcId: string }): Promise<PracticeResult> {
  if (instrumentId !== 'dsa.problems') throw new Error(`"${instrumentId}" has no legacy practice writer.`);
  const before = await getDsaTopicMastery(values.topic);
  await logProblem(
    ctx.today,
    ctx.arcId,
    {
      slug: slugOf(values.title),
      title: values.title.trim(),
      topic: values.topic,
      difficulty: values.difficulty,
      outcome: values.outcome,
      minutes: values.minutes,
      insight: values.insight?.trim() || undefined,
    },
    getEngineConfig(),
    realDeps
  );
  const after = await getDsaTopicMastery(values.topic);
  // final/05 §2.1's MASTERY Moment fires only on a genuine state advance.
  return masteryAdvanced(before, after) ? { masteryAdvance: { topic: values.topic, state: after } } : {};
}
