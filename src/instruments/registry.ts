import type { InstrumentType } from '../blueprint/schema';
import type { InstrumentDefinition } from './framework';
import { artifactInstrument } from './types/artifact';
import { checklistInstrument } from './types/checklist';
import { durationInstrument } from './types/duration';
import { pipelineInstrument } from './types/pipeline';
import { practiceItemInstrument } from './types/practiceItem';
import { sessionInstrument } from './types/session';
import { studyBlockInstrument } from './types/studyBlock';
import { thresholdInstrument } from './types/threshold';
import { timeWindowInstrument } from './types/timeWindow';

/** Each definition is generic in its own params and record; the registry is addressed by type string, so it is erased to the common shape. */
type AnyDefinition = InstrumentDefinition;
const erase = (definition: unknown) => definition as AnyDefinition;

/** The executable half of every instrument type, by type (platform/02 §8.2). */
export const INSTRUMENT_DEFINITIONS: Readonly<Record<InstrumentType, AnyDefinition>> = {
  practice_item: erase(practiceItemInstrument),
  pipeline: erase(pipelineInstrument),
  duration: erase(durationInstrument),
  session: erase(sessionInstrument),
  threshold: erase(thresholdInstrument),
  time_window: erase(timeWindowInstrument),
  artifact: erase(artifactInstrument),
  study_block: erase(studyBlockInstrument),
  checklist: erase(checklistInstrument),
};
