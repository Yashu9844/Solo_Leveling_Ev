// Shared by the adaptive-onboarding e2e specs: scripted ways through the new onboarding.
import { expect, type Page } from '@playwright/test';
import { ARCHETYPES } from '../../../src/library/archetypes';
import { PRESETS } from '../../../src/library/presets';

/** The areas and resolutions that make a preset's engines: one area per archetype's area, the archetype as the resolution. */
export function choicesFor(presetId: string): { areas: string[]; resolution: Record<string, string> } {
  const preset = PRESETS.find((candidate) => candidate.id === presetId)!;
  const resolution: Record<string, string> = {};
  for (const domain of preset.domains) {
    const area = ARCHETYPES[domain.archetypeId]!.area;
    if (!(area in resolution)) resolution[area] = domain.archetypeId;
  }
  const areas = Object.keys(resolution).slice(0, 6);
  return { areas, resolution };
}

export async function next(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Begin|Next)$/ }).click();
}

export async function currentKey(page: Page): Promise<string> {
  const question = page.locator('[data-testid^="question-"]').first();
  await expect(question).toBeVisible();
  return (await question.getAttribute('data-testid'))!.replace('question-', '');
}

/** Opens the new arc's way in and says how much to tell. */
export async function begin(page: Page, tier: 'quick' | 'guided'): Promise<void> {
  await page.goto('/onboarding');
  await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('tier-choice')).toBeVisible();
  await page.locator(`[role="radio"][data-value="${tier}"]`).click();
  await page.getByRole('button', { name: 'Begin' }).click();
}

/** Answers by what is asked; anything not named takes the System's own default. */
export async function interview(page: Page, areas: string[], resolution: Record<string, string>, fill: Record<string, string> = {}, pick: Record<string, string> = {}): Promise<void> {
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
