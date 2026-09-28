import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, waitForQuestInstanceState } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('logging one problem auto-completes the DSA quest', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-dsa-open').click();
  await page.getByRole('button', { name: /Record Logic Trial|Log problem/ }).click();
  await page.getByLabel('Problem', { exact: true }).fill('Two Sum');
  await page.getByRole('button', { name: 'Arrays' }).click();
  await page.getByRole('button', { name: 'E', exact: true }).click();
  await page.getByRole('button', { name: /First impact|First attempt/ }).click();
  await page.getByRole('button', { name: 'Log problem' }).click();

  await waitForQuestInstanceState(page, 'DSA', '2026-09-05', 'complete');
  await expect(page.getByRole('button', { name: 'Undo DSA' })).toBeVisible();
});
