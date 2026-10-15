// The owner's training sessions, steps and screen time keep writing TRAINING_SESSION_LOGGED,
// STEPS_LOGGED and SCREENTIME_LOGGED through their stores.
import { realDeps } from '../../../store/deps';
import { getEngineConfig } from '../../../store/engineConfig';
import { logScreentime } from '../../../store/lifestyle';
import { logSteps, logTrainingSession, type LogTrainingSessionInput } from '../../../store/training';
import type { RecorderContext } from '../recorders/duration';
import type { SessionValues } from '../recorders/sessionAndThreshold';

export async function legacyRecordSession(instrumentId: string, values: SessionValues, ctx: RecorderContext): Promise<void> {
  if (instrumentId !== 'training.sessions') throw new Error(`"${instrumentId}" has no legacy session writer.`);
  await logTrainingSession(
    ctx.today,
    ctx.arcId,
    { type: values.sessionType as LogTrainingSessionInput['type'], minutes: values.minutes, rpe: values.rpe ?? 6 },
    getEngineConfig(),
    realDeps
  );
}

export async function legacyRecordThreshold(instrumentId: string, value: number, ctx: RecorderContext): Promise<void> {
  if (instrumentId === 'training.steps') return logSteps(ctx.today, ctx.arcId, value, getEngineConfig(), realDeps);
  if (instrumentId === 'attention.screen') return logScreentime(ctx.today, ctx.arcId, value, getEngineConfig(), realDeps);
  throw new Error(`"${instrumentId}" has no legacy threshold writer.`);
}
