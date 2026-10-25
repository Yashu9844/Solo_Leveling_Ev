import { defineConfig } from 'vitest/config';

// The performance budgets (platform/04 §33.3, loop 15.1). They live apart from the unit suite and run one file at a time: a time measured while
// a hundred test files share the machine says nothing about the code, so these are never part of `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 120_000,
    env: { VITE_ENGINE_V2: 'false', VITE_NEW_ONBOARDING: 'false' },
    include: ['tests/perf/**/*.test.ts'],
  },
});
