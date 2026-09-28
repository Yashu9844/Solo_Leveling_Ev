import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, waitForQuestInstanceState } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('logging 10,000+ steps auto-completes TRAINING', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-training-open').click();
  await page.getByRole('button', { name: /Record Vitality Trial|Log training/ }).click();
  await page.getByRole('button', { name: 'Steps', exact: true }).click();
  // Stepper starts at 8000 with a +500 step; click + 4 times to clear 10,000.
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Increase' }).click();
  }
  await page.getByRole('button', { name: 'Log steps' }).click();

  await waitForQuestInstanceState(page, 'TRAINING', '2026-09-05', 'complete');
  await expect(page.getByRole('button', { name: 'Undo TRAINING' })).toBeVisible();
});

test('logging a wake time inside the window auto-completes SLEEP', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-sleep-open').click();
  await page.getByRole('button', { name: /Log Synchronization|Log wake time/ }).click();
  await page.getByLabel('Wake time').fill('08:15');
  await page.getByRole('button', { name: /Log Synchronization|Log wake time/ }).click();

  await waitForQuestInstanceState(page, 'SLEEP', '2026-09-05', 'complete');
  await expect(page.getByRole('button', { name: 'Undo SLEEP' })).toBeVisible();
});

test('logging screen time at or under the limit auto-completes ATTENTION', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-attention-open').click();
  await page.getByRole('button', { name: /Log Friction Control|Log screen time/ }).click();
  await page.getByRole('button', { name: /Log Friction Control|Log screen time/ }).click(); // default 45 <= 60

  await waitForQuestInstanceState(page, 'ATTENTION', '2026-09-05', 'complete');
  await expect(page.getByRole('button', { name: 'Undo ATTENTION' })).toBeVisible();
});

test('Maintenance card ticks save immediately and never touch a core quest row', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  const card = page.getByTestId('maintenance-card');
  await expect(card).toBeVisible();
  await card.getByText('Bath').click();
  await card.getByText('Ate to plan').click();

  // Neither tick is a core quest — none of the six rows ever flips to
  // complete (aria-label reads "Undo <TITLE>") from this alone.
  await expect(page.getByRole('button', { name: /^Undo /i })).toHaveCount(0);
});
