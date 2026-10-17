// The self-report instruments of a checkpoint (platform/02 §16.4): self-efficacy, automaticity and enjoyment. Which questions they ask comes
// from the System's Blueprint (the owner's carries its original wording, a generated one the questions of its own domains); the scales are
// fixed, so a number means the same in every System. Never a gate, never XP. Pure.
import type { CheckpointDef } from '../schema';

export type InstrumentName = 'selfEfficacy' | 'automaticity' | 'enjoyment';

export interface InstrumentScale { min: number; max: number; step: number; start: number }

export const INSTRUMENT_SCALES: Record<InstrumentName, InstrumentScale> = {
  selfEfficacy: { min: 0, max: 100, step: 10, start: 50 },
  automaticity: { min: 1, max: 7, step: 1, start: 4 },
  enjoyment: { min: 0, max: 10, step: 1, start: 5 },
};

export type InstrumentAnswers = Partial<Record<InstrumentName, readonly number[]>>;

/** What the writer checks: each instrument answered has exactly the System's questions, each answer on its scale. Empty when fine. */
export function validateInstrumentAnswers(checkpoints: CheckpointDef, answers: InstrumentAnswers): string[] {
  const issues: string[] = [];
  for (const name of Object.keys(INSTRUMENT_SCALES) as InstrumentName[]) {
    const given = answers[name];
    if (!given) continue;
    const scale = INSTRUMENT_SCALES[name];
    if (given.length !== checkpoints[name].length) issues.push(`${name}: ${given.length} answers for ${checkpoints[name].length} questions`);
    for (const value of given) {
      if (!Number.isFinite(value) || value < scale.min || value > scale.max) issues.push(`${name}: ${value} is outside ${scale.min}-${scale.max}`);
    }
  }
  return issues;
}

/** The ids of the questions an instrument answered, in order: stored with a generated System's answers so a later version cannot misread them. */
export function instrumentIds(checkpoints: CheckpointDef, name: InstrumentName): string[] {
  return checkpoints[name].map((item) => item.id);
}
