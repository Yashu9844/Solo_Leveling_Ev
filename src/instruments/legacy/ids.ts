import type { InstrumentType } from '../../blueprint/schema';

/**
 * The instruments LEGACY_BLUEPRINT_V1 declares for the owner's System
 * (platform/02 §8.1), with the domain each belongs to. These ids are part of
 * the owner's history: records, criteria and signals all refer to them.
 */
export const LEGACY_INSTRUMENTS = {
  'career.applications': { type: 'pipeline', domainId: 'career' },
  'career.substitute': { type: 'duration', domainId: 'career' },
  'dsa.problems': { type: 'practice_item', domainId: 'dsa' },
  'build.sessions': { type: 'duration', domainId: 'build' },
  'build.artifacts': { type: 'artifact', domainId: 'build' },
  'training.sessions': { type: 'session', domainId: 'training' },
  'training.steps': { type: 'threshold', domainId: 'training' },
  'sleep.wake': { type: 'time_window', domainId: 'sleep' },
  'attention.screen': { type: 'threshold', domainId: 'attention' },
  'foundations.blocks': { type: 'study_block', domainId: 'foundations' },
  'foundations.design': { type: 'study_block', domainId: 'foundations' },
  'maintenance.daily': { type: 'checklist', domainId: 'maintenance' },
} as const satisfies Record<string, { type: InstrumentType; domainId: string }>;

export type LegacyInstrumentId = keyof typeof LEGACY_INSTRUMENTS;
export const LEGACY_INSTRUMENT_IDS = Object.keys(LEGACY_INSTRUMENTS) as LegacyInstrumentId[];

/** The checklist items of `maintenance.daily`; laundry is due every N days (config.maintenanceLaundryEveryDays). */
export const MAINTENANCE_ITEMS = ['bath', 'fuel', 'laundry'] as const;

export function minutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function hhmmFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
