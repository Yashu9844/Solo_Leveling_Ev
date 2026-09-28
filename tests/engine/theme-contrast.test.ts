import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * design/03-SETTINGS-AND-THEMING.md §5: every theme's body text must
 * clear 4.5:1 against its own ground, measured and recorded in
 * tokens.css.
 *
 * Those ratios were recorded as comments, which means nothing checks
 * them. A token nudged half a shade later leaves the comment claiming a
 * number that is no longer true, and nobody finds out. This computes
 * the real ratio from the hex values and asserts two things: the floor
 * holds, and the comment still tells the truth.
 */

const TOKENS = readFileSync(
  fileURLToPath(new URL('../../src/ui/tokens.css', import.meta.url)),
  'utf-8'
);

/** The five themes, each keyed off its own attribute selector. */
const THEMES = ['arc', 'dawn', 'abyss', 'contrast', 'daylight'] as const;

/** Tokens that carry body text and therefore owe 4.5:1. `--faint` is
 * the floor of the ramp and the one that gets used for the smallest
 * copy, so it is included rather than excused. */
const INK_TOKENS = ['--ink-100', '--ink-300', '--ink-500', '--ink-700', '--ink-900', '--faint'];

function blockFor(theme: string): string {
  const start = TOKENS.indexOf(`[data-theme='${theme}'] {`);
  expect(start, `no [data-theme='${theme}'] block in tokens.css`).toBeGreaterThan(-1);
  const end = TOKENS.indexOf('\n}', start);
  return TOKENS.slice(start, end);
}

function hexOf(block: string, token: string): string {
  const m = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  expect(m, `${token} is not a plain hex in this theme`).not.toBeNull();
  return m![1]!;
}

/** The ratio the comment on that line claims — the "18.0" in a trailing
 * block comment reading 18.0:1. */
function claimedRatio(block: string, token: string): number | null {
  const m = new RegExp(`${token}:[^\\n]*?/\\*\\s*([0-9.]+):1`).exec(block);
  return m ? Number(m[1]) : null;
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = srgbToLinear((n >> 16) & 0xff);
  const g = srgbToLinear((n >> 8) & 0xff);
  const b = srgbToLinear(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 relative contrast. */
function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme contrast — design/03 §5', () => {
  it('knows the reference ratios are right', () => {
    // Sanity on the maths itself before trusting it about the themes.
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });

  for (const theme of THEMES) {
    describe(theme, () => {
      const block = blockFor(theme);
      const ground = hexOf(block, '--void');

      for (const token of INK_TOKENS) {
        it(`${token} clears 4.5:1 against --void`, () => {
          const ratio = contrast(hexOf(block, token), ground);
          expect(
            ratio,
            `${theme} ${token} is ${ratio.toFixed(2)}:1 against ${ground}`
          ).toBeGreaterThanOrEqual(4.5);
        });

        it(`${token}'s recorded ratio is honest`, () => {
          const claimed = claimedRatio(block, token);
          if (claimed === null) return; // not every line carries one
          const actual = contrast(hexOf(block, token), ground);
          expect(
            Math.abs(actual - claimed),
            `${theme} ${token} claims ${claimed}:1 but measures ${actual.toFixed(2)}:1`
          ).toBeLessThan(0.15);
        });
      }

      it('keeps the three state colours distinguishable from each other', () => {
        // Not a WCAG rule — a design one. Every state also carries a
        // shape (final/06 §7), so this only has to catch two states
        // collapsing into the same colour, not guarantee colour alone
        // is sufficient.
        const complete = hexOf(block, '--state-complete');
        const recover = hexOf(block, '--state-recover');
        const alert = hexOf(block, '--state-alert');
        const pairs: [string, string, string][] = [
          ['complete/recover', complete, recover],
          ['complete/alert', complete, alert],
          ['recover/alert', recover, alert],
        ];
        for (const [name, a, b] of pairs) {
          const apart = Math.abs(relativeLuminance(a) - relativeLuminance(b));
          const hueApart = a !== b;
          expect(hueApart, `${theme} ${name} are the same colour`).toBe(true);
          expect(apart >= 0 && Number.isFinite(apart)).toBe(true);
        }
      });
    });
  }
});
