import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, waitForQuestInstanceState } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z'; // 2026-09-05T15:30 IST

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

async function advanceToDay(page: Page, dayOffset: number) {
  const next = new Date(SAFE_TIME);
  next.setUTCDate(next.getUTCDate() + dayOffset);
  await page.clock.setFixedTime(next);
  await page.reload();
}

async function barWidthPct(page: Page): Promise<number> {
  const style = await page.getByTestId('xp-bar-fill').getAttribute('style');
  const match = style?.match(/width:\s*([\d.]+)%/);
  return match ? Number(match[1]) : 0;
}

test('a partial day offers a recovery quest the next day, which grants XP when claimed', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  // Day 1: complete only CAREER and DSA — a partial, incomplete day.
  await page.getByRole('button', { name: 'Complete CAREER' }).click();
  await expect(page.getByRole('button', { name: 'Undo CAREER' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete DSA' }).click();
  await expect(page.getByRole('button', { name: 'Undo DSA' })).toBeVisible();

  // Those assertions only prove the OPTIMISTIC flip. advanceToDay
  // reloads, and a reload that outruns the confirmed write (a full
  // rebuildProjections) reads a Day 1 that was never partially
  // completed — so the recovery card describes a different day, or does
  // not appear. helpers.ts documents this race; poll IndexedDB for it.
  await waitForQuestInstanceState(page, 'CAREER', '2026-09-05', 'complete');
  await waitForQuestInstanceState(page, 'DSA', '2026-09-05', 'complete');

  // Day 2: the recovery card should offer yesterday's gap. XP is
  // cumulative across the whole arc (not reset daily), so the bar is
  // already non-zero here from Day 1's 200 XP — claiming recovery is
  // checked as a further increase, not a rise from zero.
  await advanceToDay(page, 1);
  const recoveryCard = page.getByTestId('recovery-card');
  await expect(recoveryCard).toContainText('Yesterday: 2 of 6.');
  await expect(recoveryCard).toContainText('BUILD');

  const beforeClaim = await barWidthPct(page);
  await recoveryCard.getByRole('button', { name: /Recovery quest/ }).click();
  await expect.poll(() => barWidthPct(page)).toBeGreaterThan(beforeClaim);
  await expect(page.getByTestId('recovery-card')).toHaveCount(0);
});

test('two consecutive missed days trigger Reduced Mode', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);
  // Day 1: open the app, complete nothing.

  await advanceToDay(page, 1); // Day 2: open the app, complete nothing.
  await advanceToDay(page, 2); // Day 3: two consecutive misses (Day 1, Day 2) behind us.

  await expect(page.getByText('Reduced to the floor for two days. The arc continues.')).toBeVisible();
});

test('Arc Pause: pausing and resuming updates the Profile control', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await expect(page.getByText('Arc pause')).toBeVisible();

  await page.getByRole('button', { name: '3d' }).click();
  await expect(page.getByRole('button', { name: 'Resume now' })).toBeVisible();

  await page.getByRole('button', { name: 'Resume now' }).click();
  await expect(page.getByRole('button', { name: '1d' })).toBeVisible();
});
