// How a REALITY row prints (platform/03 §27.3): the `Now` column from the value and the
// row's display definition, the Day 0 column from the definition. Pure, so it is tested
// without a screen.
import type { RealityRowDef } from '../../blueprint/schema';

const percent = (x: number): string => `${Math.round(x * 100)}%`;

export function realityCells(row: RealityRowDef, values: Record<string, number>): { label: string; day0: string; now: string } {
  const display = row.display ?? {};
  const value = values[row.key] ?? 0;
  const format = display.format ?? 'int';
  const blank = (display.dashWhenZero && value <= 0) || (display.dashUnless !== undefined && (values[display.dashUnless] ?? 0) <= 0);
  const now = blank ? '—' : format === 'percent' ? percent(value) : format === 'fraction' ? `${value} / ${display.of ?? 0}` : String(value);
  const day0 = display.day0 ?? (format === 'fraction' ? `0 / ${display.of ?? 0}` : format === 'percent' ? '—' : '0');
  return { label: display.label ?? row.label, day0, now };
}
