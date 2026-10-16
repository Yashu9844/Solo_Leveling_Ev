// The interview's draft, kept on the device so an app kill does not cost the person their answers (platform/03 §23.2, 04 §36).
// Local only and never part of the event log: the answers can hold health, finance and relationship detail the Blueprint does not need.
// It is deleted at activation and by every wipe (store/onboarding.ts resetArc). Storage can be absent or throw (a private window,
// blocked site data), so nothing here may fail the interview: a draft that cannot be kept is simply not resumable.
import { hasPins, type Pins } from './pins';
import type { InterviewDraft, Tier } from './types';

export const DRAFT_KEY = 'onboarding_draft';
const DRAFT_VERSION = 1;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const isTier = (value: unknown): value is Tier => value === 'quick' || value === 'guided';

/** The saved draft, or null if there is none or what is there cannot be trusted. */
export function loadDraft(storage: Store | null = browserStorage()): InterviewDraft | null {
  try {
    const raw = storage?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { v, tier, answers } = parsed as { v?: unknown; tier?: unknown; answers?: unknown };
    if (v !== DRAFT_VERSION || !isTier(tier) || typeof answers !== 'object' || answers === null || Array.isArray(answers)) return null;
    return { tier, answers: answers as Record<string, unknown> };
  } catch {
    return null;
  }
}

/** Keeps the draft. Returns whether it could be kept. */
export function saveDraft(draft: InterviewDraft, storage: Store | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(DRAFT_KEY, JSON.stringify({ v: DRAFT_VERSION, tier: draft.tier, answers: draft.answers }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: Store | null = browserStorage()): void {
  try {
    storage?.removeItem(DRAFT_KEY);
    storage?.removeItem(PINS_KEY);
  } catch {
    // Nothing to clear if storage cannot be reached.
  }
}

// The pins laid over the System on the Reveal are decisions of the same kind as answers, and are kept and deleted with them.
export const PINS_KEY = 'onboarding_pins';

const isFieldMap = (value: unknown): value is Record<string, number | string> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((item) => typeof item === 'number' || typeof item === 'string');

export function loadPins(storage: Store | null = browserStorage()): Pins | null {
  try {
    const raw = storage?.getItem(PINS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { arcLength, domains } = parsed as { arcLength?: unknown; domains?: unknown };
    if (typeof domains !== 'object' || domains === null || Array.isArray(domains) || !Object.values(domains).every(isFieldMap)) return null;
    if (arcLength !== undefined && (typeof arcLength !== 'number' || !Number.isFinite(arcLength))) return null;
    return { ...(arcLength !== undefined ? { arcLength } : {}), domains: domains as Pins['domains'] };
  } catch {
    return null;
  }
}

/** Keeps the pins, or forgets them when there are none. */
export function savePins(pins: Pins, storage: Store | null = browserStorage()): void {
  try {
    if (!storage) return;
    if (!hasPins(pins)) storage.removeItem(PINS_KEY);
    else storage.setItem(PINS_KEY, JSON.stringify(pins));
  } catch {
    // Pins that cannot be kept are simply not resumable.
  }
}
