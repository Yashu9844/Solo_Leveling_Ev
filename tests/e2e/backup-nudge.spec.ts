import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, openDataSettings } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('Settings > Data shows a neutral (not red) "never backed up" status on a fresh arc, and it updates after exporting', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await openDataSettings(page);
  const status = page.getByTestId('backup-status');
  await expect(status).toBeVisible();
  await expect(status).toContainText('Never backed up');
  // Day 1 of a fresh arc must not read as an alert — the 14-day red
  // threshold hasn't been crossed yet.
  await expect(status).not.toHaveClass(/state-alert/);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  await downloadPromise;

  await expect(status).toContainText('Last backup: today');
});

test('the weekly review shows a backup prompt and exporting from it works', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'Weekly review' }).click();

  const backupSection = page.getByTestId('weekly-review-backup');
  await expect(backupSection).toBeVisible();
  await expect(backupSection).toContainText('never backed up');

  const downloadPromise = page.waitForEvent('download');
  await backupSection.getByRole('button', { name: 'Export backup' }).click();
  await downloadPromise;
  await expect(backupSection.getByRole('button', { name: /Exported/ })).toBeVisible();
});
