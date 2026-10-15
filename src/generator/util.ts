// Small pure helpers the stages share.

/** "Deep build" -> "deep-build". */
export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

/** A short stable hash (FNV-1a, four base-36 characters): deterministic ids that do not collide across lineages. */
export function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(36).padStart(4, '0').slice(-4);
}

/** "HH:MM" -> minutes since midnight, or undefined when it is not a time. */
export function minutesOf(time: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

export function timeOf(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/**
 * Splits `total` over items in proportion to their weights, each kept within [min, max], in whole
 * multiples of `unit`, summing to `total` whenever that is feasible (largest remainder for the rounding).
 */
export function allocate(total: number, items: readonly { weight: number; min: number; max: number }[], unit: number): number[] {
  const count = items.length;
  const value = new Array<number>(count).fill(0);
  const fixed = new Array<boolean>(count).fill(false);
  let remaining = total;
  // Water-filling: items that would fall outside their bounds are pinned there and the rest re-share what is left.
  for (let round = 0; round < count + 1; round++) {
    const free = items.map((_, index) => index).filter((index) => !fixed[index]);
    if (free.length === 0) break;
    const weightSum = free.reduce((sum, index) => sum + items[index]!.weight, 0);
    let pinned = false;
    for (const index of free) {
      const share = weightSum > 0 ? (remaining * items[index]!.weight) / weightSum : remaining / free.length;
      const item = items[index]!;
      if (share < item.min || share > item.max) {
        value[index] = share < item.min ? item.min : item.max;
        fixed[index] = true;
        remaining -= value[index]!;
        pinned = true;
        break;
      }
    }
    if (!pinned) {
      for (const index of free) value[index] = weightSum > 0 ? (remaining * items[index]!.weight) / weightSum : remaining / free.length;
      break;
    }
  }
  // Discretize: floor to the unit within bounds, then hand out the remaining units by largest remainder.
  const floored = value.map((v, index) => Math.min(items[index]!.max, Math.max(items[index]!.min, Math.floor(v / unit + 1e-9) * unit)));
  let leftover = Math.round((total - floored.reduce((sum, v) => sum + v, 0)) / unit);
  const order = value.map((v, index) => ({ index, remainder: v - floored[index]! })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  while (leftover > 0) {
    const next = order.find(({ index }) => floored[index]! + unit <= items[index]!.max);
    if (!next) break;
    floored[next.index]! += unit;
    leftover--;
    order.push(order.splice(order.indexOf(next), 1)[0]!); // rotate so remainders are shared, not stacked
  }
  while (leftover < 0) {
    const next = [...order].reverse().find(({ index }) => floored[index]! - unit >= items[index]!.min);
    if (!next) break;
    floored[next.index]! -= unit;
    leftover++;
  }
  return floored;
}
