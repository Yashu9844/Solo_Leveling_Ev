import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

// Same reasoning as core-loop.spec.ts: every assertion here needs "now"
// to fall inside the arc's active window, so pin the clock well inside it.
const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

/**
 * design/02-NAVIGATION-FLOW.md §6 — the three PWA app shortcuts.
 *
 * These have been declared in the manifest since Slice 1 and were never
 * routed: they fell through to the catch-all and landed on a bare Today
 * with nothing open. The redirect is what makes a long-press shortcut
 * mean anything.
 */
test.describe('PWA app shortcuts', () => {
  for (const [path, target] of [
    ['/log/problem', 'dsa'],
    ['/log/application', 'career'],
    ['/review', 'review'],
  ] as const) {
    test(`${path} resolves to Today asking for "${target}"`, async ({ page }) => {
      await withSafeClock(page);
      await completeOnboarding(page);

      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/today\\?open=${target}$`));
      await expect(page.getByRole('heading', { name: 'TODAY' })).toBeVisible();
    });
  }

  test('a shortcut with no arc yet goes to Start, not a dead end', async ({ page }) => {
    await withSafeClock(page);
    await page.goto('/log/problem');
    await expect(page).toHaveURL(/\/start$/);
  });

  // `replace`, not `push`: a launcher entry point must not sit in the
  // history stack waiting for a back gesture to land the user on it.
  test('a shortcut leaves no history entry behind it', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    await nav(page).getByRole('link', { name: 'PROGRESS' }).click();
    await expect(page).toHaveURL(/\/progress$/);

    await page.goto('/log/problem');
    await expect(page).toHaveURL(/\/today\?open=dsa$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/progress$/);
  });
});

test.describe('unknown paths', () => {
  test('with an arc, an unknown path lands on Today', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);
    await page.goto('/no-such-screen');
    await expect(page).toHaveURL(/\/today$/);
  });

  test('with no arc, an unknown path lands on Start', async ({ page }) => {
    await withSafeClock(page);
    await page.goto('/no-such-screen');
    await expect(page).toHaveURL(/\/start$/);
  });
});

/**
 * design/02-NAVIGATION-FLOW.md §5 — back closes an overlay, not the
 * screen behind it.
 *
 * The second test here exists because of a real failure: an earlier
 * implementation popped a history entry whenever an overlay closed by
 * button, and since history.back() is async while pushState is not,
 * opening a sheet from another sheet consumed the wrong entry. Two
 * rounds later the app unwound past its own first entry and rendered a
 * white about:blank. Never navigating away is the property under test.
 */
test.describe('overlays and the back gesture', () => {
  test('back closes an open sheet instead of leaving the screen', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    await page.getByTestId('quest-row-career-open').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('button', { name: 'Complete CAREER' })).toBeVisible();
  });

  test('opening a sheet from a sheet, repeatedly, never leaves the app', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    for (let i = 0; i < 3; i++) {
      await page.getByTestId('quest-row-career-open').click();
      await page.getByRole('button', { name: /Despatch Ascension|Log application/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // Still the app, still Today, still rendering.
      await expect(page).toHaveURL(/\/today/);
      await expect(page.getByTestId('quest-row-career')).toBeVisible();
    }
  });
});

test.describe('tab navigation', () => {
  test('back returns to the previous tab rather than leaving the app', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    await nav(page).getByRole('link', { name: 'SKILLS' }).click();
    await expect(page.getByRole('heading', { name: 'SKILLS' })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('heading', { name: 'TODAY' })).toBeVisible();
  });

  /**
   * Each tab keeps its own scroll position. The scroll container persists
   * across route changes, so without explicit management a user leaving a
   * scrolled Profile would arrive mid-page on a Today they never scrolled.
   */
  test('each tab keeps its own scroll position', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    const scroller = page.locator('main');

    await nav(page).getByRole('link', { name: 'PROFILE' }).click();
    await expect(page.getByRole('heading', { name: 'PROFILE' })).toBeVisible();
    await scroller.evaluate((el) => el.scrollTo({ top: 400 }));
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await nav(page).getByRole('link', { name: 'TODAY' }).click();
    await expect(page.getByRole('heading', { name: 'TODAY' })).toBeVisible();
    // Today has never been scrolled, so it must open at the top.
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);

    await nav(page).getByRole('link', { name: 'PROFILE' }).click();
    await expect(page.getByRole('heading', { name: 'PROFILE' })).toBeVisible();
    // Profile returns to where it was left.
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test('tapping the tab you are already on scrolls back to the top', async ({ page }) => {
    await withSafeClock(page);
    await completeOnboarding(page);

    const scroller = page.locator('main');

    await nav(page).getByRole('link', { name: 'PROFILE' }).click();
    await scroller.evaluate((el) => el.scrollTo({ top: 400 }));
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await nav(page).getByRole('link', { name: 'PROFILE' }).click();
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
  });
});
