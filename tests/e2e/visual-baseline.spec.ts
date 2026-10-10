// platform/05 loop 0.4 / equivalence level E3 (platform/02 §22.2): the pixels.
//
// A synthetic legacy database (the 40-day activity log of the owner's System,
// tests/engine/support/legacyActivityLog) is written straight into IndexedDB,
// the clock is pinned, motion is reduced and Math.random is seeded, and then
// every route - plus the main sheets - is captured at 360, 390 and 430 px wide.
// The committed images are the baseline the Presentation phase (7.x) must keep
// at ZERO diff for the legacy Blueprint (tolerance: anti-aliasing, 0.1%).
//
// Re-run `npx playwright test visual-baseline` to compare;
// `npx playwright test visual-baseline --update-snapshots` to re-record, which
// is a deliberate, reviewed act - never a way to make a failure go away.
//
// Baselines are recorded on Windows/Chromium (Playwright names them per
// platform); a different OS needs its own recording.
import { expect, test, type Page } from '@playwright/test';
import { buildDomainTables } from '../../src/db/domainProjections';
import { buildProjectionsV2 } from '../../src/blueprint/engine/projections';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { legacyActivityLog, LEGACY_ARC_ID } from '../engine/support/legacyActivityLog';

/** 14:00 IST on arc day 40 - mid-day, so the day is open and no boundary is near. */
const NOW = '2026-10-10T08:30:00Z';
const WIDTHS = [360, 390, 430] as const;

const ROUTES: [name: string, path: string][] = [
  ['today', '/today'],
  ['progress', '/progress'],
  ['skills', '/skills'],
  ['profile', '/profile'],
  ['attributes-body', '/attributes/body'],
  ['attributes-mind', '/attributes/mind'],
  ['attributes-craft', '/attributes/craft'],
  ['settings', '/profile/settings'],
  ['settings-appearance', '/profile/settings/appearance'],
  ['settings-system', '/profile/settings/system'],
  ['settings-data', '/profile/settings/data'],
  ['settings-about', '/profile/settings/about'],
];

/** Deterministic Math.random (mulberry32): the reflection picker and a few decorative effects read it. */
const SEED_RANDOM = () => {
  let a = 0x2f6e2b1;
  Math.random = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

async function seedLegacyDatabase(page: Page): Promise<void> {
  const events = legacyActivityLog({ seed: 42, days: 40 });
  const tables = buildDomainTables(events, DEFAULT_CONFIG);
  // The five cache tables are what the app reads on boot; derive them exactly as a rebuild would.
  const cache = buildProjectionsV2(events, { now: () => NOW, newId: () => 'visual-baseline' }); // byte-identical to the legacy builder (E1)
  const rows: Record<string, unknown[]> = {
    event: events,
    arc: [{
      id: LEGACY_ARC_ID, start_date: DEFAULT_CONFIG.arc.startDate, end_date: DEFAULT_CONFIG.arc.endDate, timezone: DEFAULT_CONFIG.arc.timezone,
      day_boundary_hour: DEFAULT_CONFIG.arc.dayBoundaryHour, day_close_hour: DEFAULT_CONFIG.arc.dayCloseHour, main_quest_text: 'Ship a working agent and land an offer.', status: 'active',
    }],
    profile: [{ id: 'profile', name: 'Ada', created_at: '2026-09-01T00:00:00Z', arc_timezone: DEFAULT_CONFIG.arc.timezone, settings: {} }],
    quest_template: cache.templates, quest_instance: cache.instances, xp_ledger: cache.ledger, day_rollup: cache.dayRollups, player_state: cache.playerState ? [cache.playerState] : [],
    application: tables.applications, career_event: tables.careerEvents, resume_version: tables.resumeVersions, dsa_problem: tables.dsaProblems,
    dsa_attempt: tables.dsaAttempts, learning_block: tables.learningBlocks, system_design_study: tables.systemDesigns, build_session: tables.buildSessions,
    artifact: tables.artifacts, training_session: tables.trainingSessions, metric_sample: tables.metricSamples, maintenance_log: tables.maintenanceLogs,
  };

  // The app creates the schema on first load; seed the stores it made, then boot again so it reads them.
  await page.goto('/start');
  await page.evaluate((payload) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('system-arc');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const names = Object.keys(payload);
      const tx = database.transaction(names, 'readwrite');
      for (const name of names) for (const row of payload[name]!) tx.objectStore(name).put(row);
      tx.oncomplete = () => { database.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), rows);
}

async function settle(page: Page): Promise<void> {
  // A cold load shows the splash first; a baseline of the splash would be a baseline of nothing.
  await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  // Art plates arrive over their placeholders; wait until none is still decoding.
  await page.evaluate(() => Promise.all(Array.from(document.images).map((image) => (image.complete ? undefined : new Promise((done) => { image.onload = image.onerror = () => done(undefined); })))));
  // Rows, plates and counters ease in for a second or two after the data lands.
  await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string): Promise<void> {
  await settle(page);
  // The only live-ticking thing on any screen: TODAY's "TIME REMAINING" countdown (hh:mm:ss). Everything else is deterministic.
  const countdown = page.getByText('TIME REMAINING').locator('xpath=ancestor::div[1]');
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001, timeout: 20_000, mask: [countdown] });
}

test.describe('E3 visual baseline - the owner\'s System as it renders today', () => {
  test.use({ reducedMotion: 'reduce', deviceScaleFactor: 1 });

  for (const width of WIDTHS) {
    test(`every route at ${width}px`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height: 800 });
      await page.clock.install({ time: new Date(NOW) });
      await page.addInitScript(SEED_RANDOM);
      await seedLegacyDatabase(page);

      for (const [name, path] of ROUTES) {
        await test.step(name, async () => {
          await page.goto(path);
          await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
          await shot(page, `${name}-${width}`);
        });
      }

      await test.step('progress, REALITY tab', async () => {
        await page.goto('/progress');
        await page.getByRole('button', { name: 'REALITY' }).click();
        await expect(page.getByTestId('reality-tab')).toBeVisible();
        await shot(page, `progress-reality-${width}`);
      });
    });
  }

  test('sheets and the checkpoint screen at 390px', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.clock.install({ time: new Date(NOW) });
    await page.addInitScript(SEED_RANDOM);
    await seedLegacyDatabase(page);

    await page.goto('/today');
    await expect(page.getByTestId('quest-toggle-career')).toBeVisible({ timeout: 30_000 });

    await test.step('the DSA quest sheet', async () => {
      await page.getByTestId('quest-row-dsa-open').click();
      await shot(page, 'sheet-dsa');
      await page.keyboard.press('Escape');
    });

    await test.step('the checkpoint screen', async () => {
      await page.goto('/profile');
      await page.getByRole('button', { name: /Next checkpoint: Day/ }).click();
      await expect(page.getByTestId('checkpoint-screen')).toBeVisible({ timeout: 30_000 });
      await shot(page, 'checkpoint-screen');
    });
  });
});
