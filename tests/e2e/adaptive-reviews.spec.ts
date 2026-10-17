// platform/05 loop 13.x: the reviews of a generated System. Against the build with NEW_ONBOARDING on: a person with a Quick System reviews
// their evening; the System asks one question about one of their own domains, answered with a chip, in the same handful of taps.
import { expect, test } from '@playwright/test';
import { generateBlueprint } from '../../src/generator';
import { p1 } from '../fixtures/personas/p1';
import { personaEventLog } from '../engine/support/personaEventLog';
import { begin, choicesFor, interview } from './support/adaptive';
import { seedGeneratedSystem } from './support/seedDatabase';

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

test.describe('the weekly review of a generated System', () => {
  test('is its own: its rows, no legacy domain names, and a weekly quest to choose and accept', async ({ page }) => {
    test.setTimeout(120_000);
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push('console: ' + message.text()); });

    // A generated System and twenty-five days of living in it, seeded the way a rebuild derives them.
    const { blueprint } = generateBlueprint(p1.draft);
    const events = personaEventLog(blueprint, p1.seed, { kind: 'steady', days: 25 });
    const now = '2026-09-26T10:00:00Z';
    await page.clock.install({ time: new Date(now) });
    await seedGeneratedSystem(page, blueprint, events, now);
    await page.goto('/progress');
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });

    await page.getByRole('button', { name: 'SYSTEM' }).click();
    await page.getByRole('button', { name: 'Weekly review' }).click();
    const sheet = page.getByTestId('weekly-review');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('SYSTEM EVALUATION')).toBeVisible();

    // The owner's rows (DSA, Build, Learn) are the owner's; a generated System's rows are its own, and none shows NaN.
    for (const row of blueprint.reviews.weeklyMetrics ?? []) if (row.key !== 'xpEarned') await expect(sheet.getByText(row.label, { exact: true }).first()).toBeVisible();
    await expect(sheet.getByText('DSA', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('NaN')).toHaveCount(0);

    const offers = sheet.getByTestId('weekly-quest-offers');
    await expect(offers).toBeVisible();
    const accept = offers.getByRole('button', { name: /Accept weekly quest/ });
    expect(await accept.count()).toBeGreaterThanOrEqual(2);
    await accept.first().click();
    // At most one: once a quest is accepted, the others are no longer offered for acceptance.
    await expect(offers.getByRole('button', { name: /Accept weekly quest/ })).toHaveCount(0);
    await expect(offers.getByText('Accepted.')).toBeVisible();

    await sheet.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(sheet).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});

test.describe('the checkpoint questions of a generated System', () => {
  test('the Day-0 baseline asks the System\'s own questions on fixed scales, and saves', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push('console: ' + message.text()); });

    const { areas, resolution } = choicesFor('fitness');
    await begin(page, 'quick');
    await interview(page, areas, resolution);
    await page.getByRole('button', { name: 'Initialise system' }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });

    await page.getByRole('link', { name: 'PROFILE' }).click();
    await page.getByRole('button', { name: 'Complete Day-0 baseline' }).click();
    await expect(page.getByText('at each checkpoint')).toBeVisible();

    // Six self-efficacy, four automaticity and one enjoyment per engine domain (at most four): never the owner's three.
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(11);
    expect(count).toBeLessThanOrEqual(14);
    // The owner's software questions are the owner's.
    await expect(page.getByText('unseen medium DSA problem')).toHaveCount(0);
    await expect(page.getByText('evaluation suite')).toHaveCount(0);

    await page.getByRole('button', { name: 'Save baseline' }).click();
    await expect(page.getByRole('button', { name: 'Complete Day-0 baseline' })).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
