// Owner opt-in offers (platform/02 §22.4). The owner's System reproduces what the app DID, including the places it fell short of what the spec
// said (§22.1). Once it is Blueprint-driven, each of those becomes an offer at a checkpoint's Amend step: the owner accepts or declines each,
// accepting writes an ordinary structural version, and declining changes nothing. Pure.
import type { SystemBlueprint } from './schema';

export interface OwnerOfferInput {
  /** The wake time the owner gave at onboarding (profile.settings.wakeTime), if any. */
  wakeTime?: string;
}

export interface OwnerOffer {
  id: 'wake-target' | 'reduced-mode-collapse';
  title: string;
  /** What the System does today, and what it would do if accepted. */
  description: string;
  /** The candidate version, or undefined when the offer does not apply (already accepted, or nothing to honour). */
  build(base: SystemBlueprint, input: OwnerOfferInput): SystemBlueprint | undefined;
}

const clock = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const hhmm = (minutes: number): string => { const wrapped = ((minutes % 1440) + 1440) % 1440; return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`; };

export const OWNER_OFFERS: readonly OwnerOffer[] = [
  {
    id: 'wake-target',
    title: 'Honour the wake time you gave at the start',
    description: 'The Sync quest has always asked for a wake within 30 minutes of 08:30, whatever you answered when you began. Accept to make it the time you gave.',
    build(base, input) {
      const wake = base.instruments.find((instrument) => instrument.type === 'time_window' && instrument.id === 'sleep.wake');
      if (!wake || !input.wakeTime || !/^\d{2}:\d{2}$/.test(input.wakeTime) || wake.params.targetTime === input.wakeTime) return undefined;
      const tolerance = Number(wake.params.toleranceMinutes ?? 30);
      const from = hhmm(clock(input.wakeTime) - tolerance);
      const to = hhmm(clock(input.wakeTime) + tolerance);
      const next = structuredClone(base);
      next.version = base.version + 1;
      next.instruments.find((instrument) => instrument.id === 'sleep.wake')!.params = { ...wake.params, targetTime: input.wakeTime };
      const quest = next.quests.find((candidate) => candidate.id === 'sleep');
      if (quest) {
        quest.objective = `Synchronization active: wake within ${tolerance} minutes of ${input.wakeTime} (${from}–${to}).`;
        quest.realityLabel = `sync window ${from}–${to}`;
      }
      return next;
    },
  },
  {
    id: 'reduced-mode-collapse',
    title: 'Let Reduced Mode lower the day',
    description: 'Reduced Mode has always been shown without changing the day. Accept to have it collapse the day to its hard-day floors while it is on, as the System was designed to.',
    build(base) {
      if (base.progression.reducedMode.collapsesQuests) return undefined;
      const next = structuredClone(base);
      next.version = base.version + 1;
      next.progression.reducedMode.collapsesQuests = true;
      return next;
    },
  },
];

/** The offers that apply to this version, with their candidate documents. */
export function applicableOffers(base: SystemBlueprint, input: OwnerOfferInput): { offer: OwnerOffer; candidate: SystemBlueprint }[] {
  if (base.origin !== 'legacy') return [];
  return OWNER_OFFERS.flatMap((offer) => { const candidate = offer.build(base, input); return candidate ? [{ offer, candidate }] : []; });
}
