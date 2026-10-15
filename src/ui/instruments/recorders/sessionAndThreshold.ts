// Writing a session record and a threshold reading (platform/03 §27.2).
import type { InstrumentConfig } from '../../../blueprint/schema';
import { realDeps } from '../../../store/deps';
import { recordInstrument } from '../../../store/instruments';
import { legacyRecordSession, legacyRecordThreshold } from '../legacy/sessionAndThreshold';
import { isLegacyBound } from '../types';
import type { RecorderContext } from './duration';

export interface SessionValues {
  sessionType: string;
  minutes: number;
  rpe?: number;
}

export async function recordSession(instrument: InstrumentConfig, values: SessionValues, ctx: RecorderContext): Promise<void> {
  if (isLegacyBound(instrument)) return legacyRecordSession(instrument.id, values, ctx);
  await recordInstrument(instrument.id, {
    sessionType: values.sessionType, minutes: values.minutes, ...(values.rpe !== undefined ? { rpe: values.rpe } : {}),
  }, ctx.today, realDeps);
}

export async function recordThreshold(instrument: InstrumentConfig, value: number, ctx: RecorderContext): Promise<void> {
  if (isLegacyBound(instrument)) return legacyRecordThreshold(instrument.id, value, ctx);
  await recordInstrument(instrument.id, { value }, ctx.today, realDeps);
}
