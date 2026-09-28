import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, waitForQuestInstanceState } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('logging a 45-minute build session auto-completes the BUILD quest', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-build-open').click();
  await page.getByRole('button', { name: /Forge Construct|Log session/ }).click();
  await page.getByRole('button', { name: 'LEARN', exact: true }).click();
  await page.getByLabel('Project').fill('agent-project');
  await page.getByRole('button', { name: /Forge Construct|Log session/ }).click();

  await waitForQuestInstanceState(page, 'BUILD', '2026-09-05', 'complete');
  await expect(page.getByRole('button', { name: 'Undo BUILD' })).toBeVisible();
});
