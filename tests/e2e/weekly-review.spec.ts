import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('Weekly review opens from Progress, shows real zeroed metrics on a fresh arc, and closes', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'Weekly review' }).click();

  const sheet = page.getByTestId('weekly-review');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('SYSTEM EVALUATION')).toBeVisible();
  await expect(sheet.getByText('Career')).toBeVisible();

  await sheet.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(sheet).toHaveCount(0);
});

test('shipping an artifact this week surfaces the resume-content nudge in Weekly Review', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-build-open').click();
  await page.getByRole('button', { name: /Forge Construct|Log session/ }).click();
  await page.getByRole('button', { name: 'SHIP', exact: true }).click();
  await page.getByLabel('Project').fill('agent');
  await page.getByPlaceholder('e.g. Tool-calling retry logic').fill('Retry logic');
  await page.getByRole('button', { name: /Forge Construct|Log session/ }).click();
  await expect(page.getByText('EVIDENCE ACCEPTED')).toBeVisible();
  await page.getByText('EVIDENCE ACCEPTED').click(); // dismiss the Moment

  await page.getByRole('link', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'Weekly review' }).click();
  await expect(page.getByTestId('resume-nudge')).toHaveText(/You shipped 1 artifact this week/);
});

test('the recovery card offers an optional "what got in the way" chip alongside the claim', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  // Day 1's quest instances are generated asynchronously once Today
  // mounts, and completeOnboarding only waits for the URL. Jumping the
  // clock before that write lands leaves Day 1 with no instances, so
  // there is nothing to recover and the card never appears. Wait for a
  // row to prove generation finished.
  await expect(page.getByTestId('quest-row-career')).toBeVisible();

  // Day 2, having touched nothing on Day 1 -> Day 1 is fully recoverable.
  const day2 = new Date(SAFE_TIME);
  day2.setUTCDate(day2.getUTCDate() + 1);
  await page.clock.setFixedTime(day2);
  await page.reload();

  const card = page.getByTestId('recovery-card');
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card.getByRole('button', { name: 'Wrong time' })).toBeVisible();
  await card.getByRole('button', { name: 'Wrong time' }).click();
  await card.getByRole('button', { name: /Recovery quest/ }).click();
  await expect(card).toHaveCount(0, { timeout: 8000 });
});
