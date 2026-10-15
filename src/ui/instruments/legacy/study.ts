// The owner's learning blocks and system-design studies keep writing LEARNING_BLOCK_LOGGED and
// SYSTEM_DESIGN_LOGGED through store/build.ts.
import { realDeps } from '../../../store/deps';
import { getEngineConfig } from '../../../store/engineConfig';
import { logLearningBlock, logSystemDesignStudy } from '../../../store/build';
import { getFoundationTopicMastery } from '../../../store/mastery';
import type { SystemDesignStudyRow } from '../../../db/schema';
import { masteryAdvanced } from '../recorders/practiceShared';
import type { RecorderContext } from '../recorders/duration';
import type { StudyResult, StudyValues } from '../recorders/studyBlock';

export async function legacyRecordStudy(instrumentId: string, values: StudyValues, ctx: RecorderContext): Promise<StudyResult> {
  if (instrumentId !== 'foundations.blocks') throw new Error(`"${instrumentId}" has no legacy study writer.`);
  const before = await getFoundationTopicMastery(values.topic);
  if (values.design) {
    await logSystemDesignStudy(
      ctx.today, ctx.arcId, values.design.system.trim(), values.design.mode as SystemDesignStudyRow['mode'], values.minutes,
      getEngineConfig(), realDeps, values.design.artifactUrl?.trim() || undefined, values.note?.trim() || undefined
    );
  } else {
    await logLearningBlock(ctx.today, ctx.arcId, values.topic, values.minutes, getEngineConfig(), realDeps, values.note?.trim() || undefined);
  }
  const after = await getFoundationTopicMastery(values.topic);
  return masteryAdvanced(before, after) ? { masteryAdvance: { topic: values.topic, state: after } } : {};
}
