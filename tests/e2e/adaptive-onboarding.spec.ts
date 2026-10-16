// platform/05 loop 10.4: a stranger's way in. Against the build with NEW_ONBOARDING (and so ENGINE_V2) on, a person with no arc answers the
// Quick interview, is shown the System it describes, brings it online, and finds those quests on Today. One journey per preset: the
// preset's engines, chosen by area and resolution the way a person would. Scripted, it takes well under two minutes.
import { expect, test, type Page } from '@playwright/test';
import { ARCHETYPES } from '../../src/library/archetypes';
import { PRESETS } from '../../src/library/presets';

const MAX_SCRIPTED_MS = 120_000;

/** The areas and resolutions that make a preset's engines: one area per archetype's area, the archetype as the resolution. */
function choicesFor(presetId: string): { areas: string[]; resolution: Record<string, string> } {
  const preset = PRESETS.find((candidate) => candidate.id === presetId)!;
  const resolution: Record<string, string> = {};
  for (const domain of preset.domains) {
    const area = ARCHETYPES[domain.archetypeId]!.area;
    if (!(area in resolution)) resolution[area] = domain.archetypeId;
  }
  const areas = Object.keys(resolution).slice(0, 6);
  return { areas, resolution };
}

async function next(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Begin|Next)$/ }).click();
}

async function currentKey(page: Page): Promise<string> {
  const question = page.locator('[data-testid^="question-"]').first();
  await expect(question).toBeVisible();
  return (await question.getAttribute('data-testid'))!.replace('question-', '');
}

/** Opens the new arc's way in and says how much to tell. */
async function begin(page: Page, tier: 'quick' | 'guided'): Promise<void> {
  await page.goto('/onboarding');
  await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('tier-choice')).toBeVisible();
  await page.locator(`[role="radio"][data-value="${tier}"]`).click();
  await page.getByRole('button', { name: 'Begin' }).click();
}

/** Answers by what is asked; anything not named takes the System's own default. */
async function interview(page: Page, areas: string[], resolution: Record<string, string>, fill: Record<string, string> = {}, pick: Record<string, string> = {}): Promise<void> {
  for (let guard = 0; guard < 150; guard++) {
    if (await page.getByTestId('reveal').isVisible()) return;
    const key = await currentKey(page);
    if (key === 'name') await page.getByTestId('answer').fill('Ada');
    else if (key in fill) await page.getByTestId('answer').fill(fill[key]!);
    else if (key in pick) await page.locator(`[role="radio"][data-value="${pick[key]}"]`).click();
    else if (key === 'areas') for (const area of areas) await page.locator(`[role="checkbox"][data-value="${area}"]`).click();
    else if (key.startsWith('resolution@')) {
      const wanted = resolution[key.split('@')[1]!];
      if (wanted) await page.locator(`[role="radio"][data-value="${wanted}"]`).click();
    }
    await next(page);
    // The next question (or the reveal) replaces this one.
    await expect(page.locator(`[data-testid="question-${key}"]`)).toHaveCount(0);
  }
  throw new Error('the interview did not reach the Reveal');
}

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
