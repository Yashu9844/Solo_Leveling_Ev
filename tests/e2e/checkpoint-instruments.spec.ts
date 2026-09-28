import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

// docs/04 §5.2-5.3 — self-efficacy (6 items, 0-100), automaticity (4
// items, 1-7), enjoyment (3 items, 0-10), administered at Day 0.
test('the Day-0 baseline row now captures all three instruments, not just self-efficacy', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await page.getByRole('button', { name: 'Complete Day-0 baseline' }).click();

  await expect(page.getByText('How confident are you, right now, that you could:')).toBeVisible();
  await expect(page.getByText('"I do this without having to consciously remember or decide."')).toBeVisible();
  await expect(page.getByText('How much do you enjoy this, independent of its usefulness?')).toBeVisible();

  await page.getByRole('button', { name: 'Save baseline' }).click();
  await expect(page.getByRole('button', { name: 'Complete Day-0 baseline' })).toHaveCount(0);
});

test('a later checkpoint offers its own instrument round, independent of sealing', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await page.getByRole('button', { name: /Next checkpoint: Day 14/ }).click();

  const sheet = page.getByTestId('checkpoint-screen');
  // Day 14 is excluded from the instrument schedule (docs/04: "Day
  // 0/30/60/90/120 only").
  await expect(sheet.getByRole('button', { name: /Record Day 14 instruments/ })).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Export' }).click();
  await sheet.getByRole('button', { name: 'Seal checkpoint' }).click();
  await expect(sheet.getByText(/Sealed\. Rank/)).toBeVisible();
});
