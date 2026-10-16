// platform/05 loop 10.4: a stranger's way in. Against the build with NEW_ONBOARDING (and so ENGINE_V2) on, a person with no arc answers the
// Quick interview, is shown the System it describes, brings it online, and finds those quests on Today. One journey per preset: the
// preset's engines, chosen by area and resolution the way a person would. Scripted, it takes well under two minutes.
import { expect, test } from '@playwright/test';
import { PRESETS } from '../../src/library/presets';
import { begin, choicesFor, interview, next } from './support/adaptive';

const MAX_SCRIPTED_MS = 120_000;

test.describe('Quick Awakening', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const preset of PRESETS) {
    test(`${preset.label}: interview, reveal, activate, and the quests are on Today`, async ({ page }) => {
      test.setTimeout(MAX_SCRIPTED_MS);
      const started = Date.now();
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });

      const { areas, resolution } = choicesFor(preset.id);
      await begin(page, 'quick');
      await interview(page, areas, resolution);

      const designations = await page.getByTestId('reveal-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-designation') ?? ''));
      expect(designations.length).toBeGreaterThanOrEqual(4);
      await page.getByRole('button', { name: 'Initialise system' }).click();

      await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
      await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
      for (const designation of designations) await expect(page.getByText(designation, { exact: false }).first()).toBeVisible();

      expect(Date.now() - started).toBeLessThan(MAX_SCRIPTED_MS);
      expect(problems).toEqual([]);
    });
  }

  test('an arc that exists is never re-interviewed', async ({ page }) => {
    const { areas, resolution } = choicesFor('fitness');
    await begin(page, 'quick');
    await interview(page, areas, resolution);
    await page.getByRole('button', { name: 'Initialise system' }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/today/);
  });
});

test.describe('Resuming the interview', () => {
  test.use({ reducedMotion: 'reduce' });

  test('an app kill mid-interview loses nothing, and the draft is gone once the System is online', async ({ context, page }) => {
    await begin(page, 'quick');
    await page.getByTestId('answer').fill('Ada');
    await next(page);
    await expect(page.getByTestId('question-areas')).toBeVisible();
    for (const area of ['career', 'body', 'creativity']) await page.locator(`[role="checkbox"][data-value="${area}"]`).click();
    await next(page);
    await expect(page.getByTestId('question-priorities')).toBeVisible();
    await next(page);
    await expect(page.getByTestId('question-resolution@career')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('onboarding_draft'))).toContain('"career"');

    // The kill: the tab goes away entirely and the app is opened again.
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto('/onboarding');
    await expect(reopened.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    await expect(reopened.getByTestId('question-resolution@career')).toBeVisible();

    // Going back finds the earlier answers where they were left.
    await reopened.getByRole('button', { name: 'Back' }).click();
    await expect(reopened.getByTestId('question-priorities')).toBeVisible();
    await reopened.getByRole('button', { name: 'Back' }).click();
    await expect(reopened.locator('[role="checkbox"][data-value="creativity"]')).toHaveAttribute('aria-checked', 'true');
    await expect(reopened.locator('[role="checkbox"][data-value="knowledge"]')).toHaveAttribute('aria-checked', 'false');

    await interview(reopened, [], {});
    await reopened.getByRole('button', { name: 'Initialise system' }).click();
    await expect(reopened).toHaveURL(/\/today/, { timeout: 30_000 });
    expect(await reopened.evaluate(() => localStorage.getItem('onboarding_draft'))).toBeNull();
  });
});

test.describe('Guided', () => {
  test.use({ reducedMotion: 'reduce' });

  test('P2, a student with an exam: the arc is aligned to the exam date and the trigger is kept', async ({ page }) => {
    test.setTimeout(MAX_SCRIPTED_MS * 2);
    const exam = new Date();
    exam.setUTCDate(exam.getUTCDate() + 100);
    const examDate = exam.toISOString().slice(0, 10);
    await begin(page, 'guided');
    await interview(page, ['knowledge', 'body', 'relationships'], { knowledge: 'exam-prep' }, {
      'examDate@knowledge': examDate,
      'subjects@knowledge': 'Anatomy, Physiology, Pathology',
      'triggerTime@knowledge': '07:30',
      'triggerPlace@knowledge': 'the desk',
      'triggerAction@knowledge': 'open the question bank',
    });
    // The System said what it did with the date.
    await expect(page.getByTestId('reveal')).toContainText(`to ${examDate}`);
    await page.getByRole('button', { name: 'Initialise system' }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });

    // The sentence is part of the arc: it is on the reminder for the exam quest.
    await page.goto('/profile/settings/system');
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText('open the question bank', { exact: false }).first()).toBeVisible();
  });
});

test.describe('Things of their own', () => {
  test.use({ reducedMotion: 'reduce' });

  test('P7: five custom domains and an area, each under its own name; the validator is clean and Today shows them', async ({ page }) => {
    test.setTimeout(MAX_SCRIPTED_MS * 3);
    await begin(page, 'guided');
    await interview(page, ['body'], { body: 'strength-movement' }, { customs: 'Piano, Gallery outreach, Cold shower, Evening shutdown, Pushups' }, {
      'customAction@custom1': 'custom:practice_item',
      'customAction@custom2': 'custom:pipeline',
      'customAction@custom3': 'custom:time_window',
      'customAction@custom4': 'custom:checklist',
      'customAction@custom5': 'custom:threshold',
    });
    const designations = await page.getByTestId('reveal-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-designation') ?? ''));
    for (const stem of ['DRILL', 'REACH', 'HOUR', 'ROUTINE', 'MEASURE']) expect(designations).toContain(stem);
    // Nothing blocks activation: no error is shown and the button is live.
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Initialise system' }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    for (const stem of ['DRILL', 'REACH', 'HOUR', 'ROUTINE', 'MEASURE']) await expect(page.getByText(stem, { exact: false }).first()).toBeVisible();
  });
});

