// The interview's draft, kept on the device so an app kill does not cost the person their answers (platform/03 §23.2, 04 §36).
// Local only and never part of the event log: the answers can hold health, finance and relationship detail the Blueprint does not need.
// It is deleted at activation and by every wipe (store/onboarding.ts resetArc). Storage can be absent or throw (a private window,
// blocked site data), so nothing here may fail the interview: a draft that cannot be kept is simply not resumable.
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
  } catch {
    // Nothing to clear if storage cannot be reached.
  }
}
