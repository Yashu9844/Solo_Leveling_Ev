// The invariants of platform/04 §31.2, wired (loop 9.5).
//
// INVARIANT_RUNS sets how many random Systems each property checks: the default keeps a pull request's run short, the
// nightly job sets it high (.github/workflows/platform.yml). Everything is seeded, so a failure names its seed and replays.
import { generateBlueprint } from '../../../src/generator';
import type { DomainChoice, DraftState } from '../../../src/generator/types';
import { ARCHETYPES } from '../../../src/library/archetypes';
import { mulberry32 } from './randomEventLog';

/** Random Systems per property: 12 on a pull request, 300 in the nightly job (INVARIANT_RUNS=300). */
export const INVARIANT_RUNS = Math.max(1, Number(process.env.INVARIANT_RUNS ?? 12));

/** Where each invariant is checked. A new invariant, or a moved test, has to be reflected here: the registry test reads these files. */
export const INVARIANT_COVERAGE: Record<string, { file: string; mention: string }> = {
  I1: { file: 'invariants.test.ts', mention: 'I1' },
  I2: { file: 'invariants.test.ts', mention: 'I2' },
  I3: { file: 'integrity-invariants.test.ts', mention: 'I3' },
  I4: { file: 'integrity-invariants.test.ts', mention: 'I4' },
  I5: { file: 'invariants.test.ts', mention: 'I5' },
  I6: { file: 'invariants.test.ts', mention: 'I6' },
  I7: { file: 'integrity-invariants.test.ts', mention: 'I7' },
  I8: { file: 'integrity-invariants.test.ts', mention: 'I8' },
  I9: { file: 'invariants.test.ts', mention: 'I9' },
  I10: { file: 'invariants.test.ts', mention: 'I10' },
  I11: { file: 'generator-blueprint.test.ts', mention: 'I11' },
  I12: { file: 'invariants.test.ts', mention: 'I12' },
  I13: { file: 'integrity-invariants.test.ts', mention: 'I13' },
  I14: { file: 'invariants.test.ts', mention: 'I14' },
  I15: { file: 'invariants.test.ts', mention: 'I15' },
  I16: { file: 'integrity-invariants.test.ts', mention: 'I16' },
  I17: { file: 'generator-presets.test.ts', mention: 'I17' },
  I18: { file: 'integrity-invariants.test.ts', mention: 'I18' },
  I19: { file: 'time-correctness.test.ts', mention: 'I19' },
  I20: { file: 'invariants.test.ts', mention: 'I20' },
};

const ENGINES = Object.values(ARCHETYPES).filter((archetype) => archetype.role === 'engine').map((archetype) => archetype.id);
const GUARDRAILS = Object.values(ARCHETYPES).filter((archetype) => archetype.role === 'guardrail').map((archetype) => archetype.id);

/** A random, valid-shaped draft: 3-6 distinct engines and 1-3 distinct guardrails (4-8 core domains), any arc length, rhythm and priority mode. */
export function randomDraft(seed: number): DraftState {
  const random = mulberry32(seed * 7919 + 13);
  const shuffled = <T>(items: readonly T[]): T[] => items.map((item) => ({ item, k: random() })).sort((a, b) => a.k - b.k).map(({ item }) => item);
  // Three to six engines and one to three guardrails, never more than eight core domains (V-DOM-01): the shapes the interview can reach.
  const engineCount = 3 + Math.floor(random() * 4);
  const engines = shuffled(ENGINES).slice(0, engineCount);
  const guardrails = shuffled(GUARDRAILS).slice(0, 1 + Math.floor(random() * Math.min(3, 8 - engineCount)));
  const domains: DomainChoice[] = [...engines, ...guardrails].map((archetypeId) => ({
    archetypeId,
    ...(random() < 0.4 ? { answers: { goodDay: 1 + Math.floor(random() * 60), hardDay: 1 + Math.floor(random() * 10), limit: 20 + Math.floor(random() * 200) } } : {}),
  }));
  return {
    lineageId: `inv-${seed}`, today: '2026-09-01', identity: { displayName: 'INV', primaryObjective: 'Hold the invariants.' }, domains,
    priorityMode: random() < 0.5 ? 'ranked' : 'equal',
    rhythm: { wakeTime: `0${5 + Math.floor(random() * 4)}:${random() < 0.5 ? '00' : '30'}`, sleepTime: `${String((21 + Math.floor(random() * 5)) % 24).padStart(2, '0')}:00` },
    arc: { startDate: '2026-09-01', lengthDays: 60 + Math.floor(random() * 306), timezone: random() < 0.5 ? 'Asia/Kolkata' : 'America/New_York' },
  };
}

/** A random System that generates without an error. */
export function randomSystem(seed: number) {
  const draft = randomDraft(seed);
  const { blueprint, issues } = generateBlueprint(draft);
  return { draft, blueprint, issues };
}
