import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

// store/training.ts's logBodyMetric had no UI caller anywhere in the
// app before ui/components/BodyMetricsCard.tsx — this closes that gap.
test('logging a body metric from Profile saves without touching any quest or XP', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await page.getByRole('button', { name: 'Log body metric' }).click();

  await expect(page.getByRole('button', { name: 'Weight (kg)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Waist (cm)' }).click();
  await page.getByRole('button', { name: 'Log', exact: true }).click();

  await expect(page.getByText('Saved.')).toBeVisible();

  // XP bar untouched -- final/04 §1's "no XP for body metrics" rule.
  await page.getByRole('link', { name: 'TODAY' }).click();
  const style = await page.getByTestId('xp-bar-fill').getAttribute('style');
  expect(style).toContain('width: 0%');
});
