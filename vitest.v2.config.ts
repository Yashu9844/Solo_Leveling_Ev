// The same unit suite with the Blueprint engine switched on (platform/05 loop 6.1).
// Every L0 test must pass here exactly as it does with the flag off: that is
// the proof that the cutover is a swap and not a change.
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

export default mergeConfig(base, defineConfig({
  test: { env: { VITE_ENGINE_V2: 'true' } },
}));
