import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

// final/05 §2.1's CHECKPOINT Moment: "sealed with improvement" ->
// self-paced sequence, tap to advance, tap again to dismiss.
test('sealing a checkpoint with real logged progress shows the self-paced CHECKPOINT sequence', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  // One real logged problem is enough to move "Problems solved" 0 -> 1,
  // which is all checkpointImproved needs to fire, independent of
  // whether the Day 14 rank gate itself passes.
  await page.getByTestId('quest-row-dsa-open').click();
  await page.getByRole('button', { name: /Record Logic Trial|Log problem/ }).click();
  await page.getByLabel('Problem', { exact: true }).fill('Two Sum');
  await page.getByRole('button', { name: 'Arrays' }).click();
  await page.getByRole('button', { name: 'E', exact: true }).click();
  await page.getByRole('button', { name: /First impact|First attempt/ }).click();
  await page.getByRole('button', { name: /Record Logic Trial|Log problem/ }).click();

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await page.getByRole('button', { name: /Next checkpoint: Day 14/ }).click();

  const sheet = page.getByTestId('checkpoint-screen');
  await sheet.getByRole('button', { name: 'Export' }).click();
  await sheet.getByRole('button', { name: 'Seal checkpoint' }).click();

  const moment = page.getByTestId('checkpoint-moment');
  await expect(moment).toBeVisible();
  await expect(moment).toHaveAttribute('data-step', '0');
  await expect(moment.getByText('SEALED', { exact: true })).toBeVisible(); // no rank advance in this scenario

  await moment.click();
  await expect(moment).toHaveAttribute('data-step', '1');
  await expect(moment.getByText('Problems solved')).toBeVisible();
  await expect(moment.getByText('0 → 1')).toBeVisible();

  await moment.click();
  await expect(moment).toHaveAttribute('data-step', '2');
  await expect(moment.getByText(/Rank E -> D requires/)).toBeVisible();

  // The self-paced sequence never auto-dismisses -- only a tap on the
  // final step closes it.
  await page.waitForTimeout(1500);
  await expect(moment).toBeVisible();

  await moment.click();
  await expect(moment).toHaveCount(0);
  await expect(sheet.getByText(/Sealed\. Rank/)).toBeVisible();
});

test('a checkpoint sealed with zero real progress shows the plain verdict line, not the sequence', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await page.getByRole('button', { name: /Next checkpoint: Day 14/ }).click();

  const sheet = page.getByTestId('checkpoint-screen');
  await sheet.getByRole('button', { name: 'Export' }).click();
  await sheet.getByRole('button', { name: 'Seal checkpoint' }).click();

  await expect(page.getByTestId('checkpoint-moment')).toHaveCount(0);
  await expect(sheet.getByText(/Sealed\. Rank/)).toBeVisible();
});
