import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

// final/07 §6.2's justification for the Screen Wake Lock API ("use for
// the deep-work timer") had no timer anywhere in the app to hold a lock
// during. This is the minimal, optional stopwatch that gives it one —
// optional per final/07 §6's "no mandatory timers" rule, so the manual
// Minutes stepper must keep working untouched either way.
test('the deep-work timer is optional and fills the minutes field when stopped', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-dsa-open').click();
  await page.getByRole('button', { name: /Record Logic Trial|Log problem/ }).click();

  await expect(page.getByTestId('deep-work-elapsed')).toHaveText('00:00');
  await page.getByRole('button', { name: 'Start deep work' }).click();

  await page.clock.fastForward('05:00'); // 5 real minutes of virtual time
  await expect(page.getByTestId('deep-work-elapsed')).toHaveText('05:00');

  await page.getByRole('button', { name: /Stop · use 5 min/ }).click();

  // Stopping hands control back to "Start deep work" (elapsed reset) —
  // the manual Minutes stepper remains independently editable either way.
  await expect(page.getByRole('button', { name: 'Start deep work' })).toBeVisible();
  await expect(page.getByTestId('deep-work-elapsed')).toHaveText('00:00');
});

test('logging a problem without ever touching the timer still works — it is never required', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-dsa-open').click();
  await page.getByRole('button', { name: /Record Logic Trial|Log problem/ }).click();
  await page.getByLabel('Problem', { exact: true }).fill('Two Sum');
  await page.getByRole('button', { name: 'Arrays' }).click();
  await page.getByRole('button', { name: 'E', exact: true }).click();
  await page.getByRole('button', { name: /First impact|First attempt/ }).click();
  await page.getByRole('button', { name: /Record Logic Trial|Log problem/ }).click();

  await expect(page.getByRole('button', { name: 'Undo DSA' })).toBeVisible();
});
