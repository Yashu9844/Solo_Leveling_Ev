import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('Today shows a real system line (reflection or System Message) below the priority line', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  const line = page.getByTestId('system-line');
  await expect(line).toBeVisible();
  const text = await line.textContent();
  expect(text?.length).toBeGreaterThan(0);
});

test('a recovery day shows a setbacks-only reflection instead of the usual morning pool', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  // Day 1's quest instances are generated asynchronously once Today
  // mounts, and completeOnboarding only waits for the URL. Jumping the
  // clock before that write lands leaves Day 1 with no instances, so
  // there is nothing to recover and the card never appears. Wait for a
  // row to prove generation finished.
  await expect(page.getByTestId('quest-row-career')).toBeVisible();

  // Day 2, having touched nothing on Day 1 -> Day 1 is fully recoverable,
  // which is this app's post-lapse moment.
  const day2 = new Date(SAFE_TIME);
  day2.setUTCDate(day2.getUTCDate() + 1);
  await page.clock.setFixedTime(day2);
  await page.reload();

  await expect(page.getByTestId('recovery-card')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('system-line')).toBeVisible();
});
