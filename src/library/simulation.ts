// A TypeScript port of final/xp-simulation.py (platform/05 loop 8.1): the Monte Carlo that
// priced the level curve. It exists so the level coefficient for any arc length is DERIVED
// (library/calibration.ts) rather than guessed, and so a test can re-run it and catch drift.
//
// The port is exact, not approximate: it carries Python's own Mersenne Twister (seeding, random(),
// choice()), so tests/engine/library-simulation.test.ts compares its means to numbers dumped from
// the Python script itself, to the last float digit.
//
// Pure: no clock, no I/O. The generator never calls it at runtime; calibration.ts holds the table.

// ── Python-compatible MT19937 ───────────────────────────────────────────────
const N = 624;
const M = 397;

/** random.Random(seed) for a non-negative integer seed below 2^32 (the only kind the script uses). */
export class PythonRandom {
  private readonly mt = new Uint32Array(N);
  private index = N + 1;

  constructor(seed: number) {
    this.initByArray([seed >>> 0]);
  }

  private initGenrand(seed: number): void {
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < N; i++) {
      const previous = this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30);
      this.mt[i] = (Math.imul(1812433253, previous) + i) >>> 0;
    }
    this.index = N;
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(N, key.length); k > 0; k--) {
      const previous = this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30);
      this.mt[i] = ((this.mt[i]! ^ Math.imul(previous, 1664525)) + key[j]! + j) >>> 0;
      i++; j++;
      if (i >= N) { this.mt[0] = this.mt[N - 1]!; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k > 0; k--) {
      const previous = this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30);
      this.mt[i] = ((this.mt[i]! ^ Math.imul(previous, 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) { this.mt[0] = this.mt[N - 1]!; i = 1; }
    }
    this.mt[0] = 0x80000000;
    this.index = N;
  }

  private nextUint32(): number {
    if (this.index >= N) {
      const mt = this.mt;
      for (let kk = 0; kk < N; kk++) {
        const y = (mt[kk]! & 0x80000000) | (mt[(kk + 1) % N]! & 0x7fffffff);
        mt[kk] = (mt[(kk + M) % N]! ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0)) >>> 0;
      }
      this.index = 0;
    }
    let y = this.mt[this.index++]!;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** random.random(): a float in [0, 1) from 53 random bits. */
  random(): number {
    const a = this.nextUint32() >>> 5;
    const b = this.nextUint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  private randBelow(n: number): number {
    const k = 32 - Math.clz32(n); // n.bit_length()
    let r = this.nextUint32() >>> (32 - k);
    while (r >= n) r = this.nextUint32() >>> (32 - k);
    return r;
  }

  /** random.choice(sequence). */
  choice<T>(sequence: readonly T[]): T {
    return sequence[this.randBelow(sequence.length)]!;
  }
}

// ── The economy being simulated ─────────────────────────────────────────────
type Channel = 'CAREER' | 'MIND' | 'CRAFT' | 'BODY' | 'SLEEP' | 'ATTENTION' | 'LEARN' | 'MAINT';

/** The six core quests (xp, channel) in the order the script walks them. */
const CORE: readonly (readonly [number, Channel])[] = [[100, 'CAREER'], [100, 'MIND'], [100, 'CRAFT'], [100, 'BODY'], [60, 'SLEEP'], [40, 'ATTENTION']];
const CHANNEL_CAP: Record<Channel, number> = { CAREER: 140, MIND: 200, CRAFT: 200, BODY: 150, SLEEP: 60, ATTENTION: 40, LEARN: 75, MAINT: 20 };
const DAILY_CAP = 700;

/** Python's round() is banker's rounding; the script rounds a float that is never exactly .5, but keep it exact. */
function pythonRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** XP to go from level n to n+1: round10(200 + c * n^0.98). */
export function requiredXp(n: number, coefficient: number): number {
  return pythonRound((200 + coefficient * n ** 0.98) / 10) * 10;
}

export function levelAt(xp: number, coefficient: number): number {
  let level = 1;
  let spent = 0;
  while (spent + requiredXp(level, coefficient) <= xp) {
    spent += requiredXp(level, coefficient);
    level++;
  }
  return level;
}

