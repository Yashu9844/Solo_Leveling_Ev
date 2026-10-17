// platform/05 loop 15.5: an export protected by a passphrase. The file holds no readable data; a wrong passphrase is refused and changes nothing;
// the right one restores everything.
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { completeOnboarding, expectQuestComplete, openDataSettings, questToggle, waitForQuestInstanceState } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';
const PASSPHRASE = 'a long passphrase';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

test('an encrypted export restores with its passphrase, and a wrong one is refused', async ({ page }) => {
  test.setTimeout(120_000);
  await withSafeClock(page);
  await completeOnboarding(page);
  await questToggle(page, 'career').click();
  await waitForQuestInstanceState(page, 'career', '2026-09-05', 'complete');

  await openDataSettings(page);
  await page.getByTestId('backup-protect').locator('summary').click();
  await page.getByTestId('backup-passphrase').fill(PASSPHRASE);
  await page.getByTestId('backup-passphrase-again').fill('something else entirely');
  await page.getByRole('button', { name: 'Export backup' }).click();
  await expect(page.getByText('The two passphrases are not the same.')).toBeVisible();

  await page.getByTestId('backup-passphrase-again').fill(PASSPHRASE);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/solo-leveling-backup-.*\.enc\.json$/);
  const file = path.join(os.tmpdir(), `backup-enc-${Date.now()}.json`);
  await download.saveAs(file);
  const contents = fs.readFileSync(file, 'utf-8');
  expect(contents).not.toContain('ARC_STARTED');
  expect(JSON.parse(contents)).toMatchObject({ format: 'system-export-encrypted/1', cipher: 'AES-256-GCM' });

  await page.evaluate(() => indexedDB.deleteDatabase('system-arc'));
  await page.reload();
  await expect(page).toHaveURL(/\/start$/);
  await completeOnboarding(page, 'Temp');
  await openDataSettings(page);

  await page.getByTestId('backup-import-input').setInputFiles(file);
  const confirm = page.getByTestId('import-confirm');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('encrypted');

  // A wrong passphrase: refused, and the data on the device is still the temporary arc.
  await confirm.getByTestId('import-passphrase').fill('not the passphrase');
  await confirm.getByRole('button', { name: 'Replace and import' }).click();
  await expect(page.getByText('does not open this backup')).toBeVisible();
  await expect(confirm).toBeVisible();

  await confirm.getByTestId('import-passphrase').fill(PASSPHRASE);
  await confirm.getByRole('button', { name: 'Replace and import' }).click();
  await page.waitForURL(/\/(profile|today)/, { timeout: 15000 });
  await page.getByRole('link', { name: 'TODAY' }).click();
  await expectQuestComplete(page, 'career');
  fs.unlinkSync(file);
});
