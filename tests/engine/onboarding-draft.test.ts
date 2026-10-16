// Loop 10.5: the interview's draft survives an app kill, and is gone once it has done its work.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../../src/db/db';
import { DRAFT_KEY, clearDraft, loadDraft, saveDraft } from '../../src/onboarding/draftStorage';
import type { InterviewDraft } from '../../src/onboarding/types';
import { SKIP } from '../../src/onboarding/types';
import { resetArc } from '../../src/store/onboarding';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

const draft: InterviewDraft = { tier: 'quick', answers: { 'identity.displayName': 'Ada', areas: ['career', 'body'], 'area.body.triggerTime': SKIP } };

describe('the onboarding draft', () => {
  it('round-trips exactly, including answers that are inert and skipped', () => {
    const store = memory();
    expect(saveDraft(draft, store)).toBe(true);
    expect(loadDraft(store)).toEqual(draft);
  });

  it('reads as nothing when there is nothing, or when what is there cannot be trusted', () => {
    expect(loadDraft(memory())).toBeNull();
    for (const bad of ['', 'not json', 'null', '[]', '{}', '{"v":2,"tier":"quick","answers":{}}', '{"v":1,"tier":"deluxe","answers":{}}', '{"v":1,"tier":"quick","answers":[]}', '{"v":1,"tier":"quick"}']) {
      expect(loadDraft(memory({ [DRAFT_KEY]: bad })), bad).toBeNull();
    }
  });

  it('never throws when storage is missing or refuses', () => {
    const refusing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(saveDraft(draft, null)).toBe(false);
    expect(saveDraft(draft, refusing)).toBe(false);
    expect(loadDraft(null)).toBeNull();
    expect(loadDraft(refusing)).toBeNull();
    expect(() => clearDraft(refusing)).not.toThrow();
    expect(() => clearDraft(null)).not.toThrow();
  });

  it('clearing removes it', () => {
    const store = memory();
    saveDraft(draft, store);
    clearDraft(store);
    expect(store.data.has(DRAFT_KEY)).toBe(false);
    expect(loadDraft(store)).toBeNull();
  });

  it('a wipe (resetArc) takes the draft with it', async () => {
    const store = memory();
    // resetArc reads the browser's localStorage; give this node run one.
    (globalThis as { localStorage?: unknown }).localStorage = store;
    try {
      saveDraft(draft);
      expect(store.data.has(DRAFT_KEY)).toBe(true);
      await resetArc();
      expect(store.data.has(DRAFT_KEY)).toBe(false);
      expect(await db.event.count()).toBe(0);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
