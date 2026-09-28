import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

// Before this, LogBuildSessionSheet hardcoded every shipped artifact to
// kind 'feature' -- there was no UI anywhere to create an 'eval',
// 'project', 'deployment' or 'writeup' artifact, and no way to
// self-certify final/03 §4.4's "cost per task measured and stated" for
// a project, which meant costPerTaskMeasured (a Rank S / Boss III-IV
// input) could never become true.
test('shipping a project reveals the cost-per-task checkbox; a feature does not', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-build-open').click();
  await page.getByRole('button', { name: /Forge Construct|Log session/ }).click();
  await page.getByRole('button', { name: 'SHIP', exact: true }).click();
  await page.getByPlaceholder('e.g. Tool-calling retry logic').fill('URL shortener agent');

  await expect(page.getByText('Evidence kind')).toBeVisible();
  await expect(page.getByText('Cost per task measured and stated')).toHaveCount(0);

  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await expect(page.getByText('Cost per task measured and stated')).toBeVisible();

  await page.getByText('Cost per task measured and stated').click();
  await page.getByLabel('Project').fill('shortener');
  await page.getByRole('button', { name: /Forge Construct|Log session/ }).click();

  await expect(page.getByText('EVIDENCE ACCEPTED')).toBeVisible();
});
