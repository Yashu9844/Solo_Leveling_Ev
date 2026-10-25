import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Worker threads, not child processes: on Windows the default fork pool dies with
    // tinypool `kill EPERM` while terminating workers once the suite has several long
    // equivalence files (platform/05 loops 3.6, 4.7). The tests themselves are unaffected.
    pool: 'threads',
    // The unit suite now runs ~80 files, several of them 10k-case equivalence checks, in parallel threads.
    // Individual tests that take 3-4s alone can pass 5s under that load; nothing here waits on a clock.
    testTimeout: 30_000,
    // The default build is now the Blueprint engine with the adaptive onboarding (src/flags.ts). This suite is the original
    // engine's, so it pins both off; vitest.v2.config.ts turns ENGINE_V2 back on for the same tests.
    env: { VITE_ENGINE_V2: 'false', VITE_NEW_ONBOARDING: 'false' },
    include: ['tests/engine/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**'],
    },
  },
});