test.describe('Adjusting the Reveal', () => {
  test.use({ reducedMotion: 'reduce' });

  test('an adjusted field is pinned, says so, and survives changing an answer', async ({ page }) => {
    test.setTimeout(MAX_SCRIPTED_MS);
    await begin(page, 'quick');
    await interview(page, ['career', 'body'], {}, {}, {});
    const first = page.getByTestId('reveal-card').first();
    const designation = await first.getAttribute('data-designation');
    await expect(first).toContainText('BECAUSE: YOU CHOSE');

    await first.getByRole('button', { name: `Adjust ${designation}` }).click();
    const good = page.getByRole('spinbutton', { name: /Good day/ });
    await good.fill('7');
    await page.getByRole('button', { name: 'Pin these' }).click();
    await expect(page.getByTestId('reveal-card').first()).toContainText('PINNED');
    await expect(page.getByTestId('reveal-card').first()).toContainText('YOU ADJUSTED IT.');

    // Change an answer (the arc length, the last question) and come back: the pin is still there, on the same card.
    await page.getByRole('button', { name: 'Change' }).click();
    await expect(page.getByTestId('question-length')).toBeVisible();
    await page.locator('[role="radio"][data-value="180"]').click();
    await next(page);
    await expect(page.getByTestId('reveal')).toBeVisible();
    await expect(page.getByTestId('reveal')).toContainText('180 days');
    await expect(page.getByTestId('reveal-card').first()).toContainText('PINNED');
    await expect(page.getByTestId('reveal-card').first()).toContainText('YOU ADJUSTED IT.');

    // Pinning the arc holds it against a later change too, and a pin can be released.
    await page.getByRole('button', { name: 'Adjust the arc' }).click();
    await page.getByRole('spinbutton', { name: /Arc length/ }).fill('90');
    await page.getByRole('button', { name: 'Pin this length' }).click();
    await expect(page.getByTestId('reveal-arc')).toContainText('90 days');
    await page.getByRole('button', { name: 'Release every pin' }).click();
    await expect(page.getByTestId('reveal-arc')).toContainText('180 days');
    await expect(page.getByTestId('reveal-card').first()).not.toContainText('PINNED');

    await page.getByRole('button', { name: 'Initialise system' }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
    expect(await page.evaluate(() => [localStorage.getItem('onboarding_draft'), localStorage.getItem('onboarding_pins')])).toEqual([null, null]);
  });
});

test.describe('Binding the System', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a warning needs one acknowledgement, and its fix is one tap', async ({ page }) => {
    test.setTimeout(MAX_SCRIPTED_MS);
    await begin(page, 'quick');
    await interview(page, ['career', 'body'], {}, {}, {});
    const first = page.getByTestId('reveal-card').first();
    const designation = await first.getAttribute('data-designation');
    await first.getByRole('button', { name: `Adjust ${designation}` }).click();
    await page.getByTestId('own-designation').fill('a designation far too long to use');
    await page.getByRole('button', { name: 'Pin these' }).click();

    await expect(page.getByTestId('issue-G-DOM-02')).toContainText('THAT DESIGNATION IS NOT AVAILABLE.');
    const initialise = page.getByRole('button', { name: 'Initialise system' });
    await expect(initialise).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Proceed anyway' }).check();
    await expect(initialise).toBeEnabled();
    await page.getByRole('checkbox', { name: 'Proceed anyway' }).uncheck();
    await expect(initialise).toBeDisabled();

    await page.getByTestId('issue-G-DOM-02').getByRole('button', { name: /^Use / }).click();
    await expect(page.getByTestId('issue-G-DOM-02')).toHaveCount(0);
    await expect(initialise).toBeEnabled();
    await initialise.click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
  });

  test('an invalid System cannot be activated: a Reveal left open past the window is refused, and one tap rebuilds it', async ({ page }) => {
    test.setTimeout(MAX_SCRIPTED_MS);
    await page.clock.install({ time: new Date('2026-09-01T09:00:00Z') });
    await begin(page, 'quick');
    await interview(page, ['career', 'body'], {}, {}, {});
    const initialise = page.getByRole('button', { name: 'Initialise system' });
    await expect(initialise).toBeEnabled();
    await expect(page.getByTestId('issues')).toHaveCount(0);

    // Forty-nine days pass with the Reveal open; the System is judged against the date it is now.
    // (In steps: the clock takes a 32-bit number of milliseconds, about 24 days, at a time.)
    for (const days of [20, 20, 9]) await page.clock.fastForward(days * 24 * 60 * 60 * 1000);
    await expect(page.getByTestId('issue-V-ARC-03')).toContainText('THE ARC START IS OUTSIDE THE ACTIVATION WINDOW.');
    await expect(initialise).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: 'Proceed anyway' })).toHaveCount(0); // an error is not acknowledged away

    await page.getByTestId('issue-V-ARC-03').getByRole('button', { name: 'Begin today' }).click();
    await expect(page.getByTestId('issue-V-ARC-03')).toHaveCount(0);
    await expect(initialise).toBeEnabled();
    await expect(page.getByTestId('reveal-arc')).toContainText('from 2026-10-20');
    await initialise.click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
  });
});
