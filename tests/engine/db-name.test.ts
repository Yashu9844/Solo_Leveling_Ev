// platform/05-ROADMAP.md loop 0.5 — platform/preview builds must be able
// to use their own IndexedDB, while production keeps 'system-arc'
// forever (renaming it would orphan the owner's live data).
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('db name', () => {
  it("defaults to the production 'system-arc'", async () => {
    vi.stubEnv('VITE_DB_NAME', '');
    vi.resetModules();
    const { DB_NAME, db } = await import('../../src/db/db');
    expect(DB_NAME).toBe('system-arc');
    expect(db.name).toBe('system-arc');
  });

  it('honours VITE_DB_NAME for platform/preview builds', async () => {
    vi.stubEnv('VITE_DB_NAME', 'system-arc-platform');
    vi.resetModules();
    const { DB_NAME, db } = await import('../../src/db/db');
    expect(DB_NAME).toBe('system-arc-platform');
    expect(db.name).toBe('system-arc-platform');
  });

  it('treats a whitespace-only override as unset', async () => {
    vi.stubEnv('VITE_DB_NAME', '   ');
    vi.resetModules();
    const { DB_NAME } = await import('../../src/db/db');
    expect(DB_NAME).toBe('system-arc');
  });
});
