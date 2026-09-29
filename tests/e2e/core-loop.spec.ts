import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, waitForQuestInstanceState, questToggle, expectQuestComplete } from './helpers';

// Every one of these tests depends on "now" falling inside the arc's
// active window (arc.startDate is the fixed constant 2026-09-01 in
// DEFAULT_CONFIG). Relying on the real wall clock is flaky by
// construction — right at the 04:00 IST boundary edge around the arc's
// own start date, the real local_date can compute to 2026-08-31, which
// is BEFORE active_from, so generateQuests correctly returns zero
// instances and every row-based assertion fails. Every test here installs
// a fixed clock well inside the arc first, before touching Today.
const SAFE_TIME = '2026-09-05T10:00:00Z'; // 2026-09-05T15:30 IST — plainly open, plainly mid-arc

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('complete a quest -> reload -> still complete', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  const careerButton = questToggle(page, 'career');
  await careerButton.click();
  await expectQuestComplete(page, 'career');
  await waitForQuestInstanceState(page, 'career', '2026-09-05', 'complete');

  await page.reload();
  await expectQuestComplete(page, 'career');
});

test('complete -> undo -> reload -> not complete', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await questToggle(page, 'career').click();
  await expectQuestComplete(page, 'career');
  await waitForQuestInstanceState(page, 'career', '2026-09-05', 'complete');

  await questToggle(page, 'career').click();
  await expectQuestComplete(page, 'career', false);
  await waitForQuestInstanceState(page, 'career', '2026-09-05', 'available');

  await page.reload();
  await expectQuestComplete(page, 'career', false);
});

test('with a mocked clock at 03:05 local, rows are disabled and the banner shows', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  // 2026-09-05T21:35:00Z = 2026-09-06T03:05 IST — inside the day-close window.
  await page.clock.setFixedTime(new Date('2026-09-05T21:35:00Z'));
  await page.reload();

  await expect(page.getByText('Day closed. Next day begins at 04:00.')).toBeVisible();
  await expect(questToggle(page, 'career')).toBeDisabled();
});

test('a mocked clock crossing 04:00 while the page is open regenerates instances for the new date', async ({
  page,
}) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  // 2026-09-05T22:20:00Z = 2026-09-06T03:50 IST (day closed).
  await page.clock.setFixedTime(new Date('2026-09-05T22:20:00Z'));
  await page.reload();
  await expect(page.getByText('Day closed. Next day begins at 04:00.')).toBeVisible();

  // Cross the 04:00 boundary: 2026-09-05T22:35:00Z = 2026-09-06T04:05 IST.
  await page.clock.setFixedTime(new Date('2026-09-05T22:35:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByText('Day closed. Next day begins at 04:00.')).toHaveCount(0);
  await expect(questToggle(page, 'career')).toBeEnabled();
});

test('all six rows are reachable without scrolling at 412x915 (Pixel 7)', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  // By stable row testid, not display title (see helpers.ts#questToggle).
  const keys = ['career', 'dsa', 'build', 'training', 'sleep', 'attention'];
  for (const key of keys) {
    await expect(page.getByTestId(`quest-row-${key}`)).toBeVisible();
  }

  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? main.scrollHeight - main.clientHeight : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
