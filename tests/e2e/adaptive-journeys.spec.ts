// platform/05 loop 11.5: P1-P7 through the UI. Each journey (tests/fixtures/personas/journeys.ts) is replayed tap by tap in the browser, on the
// build with NEW_ONBOARDING on: the questions the engine asks, in the order it asks them, answered as the persona would. Then the Reveal,
// the System coming online, and every quest on Today.
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_CONFIG } from '../../src/engine/config';
import { localDate } from '../../src/engine/time';
import { SKIP } from '../../src/onboarding/types';
import { JOURNEYS } from '../fixtures/personas/journeys';
import { walkJourney, type JourneyStep } from '../engine/support/journeyWalk';

const MAX_MS = 3 * 60_000;

async function perform(page: Page, step: JourneyStep): Promise<void> {
  await expect(page.locator(`[data-testid="question-${step.key}"]`)).toBeVisible();
  if (step.value === SKIP) {
    await page.getByRole('button', { name: 'Skip' }).click();
  } else {
    if (step.given) {
      switch (step.kind) {
        case 'single_card':
        case 'action_card':
          await page.locator(`[role="radio"][data-value="${String(step.value)}"]`).click();
          break;
        case 'multi_card': {
          // Untick what is not wanted, then tick what is, in the order the person gave it: the order is their ranking.
          const wanted = step.value as string[];
          for (const option of step.options) {
            const box = page.locator(`[role="checkbox"][data-value="${option}"]`);
            if (!wanted.includes(option) && (await box.getAttribute('aria-checked')) === 'true') await box.click();
          }
          for (const option of wanted) {
            const box = page.locator(`[role="checkbox"][data-value="${option}"]`);
            if ((await box.getAttribute('aria-checked')) !== 'true') await box.click();
          }
          break;
        }
        case 'rank':
          break;
        default:
          await page.getByTestId('answer').fill(String(step.value));
      }
    }
    await page.getByRole('button', { name: /^(Begin|Next)$/ }).click();
  }
  await expect(page.locator(`[data-testid="question-${step.key}"]`)).toHaveCount(0);
}

test.describe('P1-P7 through the UI', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const journey of JOURNEYS) {
    test(`${journey.id} (${journey.persona}) ${journey.label}: answered, revealed, bound, and on Today`, async ({ page }) => {
      test.setTimeout(MAX_MS);
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });

      const today = localDate(new Date().toISOString(), 'Asia/Kolkata', DEFAULT_CONFIG.arc.dayBoundaryHour);
      const { steps } = walkJourney(journey.answers(today), today);

      await page.goto('/onboarding');
      await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
      await page.locator('[role="radio"][data-value="guided"]').click();
      await page.getByRole('button', { name: 'Begin' }).click();
      for (const step of steps) await perform(page, step);

      await expect(page.getByTestId('reveal')).toBeVisible();
      const designations = await page.getByTestId('reveal-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-designation') ?? ''));
      expect(designations.length).toBeGreaterThanOrEqual(4);
      expect(new Set(designations).size).toBe(designations.length);
      // Nothing to correct: no error, no warning to acknowledge.
      await expect(page.getByTestId('issues')).toHaveCount(0);
      const initialise = page.getByRole('button', { name: 'Initialise system' });
      await expect(initialise).toBeEnabled();
      await initialise.click();

      await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
      await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
      for (const designation of designations) await expect(page.getByText(designation, { exact: false }).first()).toBeVisible();
      expect(await page.evaluate(() => [localStorage.getItem('onboarding_draft'), localStorage.getItem('onboarding_pins')])).toEqual([null, null]);
      expect(problems).toEqual([]);
    });
  }
});
