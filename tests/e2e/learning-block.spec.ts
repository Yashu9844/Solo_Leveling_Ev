import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

async function barWidthPct(page: Page): Promise<number> {
  const style = await page.getByTestId('xp-bar-fill').getAttribute('style');
  const match = style?.match(/width:\s*([\d.]+)%/);
  return match ? Number(match[1]) : 0;
}

// final/03 §3's LEARN category has no core-quest gate, so its own
// button is always on TODAY, not behind a quest-detail sheet.
test('logging a foundation topic block grants LEARN XP and fires the MASTERY Moment on first exposure', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  expect(await barWidthPct(page)).toBe(0);

  await page.getByRole('button', { name: /Foundational Trial|Learning block/ }).click();
  await page.getByRole('button', { name: 'Operating Systems' }).click();
  await page.getByRole('button', { name: /LOG BLOCK · \+\d+ XP/ }).click();

  // The very first block for a topic is unseen -> introduced, a genuine
  // mastery advance, so the MASTERY Moment fires and holds the sheet
  // open until dismissed (mirrors xp.spec.ts's LEVEL UP handling).
  const moment = page.getByRole('button', { name: /Operating Systems advanced to Introduced/ });
  await expect(moment).toBeVisible();
  await moment.click();
  await expect(moment).toHaveCount(0);

  await expect.poll(() => barWidthPct(page)).toBeGreaterThan(0);
});

test('the System Design chip reveals system/mode fields and logs into its own table, not a plain block', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('button', { name: /Foundational Trial|Learning block/ }).click();
  await page.getByRole('button', { name: 'System Design' }).click();

  // Distinct from every other topic — final/03 §3.3's "extra structure."
  await expect(page.getByLabel('System')).toBeVisible();
  await page.getByLabel('System').fill('URL shortener');
  await page.getByRole('button', { name: 'Studied' }).click();
  await page.getByRole('button', { name: /LOG BLOCK · \+\d+ XP/ }).click();

  // System Design's mastery is tracked from logged blocks, not from
  // system_design_study rows (existing, documented design) — so this
  // path never fires a MASTERY Moment on a fresh topic; the sheet
  // closes straight away.
  await expect(page.getByRole('heading', { name: /FOUNDATIONAL TRIAL|LEARNING BLOCK/ })).toHaveCount(0);
  await expect.poll(() => barWidthPct(page)).toBeGreaterThan(0);
});
