// platform/05 loop 13.x: the reviews of a generated System. Against the build with NEW_ONBOARDING on: a person with a Quick System reviews
// their evening; the System asks one question about one of their own domains, answered with a chip, in the same handful of taps.
import { expect, test } from '@playwright/test';
import { begin, choicesFor, interview } from './support/adaptive';

test.use({ reducedMotion: 'reduce' });

test.describe('the evening review of a generated System', () => {
  test('asks one domain prompt with chips, takes the answer, and closes the day in five taps', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });

    const { areas, resolution } = choicesFor('career-builder');
    await begin(page, 'quick');
    await interview(page, areas, resolution);
    await page.getByRole('button', { name: 'Initialise system' }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });

    await page.getByRole('button', { name: 'Evening review · 25 seconds' }).click();
    const prompt = page.getByTestId('domain-prompt');
    await expect(prompt).toBeVisible();
    const chips = prompt.getByRole('button');
    expect(await chips.count()).toBeGreaterThanOrEqual(2);

    // The taps: the blocker, the domain prompt, Complete day. Energy and focus start at 3, tomorrow's priority is optional, the sleep time has its default.
    await page.getByRole('button', { name: 'Nothing', exact: true }).click();
    await chips.first().click();
    await page.getByRole('button', { name: 'Complete day' }).click();

    await expect(page.getByText(/DAILY REPORT/)).toBeVisible();
    await page.getByText('tap anywhere').click();
    await expect(page.getByRole('button', { name: 'Evening review · 25 seconds' })).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