function dayXp(rng: PythonRandom, p: number): [capped: number, uncapped: number] {
  const cat: Record<Channel, number> = { CAREER: 0, MIND: 0, CRAFT: 0, BODY: 0, SLEEP: 0, ATTENTION: 0, LEARN: 0, MAINT: 0 };
  for (const [xp, channel] of CORE) if (rng.random() < p) cat[channel] += xp;
  if (cat.MIND) {
    const extras = rng.choice([0, 1, 1, 2, 2, 3]);
    for (let i = 0; i < extras; i++) cat.MIND += rng.choice([15, 25, 25, 40]);
    if (rng.random() < 0.35) cat.MIND += 20;
  }
  if (cat.CRAFT && rng.random() < 0.30) cat.CRAFT += 50;
  if (cat.CAREER) cat.CAREER += 10 * rng.choice([0, 0, 1, 2, 3, 4]);
  if (cat.BODY && rng.random() < 0.55) cat.BODY += 20;
  if (rng.random() < p * 0.8) cat.LEARN += 25 * rng.choice([0, 1, 1, 2]);
  if (rng.random() < p) cat.MAINT += 20;
  const capped = Math.min((Object.keys(cat) as Channel[]).reduce((sum, key) => sum + Math.min(cat[key], CHANNEL_CAP[key]), 0), DAILY_CAP);

  // Uncapped grants are frequency-limited, not volume-limited: exempt from every cap.
  let uncapped = 0;
  if (rng.random() < (1 - p) * 0.45) uncapped += 40; // recovery quest
  return [capped, uncapped];
}

/** The owner's boss windows in a 120-day arc; other lengths place theirs at the same fractions. */
export const LEGACY_BOSS_DAYS = [32, 68, 92, 118] as const;

export function bossDaysFor(days: number): number[] {
  if (days === 120) return [...LEGACY_BOSS_DAYS];
  return [...new Set(LEGACY_BOSS_DAYS.map((day) => Math.max(1, Math.min(days, Math.round((day * days) / 120)))))];
}

export interface SimulationOptions {
  days?: number;
  /** Probability of completing each core quest on a day (the script's "performance"). */
  p?: number;
  seed?: number;
  bossDays?: readonly number[];
}

/** One run: cumulative XP at the end of each day (index 0 is day 1). */
export function simulate({ days = 120, p = 0.85, seed = 1, bossDays }: SimulationOptions = {}): number[] {
  const rng = new PythonRandom(seed);
  const bosses = new Set(bossDays ?? bossDaysFor(days));
  let total = 0;
  const series: number[] = [];
  for (let day = 1; day <= days; day++) {
    const [capped, uncapped] = dayXp(rng, p);
    total += capped + uncapped;
    if (day % 7 === 0) for (let i = 0; i < 2; i++) if (rng.random() < p) total += 200; // weekly quest payouts
    if (bosses.has(day)) if (rng.random() < p + 0.10) total += 500; // boss windows
    series.push(total);
  }
  return series;
}

/** The mean cumulative XP at each day in `at`, over `runs` seeds 0..runs-1 (the script uses 60). */
export function meanTotals(options: SimulationOptions, at: readonly number[], runs = 60): number[] {
  const series = Array.from({ length: runs }, (_, seed) => simulate({ ...options, seed }));
  return at.map((day) => series.reduce((sum, run) => sum + run[day - 1]!, 0) / runs);
}

/** The level an arc of `days` days ends on at completion rate `p`, for a level coefficient. */
export function terminusLevel(days: number, p: number, coefficient: number, runs = 60): number {
  return levelAt(meanTotals({ days, p }, [days], runs)[0]!, coefficient);
}

/**
 * The smallest integer coefficient whose terminus level at completion rate `p` is at most
 * `target` - the gentlest curve that does not overshoot it. Level falls as the coefficient rises,
 * so this is the first coefficient at which the curve reaches the target level (final/01 §3's
 * revision note picks 84 for 120 days at 85% by exactly this rule).
 */
export function solveCoefficient(days: number, target: number, p = 0.85, runs = 60): number {
  const mean = meanTotals({ days, p }, [days], runs)[0]!;
  for (let coefficient = 30; coefficient <= 300; coefficient++) {
    if (levelAt(mean, coefficient) <= target) return coefficient;
  }
  return 300;
}
