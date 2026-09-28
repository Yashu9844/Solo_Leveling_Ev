import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  /**
   * Capped rather than left at Playwright's default of half the cores.
   *
   * xp.spec's "tap -> XP feedback rendered in under 300ms" is a product
   * requirement (final/06 §4.3), and a performance assertion is only
   * meaningful on a machine that is not saturated. At the default 8
   * workers on a 16-core box this suite drove that measurement to
   * 310-332ms while the same interaction measured 106-127ms on an idle
   * machine — the failures were reporting CPU contention between
   * browsers, not the app. The threshold stays at 300ms; only the noise
   * around it is reduced.
   */
  workers: 4,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    /**
     * The everyday project. Runs the whole suite, including
     * responsive.spec at its own 412x915.
     */
    {
      name: 'chromium-pixel-7',
      use: { ...devices['Pixel 7'] },
    },

    /**
     * Five more viewports, running responsive.spec and nothing else.
     *
     * The rest of the suite is about behaviour, and behaviour does not
     * change with width — running all 85 tests six times over would cost
     * ten minutes a gate to re-prove the same facts. These carry the
     * cases the design has to survive: the narrowest phone still sold,
     * a common small Android, a large modern phone, a tablet, and a
     * laptop where the shell has to stop growing.
     */
    ...(
      [
        ['vp-320x568', 320, 568],
        ['vp-360x640', 360, 640],
        ['vp-430x932', 430, 932],
        ['vp-768x1024', 768, 1024],
        ['vp-1280x800', 1280, 800],
      ] as const
    ).map(([name, width, height]) => ({
      name,
      testMatch: /responsive\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width, height },
        // Every one of these stands in for a touch device except the
        // last two, and the 44px target rule applies regardless of what
        // is doing the pointing.
        hasTouch: true,
        isMobile: false,
      },
    })),
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
