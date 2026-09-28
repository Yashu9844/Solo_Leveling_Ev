import { describe, it, expect } from 'vitest';
import { withinWakeWindow } from '../../src/engine/sleep';

describe('withinWakeWindow', () => {
  it('accepts the exact target and both edges of the tolerance', () => {
    expect(withinWakeWindow('08:30', '08:30', 30)).toBe(true);
    expect(withinWakeWindow('08:00', '08:30', 30)).toBe(true);
    expect(withinWakeWindow('09:00', '08:30', 30)).toBe(true);
  });

  it('rejects just outside the tolerance on either side', () => {
    expect(withinWakeWindow('07:59', '08:30', 30)).toBe(false);
    expect(withinWakeWindow('09:01', '08:30', 30)).toBe(false);
  });
});
