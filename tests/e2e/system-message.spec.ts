import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * design/04-SYSTEM-MESSAGE-ENGINE.md §19, tests 12-15.
 *
 * The properties under test are the ones that separate this feature from
 * "we added random motivational quotes": the line is chosen for a state,
 * it is stable while that state is, and it moves when the state does.
 */

/** 10:00Z is 15:30 IST — an afternoon, safely inside an open day. */
const AFTERNOON = '2026-09-05T10:00:00Z';

const transmission = (page: Page) => page.getByTestId('system-transmission');

async function transmissionText(page: Page): Promise<string> {
  const text = await transmission(page).locator('p[role="status"]').textContent();
  return (text ?? '').trim();
}

test('the System states a condition on Today', async ({ page }) => {
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);

  await expect(transmission(page)).toBeVisible();

  const text = await transmissionText(page);
  expect(text.length).toBeGreaterThan(0);
  // The voice: capitals, ending in a full stop. Not a quote card.
  expect(text).toBe(text.toUpperCase());
  expect(text.endsWith('.')).toBe(true);
  expect(text).not.toContain('"');

  // The receipt under the decree — the numbers that justify the sentence.
  await expect(transmission(page)).toContainText('CLEARED');
  await expect(transmission(page)).toContainText('XP');
});

test('the existing system line is untouched by the new surface', async ({ page }) => {
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);

  // design/00 §10's contract. The transmission is additive; the evidence
  // line keeps its testid, its position and its content source.
  await expect(page.getByTestId('system-line')).toBeVisible();
  const evidence = await page.getByTestId('system-line').textContent();
  expect((evidence ?? '').length).toBeGreaterThan(0);
  expect(evidence).not.toBe(await transmissionText(page));
});

test('the message does not change on reload or on re-navigation', async ({ page }) => {
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);

  const first = await transmissionText(page);

  // A round trip through another tab: Today remounts and re-resolves.
  await page.getByRole('link', { name: 'SKILLS' }).click();
  await expect(page.getByRole('heading', { name: 'SKILLS' })).toBeVisible();
  await page.getByRole('link', { name: 'TODAY' }).click();
  await expect(transmission(page)).toBeVisible();
  expect(await transmissionText(page)).toBe(first);

  // A hard refresh: the cache lives in IndexedDB, not in memory.
  await page.reload();
  await expect(transmission(page)).toBeVisible();
  expect(await transmissionText(page)).toBe(first);
});

test('the System speaks again once the day has actually moved', async ({ page }) => {
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);
  await expect(page.getByTestId('quest-row-career')).toBeVisible();

  const zeroProgress = await transmissionText(page);

  // Two core quests is 200 of 500 — out of ZERO, through STARTED, into
  // BUILDING. Crossing a band is exactly what the fingerprint is for.
  //
  // Addressed by row testid rather than by the button's accessible name:
  // the quest titles are display copy and have been renamed once already
  // in this redesign, and what this spec is about is the message engine,
  // not what the career quest happens to be called this week.
  for (const key of ['career', 'dsa']) {
    await page
      .getByTestId(`quest-row-${key}`)
      .getByRole('button', { name: /^Complete / })
      .click();
  }

  // Wait on the second completion landing, not merely on the text
  // changing: each toggle is its own projections rebuild, and the first
  // one alone already moves the message off ZERO. Polling the receipt is
  // what makes this assert the state it means to assert.
  //
  // Whitespace-insensitive because the receipt is a three-tile HUD whose
  // exact spacing is display copy, and this spec is about the engine.
  await expect
    .poll(async () => (await transmission(page).innerText()).replace(/\s+/g, ''), {
      timeout: 10000,
    })
    .toContain('2/6');

  const moved = await transmissionText(page);
  expect(moved).not.toBe(zeroProgress);
  expect(moved).toBe(moved.toUpperCase());
});

test('the message is readable with motion disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);

  // Nothing about the meaning may depend on an animation reaching its
  // last frame — the block is in its final layout position from the start.
  await expect(transmission(page)).toBeVisible();
  const text = await transmissionText(page);
  expect(text.length).toBeGreaterThan(0);
  await expect(transmission(page).locator('p[role="status"]')).toHaveCSS('opacity', '1');
});
