import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('Profile shows RANK E and the next checkpoint on a fresh arc', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await expect(page.getByText(/RANK E/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Next checkpoint: Day 14/ })).toBeVisible();
});

test('sealing the Day 14 checkpoint is blocked until export, then updates RANK on Profile', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await page.getByRole('button', { name: /Next checkpoint: Day 14/ }).click();

  const sheet = page.getByTestId('checkpoint-screen');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('checkpoint-verdict')).toContainText('Rank E -> D requires');

  // Seal is disabled before export.
  await expect(sheet.getByRole('button', { name: 'Seal checkpoint' })).toBeDisabled();

  await sheet.getByRole('button', { name: 'Export' }).click();
  await expect(sheet.getByRole('button', { name: 'Seal checkpoint' })).toBeEnabled();

  await sheet.getByRole('button', { name: 'Seal checkpoint' }).click();
  await expect(sheet.getByText(/Sealed\. Rank/)).toBeVisible();

  await sheet.getByRole('button', { name: 'Close' }).click();
  // Rank stalls at E (no MVD consistency evidence yet) but the row is
  // sealed and Profile's Next checkpoint should have advanced to Day 30.
  await expect(page.getByRole('button', { name: /Next checkpoint: Day 30/ })).toBeVisible();
});
