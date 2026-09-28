import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

/**
 * design/02-NAVIGATION-FLOW.md §1 — the boot path.
 *
 *   cold start -> Splash -> Start (no arc) or Today (arc exists)
 */
test.describe('boot path', () => {
  test('a cold start shows the splash, then lands on Start', async ({ page }) => {
    await withSafeClock(page);

    // `commit` returns as soon as navigation begins, so the assertion is
    // not racing the splash's own minimum hold.
    await page.goto('/', { waitUntil: 'commit' });

    await expect(page.getByTestId('splash')).toBeVisible();
    await expect(page).toHaveURL(/\/start$/);
    await expect(page.getByTestId('splash')).toHaveCount(0);
  });

  test('Start offers the wordmark and one action', async ({ page }) => {
    await withSafeClock(page);
    await page.goto('/start');

    await expect(page.getByRole('heading', { name: 'SYSTEM' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Begin your journey' })).toBeVisible();
  });

  test('Begin your journey leads into onboarding', async ({ page }) => {
    await withSafeClock(page);
    await page.goto('/start');

    await page.getByRole('button', { name: 'Begin your journey' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByPlaceholder('Your name')).toBeVisible();
  });

  test('once an arc exists, /start redirects to Today', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    await page.goto('/start');
    await expect(page).toHaveURL(/\/today$/);
  });

  /**
   * The point of the whole screen: Start is a first-run surface. Someone
   * opening the app on day 40 to log a quest must never meet it again.
   */
  test('a returning user boots straight to Today and never sees Start', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.getByTestId('splash')).toBeVisible();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('button', { name: 'Begin your journey' })).toHaveCount(0);
  });

  test('the splash also precedes a reload of a deep route', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    await page.goto('/progress', { waitUntil: 'commit' });
    await expect(page.getByTestId('splash')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'PROGRESS' })).toBeVisible();
  });
});
