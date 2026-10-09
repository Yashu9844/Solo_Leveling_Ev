import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Worker threads, not child processes: on Windows the default fork pool dies with
    // tinypool `kill EPERM` while terminating workers once the suite has several long
    // equivalence files (platform/05 loops 3.6, 4.7). The tests themselves are unaffected.
    pool: 'threads',
    include: ['tests/engine/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**'],
    },
  },
});
