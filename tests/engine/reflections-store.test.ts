import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import { recordReflectionShown, pickReflection } from '../../src/store/reflections';

describe('recordReflectionShown', () => {
  beforeEach(async () => {
    await db.reflection_state.clear();
  });

  it('creates a row on first show', async () => {
    await recordReflectionShown('discipline-1', '2026-09-05');
    const row = await db.reflection_state.get('discipline-1');
    expect(row).toEqual({ id: 'discipline-1', times_shown: 1, last_shown_at: '2026-09-05' });
  });

  it('is idempotent within the same day — repeated calls do not inflate times_shown', async () => {
    await recordReflectionShown('discipline-1', '2026-09-05');
    await recordReflectionShown('discipline-1', '2026-09-05');
    await recordReflectionShown('discipline-1', '2026-09-05');
    const row = await db.reflection_state.get('discipline-1');
    expect(row?.times_shown).toBe(1);
  });

  it('increments again on a genuinely new day', async () => {
    await recordReflectionShown('discipline-1', '2026-09-05');
    await recordReflectionShown('discipline-1', '2026-09-26'); // past the 21-day cooldown, a real re-show
    const row = await db.reflection_state.get('discipline-1');
    expect(row?.times_shown).toBe(2);
    expect(row?.last_shown_at).toBe('2026-09-26');
  });
});

describe('pickReflection — live wiring over db.reflection_state', () => {
  beforeEach(async () => {
    await db.reflection_state.clear();
  });

  it('returns a MORNING-eligible reflection on a fresh database', async () => {
    const result = await pickReflection('MORNING', 1, false, '2026-09-05');
    expect(result).not.toBeNull();
    expect(result?.context).toContain('MORNING');
  });

  it('excludes a reflection that was shown too recently', async () => {
    const first = await pickReflection('MORNING', 1, false, '2026-09-05');
    await recordReflectionShown(first!.id, '2026-09-05');
    // Ask again the very next day -- the just-shown one must not repeat.
    const second = await pickReflection('MORNING', 2, false, '2026-09-06');
    expect(second?.id).not.toBe(first!.id);
  });
});
