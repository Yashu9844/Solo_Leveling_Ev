import type { StageId } from '../../../onboarding/types';

/** What the spine reads out and the console's rail says for each stage of the interview: a single tracked word, and a label. */
export const STAGE_COPY: Record<StageId, { code: string; kicker: string }> = {
  DESIGNATION: { code: 'IDENTITY', kicker: 'AWAKENING' },
  INTENT: { code: 'INTENT', kicker: 'WHAT CHANGES' },
  HIERARCHY: { code: 'PRIORITY', kicker: 'ORDER THE FIELD' },
  RESOLUTION: { code: 'RESOLUTION', kicker: 'NAME THE TARGET' },
  MEASURE: { code: 'MEASURE', kicker: 'SET THE BAR' },
  GUARDRAILS: { code: 'GUARDRAILS', kicker: 'PROTECT CAPACITY' },
  RHYTHM: { code: 'RHYTHM', kicker: 'CALIBRATE THE DAY' },
  ARC: { code: 'ARC', kicker: 'DEFINE THE WINDOW' },
  TRIGGERS: { code: 'TRIGGERS', kicker: 'TRIGGER PROTOCOL' },
  BASELINE: { code: 'BASELINE', kicker: 'BASELINE CAPTURE' },
};
