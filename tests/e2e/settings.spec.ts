import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

async function openAppearance(page: Page) {
  await page.getByRole('link', { name: 'PROFILE' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByTestId('settings-appearance-row').click();
  await expect(page.getByTestId('appearance-screen')).toBeVisible();
}

/** What the root element actually carries — the single mechanism every
 * theme and modifier in tokens.css is keyed off. */
function rootData(page: Page, key: string) {
  return page.evaluate((k) => document.documentElement.dataset[k], key);
}

const THEMES = ['arc', 'dawn', 'abyss', 'contrast', 'daylight'] as const;

test('every theme applies immediately and survives a reload', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);
  await openAppearance(page);

  for (const theme of THEMES) {
    await page.getByTestId(`theme-${theme}`).click();
    await expect.poll(() => rootData(page, 'theme')).toBe(theme);
  }

  // The last one chosen has to come back after a cold boot — the inline
  // bootstrap in index.html reads the same localStorage key before the
  // module script runs, which is what prevents a flash of the default.
  await page.reload();
  await expect.poll(() => rootData(page, 'theme')).toBe('daylight');
});

test('text scale XL does not overflow at 320px', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);
  await openAppearance(page);

  await page.getByRole('button', { name: 'XL', exact: true }).click();
  await expect.poll(() => rootData(page, 'textScale')).toBe('xl');

  await page.setViewportSize({ width: 320, height: 568 });

  for (const path of ['/today', '/progress', '/skills', '/profile']) {
    await page.goto(path);
    // A cold load re-runs the splash hold, so waiting on a fixed timeout
    // would measure the splash instead of the screen.
    await page.locator('nav').waitFor();
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const main = document.querySelector('main');
      return {
        doc: doc.scrollWidth - doc.clientWidth,
        main: main ? main.scrollWidth - main.clientWidth : 0,
      };
    });
    expect(overflow, `horizontal overflow on ${path}`).toEqual({ doc: 0, main: 0 });
  }
});

test('motion: reduced stops animation everywhere', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);
  await openAppearance(page);

  await page.getByRole('button', { name: 'Reduced', exact: true }).click();
  await expect.poll(() => rootData(page, 'motion')).toBe('reduced');

  await page.goto('/today');
  await page.locator('nav').waitFor();

  // index.css collapses every duration to 0.01ms under this attribute
  // rather than removing animations, so elements still reach their final
  // state — the whole point of the CSS-not-JS rule in design/00 §5.1.
  const durations = await page.evaluate(() => {
    const el = document.querySelector('main');
    if (!el) return null;
    const s = getComputedStyle(el);
    return { animation: s.animationDuration, transition: s.transitionDuration };
  });
  // 0.01ms, which Chromium serialises as 1e-05s. Asserted as a number
  // rather than a string so the test is about the duration being
  // effectively zero, not about how a browser formats it.
  expect(parseFloat(durations?.animation ?? '1')).toBeLessThan(0.001);
  expect(parseFloat(durations?.transition ?? '1')).toBeLessThan(0.001);
});

test('art: off removes every plate and the content is still readable', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);
  await openAppearance(page);

  await page.getByRole('button', { name: 'Off', exact: true }).first().click();
  await expect.poll(() => rootData(page, 'art')).toBe('off');

  await page.goto('/today');
  await page.locator('nav').waitFor();

  const layers = page.locator('.art-layer');
  const count = await layers.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(layers.nth(i)).toHaveCSS('opacity', '0');
  }

  // design/00 §2.5: every screen must look finished with zero art, so
  // the quest rows are still all there and still tappable.
  await expect(page.getByRole('button', { name: 'Complete CAREER' })).toBeVisible();
});

test('appearance settings survive resetting the arc', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);
  await openAppearance(page);

  await page.getByTestId('theme-abyss').click();
  await page.getByRole('button', { name: 'L', exact: true }).click();
  await expect.poll(() => rootData(page, 'theme')).toBe('abyss');
  await expect.poll(() => rootData(page, 'textScale')).toBe('l');

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByTestId('settings-about-row').click();
  await page.getByTestId('reset-arc-row').click();
  await page.getByTestId('reset-arc-confirm').click();

  // The arc is gone; the device preference is not. design/03 §2 makes
  // that explicit — re-onboarding should not reset your text size.
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect.poll(() => rootData(page, 'theme')).toBe('abyss');
  await expect.poll(() => rootData(page, 'textScale')).toBe('l');
});
