// The public build is for everyone: the Blueprint engine and the adaptive onboarding are on unless a build says 'false'.
import { afterEach, describe, expect, it, vi } from 'vitest';

async function flagsWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value as string);
  return import('../../src/flags');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('build flags', () => {
  it('are on when the build sets nothing', async () => {
    const flags = await flagsWith({ VITE_ENGINE_V2: '', VITE_NEW_ONBOARDING: '' });
    expect(flags.engineV2Enabled()).toBe(true);
    expect(flags.newOnboardingEnabled()).toBe(true);
  });

  it('turn off only with an explicit false, and the onboarding follows the engine', async () => {
    let flags = await flagsWith({ VITE_ENGINE_V2: 'false', VITE_NEW_ONBOARDING: '' });
    expect(flags.engineV2Enabled()).toBe(false);
    expect(flags.newOnboardingEnabled()).toBe(false);
    flags = await flagsWith({ VITE_ENGINE_V2: '', VITE_NEW_ONBOARDING: 'false' });
    expect(flags.engineV2Enabled()).toBe(true);
    expect(flags.newOnboardingEnabled()).toBe(false);
  });
});
