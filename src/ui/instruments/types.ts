import type { DomainDefinition, InstrumentConfig } from '../../blueprint/schema';

/**
 * What every instrument sheet receives (platform/03 §27.2). The sheet is chosen by
 * the instrument's TYPE; everything it shows comes from the instrument's params and
 * labels, and what it writes goes through the recorder for that instrument
 * (ui/instruments/recorders: a legacy-bound instrument keeps writing its own
 * legacy event, a generic one appends INSTRUMENT_RECORDED).
 */
export interface InstrumentSheetProps {
  instrument: InstrumentConfig;
  /** The domain the instrument belongs to (its presentation, e.g. an art plate, shapes the sheet). */
  domain: DomainDefinition;
  /** The other instruments of the same domain, e.g. the duration beside a pipeline (substitute work). */
  siblings: readonly InstrumentConfig[];
  today: string;
  arcId: string;
  onClose: () => void;
}

export const isLegacyBound = (instrument: InstrumentConfig): boolean => instrument.eventBinding.kind === 'legacy';

/** "first_attempt" -> "First attempt": the label a generic System gets when nothing names an option better. */
export function humanize(id: string): string {
  const spaced = id.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
