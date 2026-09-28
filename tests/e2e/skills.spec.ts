import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

// final/06's SKILLS row named DSA topics, SE foundations, AI tiers and
// a career tree, all "flat lists" -- but Skills.tsx was a literal
// "Phase 0 — not implemented" placeholder until now.
test('Skills shows real DSA/foundations mastery, AI tiers, career tree and the interview benchmark', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'SKILLS' }).click();
  await expect(page.getByText('Phase 0')).toHaveCount(0);

  await expect(page.getByText('Arrays')).toBeVisible();
  await expect(page.getByText('Operating Systems')).toBeVisible();
  await expect(page.getByText('Tier 0 — table stakes')).toBeVisible();
  await expect(page.getByText('Evaluation design')).toBeVisible();
  await expect(page.getByText('Career tree')).toBeVisible();
  await expect(page.getByText('Applications')).toBeVisible();

  // The benchmark speaks in the System's register now (design/07 task
  // 0.3): an un-cleared gate rather than "Not yet passed." The assertion
  // still checks the same two states of the same real record.
  await expect(page.getByText('UNCLEARED GATE')).toBeVisible();
  await page.getByRole('button', { name: 'GATE CLEARED', exact: true }).click();
  await expect(page.getByText('✓ GATE CLEARED')).toBeVisible();
});

test('logging a DSA problem shows up as real mastery on Skills', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByTestId('quest-row-dsa-open').click();
  await page.getByRole('button', { name: /Record Logic Trial|Log problem/ }).click();
  await page.getByLabel('Problem', { exact: true }).fill('Two Sum');
  await page.getByRole('button', { name: 'Arrays' }).click();
  await page.getByRole('button', { name: 'E', exact: true }).click();
  await page.getByRole('button', { name: /First impact|First attempt/ }).click();
  await page.getByRole('button', { name: /Record Logic Trial|Log problem/ }).click();

  await page.getByRole('link', { name: 'SKILLS' }).click();
  const arraysRow = page.getByText('Arrays', { exact: true }).locator('..');
  await expect(arraysRow.locator('[aria-label="introduced"]')).toBeVisible();
});
