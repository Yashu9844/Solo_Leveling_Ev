// The staged amendment (platform/02 §19.1: DRAFT is local only, not in the log). The person's edits against the version in force are kept
// as a list of operations, not as a document, so they replay on exactly the version they were staged against and are dropped, not misapplied,
// when a newer version has since been activated.
import type { AmendOp } from '../blueprint/amend';

const KEY = 'blueprint_draft';

interface StoredDraft { arcId: string; baseVersion: number; ops: AmendOp[] }

function read(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

/** The ops staged for this arc against this version; none when the draft belongs to another arc or an older version. */
export function loadDraft(arcId: string, baseVersion: number): AmendOp[] {
  const stored = read();
  return stored && stored.arcId === arcId && stored.baseVersion === baseVersion && Array.isArray(stored.ops) ? stored.ops : [];
}

export function saveDraft(arcId: string, baseVersion: number, ops: readonly AmendOp[]): void {
  try {
    if (ops.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ arcId, baseVersion, ops: [...ops] } satisfies StoredDraft));
  } catch {
    // Private mode or a full quota: the draft lives for the visit and is simply not kept.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
