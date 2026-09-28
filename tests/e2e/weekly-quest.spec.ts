import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

// final/00 §C8's weekly quest payout: proposed in Weekly Review,
// accepted once, tracked live on Today, claimed automatically once its
// target is reached.
test('accepting a weekly quest shows live progress on Today and claims XP on completion', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  // A fresh arc has no DSA history, so the proposal falls back to
  // ship_project (target 1) -- the fastest real path to a completion.
  await page.getByRole('link', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'Weekly review' }).click();
  const sheet = page.getByTestId('weekly-review');
  await expect(sheet.getByTestId('weekly-quest-proposal')).toBeVisible();
  await sheet.getByRole('button', { name: /Accept weekly quest/ }).click();
  await expect(sheet.getByText('Accepted.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Accept', exact: true }).click();

  await page.getByRole('link', { name: 'TODAY' }).click();
  await expect(page.getByTestId('weekly-quest-progress')).toContainText('0/1');

  await page.getByTestId('quest-row-build-open').click();
  await page.getByRole('button', { name: /Forge Construct|Log session/ }).click();
  await page.getByRole('button', { name: 'SHIP', exact: true }).click();
  await page.getByLabel('Project').fill('agent');
  await page.getByPlaceholder('e.g. Tool-calling retry logic').fill('Retry logic');
  await page.getByRole('button', { name: /Forge Construct|Log session/ }).click();
  await expect(page.getByText('EVIDENCE ACCEPTED')).toBeVisible();
  await page.getByText('EVIDENCE ACCEPTED').click();

  await expect(page.getByTestId('weekly-quest-progress')).toContainText('COMPLETE');

  // A second visit (quest now completed) shows no active quest banner.
  await page.getByRole('link', { name: 'PROGRESS' }).click();
  await page.getByRole('link', { name: 'TODAY' }).click();
  await expect(page.getByTestId('weekly-quest-progress')).toHaveCount(0);
});

test('a second Weekly Review while one is already running shows progress, not a new proposal', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'Weekly review' }).click();
  const sheet = page.getByTestId('weekly-review');
  await sheet.getByRole('button', { name: /Accept weekly quest/ }).click();
  await sheet.getByRole('button', { name: 'Accept', exact: true }).click();

  await page.getByRole('button', { name: 'Weekly review' }).click();
  const sheet2 = page.getByTestId('weekly-review');
  await expect(sheet2.getByTestId('weekly-quest-active')).toBeVisible();
  await expect(sheet2.getByTestId('weekly-quest-proposal')).toHaveCount(0);
});
