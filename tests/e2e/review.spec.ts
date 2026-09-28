import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('evening review: complete it, see the daily report, entry disappears and stays gone on reload', async ({
  page,
}) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('button', { name: 'Complete CAREER' }).click();
  await expect(page.getByRole('button', { name: 'Undo CAREER' })).toBeVisible();

  const entry = page.getByRole('button', { name: 'Evening review · 25 seconds' });
  await expect(entry).toBeVisible();
  await entry.click();

  // Energy/Focus default to a value already; only the blocker is required.
  await page.getByRole('button', { name: 'Focus 5 of 5' }).click();
  await page.getByRole('button', { name: 'Tired' }).click();
  await page.getByRole('button', { name: 'DSA', exact: true }).click(); // tomorrow's priority

  await page.getByRole('button', { name: 'Complete day' }).click();

  await expect(page.getByText(/DAILY REPORT/)).toBeVisible();
  await expect(page.getByText('Core quests')).toBeVisible();
  await expect(page.getByText('1 / 6')).toBeVisible();

  await page.getByText('tap anywhere').click();
  await expect(page.getByText(/DAILY REPORT/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Evening review · 25 seconds' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Evening review · 25 seconds' })).toHaveCount(0);
});

test('the "Complete day" button stays disabled until a blocker is chosen', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('button', { name: 'Evening review · 25 seconds' }).click();
  await expect(page.getByRole('button', { name: 'Complete day' })).toBeDisabled();

  await page.getByRole('button', { name: 'Nothing' }).click();
  await expect(page.getByRole('button', { name: 'Complete day' })).toBeEnabled();
});
