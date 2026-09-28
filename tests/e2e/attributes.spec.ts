import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('Profile shows the six attribute bars, all starting at 0', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROFILE' }).click();
  const bars = page.getByTestId('attribute-bars');
  await expect(bars).toBeVisible();
  for (const label of ['DISCIPLINE', 'DEPTH', 'PROBLEM SOLVING', 'ENGINEERING', 'MOMENTUM', 'VITALITY']) {
    await expect(bars.getByText(label, { exact: true })).toBeVisible();
  }
});

test('Progress screen defaults to SYSTEM before Day 30 and switches to REALITY on tap', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROGRESS' }).click();
  await expect(page.getByTestId('attribute-bars')).toBeVisible();
  await expect(page.getByTestId('reality-tab')).toHaveCount(0);

  await page.getByRole('button', { name: 'REALITY' }).click();
  await expect(page.getByTestId('reality-tab')).toBeVisible();
  await expect(page.getByText('Applications')).toBeVisible();
});
