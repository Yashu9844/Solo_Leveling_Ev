import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, openDataSettings, waitForQuestInstanceState } from './helpers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('export downloads a real JSON backup, and importing it back restores state after a wipe', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('button', { name: 'Complete CAREER' }).click();
  await waitForQuestInstanceState(page, 'CAREER', '2026-09-05', 'complete');

  await openDataSettings(page);
  await expect(page.getByTestId('backup-card')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/solo-leveling-backup-.*\.json/);

  const tmpFile = path.join(os.tmpdir(), `backup-test-${Date.now()}.json`);
  await download.saveAs(tmpFile);
  const contents = fs.readFileSync(tmpFile, 'utf-8');
  const parsed = JSON.parse(contents);
  expect(Array.isArray(parsed.events)).toBe(true);
  expect(parsed.events.length).toBeGreaterThan(0);
  expect(parsed.arc).toBeTruthy();

  // Wipe everything client-side (simulating a lost/reset device), then
  // reload to confirm the wipe took. A device with no arc now lands on
  // the Start screen, which is exactly the first-run state a wiped
  // device should be in.
  await page.evaluate(() => indexedDB.deleteDatabase('system-arc'));
  await page.reload();
  await expect(page).toHaveURL(/\/start$/);

  // Now import the backup from the fresh (onboarding) state. The
  // import button lives behind Settings > Data, which requires an
  // arc to reach, so this exercises importing from the smallest possible
  // existing data: re-onboard minimally first, then drive the file input
  // that exists once an arc does.
  await completeOnboarding(page, 'Temp');
  await openDataSettings(page);

  await page.getByTestId('backup-import-input').setInputFiles(tmpFile);
  const confirmBox = page.getByTestId('import-confirm');
  await expect(confirmBox).toBeVisible();
  await confirmBox.getByRole('button', { name: 'Replace and import' }).click();

  // Import reloads the page, so it comes back wherever it was — which
  // is now /profile/settings/data, not /profile. Anchored at the start
  // rather than the end so the assertion survives the depth.
  await page.waitForURL(/\/(profile|today)/, { timeout: 10000 });
  await page.getByRole('link', { name: 'TODAY' }).click();
  await expect(page.getByRole('button', { name: 'Undo CAREER' })).toBeVisible();

  fs.unlinkSync(tmpFile);
});
