import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/engine/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**'],
    },
  },
});
