import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, openDataSettings, waitForQuestInstanceState } from './helpers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

function writeTmpCsv(name: string, contents: string): string {
  const file = path.join(os.tmpdir(), `${name}-${Date.now()}.csv`);
  fs.writeFileSync(file, contents);
  return file;
}

test('importing a daily-log CSV completes real quests for a past day', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  const csv = 'date,dsa,bld,trn,slp,fue,att,wake,sleep,scrn,energy,focus,blocker,note\n' + '2026-09-01,1,1,1,1,1,1,06:34,23:10,47,3,4,none,paper day';
  const csvFile = writeTmpCsv('daily-log', csv);

  await openDataSettings(page);
  await page.getByRole('button', { name: 'Import daily log CSV' }).click();
  // The button click above just opens a native picker; drive the
  // (hidden) file input directly instead of the dialog.
  await page.getByTestId('paper-import-daily-input').setInputFiles(csvFile);

  const preview = page.getByTestId('paper-import-preview');
  await expect(preview).toContainText('1 days parsed');
  await preview.getByRole('button', { name: /Import 1/ }).click();
  await expect(page.getByText(/1 days imported/)).toBeVisible();

  await page.getByRole('link', { name: 'TODAY' }).click();
  await waitForQuestInstanceState(page, 'DSA', '2026-09-01', 'complete');
  await waitForQuestInstanceState(page, 'SLEEP', '2026-09-01', 'complete');

  fs.unlinkSync(csvFile);
});

test('importing a DSA-log CSV creates a real logged problem', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  const csv = 'date,problem,topic,diff,outcome,min,insight\n2026-09-01,Two Sum,arrays,E,first,8,';
  const csvFile = writeTmpCsv('dsa-log', csv);

  await openDataSettings(page);
  await page.getByRole('button', { name: 'Import DSA log CSV' }).click();
  await page.getByTestId('paper-import-dsa-input').setInputFiles(csvFile);

  const preview = page.getByTestId('paper-import-preview');
  await expect(preview).toContainText('1 problems parsed');
  await preview.getByRole('button', { name: /Import 1/ }).click();
  await expect(page.getByText(/1 problems imported/)).toBeVisible();

  fs.unlinkSync(csvFile);
});

test('a malformed CSV row is reported and not silently imported', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  const csv = 'date,dsa,bld,trn,slp,fue,att\nnot-a-date,1,1,1,1,1,1';
  const csvFile = writeTmpCsv('bad-daily-log', csv);

  await openDataSettings(page);
  await page.getByRole('button', { name: 'Import daily log CSV' }).click();
  await page.getByTestId('paper-import-daily-input').setInputFiles(csvFile);

  const preview = page.getByTestId('paper-import-preview');
  await expect(preview).toContainText('0 days parsed');
  await expect(preview).toContainText('1 rows skipped');
  await expect(preview.getByText(/must be YYYY-MM-DD/)).toBeVisible();
  await expect(preview.getByRole('button', { name: /Import 0/ })).toBeDisabled();

  fs.unlinkSync(csvFile);
});
